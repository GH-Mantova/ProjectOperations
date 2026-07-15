import { ClientSecretCredential } from "@azure/identity";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  buildMailCredential,
  resetMailAuthModeLoggedForTests,
  resolveMailAuthMode
} from "../providers/outlook.provider";

// Minimal ConfigService stand-in: get(key) reads from a plain map.
function fakeConfig(map: Record<string, string | undefined>) {
  return { get: <T = string>(key: string) => map[key] as unknown as T | undefined };
}

const MAIL_ENV = [
  "AZURE_MAIL_TENANT_ID",
  "AZURE_MAIL_CLIENT_ID",
  "AZURE_MAIL_CLIENT_SECRET",
  "SHAREPOINT_TENANT_ID",
  "SHAREPOINT_CLIENT_ID",
  "SHAREPOINT_CLIENT_SECRET"
] as const;

describe("mail auth mode", () => {
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
  });

  describe("resolveMailAuthMode", () => {
    it("defaults to client-secret when MAIL_AUTH_MODE is unset (no regression)", () => {
      expect(resolveMailAuthMode(fakeConfig({}))).toBe("client-secret");
    });

    it("honours managed-identity, case/space-insensitively", () => {
      expect(resolveMailAuthMode(fakeConfig({ MAIL_AUTH_MODE: " Managed-Identity " }))).toBe(
        "managed-identity"
      );
    });

    it("throws on an unrecognised value", () => {
      expect(() => resolveMailAuthMode(fakeConfig({ MAIL_AUTH_MODE: "oauth" }))).toThrow(
        ServiceUnavailableException
      );
    });
  });

  describe("buildMailCredential", () => {
    it("managed-identity returns a credential with getToken (system-assigned)", () => {
      const cred = buildMailCredential("managed-identity", fakeConfig({}), () => undefined);
      expect(typeof cred.getToken).toBe("function");
    });

    it("managed-identity honours a user-assigned client id in the startup log", () => {
      const lines: string[] = [];
      buildMailCredential(
        "managed-identity",
        fakeConfig({ AZURE_MANAGED_IDENTITY_CLIENT_ID: "abc-123" }),
        (l) => lines.push(l)
      );
      expect(lines.join("\n")).toContain("user-assigned clientId=abc-123");
    });

    it("client-secret names the EXACT missing env var, not a generic list", () => {
      process.env.AZURE_MAIL_TENANT_ID = "t";
      process.env.AZURE_MAIL_CLIENT_ID = "c";
      // client secret deliberately absent
      expect(() => buildMailCredential("client-secret", fakeConfig({}), () => undefined)).toThrow(
        /AZURE_MAIL_CLIENT_SECRET/
      );
    });

    it("client-secret returns a ClientSecretCredential when fully configured", () => {
      process.env.AZURE_MAIL_TENANT_ID = "t";
      process.env.AZURE_MAIL_CLIENT_ID = "c";
      process.env.AZURE_MAIL_CLIENT_SECRET = "s";
      const cred = buildMailCredential("client-secret", fakeConfig({}), () => undefined);
      expect(cred).toBeInstanceOf(ClientSecretCredential);
    });
  });
});
