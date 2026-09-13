import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { BrandAssetKind } from "@prisma/client";
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.interface";
import { BrandingService } from "./branding.service";

class UpsertColorSchemeDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsString() @MaxLength(9) primaryColorHex!: string;
  @IsString() @MaxLength(9) secondaryColorHex!: string;

  // S3 palette — all optional; omitting a field leaves the DB value unchanged.
  @IsOptional() @IsString() @MaxLength(9) sidebarBgHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) sidebarTextHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) sidebarTextActiveHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) surfacePageHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) surfaceCardHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) textPrimaryHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) textSecondaryHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) textMutedHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) statusActiveHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) statusWarningHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) statusDangerHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) statusInfoHex?: string | null;
  @IsOptional() @IsString() @MaxLength(9) statusNeutralHex?: string | null;
}

class SetActiveColorSchemeDto {
  @IsOptional() @IsString() schemeId?: string | null;
}

class UpsertBrandAssetDto {
  @IsIn(["LOGO_LIGHT", "LOGO_DARK", "FAVICON", "PDF_LETTERHEAD"])
  kind!: BrandAssetKind;

  @IsString() @MinLength(1) @MaxLength(1000) url!: string;
}

@ApiTags("Branding")
@ApiBearerAuth()
@Controller("admin/branding")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Read the current branding: active color scheme, all schemes, per-kind assets, and the legacy string fallbacks."
  })
  getBranding() {
    return this.service.getBranding();
  }

  @Get("color-schemes")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List all named color schemes." })
  listColorSchemes() {
    return this.service.listColorSchemes();
  }

  @Post("color-schemes")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Create or update a named color scheme. Super-user only." })
  upsertColorScheme(@Body() dto: UpsertColorSchemeDto, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    return this.service.upsertColorScheme(req.user!.sub, dto);
  }

  @Delete("color-schemes/:id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a color scheme. Super-user only." })
  async deleteColorScheme(@Param("id") id: string, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    await this.service.deleteColorScheme(req.user!.sub, id);
    return { ok: true };
  }

  @Put("active-color-scheme")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Point the singleton at a color scheme (or clear it with null). Mirrors palette into the legacy string columns. Super-user only."
  })
  setActiveColorScheme(
    @Body() dto: SetActiveColorSchemeDto,
    @Req() req: AuthenticatedRequest
  ) {
    this.service.assertSuperUser(req.user);
    return this.service.setActiveColorScheme(req.user!.sub, dto.schemeId ?? null);
  }

  @Put("assets")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Create-or-update a per-kind brand asset URL. Also mirrors the URL into the matching legacy string column. Super-user only."
  })
  upsertAsset(@Body() dto: UpsertBrandAssetDto, @Req() req: AuthenticatedRequest) {
    this.service.assertSuperUser(req.user);
    return this.service.upsertAsset(req.user!.sub, dto);
  }

  @Delete("assets/:kind")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a per-kind brand asset. Super-user only." })
  async deleteAsset(
    @Param("kind") kind: BrandAssetKind,
    @Req() req: AuthenticatedRequest
  ) {
    this.service.assertSuperUser(req.user);
    await this.service.deleteAsset(req.user!.sub, kind);
    return { ok: true };
  }
}

/**
 * Unprivileged read — any authenticated user may call GET /branding/active.
 *
 * NOTE: PermissionsGuard is intentionally OMITTED. Its source shows that when
 * no @RequirePermissions decorator is present, the guard returns true (allow),
 * so including it would be harmless — but the spec requires only JwtAuthGuard
 * here to make the intent explicit and prevent future reviewers from adding a
 * blanket class-level @RequirePermissions that would lock out regular users.
 *
 * Returns EXACTLY seventeen keys: the original four (primaryColorHex,
 * secondaryColorHex, logoLightUrl, logoDarkUrl) plus the thirteen S3 palette
 * columns. No scheme ids, names, lists, favicon, or letterhead.
 */
@ApiTags("Branding")
@ApiBearerAuth()
@Controller("branding")
@UseGuards(JwtAuthGuard)
export class BrandingViewerController {
  constructor(private readonly service: BrandingService) {}

  @Get("active")
  @ApiOperation({
    summary:
      "Return the active brand colours and logo URLs for the current company. " +
      "Available to every authenticated user — primary, accent, and S3 palette " +
      "are applied across the app. Returns exactly seventeen keys."
  })
  getActiveBranding() {
    return this.service.getActiveBrandingForViewer();
  }
}
