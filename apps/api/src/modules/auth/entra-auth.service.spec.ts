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

  const prismaService = {
    user: { create: jest.fn() },
    role: { findMany: jest.fn() }
  };

  const service = new EntraAuthService(
    usersService as never,
    entraTokenValidatorService as never,
    prismaService as never
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

  describe("authenticateWithSso", () => {
    it("returns existing active users without provisioning", async () => {
      const user = {
        id: "user-1",
        email: "existing@example.com",
        firstName: "Existing",
        lastName: "User",
        isActive: true,
        lastLoginAt: null,
        passwordHash: "stored",
        userRoles: []
      };

      entraTokenValidatorService.validateIdToken.mockResolvedValue({
        issuer: "issuer",
        audience: "aud",
        subject: "sub",
        email: "existing@example.com",
        displayName: "Existing User"
      });
      usersService.findByEmailWithSecurity.mockResolvedValue(user);

      const result = await service.authenticateWithSso("entra-token");

      expect(result.user).toBe(user);
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.role.findMany).not.toHaveBeenCalled();
    });

    it("gates unregistered Entra identities with a structured ENTRA_NOT_REGISTERED forbidden", async () => {
      entraTokenValidatorService.validateIdToken.mockResolvedValue({
        issuer: "issuer",
        audience: "aud",
        subject: "sub",
        email: "new.user@initialservices.net",
        displayName: "New User"
      });
      usersService.findByEmailWithSecurity.mockResolvedValue(null);

      const thrown = await service.authenticateWithSso("entra-token").catch((err) => err);

      expect(thrown).toBeInstanceOf(ForbiddenException);
      const body = (thrown as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(body).toMatchObject({
        code: "ENTRA_NOT_REGISTERED",
        email: "new.user@initialservices.net",
        displayName: "New User"
      });
      // Auto-provisioning must NOT happen.
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(prismaService.role.findMany).not.toHaveBeenCalled();
    });

    it("rejects existing inactive users with the deactivated-account message", async () => {
      const user = {
        id: "user-inactive",
        email: "inactive@example.com",
        firstName: "Inactive",
        lastName: "User",
        isActive: false,
        lastLoginAt: null,
        passwordHash: "stored",
        userRoles: []
      };

      entraTokenValidatorService.validateIdToken.mockResolvedValue({
        issuer: "issuer",
        audience: "aud",
        subject: "sub",
        email: "inactive@example.com",
        displayName: "Inactive User"
      });
      usersService.findByEmailWithSecurity.mockResolvedValue(user);

      const thrown = await service.authenticateWithSso("entra-token").catch((err) => err);
      expect(thrown).toBeInstanceOf(ForbiddenException);
      const body = (thrown as ForbiddenException).getResponse();
      // Deactivated accounts get the plain-string 403 — not the ENTRA_NOT_REGISTERED branch.
      expect(body).not.toMatchObject({ code: "ENTRA_NOT_REGISTERED" });
      expect(prismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe("splitDisplayName", () => {
    it("splits a normal 'First Last' display name", () => {
      expect(service.splitDisplayName("Jane Doe", "jane@example.com")).toEqual({
        firstName: "Jane",
        lastName: "Doe"
      });
    });

    it("falls back to email local-part when displayName is null", () => {
      expect(service.splitDisplayName(null, "jane.doe@example.com")).toEqual({
        firstName: "jane.doe",
        lastName: "User"
      });
    });
  });
});
