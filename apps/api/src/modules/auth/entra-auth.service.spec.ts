import { ForbiddenException } from "@nestjs/common";
import { EntraAuthService } from "./entra-auth.service";

describe("EntraAuthService", () => {
  const usersService = {
    findByEmailWithSecurity: jest.fn(),
    flattenPermissions: jest.fn().mockReturnValue(["users.view"])
  };

  const entraTokenValidatorService = {
    validateIdToken: jest.fn(),
    getPublicConfiguration: jest.fn().mockReturnValue({
      clientId: "entra-client-id",
      authority: "https://login.microsoftonline.com/test-tenant"
    })
  };

  const service = new EntraAuthService(
    usersService as never,
    entraTokenValidatorService as never
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("maps a validated Entra identity to an existing internal user", async () => {
    const user = {
      id: "user-1",
      email: "active@example.com",
      firstName: "Active",
      lastName: "User",
      isActive: true,
      lastLoginAt: null,
      passwordHash: "stored",
      userRoles: []
    };

    entraTokenValidatorService.validateIdToken.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "entra-client-id",
      subject: "entra-user-1",
      email: "active@example.com",
      displayName: "Active User"
    });
    usersService.findByEmailWithSecurity.mockResolvedValue(user);

    const result = await service.authenticate("entra-token");

    expect(result.user).toBe(user);
    expect(result.permissions).toEqual(["users.view"]);
    expect(usersService.findByEmailWithSecurity).toHaveBeenCalledWith("active@example.com");
    expect(usersService.flattenPermissions).toHaveBeenCalledWith(user);
  });

  it("denies validated Entra identities that are not provisioned internally", async () => {
    entraTokenValidatorService.validateIdToken.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "entra-client-id",
      subject: "entra-user-1",
      email: "missing@example.com",
      displayName: "Missing User"
    });
    usersService.findByEmailWithSecurity.mockResolvedValue(null);

    await expect(service.authenticate("entra-token")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("normalizes Entra email before resolving the internal user", async () => {
    const user = {
      id: "user-1",
      email: "active@example.com",
      firstName: "Active",
      lastName: "User",
      isActive: true,
      lastLoginAt: null,
      passwordHash: "stored",
      userRoles: []
    };

    entraTokenValidatorService.validateIdToken.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "entra-client-id",
      subject: "entra-user-1",
      email: " Active@Example.com ",
      displayName: "Active User"
    });
    usersService.findByEmailWithSecurity.mockResolvedValue(user);

    await service.authenticate("entra-token");

    expect(usersService.findByEmailWithSecurity).toHaveBeenCalledWith("active@example.com");
  });

  it("denies validated Entra identities mapped to inactive internal users", async () => {
    const user = {
      id: "user-1",
      email: "inactive@example.com",
      firstName: "Inactive",
      lastName: "User",
      isActive: false,
      lastLoginAt: null,
      passwordHash: "stored",
      userRoles: []
    };

    entraTokenValidatorService.validateIdToken.mockResolvedValue({
      issuer: "https://login.microsoftonline.com/test-tenant/v2.0",
      audience: "entra-client-id",
      subject: "entra-user-1",
      email: "inactive@example.com",
      displayName: "Inactive User"
    });
    usersService.findByEmailWithSecurity.mockResolvedValue(user);

    await expect(service.authenticate("entra-token")).rejects.toBeInstanceOf(ForbiddenException);
  });
});
