import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { NotificationPreferencesService, resolveEffectiveChannel } from "../notification-preferences.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ─── resolveEffectiveChannel intersection table ───────────────────────────────

describe("resolveEffectiveChannel", () => {
  const table: Array<{ admin: string; user: string | null; expected: string }> = [
    // No stored pref → pass through admin unchanged
    { admin: "both", user: null, expected: "both" },
    { admin: "email", user: null, expected: "email" },
    { admin: "inapp", user: null, expected: "inapp" },
    { admin: "off", user: null, expected: "off" },

    // both × *
    { admin: "both", user: "both", expected: "both" },
    { admin: "both", user: "email", expected: "email" },
    { admin: "both", user: "inapp", expected: "inapp" },
    { admin: "both", user: "off", expected: "off" },

    // email × *
    { admin: "email", user: "both", expected: "email" }, // user cannot add inapp
    { admin: "email", user: "email", expected: "email" },
    { admin: "email", user: "inapp", expected: "off" },  // no overlap
    { admin: "email", user: "off", expected: "off" },

    // inapp × *
    { admin: "inapp", user: "both", expected: "inapp" }, // user cannot add email
    { admin: "inapp", user: "email", expected: "off" },  // no overlap
    { admin: "inapp", user: "inapp", expected: "inapp" },
    { admin: "inapp", user: "off", expected: "off" },

    // off × * → always off (admin disabled)
    { admin: "off", user: "both", expected: "off" },
    { admin: "off", user: "email", expected: "off" },
    { admin: "off", user: "inapp", expected: "off" },
    { admin: "off", user: "off", expected: "off" }
  ];

  test.each(table)(
    "admin=$admin user=$user → $expected",
    ({ admin, user, expected }) => {
      expect(
        resolveEffectiveChannel(
          admin as Parameters<typeof resolveEffectiveChannel>[0],
          user as Parameters<typeof resolveEffectiveChannel>[1]
        )
      ).toBe(expected);
    }
  );
});

// ─── NotificationPreferencesService ──────────────────────────────────────────

const mockUser = {
  userRoles: [{ role: { name: "Admin" } }]
};

const mockTriggerEnabled = {
  trigger: "compliance.expiry_reminder",
  label: "Compliance expiry reminder",
  description: "Alerts when licences or insurances are near expiry.",
  isEnabled: true,
  deliveryMethod: "both",
  recipientUserIds: [],
  recipientRoles: ["Admin"]
};

const mockTriggerDisabled = {
  trigger: "disabled.trigger",
  label: "Disabled",
  description: "Disabled trigger.",
  isEnabled: false,
  deliveryMethod: "both",
  recipientUserIds: [],
  recipientRoles: ["Admin"]
};

const makePrisma = (overrides: Record<string, unknown> = {}): PrismaService =>
  ({
    user: {
      findUnique: jest.fn().mockResolvedValue(mockUser)
    },
    notificationTriggerConfig: {
      findMany: jest.fn().mockResolvedValue([mockTriggerEnabled]),
      findUnique: jest.fn().mockResolvedValue(mockTriggerEnabled)
    },
    notificationPreference: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockImplementation(({ create }: { create: { trigger: string; channel: string } }) =>
        Promise.resolve({ trigger: create.trigger, channel: create.channel })
      ),
      delete: jest.fn().mockResolvedValue({})
    },
    ...overrides
  }) as unknown as PrismaService;

