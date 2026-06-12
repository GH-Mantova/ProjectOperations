import { UnauthorizedException } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { LocalAuthProvider } from "./local-auth.provider";

describe("LocalAuthProvider — uniform credential errors", () => {
  const passwordService = new PasswordService();
  const storedHash = passwordService.hashPassword("Password123!");

  const baseUser = {
    id: "user-1",
    email: "user@example.com",
    passwordHash: storedHash,
    isActive: true,
    userRoles: []
  };

  function makeProvider(user: Record<string, unknown> | null) {
    const usersService = {
      findByEmailWithSecurity: jest.fn().mockResolvedValue(user),
      flattenPermissions: jest.fn().mockReturnValue([])
    };
    const verifySpy = jest.spyOn(passwordService, "verifyPassword");
    const provider = new LocalAuthProvider(usersService as never, passwordService);
    return { provider, verifySpy };
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const failureCases: Array<[string, Record<string, unknown> | null]> = [
    ["unknown email", null],
    ["wrong password (existing user)", baseUser],
    ["inactive user", { ...baseUser, isActive: false }],
    ["SSO-only user with no usable password hash", { ...baseUser, passwordHash: "" }]
  ];

  it.each(failureCases)(
    "rejects %s with the identical 'Invalid credentials.' message",
    async (_label, user) => {
      const { provider } = makeProvider(user);
      const attempt = () =>
        provider.authenticate({ email: "user@example.com", password: "WrongPassword!" });

      await expect(attempt()).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(attempt()).rejects.toThrow("Invalid credentials.");
    }
  );

  it.each(failureCases)(
    "performs exactly one password verification for %s (timing-equivalent path)",
    async (_label, user) => {
      const { provider, verifySpy } = makeProvider(user);

      await provider
        .authenticate({ email: "user@example.com", password: "WrongPassword!" })
        .catch(() => undefined);

      expect(verifySpy).toHaveBeenCalledTimes(1);
    }
  );

  it("never accepts a login for an SSO-only user even with an empty password", async () => {
    const { provider } = makeProvider({ ...baseUser, passwordHash: "" });

    await expect(
      provider.authenticate({ email: "user@example.com", password: "" })
    ).rejects.toThrow("Invalid credentials.");
  });

  it("authenticates an active user with the correct password", async () => {
    const { provider } = makeProvider(baseUser);

    const result = await provider.authenticate({
      email: "user@example.com",
      password: "Password123!"
    });

    expect(result.user.id).toBe("user-1");
  });
});
