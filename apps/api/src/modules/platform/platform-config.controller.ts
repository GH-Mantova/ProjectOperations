import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PROVIDER_PRIORITY, PlatformConfigService, type AiProviderName } from "./platform-config.service";

class UpdatePlatformConfigDto {
  @IsOptional() @IsString() anthropicApiKey?: string;
  @IsOptional() @IsString() anthropicModel?: string | null;
  @IsOptional() @IsString() geminiApiKey?: string;
  @IsOptional() @IsString() geminiModel?: string | null;
  @IsOptional() @IsString() groqApiKey?: string;
  @IsOptional() @IsString() groqModel?: string | null;
  @IsOptional() @IsString() openaiApiKey?: string;
  @IsOptional() @IsString() openaiModel?: string | null;
  @IsOptional()
  @IsIn([...PROVIDER_PRIORITY, "auto"] as string[])
  preferredProvider?: AiProviderName | "auto";
}

@ApiTags("Platform Config (Admin)")
@ApiBearerAuth()
@Controller("admin/platform-config")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Status of platform integrations — masked API keys + chosen model per provider, active AI provider, SharePoint mode."
  })
  @ApiResponse({ status: 200, description: "Integration status. Never returns full API keys." })
  status() {
    return this.service.status();
  }

  @Patch()
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Set or replace any of the AI provider keys + models, and/or pick a preferred provider. All keys are encrypted at rest."
  })
  @ApiResponse({ status: 200, description: "Updated integration status." })
  async update(@Body() dto: UpdatePlatformConfigDto, @CurrentUser() actor: { sub: string }) {
    try {
      if (dto.anthropicApiKey !== undefined) {
        await this.service.setAnthropicApiKey(dto.anthropicApiKey, actor.sub);
      }
      if (dto.anthropicModel !== undefined) {
        await this.service.setModel("anthropic", dto.anthropicModel ?? null, actor.sub);
      }
      if (dto.geminiApiKey !== undefined) {
        await this.service.setGeminiApiKey(dto.geminiApiKey, actor.sub);
      }
      if (dto.geminiModel !== undefined) {
        await this.service.setModel("gemini", dto.geminiModel ?? null, actor.sub);
      }
      if (dto.groqApiKey !== undefined) {
        await this.service.setGroqApiKey(dto.groqApiKey, actor.sub);
      }
      if (dto.groqModel !== undefined) {
        await this.service.setModel("groq", dto.groqModel ?? null, actor.sub);
      }
      if (dto.openaiApiKey !== undefined) {
        await this.service.setOpenAiApiKey(dto.openaiApiKey, actor.sub);
      }
      if (dto.openaiModel !== undefined) {
        await this.service.setModel("openai", dto.openaiModel ?? null, actor.sub);
      }
      if (dto.preferredProvider !== undefined) {
        const next = dto.preferredProvider === "auto" ? null : dto.preferredProvider;
        await this.service.setPreferredProvider(next, actor.sub);
      }
      return await this.service.status();
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post("test-anthropic")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Make a tiny live call to Anthropic to verify the configured key." })
  testAnthropic() {
    return this.service.testAnthropicKey();
  }

  @Post("test-gemini")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Make a tiny live call to Google Gemini to verify the configured key." })
  testGemini() {
    return this.service.testGeminiKey();
  }

  @Post("test-groq")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Make a tiny live call to Groq to verify the configured key." })
  testGroq() {
    return this.service.testGroqKey();
  }

  @Post("test-openai")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Make a tiny live call to OpenAI to verify the configured key." })
  testOpenAi() {
    return this.service.testOpenAiKey();
  }
}

@ApiTags("AI Providers (Admin)")
@ApiBearerAuth()
@Controller("admin/ai-providers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AiProvidersController {
  constructor(private readonly service: PlatformConfigService) {}

  @Get(":provider/models")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "List available models for the provider using its configured API key. Claude returns a hardcoded list (no models endpoint exists)."
  })
  @ApiResponse({ status: 200, description: "{ provider, models: string[] } — sorted alphabetically." })
  @ApiResponse({ status: 400, description: "Key not configured, invalid, or network failure." })
  async listModels(@Param("provider") provider: string) {
    if (!PROVIDER_PRIORITY.includes(provider as AiProviderName)) {
      throw new BadRequestException(
        `Unknown provider "${provider}". Expected one of ${PROVIDER_PRIORITY.join(", ")}.`
      );
    }
    try {
      return await this.service.listModels(provider as AiProviderName);
    } catch (err) {
      throw new BadRequestException({
        error: "Could not fetch models",
        detail: `${(err as Error).message} Check your API key is valid and has the correct permissions.`
      });
    }
  }
}