describe("NotificationPreferencesService", () => {
  let service: NotificationPreferencesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    prisma = makePrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationPreferencesService,
        { provide: PrismaService, useValue: prisma }
      ]
    }).compile();

    service = module.get<NotificationPreferencesService>(NotificationPreferencesService);
  });

  // ─── listForUser ────────────────────────────────────────────────────────

  describe("listForUser", () => {
    it("returns eligible triggers with effective channel (no stored pref → inherit admin)", async () => {
      const result = await service.listForUser("user-1");
      expect(result).toHaveLength(1);
      expect(result[0].trigger).toBe("compliance.expiry_reminder");
      expect(result[0].adminDeliveryMethod).toBe("both");
      expect(result[0].storedChannel).toBeNull();
      expect(result[0].effectiveChannel).toBe("both"); // no pref → inherit
    });

    it("applies stored channel override in effectiveChannel", async () => {
      (prisma.notificationPreference.findMany as jest.Mock).mockResolvedValue([
        { trigger: "compliance.expiry_reminder", channel: "email" }
      ]);
      const result = await service.listForUser("user-1");
      expect(result[0].storedChannel).toBe("email");
      expect(result[0].effectiveChannel).toBe("email");
    });

    it("returns empty when user has no eligible triggers", async () => {
      // User has no matching roles and is not in recipientUserIds
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        userRoles: [{ role: { name: "Viewer" } }]
      });
      const result = await service.listForUser("user-1");
      expect(result).toHaveLength(0);
    });

    it("throws NotFoundException when user does not exist", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.listForUser("bad-id")).rejects.toThrow(NotFoundException);
    });
  });

  // ─── upsertForUser ──────────────────────────────────────────────────────

  describe("upsertForUser", () => {
    it("upserts a valid channel preference and returns effective channel", async () => {
      const result = await service.upsertForUser("user-1", "compliance.expiry_reminder", "email");
      expect(result.channel).toBe("email");
      expect(result.adminDeliveryMethod).toBe("both");
      expect(result.effectiveChannel).toBe("email");
    });

    it("throws BadRequestException for invalid channel", async () => {
      await expect(
        service.upsertForUser("user-1", "compliance.expiry_reminder", "sms")
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when trigger does not exist", async () => {
      (prisma.notificationTriggerConfig.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.upsertForUser("user-1", "missing.trigger", "off")
      ).rejects.toThrow(BadRequestException);
    });

    it("throws BadRequestException when trigger is disabled", async () => {
      (prisma.notificationTriggerConfig.findUnique as jest.Mock).mockResolvedValue(
        mockTriggerDisabled
      );
      await expect(
        service.upsertForUser("user-1", "disabled.trigger", "off")
      ).rejects.toThrow(BadRequestException);
    });

    it("throws ForbiddenException when user is not eligible", async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        userRoles: [{ role: { name: "Viewer" } }]
      });
      await expect(
        service.upsertForUser("user-1", "compliance.expiry_reminder", "email")
      ).rejects.toThrow(ForbiddenException);
    });

    it("allows eligibility by recipientUserIds (not just roles)", async () => {
      (prisma.notificationTriggerConfig.findUnique as jest.Mock).mockResolvedValue({
        ...mockTriggerEnabled,
        recipientUserIds: ["user-1"],
        recipientRoles: []
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        userRoles: [{ role: { name: "Viewer" } }]
      });
      const result = await service.upsertForUser("user-1", "compliance.expiry_reminder", "off");
      expect(result.channel).toBe("off");
      expect(result.effectiveChannel).toBe("off");
    });
  });

  // ─── deleteForUser ──────────────────────────────────────────────────────

  describe("deleteForUser", () => {
    it("deletes an existing preference", async () => {
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue({
        trigger: "compliance.expiry_reminder",
        channel: "email"
      });
      const result = await service.deleteForUser("user-1", "compliance.expiry_reminder");
      expect(result.deleted).toBe(true);
    });

    it("throws NotFoundException when no preference stored", async () => {
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.deleteForUser("user-1", "compliance.expiry_reminder")
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── resolveEffectiveChannelForUser (DB-backed) ──────────────────────────

  describe("resolveEffectiveChannelForUser", () => {
    it("returns admin default when no stored preference", async () => {
      const effective = await service.resolveEffectiveChannelForUser("user-1", "t", "both");
      expect(effective).toBe("both");
    });

    it("applies mute-only intersection when preference is stored", async () => {
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue({
        channel: "email"
      });
      const effective = await service.resolveEffectiveChannelForUser("user-1", "t", "both");
      expect(effective).toBe("email");
    });

    it("returns off when user muted a channel the admin sends", async () => {
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue({
        channel: "off"
      });
      const effective = await service.resolveEffectiveChannelForUser("user-1", "t", "both");
      expect(effective).toBe("off");
    });

    it("proves un-preferenced user is unaffected (muted user vs. no-pref user)", async () => {
      // Muted user
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue({ channel: "off" });
      const mutedEffective = await service.resolveEffectiveChannelForUser("muted-user", "t", "both");
      expect(mutedEffective).toBe("off");

      // Un-preferenced user
      (prisma.notificationPreference.findUnique as jest.Mock).mockResolvedValue(null);
      const normalEffective = await service.resolveEffectiveChannelForUser("normal-user", "t", "both");
      expect(normalEffective).toBe("both");
    });
  });
});
