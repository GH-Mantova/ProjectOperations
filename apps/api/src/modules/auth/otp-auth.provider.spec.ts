import { UnauthorizedException } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { OtpAuthProvider } from "./otp-auth.provider";
import type { OtpDeliveryPort } from "./otp-delivery.port";

describe("OtpAuthProvider — FIELD-worker email + code flow", () => {
  const passwordService = new PasswordService();

  const baseUser = {
    id: "user-1",
    email: "field@example.com",
    isActive: true,
    userRoles: [],
    passwordHash: ""
  };

  type Challenge = {
    id: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
    createdAt: Date;
  };

  function makeProvider(user: Record<string, unknown> | null) {
    const store = new Map<string, Challenge>();

    function makeChallenge(overrides: Partial<Challenge>): Challenge {
      return {
        id: `c-${store.size + 1}`,
        email: overrides.email ?? "field@example.com",
        codeHash: overrides.codeHash ?? "",
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
        attempts: overrides.attempts ?? 0,
        consumedAt: overrides.consumedAt ?? null,
        createdAt: new Date()
      };
    }

    const prisma = {
      otpChallenge: {
        create: jest.fn(async ({ data }: { data: { email: string; codeHash: string; expiresAt: Date } }) => {
          const row = makeChallenge(data);
          store.set(row.id, row);
          return row;
        }),
        findFirst: jest.fn(async ({ where }: { where: { email: string; consumedAt: null; expiresAt: { gt: Date } } }) => {
          const matches = [...store.values()]
            .filter((r) => r.email === where.email && r.consumedAt === null && r.expiresAt > where.expiresAt.gt)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return matches[0] ?? null;
        }),
        update: jest.fn(async ({ where, data }: { where: { id: string }; data: { attempts?: { increment: number }; consumedAt?: Date } }) => {
          const row = store.get(where.id);
          if (!row) throw new Error("row not found");
          if (data.attempts?.increment) row.attempts += data.attempts.increment;
          if (data.consumedAt) row.consumedAt = data.consumedAt;
          return row;
        })
      }
    };

    const usersService = {
      findByEmailWithSecurity: jest.fn().mockResolvedValue(user),
      flattenPermissions: jest.fn().mockReturnValue([])
    };

    const delivered: Array<{ email: string; code: string; expiresAt: Date }> = [];
    const delivery: OtpDeliveryPort = {
      deliverCode: async (input) => {
        delivered.push(input);
      }
    };

    const provider = new OtpAuthProvider(
      prisma as never,
      usersService as never,
      passwordService,
      delivery
    );

    return { provider, delivered, store, usersService };
  }

  it("requestCode returns uniform response even when the email is unknown", async () => {
    const { provider, delivered } = makeProvider(null);
    const res = await provider.requestCode({ email: "unknown@example.com" });
    expect(res.status).toBe("sent");
    expect(delivered).toHaveLength(0);
  });

  it("requestCode delivers a code when the email matches an active user", async () => {
    const { provider, delivered, store } = makeProvider(baseUser);
    await provider.requestCode({ email: "field@example.com" });
    expect(delivered).toHaveLength(1);
    expect(delivered[0].code).toMatch(/^\d{6}$/);
    expect(store.size).toBe(1);
    // Never persisted in plaintext.
    for (const row of store.values()) {
      expect(row.codeHash).not.toBe(delivered[0].code);
    }
  });

  it("verifyCode rejects an incorrect code and increments attempts", async () => {
    const { provider, delivered, store } = makeProvider(baseUser);
    await provider.requestCode({ email: "field@example.com" });
    const email = delivered[0].email;

    await expect(provider.verifyCode({ email, code: "000000" })).rejects.toBeInstanceOf(UnauthorizedException);
    const row = [...store.values()][0];
    expect(row.attempts).toBe(1);
    expect(row.consumedAt).toBeNull();
  });

  it("verifyCode consumes the challenge on success and returns a principal", async () => {
    const { provider, delivered, store } = makeProvider(baseUser);
    await provider.requestCode({ email: "field@example.com" });
    const { email, code } = delivered[0];

    const principal = await provider.verifyCode({ email, code });
    expect(principal.user.id).toBe(baseUser.id);
    const row = [...store.values()][0];
    expect(row.consumedAt).not.toBeNull();
  });

  it("verifyCode rejects reuse of a consumed code", async () => {
    const { provider, delivered } = makeProvider(baseUser);
    await provider.requestCode({ email: "field@example.com" });
    const { email, code } = delivered[0];

    await provider.verifyCode({ email, code });
    await expect(provider.verifyCode({ email, code })).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
