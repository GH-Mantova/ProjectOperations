import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { Logger } from "@nestjs/common";
import { PortalAuthService } from "./portal-auth.service";

/**
 * SEC-A3: verify that requestPasswordReset logs safely in production and
 * still logs the full URL in development.
 */
describe("PortalAuthService — requestPasswordReset log behaviour (SEC-A3)", () => {
  const userId = "user-uuid-1";
  const userEmail = "client@example.com";

  const activeUser = {
    id: userId,
    email: userEmail,
    isActive: true,
    clientId: "client-1",
    passwordHash: "hash",
    forcePasswordReset: false,
    lastLoginAt: null,
    firstName: "Test",
    lastName: "User",
    phone: null
  };

  function makeService() {
    const prisma = {
      clientPortalUser: {
        findUnique: jest.fn().mockResolvedValue(activeUser)
      }
    };

    const jwtService = {
      signAsync: jest.fn().mockResolvedValue("mock-jwt-token")
    } as unknown as JwtService;

    const configService = {
      get: jest.fn((key: string, fallback: unknown) => {
        if (key === "portal.publicUrl") return "http://localhost:5173";
        return fallback;
      }),
      // SEC-A1: the portal service now reads its signing secrets with getOrThrow,
      // which takes no fallback argument. Deterministic per-key value, so a portal
      // token is never signed with a placeholder secret in a test.
      getOrThrow: jest.fn((key: string) => `test-secret-for-${key}`)
    } as unknown as ConfigService;

    const passwordService = {
      verifyPassword: jest.fn().mockReturnValue(true),
      hashToken: jest.fn().mockReturnValue("hashed")
    };

    const auditService = {
      write: jest.fn().mockResolvedValue(undefined)
    };

    const service = new PortalAuthService(
      prisma as never,
      jwtService,
      configService,
      passwordService as never,
      auditService as never
    );

    return { service, prisma };
  }

  describe("production runtime (NODE_ENV=production)", () => {
    let originalNodeEnv: string | undefined;
    let originalSiteName: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      originalSiteName = process.env.WEBSITE_SITE_NAME;
      process.env.NODE_ENV = "production";
      delete process.env.WEBSITE_SITE_NAME;
    });

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalSiteName === undefined) {
        delete process.env.WEBSITE_SITE_NAME;
      } else {
        process.env.WEBSITE_SITE_NAME = originalSiteName;
      }
    });

    it("does not log the user email in production", async () => {
      const { service } = makeService();
      const loggedMessages: unknown[] = [];
      const spy = jest.spyOn(Logger.prototype, "log").mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args[0]);
      });

      await service.requestPasswordReset(userEmail);
      spy.mockRestore();

      for (const msg of loggedMessages) {
        expect(String(msg)).not.toContain(userEmail);
      }
    });

    it("does not log a string containing 'token=' in production", async () => {
      const { service } = makeService();
      const loggedMessages: unknown[] = [];
      const spy = jest.spyOn(Logger.prototype, "log").mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args[0]);
      });

      await service.requestPasswordReset(userEmail);
      spy.mockRestore();

      for (const msg of loggedMessages) {
        expect(String(msg)).not.toContain("token=");
      }
    });

    it("logs a message containing only the user ID in production", async () => {
      const { service } = makeService();
      const loggedMessages: unknown[] = [];
      const spy = jest.spyOn(Logger.prototype, "log").mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args[0]);
      });

      await service.requestPasswordReset(userEmail);
      spy.mockRestore();

      expect(loggedMessages.map(String).some((m) => m.includes(userId))).toBe(true);
    });
  });

  describe("development runtime (NODE_ENV=development)", () => {
    let originalNodeEnv: string | undefined;
    let originalSiteName: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
      originalSiteName = process.env.WEBSITE_SITE_NAME;
      process.env.NODE_ENV = "development";
      delete process.env.WEBSITE_SITE_NAME;
    });

    afterEach(() => {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalSiteName === undefined) {
        delete process.env.WEBSITE_SITE_NAME;
      } else {
        process.env.WEBSITE_SITE_NAME = originalSiteName;
      }
    });

    it("logs the full reset URL (including email and token=) in development", async () => {
      const { service } = makeService();
      const loggedMessages: unknown[] = [];
      const spy = jest.spyOn(Logger.prototype, "log").mockImplementation((...args: unknown[]) => {
        loggedMessages.push(args[0]);
      });

      await service.requestPasswordReset(userEmail);
      spy.mockRestore();

      const fullLog = loggedMessages.map(String).join("\n");
      expect(fullLog).toContain(userEmail);
      expect(fullLog).toContain("token=");
    });
  });
});
