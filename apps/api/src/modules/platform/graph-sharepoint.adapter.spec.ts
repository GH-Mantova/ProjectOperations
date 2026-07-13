import { ServiceUnavailableException } from "@nestjs/common";
import {
  ClientSecretCredential,
  CredentialUnavailableError,
  ManagedIdentityCredential
} from "@azure/identity";
import {
  buildSharePointCredential,
  resetSharePointAuthModeLoggedForTests,
  resolveSharePointAuthMode
} from "./graph-sharepoint.adapter";

// Feature: SHAREPOINT_AUTH_MODE — kill the client secret in prod.
// The adapter must select the credential explicitly (no
// DefaultAzureCredential fallback), keep the client-secret path working
// for local/CI, and surface an honest error when managed identity is
// requested outside Azure.

function fakeConfig(entries: Record<string, string | undefined>) {
  return {
    get: <T = string>(key: string): T | undefined => entries[key] as unknown as T | undefined
  };
}

describe("resolveSharePointAuthMode", () => {
  it("defaults to client-secret when unset (no regression)", () => {
    expect(resolveSharePointAuthMode(fakeConfig({}))).toBe("client-secret");
  });

  it("returns client-secret explicitly", () => {
    expect(
      resolveSharePointAuthMode(fakeConfig({ SHAREPOINT_AUTH_MODE: "client-secret" }))
    ).toBe("client-secret");
  });

  it("returns managed-identity when set", () => {
    expect(
      resolveSharePointAuthMode(fakeConfig({ SHAREPOINT_AUTH_MODE: "managed-identity" }))
    ).toBe("managed-identity");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(
      resolveSharePointAuthMode(fakeConfig({ SHAREPOINT_AUTH_MODE: "  Managed-Identity  " }))
    ).toBe("managed-identity");
  });

  it("rejects unknown modes with a specific error", () => {
    expect(() =>
      resolveSharePointAuthMode(fakeConfig({ SHAREPOINT_AUTH_MODE: "default" }))
    ).toThrow(/must be "managed-identity" or "client-secret"/);
  });
});

describe("buildSharePointCredential — client-secret branch", () => {
  beforeEach(() => resetSharePointAuthModeLoggedForTests());

  it("constructs a ClientSecretCredential from AZURE_* env vars", () => {
    const cred = buildSharePointCredential(
      "client-secret",
      fakeConfig({
        AZURE_TENANT_ID: "tenant-a",
        AZURE_CLIENT_ID: "client-a",
        AZURE_CLIENT_SECRET: "secret-a"
      }),
      () => undefined
    );
    expect(cred).toBeInstanceOf(ClientSecretCredential);
  });

  it("falls back to legacy SHAREPOINT_* env vars when AZURE_* are unset", () => {
    const cred = buildSharePointCredential(
      "client-secret",
      fakeConfig({
        SHAREPOINT_TENANT_ID: "tenant-b",
        SHAREPOINT_CLIENT_ID: "client-b",
        SHAREPOINT_CLIENT_SECRET: "secret-b"
      }),
      () => undefined
    );
    expect(cred).toBeInstanceOf(ClientSecretCredential);
  });

  it("throws when tenant/client/secret are missing", () => {
    expect(() =>
      buildSharePointCredential("client-secret", fakeConfig({}), () => undefined)
    ).toThrow(ServiceUnavailableException);
  });

  it("logs the resolved mode exactly once per process", () => {
    const lines: string[] = [];
    buildSharePointCredential(
      "client-secret",
      fakeConfig({
        AZURE_TENANT_ID: "t",
        AZURE_CLIENT_ID: "client-log",
        AZURE_CLIENT_SECRET: "s"
      }),
      (l) => lines.push(l)
    );
    buildSharePointCredential(
      "client-secret",
      fakeConfig({
        AZURE_TENANT_ID: "t",
        AZURE_CLIENT_ID: "client-log",
        AZURE_CLIENT_SECRET: "s"
      }),
      (l) => lines.push(l)
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("client-secret");
    expect(lines[0]).toContain("client-log");
  });
});

describe("buildSharePointCredential — managed-identity branch", () => {
  beforeEach(() => resetSharePointAuthModeLoggedForTests());

  it("constructs a ManagedIdentityCredential (system-assigned) when no client id is set", () => {
    const cred = buildSharePointCredential("managed-identity", fakeConfig({}), () => undefined);
    // The credential is wrapped in an honest-error shim; the underlying
    // credential must exist though. Sanity-check by shape.
    expect(typeof cred.getToken).toBe("function");
  });

  it("logs system-assigned identity mode", () => {
    const lines: string[] = [];
    buildSharePointCredential("managed-identity", fakeConfig({}), (l) => lines.push(l));
    expect(lines).toEqual([
      "SharePoint Graph auth: managed-identity (system-assigned)"
    ]);
  });

  it("logs the user-assigned client id when AZURE_MANAGED_IDENTITY_CLIENT_ID is set", () => {
    const lines: string[] = [];
    buildSharePointCredential(
      "managed-identity",
      fakeConfig({ AZURE_MANAGED_IDENTITY_CLIENT_ID: "user-assigned-guid" }),
      (l) => lines.push(l)
    );
    expect(lines[0]).toContain("user-assigned");
    expect(lines[0]).toContain("user-assigned-guid");
  });

  it("surfaces an honest error naming managed-identity when IMDS is unavailable", async () => {
    // Simulate the outside-Azure case: getToken throws CredentialUnavailableError.
    // Rather than mocking IMDS, force the wrapped shim by pushing the base
    // ManagedIdentityCredential's getToken to reject.
    const cred = buildSharePointCredential("managed-identity", fakeConfig({}), () => undefined);

    // Replace the private base by patching ManagedIdentityCredential.prototype
    // for this test only — the wrapped shim delegates to the prototype method.
    const original = ManagedIdentityCredential.prototype.getToken;
    ManagedIdentityCredential.prototype.getToken = async () => {
      throw new CredentialUnavailableError("ManagedIdentityCredential: no IMDS endpoint");
    };

    try {
      let caught: Error | undefined;
      try {
        await cred.getToken(["https://graph.microsoft.com/.default"]);
      } catch (e) {
        caught = e as Error;
      }
      expect(caught).toBeInstanceOf(ServiceUnavailableException);
      expect(caught?.message).toMatch(/SHAREPOINT_AUTH_MODE=managed-identity/);
      expect(caught?.message).toMatch(/no managed identity is available/);
      expect(caught?.message).toMatch(/set SHAREPOINT_AUTH_MODE=client-secret/);
    } finally {
      ManagedIdentityCredential.prototype.getToken = original;
    }
  });

  it("does not swallow non-credential-unavailable errors (they bubble raw)", async () => {
    const cred = buildSharePointCredential("managed-identity", fakeConfig({}), () => undefined);
    const original = ManagedIdentityCredential.prototype.getToken;
    ManagedIdentityCredential.prototype.getToken = async () => {
      throw new Error("upstream Graph 500");
    };

    try {
      await expect(cred.getToken(["https://graph.microsoft.com/.default"])).rejects.toThrow(
        /upstream Graph 500/
      );
    } finally {
      ManagedIdentityCredential.prototype.getToken = original;
    }
  });
});
