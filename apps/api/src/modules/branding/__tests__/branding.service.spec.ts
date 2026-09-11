import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { BrandingService } from "../branding.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { COMPANY_PROFILE_ID } from "../../company-profile/company-profile.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** The 13 S3 palette field names — kept in sync with S3_PALETTE_FIELDS in service. */
const S3_FIELDS = [
  "sidebarBgHex",
  "sidebarTextHex",
  "sidebarTextActiveHex",
  "surfacePageHex",
  "surfaceCardHex",
  "textPrimaryHex",
  "textSecondaryHex",
  "textMutedHex",
  "statusActiveHex",
  "statusWarningHex",
  "statusDangerHex",
  "statusInfoHex",
  "statusNeutralHex"
] as const;

/** All 17 viewer keys (4 original + 13 S3). */
const VIEWER_KEYS_17 = [
  "primaryColorHex",
  "secondaryColorHex",
  "logoLightUrl",
  "logoDarkUrl",
  ...S3_FIELDS
].sort();

function makeProfile(overrides: Record<string, unknown> = {}) {
  return {
    primaryColorHex: "#112233",
    secondaryColorHex: "#445566",
    logoLightUrl: "https://cdn.example.com/logo-light.svg",
    logoDarkUrl: "https://cdn.example.com/logo-dark.svg",
    activeColorScheme: null,
    ...overrides
  };
}

function makeScheme(overrides: Record<string, unknown> = {}) {
  return {
    primaryColorHex: "#AABBCC",
    secondaryColorHex: "#DDEEFF",
    sidebarBgHex: null,
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

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockPrisma = {
  companyProfile: { findUnique: jest.fn() },
  brandColorScheme: { findMany: jest.fn(), upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
  brandAsset: { upsert: jest.fn(), findUnique: jest.fn(), delete: jest.fn() }
};

const mockAudit = { write: jest.fn() };

// ── Suite: getActiveBrandingForViewer ─────────────────────────────────────────

describe("BrandingService.getActiveBrandingForViewer", () => {
  let service: BrandingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit }
      ]
    }).compile();
    service = module.get(BrandingService);
  });

  it("returns the active scheme's colours when activeColorScheme is set", async () => {
    const scheme = makeScheme();
    mockPrisma.companyProfile.findUnique.mockResolvedValue(
      makeProfile({ activeColorScheme: scheme })
    );

    const result = await service.getActiveBrandingForViewer();

    expect(result.primaryColorHex).toBe(scheme.primaryColorHex);
    expect(result.secondaryColorHex).toBe(scheme.secondaryColorHex);
  });

  it("falls back to legacy CompanyProfile columns when activeColorSchemeId is null", async () => {
    const profile = makeProfile({ activeColorScheme: null });
    mockPrisma.companyProfile.findUnique.mockResolvedValue(profile);

    const result = await service.getActiveBrandingForViewer();

    expect(result.primaryColorHex).toBe(profile.primaryColorHex);
    expect(result.secondaryColorHex).toBe(profile.secondaryColorHex);
  });

  it("returned object has EXACTLY seventeen keys — S3 widens from four intentionally (regression guard)", async () => {
    mockPrisma.companyProfile.findUnique.mockResolvedValue(makeProfile());

    const result = await service.getActiveBrandingForViewer();
    const keys = Object.keys(result).sort();

    expect(keys).toEqual(VIEWER_KEYS_17);
  });

  it("returns seventeen null values when company profile is not found", async () => {
    mockPrisma.companyProfile.findUnique.mockResolvedValue(null);

    const result = await service.getActiveBrandingForViewer();

    expect(result).toEqual({
      primaryColorHex: null,
      secondaryColorHex: null,
      logoLightUrl: null,
      logoDarkUrl: null,
      sidebarBgHex: null,
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
      statusNeutralHex: null
    });
  });

  it("includes logo urls from the profile regardless of whether a scheme is active", async () => {
    const profile = makeProfile({
      activeColorScheme: makeScheme(),
      logoLightUrl: "https://cdn.example.com/light.png",
      logoDarkUrl: "https://cdn.example.com/dark.png"
    });
    mockPrisma.companyProfile.findUnique.mockResolvedValue(profile);

    const result = await service.getActiveBrandingForViewer();

    expect(result.logoLightUrl).toBe("https://cdn.example.com/light.png");
    expect(result.logoDarkUrl).toBe("https://cdn.example.com/dark.png");
  });

  it("a scheme with all thirteen S3 columns null still returns all keys present and null", async () => {
    const scheme = makeScheme(); // all S3 fields are null by default in makeScheme
    mockPrisma.companyProfile.findUnique.mockResolvedValue(
      makeProfile({ activeColorScheme: scheme })
    );

    const result = await service.getActiveBrandingForViewer();

    for (const field of S3_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(result, field)).toBe(true);
      expect(result[field]).toBeNull();
    }
  });

  it("returns S3 palette values from the active scheme when they are set", async () => {
    const scheme = makeScheme({ sidebarBgHex: "#001122", statusDangerHex: "#FF0000" });
    mockPrisma.companyProfile.findUnique.mockResolvedValue(
      makeProfile({ activeColorScheme: scheme })
    );

    const result = await service.getActiveBrandingForViewer();

    expect(result.sidebarBgHex).toBe("#001122");
    expect(result.statusDangerHex).toBe("#FF0000");
  });
});

