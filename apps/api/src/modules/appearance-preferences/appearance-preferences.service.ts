import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/** Version marker — gated by done_when in the pipeline prompt. */
export const APPEARANCE_PREFERENCES_V1 = "brandtheme-s7c-1";

const VALID_DENSITIES = ["comfortable", "compact"] as const;
type Density = (typeof VALID_DENSITIES)[number];

/** Shape returned by GET /appearance-preferences/me */
export type AppearancePreferenceResult = {
  density: Density;
  colourSchemeId: string | null;
  colourScheme: {
    id: string;
    name: string;
    isCompanyDefault: boolean;
    primaryColorHex: string;
    secondaryColorHex: string;
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
  } | null;
};

/** Body shape for PUT /appearance-preferences/me */
export type UpdateAppearanceDto = {
  density?: string;
  colourSchemeId?: string | null;
};

const SCHEME_SELECT = {
  id: true,
  name: true,
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
} as const;

/**
 * Resolves whether a given scheme is the company default by checking whether
 * CompanyProfile.activeColorSchemeId points to it.
 */
async function resolveIsCompanyDefault(
  prisma: PrismaService,
  schemeId: string | null
): Promise<boolean> {
  if (!schemeId) return false;
  const profile = await prisma.companyProfile.findUnique({
    where: { id: "singleton" },
    select: { activeColorSchemeId: true }
  });
  return profile?.activeColorSchemeId === schemeId;
}

@Injectable()
export class AppearancePreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return the caller's appearance preferences.
   * If no row exists, returns the defaults without creating a row.
   */
  async getForUser(userId: string): Promise<AppearancePreferenceResult> {
    const row = await this.prisma.userAppearancePreference.findUnique({
      where: { userId },
      select: {
        density: true,
        colourSchemeId: true,
        colourScheme: { select: SCHEME_SELECT }
      }
    });

    if (!row) {
      return { density: "comfortable", colourSchemeId: null, colourScheme: null };
    }

    const density: Density =
      row.density === "compact" ? "compact" : "comfortable";

    let colourScheme: AppearancePreferenceResult["colourScheme"] = null;
    if (row.colourScheme) {
      const isCompanyDefault = await resolveIsCompanyDefault(
        this.prisma,
        row.colourSchemeId
      );
      colourScheme = { ...row.colourScheme, isCompanyDefault };
    }

    return { density, colourSchemeId: row.colourSchemeId, colourScheme };
  }

  /**
   * Upsert the caller's appearance preferences.
   * - density must be "comfortable" or "compact" (if provided).
   * - colourSchemeId must be null or an existing BrandColorScheme.id (if provided).
   */
  async updateForUser(
    userId: string,
    dto: UpdateAppearanceDto
  ): Promise<AppearancePreferenceResult> {
    const update: { density?: string | null; colourSchemeId?: string | null } =
      {};

    if (dto.density !== undefined) {
      if (!VALID_DENSITIES.includes(dto.density as Density)) {
        throw new BadRequestException(
          `density must be "comfortable" or "compact".`
        );
      }
      update.density = dto.density;
    }

    if (Object.prototype.hasOwnProperty.call(dto, "colourSchemeId")) {
      if (dto.colourSchemeId === null || dto.colourSchemeId === undefined) {
        update.colourSchemeId = null;
      } else {
        const scheme = await this.prisma.brandColorScheme.findUnique({
          where: { id: dto.colourSchemeId }
        });
        if (!scheme) {
          throw new BadRequestException(
            `colourSchemeId "${dto.colourSchemeId}" does not reference an existing colour scheme.`
          );
        }
        update.colourSchemeId = dto.colourSchemeId;
      }
    }

    await this.prisma.userAppearancePreference.upsert({
      where: { userId },
      create: { userId, ...update },
      update
    });

    return this.getForUser(userId);
  }
}
