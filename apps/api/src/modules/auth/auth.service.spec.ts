import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  const prisma = {
    $transaction: jest.fn().mockResolvedValue([]),
    user: {
      update: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn()
    }
  };

  const usersService = {
    toSafeUser: jest.fn().mockReturnValue({ id: "user-1" })
  };

  const passwordService = {
    hashToken: jest.fn().mockReturnValue("hashed-token")
  };

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue("token"),
    verifyAsync: jest.fn()
  } as unknown as JwtService;

  const configService = {
    get: jest.fn((key: string, fallback: string) => fallback)
  } as unknown as ConfigService;

  const auditService = {
    write: jest.fn().mockResolvedValue(undefined)
  };

  const authProviderService = {
    authenticate: jest.fn()
  };

  const entraAuthService = {
    authenticate: jest.fn(),
    getPublicConfiguration: jest.fn().mockReturnValue({
      clientId: "entra-client-id",
      authority: "https://login.microsoftonline.com/test-tenant"
    })
  };

  const service = new AuthService(
    prisma as never,
    usersService as never,
    passwordService as never,
    jwtService,
    configService,
    auditService as never,
    authProviderService as never,
    entraAuthService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects inactive users", async () => {
    authProviderService.authenticate.mockRejectedValue(new UnauthorizedException("Invalid credentials."));

    await expect(
      service.login({ email: "inactive@example.com", password: "Password123!" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("logs in active users with a valid password", async () => {
    authProviderService.authenticate.mockResolvedValue({
      user: {
        id: "user-1",
        email: "active@example.com",
        firstName: "Active",
        lastName: "User",
        isActive: true,
        lastLoginAt: null,
        passwordHash: "stored",
        userRoles: []
      },
      permissions: ["users.view"]
    });

    const result = await service.login({
      email: "active@example.com",
      password: "Password123!"
    });

    if ("requiresPasswordReset" in result) {
      throw new Error("Test fixture expected a successful session, got a password-reset envelope");
    }
    expect(result.accessToken).toBe("token");
    expect(auditService.write).toHaveBeenCalled();
  });

  it("rejects Entra users who are not provisioned internally", async () => {
    entraAuthService.authenticate.mockRejectedValue(
      new ForbiddenException(
        "Access denied. Your Microsoft account is not provisioned for Project Operations."
      )
    );

    await expect(service.loginWithEntra({ idToken: "entra-token" })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("returns public Entra config when hosted auth mode is enabled", () => {
    (configService.get as jest.Mock).mockImplementation((key: string, fallback?: string) => {
      if (key === "auth.mode") {
        return "entra";
      }

      return fallback;
    });

    expect(service.getLoginConfiguration()).toEqual({
      mode: "entra",
      entra: {
        clientId: "entra-client-id",
        authority: "https://login.microsoftonline.com/test-tenant"
      }
    });
  });
});
