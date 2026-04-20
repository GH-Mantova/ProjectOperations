import { BadRequestException, Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PlatformConfigService } from "./platform-config.service";

class UpdateAnthropicKeyDto {
  @IsString()
  anthropicApiKey!: string;
}

@ApiTags("Platform Config (Admin)")
@ApiBearerAuth()
@Controller("admin/platform-config")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PlatformConfigController {
  constructor(private readonly service: PlatformConfigService) {}

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Status of platform integrations (masked Anthropic key + SharePoint mode)" })
  @ApiResponse({ status: 200, description: "Integration status. Never returns the full Anthropic key." })
  status() {
    return this.service.status();
  }

  @Patch()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Set or replace the Anthropic API key (stored encrypted at rest)" })
  @ApiResponse({ status: 200, description: "Updated integration status." })
  async update(@Body() dto: UpdateAnthropicKeyDto, @CurrentUser() actor: { sub: string }) {
    try {
      return await this.service.setAnthropicApiKey(dto.anthropicApiKey, actor.sub);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post("test-anthropic")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Make a tiny live call to Anthropic to verify the configured key" })
  testAnthropic() {
    return this.service.testAnthropicKey();
  }
}
