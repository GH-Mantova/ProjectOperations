import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { BrandAssetKind } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { COMPANY_PROFILE_ID } from "../company-profile/company-profile.service";

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** The thirteen S3 palette fields — all optional (nullable on the schema). */
const S3_PALETTE_FIELDS = [
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

type S3PaletteField = (typeof S3_PALETTE_FIELDS)[number];
type S3PaletteData = Partial<Record<S3PaletteField, string | null>>;

export type UpsertColorSchemeDto = {
  name: string;
  primaryColorHex: string;
  secondaryColorHex: string;
} & S3PaletteData;

export type UpsertBrandAssetDto = {
  kind: BrandAssetKind;
  url: string;
};

/**
 * Branding manager. Reads/writes BrandColorScheme + BrandAsset and drives
 * CompanyProfile.activeColorSchemeId. Legacy string columns on CompanyProfile
 * are kept in sync so downstream readers that still consult the strings see
 * the same values as the new relations — until a later contract PR drops
 * them.
 */
@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Aggregate view of the current branding: active scheme, all schemes,
   * assets keyed by kind, plus the legacy string fallbacks so a caller can
   * render coherently regardless of which side has data.
   */
  async getBranding() {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { id: COMPANY_PROFILE_ID },
      select: {
        id: true,
        primaryColorHex: true,
        secondaryColorHex: true,
        logoLightUrl: true,
        logoDarkUrl: true,
        faviconUrl: true,
        pdfLetterheadUrl: true,
        activeColorSchemeId: true,
        activeColorScheme: true,
        brandAssets: true
      }
    });
    if (!profile) {
      throw new NotFoundException(
        "Company profile has not been seeded — branding is unavailable."
      );
    }
    const schemes = await this.prisma.brandColorScheme.findMany({
      orderBy: { name: "asc" }
    });
    const assetsByKind: Record<BrandAssetKind, string | null> = {
      LOGO_LIGHT: null,
      LOGO_DARK: null,
      FAVICON: null,
      PDF_LETTERHEAD: null
    };
    for (const asset of profile.brandAssets) {
      assetsByKind[asset.kind] = asset.url;
    }
    return {
      activeColorSchemeId: profile.activeColorSchemeId,
      activeColorScheme: profile.activeColorScheme,
      schemes,
      assets: assetsByKind,
      legacy: {
        primaryColorHex: profile.primaryColorHex,
        secondaryColorHex: profile.secondaryColorHex,
        logoLightUrl: profile.logoLightUrl,
        logoDarkUrl: profile.logoDarkUrl,
        faviconUrl: profile.faviconUrl,
        pdfLetterheadUrl: profile.pdfLetterheadUrl
      }
    };
  }

  async listColorSchemes() {
    return this.prisma.brandColorScheme.findMany({ orderBy: { name: "asc" } });
  }

  /** Create-or-update by name. Idempotent — the seed relies on this shape. */
  async upsertColorScheme(actorId: string, dto: UpsertColorSchemeDto) {
    this.assertHex(dto.primaryColorHex, "primaryColorHex");
    this.assertHex(dto.secondaryColorHex, "secondaryColorHex");

    // Validate each optional S3 palette column if provided.
    for (const field of S3_PALETTE_FIELDS) {
      const value = dto[field];
      if (value != null) {
        this.assertHex(value, field);
      }
    }

    // Build the palette data for the thirteen new columns.
    const paletteData: S3PaletteData = {};
    for (const field of S3_PALETTE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(dto, field)) {
        paletteData[field] = dto[field] ?? null;
      }
    }

    const scheme = await this.prisma.brandColorScheme.upsert({
      where: { name: dto.name },
      create: {
        name: dto.name,
        primaryColorHex: dto.primaryColorHex,
        secondaryColorHex: dto.secondaryColorHex,
        ...paletteData
      },
      update: {
        primaryColorHex: dto.primaryColorHex,
        secondaryColorHex: dto.secondaryColorHex,
        ...paletteData
      }
    });
    await this.audit.write({
      actorId,
      action: "branding.colorScheme.upsert",
      entityType: "BrandColorScheme",
      entityId: scheme.id,
      metadata: { name: scheme.name }
    });
    return scheme;
  }

  async deleteColorScheme(actorId: string, id: string) {
    const existing = await this.prisma.brandColorScheme.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`BrandColorScheme ${id} not found.`);
    }
    await this.prisma.brandColorScheme.delete({ where: { id } });
    await this.audit.write({
      actorId,
      action: "branding.colorScheme.delete",
      entityType: "BrandColorScheme",
      entityId: id,
      metadata: { name: existing.name }
    });
  }

  /** Point the singleton at a scheme (or clear it with null). Also mirrors
   * the palette into the legacy string columns so PDF/email/UI paths that
   * have not yet migrated see the same values.
   */
  async setActiveColorScheme(actorId: string, schemeId: string | null) {
    let mirror: { primaryColorHex: string; secondaryColorHex: string } | null = null;
    if (schemeId !== null) {
      const scheme = await this.prisma.brandColorScheme.findUnique({
        where: { id: schemeId }
      });
      if (!scheme) {
        throw new NotFoundException(`BrandColorScheme ${schemeId} not found.`);
      }
      mirror = {
        primaryColorHex: scheme.primaryColorHex,
        secondaryColorHex: scheme.secondaryColorHex
      };
    }
    await this.prisma.companyProfile.update({
      where: { id: COMPANY_PROFILE_ID },
      data: {
        activeColorSchemeId: schemeId,
        updatedById: actorId,
        ...(mirror ?? {})
      }
    });
    await this.audit.write({
      actorId,
      action: "branding.activeColorScheme.set",
      entityType: "CompanyProfile",
      entityId: COMPANY_PROFILE_ID,
      metadata: { schemeId }
    });
    return this.getBranding();
  }

  /** One asset per kind on the singleton. Upsert on (profileId, kind). Also
   * mirrors into the legacy string column so unmigrated readers agree.
   */
  async upsertAsset(actorId: string, dto: UpsertBrandAssetDto) {
    if (!dto.url || dto.url.trim().length === 0) {
      throw new BadRequestException("Brand asset URL cannot be empty.");
    }
    const asset = await this.prisma.brandAsset.upsert({
      where: {
        profileId_kind: { profileId: COMPANY_PROFILE_ID, kind: dto.kind }
      },
      create: { profileId: COMPANY_PROFILE_ID, kind: dto.kind, url: dto.url },
      update: { url: dto.url }
    });
    await this.prisma.companyProfile.update({
      where: { id: COMPANY_PROFILE_ID },
      data: { ...this.legacyMirrorForKind(dto.kind, dto.url), updatedById: actorId }
    });
    await this.audit.write({
      actorId,
      action: "branding.asset.upsert",
      entityType: "BrandAsset",
      entityId: asset.id,
      metadata: { kind: dto.kind }
    });
    return asset;
  }

  async deleteAsset(actorId: string, kind: BrandAssetKind) {
    const existing = await this.prisma.brandAsset.findUnique({
      where: { profileId_kind: { profileId: COMPANY_PROFILE_ID, kind } }
    });
    if (!existing) {
      throw new NotFoundException(`Brand asset ${kind} not found.`);
    }
    await this.prisma.brandAsset.delete({
      where: { profileId_kind: { profileId: COMPANY_PROFILE_ID, kind } }
    });
    await this.prisma.companyProfile.update({
      where: { id: COMPANY_PROFILE_ID },
      data: { ...this.legacyMirrorForKind(kind, null), updatedById: actorId }
    });
    await this.audit.write({
      actorId,
      action: "branding.asset.delete",
      entityType: "BrandAsset",
      entityId: existing.id,
      metadata: { kind }
    });
  }

  private legacyMirrorForKind(kind: BrandAssetKind, url: string | null) {
    switch (kind) {
      case "LOGO_LIGHT":
        return { logoLightUrl: url };
      case "LOGO_DARK":
        return { logoDarkUrl: url };
      case "FAVICON":
        return { faviconUrl: url };
      case "PDF_LETTERHEAD":
        return { pdfLetterheadUrl: url };
    }
  }

  /**
   * Narrow read for every authenticated user — returns exactly seventeen keys
   * (S3 widens the original four to include the full palette).
   * Precedence: active scheme first for palette columns; logos from CompanyProfile.
   * Never exposes scheme ids, names, lists, favicon, or letterhead.
   */
  async getActiveBrandingForViewer(): Promise<{
    primaryColorHex: string | null;
    secondaryColorHex: string | null;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    sidebarBgHex: string | null;
    sidebarTextHex: string | null;
    sidebarTextActiveHex: string | null;
    surfacePageHex: string | null;
    surfaceCardHex: string | null;
    textPrimaryHex: string | null;
    textSecondaryHex: string | null;
    textMutedHex: string | null;
    statusActiveHex: string | null;
    statusWarningHex: string | null;
    statusDangerHex: string | null;
    statusInfoHex: string | null;
    statusNeutralHex: string | null;
  }> {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { id: COMPANY_PROFILE_ID },
      select: {
        primaryColorHex: true,
        secondaryColorHex: true,
        logoLightUrl: true,
        logoDarkUrl: true,
        activeColorScheme: {
          select: {
            primaryColorHex: true,
            secondaryColorHex: true,
            sidebarBgHex: true,
            sidebarTextHex: true,
            sidebarTextActiveHex: true,
            surfacePageHex: true,
            surfaceCardHex: true,
            textPrimaryHex: true,
            textSecondaryHex: true,
            textMutedHex: true,
            statusActiveHex: true,
            statusWarningHex: true,
            statusDangerHex: true,
            statusInfoHex: true,
            statusNeutralHex: true
          }
        }
      }
    });
    if (!profile) {
      return {
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
      };
    }
    const scheme = profile.activeColorScheme;
    return {
      primaryColorHex: scheme?.primaryColorHex ?? profile.primaryColorHex,
      secondaryColorHex: scheme?.secondaryColorHex ?? profile.secondaryColorHex,
      logoLightUrl: profile.logoLightUrl,
      logoDarkUrl: profile.logoDarkUrl,
      sidebarBgHex: scheme?.sidebarBgHex ?? null,
      sidebarTextHex: scheme?.sidebarTextHex ?? null,
      sidebarTextActiveHex: scheme?.sidebarTextActiveHex ?? null,
      surfacePageHex: scheme?.surfacePageHex ?? null,
      surfaceCardHex: scheme?.surfaceCardHex ?? null,
      textPrimaryHex: scheme?.textPrimaryHex ?? null,
      textSecondaryHex: scheme?.textSecondaryHex ?? null,
      textMutedHex: scheme?.textMutedHex ?? null,
      statusActiveHex: scheme?.statusActiveHex ?? null,
      statusWarningHex: scheme?.statusWarningHex ?? null,
      statusDangerHex: scheme?.statusDangerHex ?? null,
      statusInfoHex: scheme?.statusInfoHex ?? null,
      statusNeutralHex: scheme?.statusNeutralHex ?? null
    };
  }

  private assertHex(value: string, field: string) {
    if (!HEX_COLOR.test(value)) {
      throw new BadRequestException(
        `${field} must be a 6-digit hex colour like "#005B61".`
      );
    }
  }

  /** Server-side super-user enforcement — the UI guard is not enough. Mirrors
   * CompanyProfileService.assertSuperUser so both admin surfaces behave the
   * same way (RatesListsAdminPage 2026-07-10 lesson).
   */
  assertSuperUser(user: { isSuperUser?: boolean } | undefined) {
    if (!user?.isSuperUser) {
      throw new ForbiddenException(
        "Branding changes require a super-user account."
      );
    }
  }
}
