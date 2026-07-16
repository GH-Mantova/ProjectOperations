import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { PublicLinkService } from "./public-link.service";
import {
  CreatePublicLinkDto,
  PublicSubmitDto,
  UpdatePublicLinkDto
} from "./dto/public-link.dto";
import { PublicLinkRateLimitGuard } from "./public-link-rate-limit.guard";

/**
 * Public / Kiosk / QR form capture endpoints (PR #621).
 *
 * Two classes of routes:
 *  - Authenticated management (mint links, list, deactivate) under /forms/public-links/*
 *  - UNAUTHENTICATED public capture under /forms/public/:token/*
 *    (rate-limited; no JWT required; no authenticated data exposed)
 */
@ApiTags("Forms - Public Links")
@Controller("forms")
export class PublicLinkController {
  constructor(private readonly service: PublicLinkService) {}

  // ── Authenticated management ──────────────────────────────────────────

  /**
   * Mint a new public or kiosk link for a form template.
   * Returns the link object including the generated token.
   */
  @Post("public-links")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Mint a public or kiosk link for a form template" })
  @ApiResponse({ status: 201, description: "Created public link with token." })
  createLink(
    @Body() dto: CreatePublicLinkDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.createLink(dto, user.sub);
  }

  /**
   * List all public links, optionally filtered by templateId.
   */
  @Get("public-links")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "List public/kiosk links" })
  @ApiResponse({ status: 200, description: "Array of public link objects." })
  @ApiQuery({ name: "templateId", required: false, type: String })
  listLinks(@Query("templateId") templateId?: string) {
    return this.service.listLinks(templateId);
  }

  /**
   * Update a public link's active status, label, or expiry.
   */
  @Patch("public-links/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Update a public link (toggle active, set expiry, etc.)" })
  @ApiResponse({ status: 200, description: "Updated public link." })
  updateLink(@Param("id") id: string, @Body() dto: UpdatePublicLinkDto) {
    return this.service.updateLink(id, dto);
  }

  /**
   * Delete a public link permanently.
   */
  @Delete("public-links/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Delete a public link permanently" })
  @ApiResponse({ status: 200, description: "{ ok: true }" })
  deleteLink(@Param("id") id: string) {
    return this.service.deleteLink(id);
  }

  // ── Unauthenticated public / kiosk endpoints ──────────────────────────

  /**
   * Return the blank template for a token (no login required).
   *
   * Exposes ONLY template name, fields, labels, types, and required flags.
   * Never exposes authenticated data, submission history, or internal config.
   * Rate-limited: 30 requests per IP per token per 60 seconds.
   */
  @Get("public/:token")
  @UseGuards(PublicLinkRateLimitGuard)
  @ApiOperation({
    summary:
      "Return blank form template for a public/kiosk token (unauthenticated, rate-limited)"
  })
  @ApiResponse({ status: 200, description: "Blank template payload safe for anonymous users." })
  @ApiResponse({ status: 403, description: "Link inactive." })
  @ApiResponse({ status: 404, description: "Token not found." })
  @ApiResponse({ status: 410, description: "Link expired or submission cap reached." })
  @ApiResponse({ status: 429, description: "Rate limit exceeded." })
  getPublicTemplate(@Param("token") token: string) {
    return this.service.getPublicTemplate(token);
  }

  /**
   * Submit a form via a public/kiosk token (no login required).
   *
   * Validates required fields, persists the submission with
   * submittedById = null and publicLinkId set, increments the link counter,
   * and auto-deactivates the link when maxSubmissions is reached.
   *
   * Rate-limited: 30 requests per IP per token per 60 seconds.
   */
  @Post("public/:token/submit")
  @UseGuards(PublicLinkRateLimitGuard)
  @ApiOperation({
    summary: "Submit a form via a public/kiosk token (unauthenticated, rate-limited)"
  })
  @ApiResponse({ status: 201, description: "{ submissionId, status, submittedAt }" })
  @ApiResponse({ status: 400, description: "Required fields missing." })
  @ApiResponse({ status: 403, description: "Link inactive." })
  @ApiResponse({ status: 404, description: "Token not found." })
  @ApiResponse({ status: 410, description: "Link expired or submission cap reached." })
  @ApiResponse({ status: 429, description: "Rate limit exceeded." })
  publicSubmit(@Param("token") token: string, @Body() dto: PublicSubmitDto) {
    return this.service.publicSubmit(token, dto);
  }

  /**
   * Return the QR-code URL payload for a link token.
   * The payload is just the public URL; the frontend renders the QR.
   * Requires forms.manage to prevent token enumeration.
   */
  @Get("public-links/:id/qr")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions("forms.manage")
  @ApiOperation({
    summary: "Return the public URL and QR payload for a link (for display in the admin UI)"
  })
  @ApiResponse({ status: 200, description: "{ token, publicUrl }" })
  async getQrPayload(@Param("id") id: string) {
    const link = await this.service.listLinks().then((links) =>
      links.find((l) => l.id === id)
    );
    if (!link) {
      throw new Error("Public link not found.");
    }
    // The frontend will construct the full URL from this token.
    // We return a relative path; the frontend knows its own origin.
    return {
      token: link.token,
      publicPath: `/forms/public/${link.token}`,
      mode: link.mode
    };
  }
}
