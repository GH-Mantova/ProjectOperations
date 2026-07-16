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

export type UpsertColorSchemeDto = {
  name: string;
  primaryColorHex: string;
  secondaryColorHex: string;
};

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
    const scheme = await this.prisma.brandColorScheme.upsert({
      where: { name: dto.name },
      create: dto,
      update: {
        primaryColorHex: dto.primaryColorHex,
        secondaryColorHex: dto.secondaryColorHex
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