// ── Suite: upsertColorScheme validation ───────────────────────────────────────

describe("BrandingService.upsertColorScheme — hex validation", () => {
  let service: BrandingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditService, useValue: mockAudit }
      ]
    }).compile();
    service = module.get(BrandingService);
  });

  it("rejects an invalid hex in primaryColorHex", async () => {
    await expect(
      service.upsertColorScheme("actor-1", {
        name: "Test",
        primaryColorHex: "not-a-hex",
        secondaryColorHex: "#FFFFFF"
      })
    ).rejects.toThrow("primaryColorHex");
  });

  it("rejects an invalid hex in secondaryColorHex", async () => {
    await expect(
      service.upsertColorScheme("actor-1", {
        name: "Test",
        primaryColorHex: "#000000",
        secondaryColorHex: "bad"
      })
    ).rejects.toThrow("secondaryColorHex");
  });

  // Parameterised: one case per S3 column
  const s3Cases: Array<{ field: typeof S3_FIELDS[number] }> = S3_FIELDS.map((field) => ({ field }));

  for (const { field } of s3Cases) {
    it(`rejects an invalid hex in ${field}`, async () => {
      await expect(
        service.upsertColorScheme("actor-1", {
          name: "Test",
          primaryColorHex: "#000000",
          secondaryColorHex: "#FFFFFF",
          [field]: "invalid"
        })
      ).rejects.toThrow(field);
    });
  }

  it("accepts valid hex in all thirteen S3 columns simultaneously", async () => {
    const validHex = "#AABBCC";
    const fullDto = {
      name: "Full Palette",
      primaryColorHex: "#000001",
      secondaryColorHex: "#000002",
      sidebarBgHex: validHex,
      sidebarTextHex: validHex,
      sidebarTextActiveHex: validHex,
      surfacePageHex: validHex,
      surfaceCardHex: validHex,
      textPrimaryHex: validHex,
      textSecondaryHex: validHex,
      textMutedHex: validHex,
      statusActiveHex: validHex,
      statusWarningHex: validHex,
      statusDangerHex: validHex,
      statusInfoHex: validHex,
      statusNeutralHex: validHex
    };
    mockPrisma.brandColorScheme.upsert.mockResolvedValue({ id: "scheme-1", name: "Full Palette" });
    mockAudit.write.mockResolvedValue(undefined);

    await expect(service.upsertColorScheme("actor-1", fullDto)).resolves.toBeDefined();
  });
});
