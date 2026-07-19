import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../../prisma/prisma.service";
import { EmailService } from "../email.service";
import { OutlookEmailProvider, resetMailAuthModeLoggedForTests } from "../providers/outlook.provider";

/**
 * verifyConnection() unit coverage — exercises the structured
 * EmailConnectionDiagnosis returned to the admin email-test route. No real
 * Graph traffic: the Outlook provider's `verifyConnection` is spied so we can
 * simulate the wire success/failure independently of credential resolution.
 *
 * Fails honestly per sot/01 §6 — the diagnosis must name the exact missing env
 * var (client-secret path) and must never expose a secret value.
 */

type EmailConfigRecord = { provider: string | null; senderAddress: string | null } | null;

function makePrisma(opts: {
  email?: EmailConfigRecord;
  companyEmail?: string | null;
} = {}): PrismaService {
  return {
    emailProviderConfig: {
      findUnique: jest.fn().mockResolvedValue(opts.email ?? null)
    },
    companyProfile: {
      findUnique: jest.fn().mockResolvedValue(
        opts.companyEmail === undefined
          ? { primaryEmail: "sender@example.com" }
          : { primaryEmail: opts.companyEmail }
      )
    }
  } as unknown as PrismaService;
}

function makeConfig(map: Record<string, string | undefined>): ConfigService {
  return { get: <T = string>(key: string) => map[key] as unknown as T | undefined } as unknown as ConfigService;
}

const MAIL_ENV = [
  "AZURE_MAIL_TENANT_ID",
  "AZURE_MAIL_CLIENT_ID",
  "AZURE_MAIL_CLIENT_SECRET",
  "SHAREPOINT_TENANT_ID",
  "SHAREPOINT_CLIENT_ID",
  "SHAREPOINT_CLIENT_SECRET"
] as const;

describe("EmailService.verifyConnection() diagnosis", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    resetMailAuthModeLoggedForTests();
    for (const k of MAIL_ENV) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of MAIL_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    jest.restoreAllMocks();
  });

  it("success path — client-secret creds present, provider verifies", async () => {
    const SECRET_VALUE = "NEVER-LEAK-ME-42";
    process.env.AZURE_MAIL_TENANT_ID = "tenant-abc";
    process.env.AZURE_MAIL_CLIENT_ID = "client-abc";
    process.env.AZURE_MAIL_CLIENT_SECRET = SECRET_VALUE;
    const spy = jest
      .spyOn(OutlookEmailProvider.prototype, "verifyConnection")
      .mockResolvedValue({ message: "Email connection verified" });

    const service = new EmailService(makePrisma(), makeConfig({}));
    const result = await service.verifyConnection();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.message).toBe("Email connection verified");
    expect(result.diagnosis).toEqual({
      provider: "outlook",
      authMode: "client-secret",
      senderAddress: "sender@example.com",
      credentialResolved: true,
      detail: expect.stringContaining("client-secret")
    });
    // Failure-honesty: secret VALUE must never appear anywhere in the
    // returned envelope. Names and booleans are fine; values are not.
    expect(JSON.stringify(result)).not.toContain(SECRET_VALUE);
  });

  it("failure path — missing AZURE_MAIL_CLIENT_SECRET, credential cannot be built", async () => {
    process.env.AZURE_MAIL_TENANT_ID = "t";
    process.env.AZURE_MAIL_CLIENT_ID = "c";
    // secret deliberately absent
    const verifySpy = jest.spyOn(OutlookEmailProvider.prototype, "verifyConnection");

    const service = new EmailService(makePrisma(), makeConfig({}));
    const result = await service.verifyConnection();

    expect(verifySpy).not.toHaveBeenCalled(); // never reached the wire
    expect(result.success).toBe(false);
    expect(result.diagnosis.provider).toBe("outlook");
    expect(result.diagnosis.authMode).toBe("client-secret");
    expect(result.diagnosis.credentialResolved).toBe(false);
    expect(result.diagnosis.senderAddress).toBe("sender@example.com");
    // Names the EXACT missing env var — mirrors #602 failure-honesty rule.
    expect(result.diagnosis.detail).toMatch(/AZURE_MAIL_CLIENT_SECRET/);
    expect(result.message).toMatch(/AZURE_MAIL_CLIENT_SECRET/);
  });

  it("failure path — invalid MAIL_AUTH_MODE surfaces with authMode=null and credentialResolved=false", async () => {
    const service = new EmailService(makePrisma(), makeConfig({ MAIL_AUTH_MODE: "oauth" }));
    const result = await service.verifyConnection();

    expect(result.success).toBe(false);
    expect(result.diagnosis.authMode).toBeNull();
    expect(result.diagnosis.credentialResolved).toBe(false);
    expect(result.diagnosis.detail).toMatch(/MAIL_AUTH_MODE/);
  });

  it("failure path — Graph verifyConnection RPC fails after credential builds", async () => {
    process.env.AZURE_MAIL_TENANT_ID = "t";
    process.env.AZURE_MAIL_CLIENT_ID = "c";
    process.env.AZURE_MAIL_CLIENT_SECRET = "s";
    jest
      .spyOn(OutlookEmailProvider.prototype, "verifyConnection")
      .mockRejectedValue(new Error("Graph 401 unauthorised"));

    const service = new EmailService(makePrisma(), makeConfig({}));
    const result = await service.verifyConnection();

    expect(result.success).toBe(false);
    expect(result.diagnosis.credentialResolved).toBe(true); // creds OK, wire failed
    expect(result.diagnosis.authMode).toBe("client-secret");
    expect(result.diagnosis.detail).toMatch(/Graph 401 unauthorised/);
  });

  it("gmail provider — surfaces provider=gmail with credentialResolved=false", async () => {
    const service = new EmailService(
      makePrisma({ email: { provider: "gmail", senderAddress: "hello@example.com" } }),
      makeConfig({})
    );
    const result = await service.verifyConnection();

    expect(result.success).toBe(false);
    expect(result.diagnosis).toEqual({
      provider: "gmail",
      authMode: null,
      senderAddress: "hello@example.com",
      credentialResolved: false,
      detail: expect.stringContaining("Gmail")
    });
  });

  it("respects sender fallback: EmailProviderConfig.senderAddress > CompanyProfile.primaryEmail", async () => {
    process.env.AZURE_MAIL_TENANT_ID = "t";
    process.env.AZURE_MAIL_CLIENT_ID = "c";
    process.env.AZURE_MAIL_CLIENT_SECRET = "s";
    jest
      .spyOn(OutlookEmailProvider.prototype, "verifyConnection")
      .mockResolvedValue({ message: "ok" });

    const service = new EmailService(
      makePrisma({ email: { provider: "outlook", senderAddress: "explicit@example.com" } }),
      makeConfig({})
    );
    const result = await service.verifyConnection();
    expect(result.diagnosis.senderAddress).toBe("explicit@example.com");
  });
});
