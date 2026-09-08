import { NotFoundException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { BrandingService } from "../branding.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { COMPANY_PROFILE_ID } from "../../company-profile/company-profile.service";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Suite ────────────────────────────────────────────────────────────────────

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

  it("returned object has EXACTLY four keys — no extras (TRAP 2 regression guard)", async () => {
    mockPrisma.companyProfile.findUnique.mockResolvedValue(makeProfile());

    const result = await service.getActiveBrandingForViewer();
    const keys = Object.keys(result).sort();

    expect(keys).toEqual(
      ["logoDarkUrl", "logoLightUrl", "primaryColorHex", "secondaryColorHex"].sort()
    );
  });

  it("returns four null values when company profile is not found", async () => {
    mockPrisma.companyProfile.findUnique.mockResolvedValue(null);

    const result = await service.getActiveBrandingForViewer();

    expect(result).toEqual({
      primaryColorHex: null,
      secondaryColorHex: null,
      logoLightUrl: null,
      logoDarkUrl: null
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
});
