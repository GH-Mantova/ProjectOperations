import { UnauthorizedException } from "@nestjs/common";
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
    findByEmailWithSecurity: jest.fn(),
    flattenPermissions: jest.fn().mockReturnValue(["users.view"]),
    toSafeUser: jest.fn().mockReturnValue({ id: "user-1" })
  };

  const passwordService = {
    verifyPassword: jest.fn(),
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

  const service = new AuthService(
    prisma as never,
    usersService as never,
    passwordService as never,
    jwtService,
    configService,
    auditService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects inactive users", async () => {
    usersService.findByEmailWithSecurity.mockResolvedValue({
      id: "user-1",
      email: "inactive@example.com",
      isActive: false
    });

    await expect(
      service.login({ email: "inactive@example.com", password: "Password123!" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("logs in active users with a valid password", async () => {
    usersService.findByEmailWithSecurity.mockResolvedValue({
      id: "user-1",
      email: "active@example.com",
      isActive: true,
      passwordHash: "stored",
      userRoles: []
    });
    passwordService.verifyPassword.mockReturnValue(true);

    const result = await service.login({
      email: "active@example.com",
      password: "Password123!"
    });

    expect(result.accessToken).toBe("token");
    expect(auditService.write).toHaveBeenCalled();
  });
});
