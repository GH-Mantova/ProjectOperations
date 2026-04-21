import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PROVIDER_PRIORITY } from "../platform/platform-config.service";
import { UserAiProvidersService } from "./user-ai-providers.service";

class CreateProviderDto {
  @IsString()
  @IsIn(PROVIDER_PRIORITY as unknown as string[])
  provider!: string;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  model?: string;
}

class UpdateProviderDto {
  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  label?: string | null;

  @IsOptional()
  @IsString()
  model?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class PreferenceDto {
  @IsOptional()
  @IsString()
  providerId?: string | null;
}

class ListModelsDto {
  @IsString()
  @IsIn(PROVIDER_PRIORITY as unknown as string[])
  provider!: string;

  @IsString()
  apiKey!: string;
}

@ApiTags("User AI Providers")
@ApiBearerAuth()
@Controller("user/ai-providers")
@UseGuards(JwtAuthGuard)
export class UserAiProvidersController {
  constructor(private readonly service: UserAiProvidersService) {}

  @Get()
  @ApiOperation({ summary: "List the calling user's personal AI providers (keys masked) and the configured company providers." })
  @ApiResponse({ status: 200, description: "{ personal: [...], company: [...] } — all keys masked." })
  list(@CurrentUser() actor: { sub: string }) {
    return this.service.listForUser(actor.sub);
  }

  @Get("available")
  @ApiOperation({
    summary:
      "Flat list of providers available to the user for point-of-use selection: company providers first (priority order), then personal, sorted alphabetically."
  })
  @ApiResponse({
    status: 200,
    description: "{ id, type, source, label, model, isDefault } — isDefault=true marks the user's last choice."
  })
  available(@CurrentUser() actor: { sub: string }) {
    return this.service.available(actor.sub);
  }

  @Post()
  @ApiOperation({ summary: "Test-then-save a personal AI provider key. 400 with { error: 'invalid_key' } if the test call fails." })
  @ApiResponse({ status: 201, description: "Created provider (key masked)." })
  @ApiResponse({ status: 400, description: "invalid_key — the test call to the provider failed." })
  create(@Body() dto: CreateProviderDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(actor.sub, dto);
  }

  @Patch("preference")
  @ApiOperation({ summary: "Remember the provider the user just picked so we can skip the modal next time." })
  preference(@Body() dto: PreferenceDto, @CurrentUser() actor: { sub: string }) {
    return this.service.setPreference(actor.sub, dto.providerId ?? null);
  }

  @Post("list-models")
  @ApiOperation({ summary: "Fetch available models for a provider using an unsaved API key (used by the Add flow)." })
  listModels(@Body() dto: ListModelsDto) {
    return this.service.listModelsForKey(dto.provider, dto.apiKey);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a personal provider. If apiKey is provided, it's re-tested before save." })
  @ApiResponse({ status: 403, description: "Not your provider." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateProviderDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.update(actor.sub, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a personal provider. Clears last-used preference if it pointed here." })
  @ApiResponse({ status: 403, description: "Not your provider." })
  remove(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.remove(actor.sub, id);
  }
}
