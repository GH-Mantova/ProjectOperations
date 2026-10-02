import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
  AppearancePreferencesService,
  APPEARANCE_PREFERENCES_V1
} from "../appearance-preferences.service";
import { PrismaService } from "../../../prisma/prisma.service";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  userAppearancePreference: {
    findUnique: jest.fn(),
    upsert: jest.fn()
  },
  brandColorScheme: {
    findUnique: jest.fn()
  },
  companyProfile: {
    findUnique: jest.fn()
  }
};

function makeScheme(overrides: Record<string, unknown> = {}) {
  return {
    id: "scheme-abc",
    name: "Harbour",
    primaryColorHex: "#005B61",
    secondaryColorHex: "#FEAA6D",
    sidebarBgHex: "#001122",
    sidebarTextHex: null,
    sidebarTextActiveHex: null,
    surfacePageHex: null,
    surfaceCardHex: null,
    textPrimaryHex: null,
    textSecondaryHex: null,
    textMutedHex: null,
    statusActiveHex: null,
    statusWarningHex: null,
    statusDangerHex: null,
    statusInfoHex: null,
    statusNeutralHex: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Suite: version marker
// ---------------------------------------------------------------------------

describe("APPEARANCE_PREFERENCES_V1 marker", () => {
  it('equals "brandtheme-s7c-1"', () => {
    expect(APPEARANCE_PREFERENCES_V1).toBe("brandtheme-s7c-1");
  });
});

// ---------------------------------------------------------------------------
// Suite: getForUser
// ---------------------------------------------------------------------------

describe("AppearancePreferencesService.getForUser", () => {
  let service: AppearancePreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppearancePreferencesService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    service = module.get(AppearancePreferencesService);
  });

  it("returns defaults when no row exists, and does NOT create one", async () => {
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue(null);

    const result = await service.getForUser("user-1");

    expect(result).toEqual({
      density: "comfortable",
      colourSchemeId: null,
      colourScheme: null
    });
    expect(mockPrisma.userAppearancePreference.upsert).not.toHaveBeenCalled();
  });

  it("returns stored density and scheme when a row exists", async () => {
    const scheme = makeScheme();
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: scheme.id,
      colourScheme: scheme
    });
    mockPrisma.companyProfile.findUnique.mockResolvedValue({
      activeColorSchemeId: "other-scheme"
    });

    const result = await service.getForUser("user-1");

    expect(result.density).toBe("compact");
    expect(result.colourSchemeId).toBe(scheme.id);
    expect(result.colourScheme).not.toBeNull();
    expect(result.colourScheme!.id).toBe(scheme.id);
    expect(result.colourScheme!.isCompanyDefault).toBe(false);
  });

  it("marks isCompanyDefault true when the user's scheme matches the active company scheme", async () => {
    const scheme = makeScheme({ id: "active-scheme" });
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "comfortable",
      colourSchemeId: "active-scheme",
      colourScheme: scheme
    });
    mockPrisma.companyProfile.findUnique.mockResolvedValue({
      activeColorSchemeId: "active-scheme"
    });

    const result = await service.getForUser("user-1");

    expect(result.colourScheme!.isCompanyDefault).toBe(true);
  });

  it("returns null colourScheme when colourSchemeId is null (SetNull relation -- row exists but scheme was deleted)", async () => {
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: null,
      colourScheme: null
    });

    const result = await service.getForUser("user-1");

    expect(result.colourSchemeId).toBeNull();
    expect(result.colourScheme).toBeNull();
    expect(result.density).toBe("compact");
  });
});

// ---------------------------------------------------------------------------
// Suite: updateForUser
// ---------------------------------------------------------------------------

