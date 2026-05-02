import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import type { AiProviderName } from "../platform/platform-config.service";
import type { ProviderId } from "../security/key-validation.service";
import { AiSettingsService } from "./ai-settings.service";

const COMPANY_PROVIDERS: AiProviderName[] = ["anthropic", "openai", "gemini", "groq"];
const USER_PROVIDERS: ProviderId[] = ["anthropic", "openai", "gemini", "groq"];

class SaveKeyDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}

@ApiTags("AI Settings")
@ApiBearerAuth()
@Controller("ai-settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiSettingsController {
  constructor(private readonly service: AiSettingsService) {}

  // ── Company keys (super-user only) ────────────────────────────────
  @Get("company/keys")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary: "Status of company-wide AI provider keys (hasKey + validatedAt). Never returns plaintext."
  })
  @ApiResponse({ status: 200, description: "Per-provider key status." })
  async getCompanyKeys(@CurrentUser() actor: AuthenticatedUser) {
    this.assertSuperUser(actor);
    return this.service.getCompanyKeys();
  }

  @Post("company/keys/:provider")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Save a new company API key for the given provider. Validates live against the provider before storing (5s timeout). Returns categorised error on failure."
  })
  @ApiResponse({ status: 201, description: "{ ok: true, validatedAt } or { ok: false, error, category }." })
  async saveCompanyKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("provider") provider: string,
    @Body() dto: SaveKeyDto
  ) {
    this.assertSuperUser(actor);
    const verified = this.assertProvider(provider, COMPANY_PROVIDERS);
    return this.service.saveCompanyKey(verified, dto.apiKey, actor.sub);
  }

  @Delete("company/keys/:provider")
  @HttpCode(200)
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Remove the company API key for the given provider." })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async deleteCompanyKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("provider") provider: string
  ) {
    this.assertSuperUser(actor);
    const verified = this.assertProvider(provider, COMPANY_PROVIDERS);
    return this.service.deleteCompanyKey(verified, actor.sub);
  }

  // ── Per-user keys (BYOK) ──────────────────────────────────────────
  @Get("me/keys")
  @RequirePermissions("ai.persona.tendering")
  @ApiOperation({
    summary: "Status of the current user's personal API keys (hasKey + validatedAt). Never returns plaintext."
  })
  @ApiResponse({ status: 200, description: "Per-provider key status for req.user." })
  async getMyKeys(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.getUserKeys(actor.sub);
  }

  @Post("me/keys/:provider")
  @RequirePermissions("ai.persona.tendering")
  @ApiOperation({
    summary:
      "Save a personal API key for the current user. Gated on GlobalAISettings.allowBringYourOwnKey. Validates live before storing."
  })
  @ApiResponse({ status: 201, description: "{ ok: true, validatedAt } or { ok: false, error, category }." })
  async saveMyKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("provider") provider: string,
    @Body() dto: SaveKeyDto
  ) {
    const verified = this.assertProvider(provider, USER_PROVIDERS) as ProviderId;
    return this.service.saveUserKey(actor.sub, verified, dto.apiKey);
  }

  @Delete("me/keys/:provider")
  @HttpCode(200)
  @RequirePermissions("ai.persona.tendering")
  @ApiOperation({ summary: "Remove the current user's personal API key for the given provider." })
  @ApiResponse({ status: 200, description: "{ ok: true }." })
  async deleteMyKey(
    @CurrentUser() actor: AuthenticatedUser,
    @Param("provider") provider: string
  ) {
    const verified = this.assertProvider(provider, USER_PROVIDERS) as ProviderId;
    return this.service.deleteUserKey(actor.sub, verified);
  }

  private assertSuperUser(actor: AuthenticatedUser) {
    if (!actor.isSuperUser) {
      throw new ForbiddenException("Super-user access required for company key management.");
    }
  }

  private assertProvider<T extends string>(provider: string, allowed: readonly T[]): T {
    if (!(allowed as readonly string[]).includes(provider)) {
      throw new BadRequestException(
        `Unknown provider "${provider}". Expected one of ${allowed.join(", ")}.`
      );
    }
    return provider as T;
  }
}
