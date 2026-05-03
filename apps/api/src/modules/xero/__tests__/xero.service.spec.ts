import { BadRequestException } from "@nestjs/common";
import { XeroService } from "../xero.service";

// Tests focus on the audit-M1 contract: raw upstream Xero error text MUST
// NEVER reach the BadRequestException message. Category mapping is best-
// effort — sanitiseProviderError's status-code regex is provider-specific
// (Anthropic/OpenAI) so Xero status-only errors fall through to "unknown",
// which is the documented expected behaviour per the audit. We verify that
// keyword-bearing errors do classify, AND that all paths produce safe text.

type AnyMock = jest.Mock;

function buildService(opts: {
  syncContactsImpl?: AnyMock;
  createInvoicesImpl?: AnyMock;
  client?: { id: string; name: string; xeroContactId: string | null } | null;
  claim?: unknown;
} = {}) {
  const xeroClientUpdate = jest.fn(async () => ({ body: { contacts: [] } }));
  const xeroClientCreate = opts.syncContactsImpl ?? jest.fn(async () => ({
    body: { contacts: [{ contactID: "x-1" }] }
  }));
  const createInvoices = opts.createInvoicesImpl ?? jest.fn(async () => ({
    body: { invoices: [{ invoiceID: "inv-1" }] }
  }));
  const xero = {
    accountingApi: {
      updateContact: xeroClientUpdate,
      createContacts: xeroClientCreate,
      createInvoices
    }
  };

  const prisma = {
    client: {
      findUnique: jest.fn(async () =>
        "client" in opts ? opts.client : { id: "client-1", name: "Acme", xeroContactId: null }
      ),
      findMany: jest.fn(async () => [] as Array<{ id: string }>),
      update: jest.fn(async () => ({}))
    },
    progressClaim: {
      findUnique: jest.fn(async () => opts.claim ?? null)
    },
    xeroSyncLog: {
      create: jest.fn(async () => ({}))
    }
  };
  const config = { get: jest.fn() };

  const service = new XeroService(prisma as never, config as never);
  // Bypass real OAuth + DB lookup. Tests focus on the catch sanitisation.
  Object.defineProperty(service, "getAuthorizedClient", {
    value: jest.fn(async () => ({ client: xero, tenantId: "tenant-1" }))
  });
  return { service, prisma, xeroClientCreate, createInvoices };
}

async function captureBadRequest(promise: Promise<unknown>): Promise<BadRequestException> {
  try {
    await promise;
    throw new Error("Expected BadRequestException to be thrown");
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return err;
  }
}

describe("XeroService — error sanitisation (audit M1)", () => {
  describe("syncContact — defence-in-depth contract", () => {
    it("never reflects script payloads from upstream into the thrown message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("Xero API 401: invalid_token <script>alert(1)</script>");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).not.toContain("<script>");
      expect(exc.message).not.toContain("invalid_token");
    });

    it("never reflects HTML attribute injection from upstream into the thrown message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error('Xero API 503: <img onerror=alert(1) src=x>');
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).not.toContain("<img");
      expect(exc.message).not.toContain("onerror");
    });

    it("preserves the 'Xero sync:' prefix on every thrown message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("anything goes here");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message.startsWith("Xero sync:")).toBe(true);
    });
  });

  describe("syncContact — category mapping", () => {
    it("maps rate-limit keywords to the rate-limit user message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("rate limit exceeded — too many requests");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).toMatch(/rate limit/i);
    });

    it("maps network errors (ECONNREFUSED) to the network user message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("ECONNREFUSED 127.0.0.1:443");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).toMatch(/Could not reach AI provider|connection/i);
    });

    it("maps unauthorized keyword to the auth user message", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("unauthorized — token expired");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).toMatch(/authentication/i);
    });

    it("falls through to the unknown user message for unrecognised shapes (acceptable per audit)", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("Some random Xero quirk we have not seen before");
        })
      });
      const exc = await captureBadRequest(service.syncContact("client-1", "user-1"));
      expect(exc.message).not.toContain("Some random Xero quirk");
      expect(exc.message).toMatch(/An error occurred/i);
    });
  });

  describe("syncContact — server-side observability", () => {
    it("logs the full original error message server-side with category prefix", async () => {
      const { service } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("rate limit exceeded — full debug context here");
        })
      });
      const logSpy = jest
        .spyOn(
          (service as unknown as { logger: { error: (msg: string) => void } }).logger,
          "error"
        )
        .mockImplementation(() => undefined);
      await service.syncContact("client-1", "user-1").catch(() => undefined);
      const logged = logSpy.mock.calls.map((args) => args[0] as string).join("\n");
      expect(logged).toContain("full debug context here");
      expect(logged).toContain("category=rate-limit");
    });

    it("stores the full original error in xeroSyncLog.errorText (server-side audit row)", async () => {
      const { service, prisma } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("unauthorized — full upstream detail");
        })
      });
      await service.syncContact("client-1", "user-1").catch(() => undefined);
      const calls = (prisma.xeroSyncLog.create as AnyMock).mock.calls;
      const failedLog = calls.find((c) => c[0]?.data?.status === "failed");
      const errorText = failedLog?.[0]?.data?.errorText as string;
      // The server-side log column gets the raw upstream text (the
      // sanitiser's logMessage). The sanitised user-facing string is
      // never stored — operators want the real detail for debugging.
      expect(errorText).toContain("full upstream detail");
    });
  });

  describe("createInvoiceFromProgressClaim — defence-in-depth contract", () => {
    const baseClaim = {
      claimNumber: "PC-001",
      contract: {
        project: {
          client: { xeroContactId: "x-1" }
        }
      },
      lineItems: [{ description: "Work", thisClaimAmount: 100 }]
    };

    it("never reflects raw upstream text into the thrown message", async () => {
      const { service } = buildService({
        claim: baseClaim,
        createInvoicesImpl: jest.fn(async () => {
          throw new Error("Xero API 401: <img onerror=alert(1) src=x>");
        })
      });
      const exc = await captureBadRequest(
        service.createInvoiceFromProgressClaim("claim-1", "user-1")
      );
      expect(exc.message).not.toContain("<img");
      expect(exc.message).not.toContain("onerror");
    });

    it("preserves the 'Xero invoice push:' prefix on every thrown message", async () => {
      const { service } = buildService({
        claim: baseClaim,
        createInvoicesImpl: jest.fn(async () => {
          throw new Error("rate limit exceeded");
        })
      });
      const exc = await captureBadRequest(
        service.createInvoiceFromProgressClaim("claim-1", "user-1")
      );
      expect(exc.message.startsWith("Xero invoice push:")).toBe(true);
      expect(exc.message).toMatch(/rate limit/i);
    });
  });

  describe("syncAllContacts — bulk results aggregation", () => {
    it("sanitises per-client errors in the results array (no raw upstream text)", async () => {
      const { service, prisma } = buildService({
        syncContactsImpl: jest.fn(async () => {
          throw new Error("unauthorized <script>alert(1)</script>");
        })
      });
      (prisma.client.findMany as AnyMock).mockResolvedValueOnce([{ id: "client-1" }]);
      const result = (await service.syncAllContacts("user-1")) as {
        total: number;
        results: Array<{ status: string; error?: string }>;
      };
      const failed = result.results.find((r) => r.status === "failed");
      expect(failed?.error).toBeDefined();
      expect(failed?.error).not.toContain("<script>");
      // unauthorized → auth category → categorised user message
      expect(failed?.error).toMatch(/authentication/i);
    });
  });
});