describe("AppearancePreferencesService.updateForUser", () => {
  let service: AppearancePreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppearancePreferencesService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    service = module.get(AppearancePreferencesService);
  });

  it("PUT then GET round-trips density and colourSchemeId", async () => {
    const scheme = makeScheme();
    mockPrisma.brandColorScheme.findUnique.mockResolvedValue(scheme);
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    // After upsert, getForUser should return the updated values
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: scheme.id,
      colourScheme: scheme
    });
    mockPrisma.companyProfile.findUnique.mockResolvedValue({
      activeColorSchemeId: null
    });

    const result = await service.updateForUser("user-1", {
      density: "compact",
      colourSchemeId: scheme.id
    });

    expect(result.density).toBe("compact");
    expect(result.colourSchemeId).toBe(scheme.id);
    expect(mockPrisma.userAppearancePreference.upsert).toHaveBeenCalledTimes(1);
  });

  it("PUT for user A never changes user B's row", async () => {
    mockPrisma.brandColorScheme.findUnique.mockResolvedValue(null);
    // density-only update so no scheme lookup
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: null,
      colourScheme: null
    });

    await service.updateForUser("user-A", { density: "compact" });

    const call = mockPrisma.userAppearancePreference.upsert.mock.calls[0][0];
    expect(call.where.userId).toBe("user-A");
    // user B's row is never touched
    expect(call.where.userId).not.toBe("user-B");
  });

  it("rejects a density value outside the two allowed values", async () => {
    await expect(
      service.updateForUser("user-1", { density: "giant" })
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts density "comfortable"', async () => {
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "comfortable",
      colourSchemeId: null,
      colourScheme: null
    });

    await expect(
      service.updateForUser("user-1", { density: "comfortable" })
    ).resolves.toBeDefined();
  });

  it('accepts density "compact"', async () => {
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: null,
      colourScheme: null
    });

    await expect(
      service.updateForUser("user-1", { density: "compact" })
    ).resolves.toBeDefined();
  });

  it("rejects an unknown colourSchemeId with BadRequestException", async () => {
    mockPrisma.brandColorScheme.findUnique.mockResolvedValue(null);

    await expect(
      service.updateForUser("user-1", { colourSchemeId: "nonexistent-scheme" })
    ).rejects.toThrow(BadRequestException);
  });

  it("accepts colourSchemeId: null and clears the choice", async () => {
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "comfortable",
      colourSchemeId: null,
      colourScheme: null
    });

    const result = await service.updateForUser("user-1", { colourSchemeId: null });

    expect(result.colourSchemeId).toBeNull();
    // brandColorScheme.findUnique should NOT be called when colourSchemeId is null
    expect(mockPrisma.brandColorScheme.findUnique).not.toHaveBeenCalled();
  });

  it("does not call brandColorScheme.findUnique when density-only update is sent", async () => {
    mockPrisma.userAppearancePreference.upsert.mockResolvedValue({});
    mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
      density: "compact",
      colourSchemeId: null,
      colourScheme: null
    });

    await service.updateForUser("user-1", { density: "compact" });

    expect(mockPrisma.brandColorScheme.findUnique).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Suite: SetNull cascade behaviour (unit-level, mocked Prisma)
// ---------------------------------------------------------------------------

describe("SetNull relation: when scheme is deleted, preference reads as colourSchemeId: null", () => {
  let service: AppearancePreferencesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppearancePreferencesService,
        { provide: PrismaService, useValue: mockPrisma }
      ]
    }).compile();
    service = module.get(AppearancePreferencesService);
  });

  it(
    "SetNull FK: after the scheme is deleted Postgres sets colour_scheme_id to NULL; " +
      "getForUser returns colourSchemeId: null without error",
    async () => {
      // Simulate what Postgres does on BrandColorScheme delete: the FK is
      // set to NULL. The row still exists; colourScheme relation is null.
      mockPrisma.userAppearancePreference.findUnique.mockResolvedValue({
        density: "comfortable",
        colourSchemeId: null, // <- DB set this to NULL via ON DELETE SET NULL
        colourScheme: null
      });

      const result = await service.getForUser("user-1");

      expect(result.colourSchemeId).toBeNull();
      expect(result.colourScheme).toBeNull();
      expect(result.density).toBe("comfortable");
    }
  );
});
