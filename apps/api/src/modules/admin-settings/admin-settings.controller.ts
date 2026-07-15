import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsIn, IsISO8601, IsNumber, IsOptional, IsString, Min, ValidateIf } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { IntegrationKeysService } from "../../common/integrations/integration-keys.service";
import { AdminSettingsService } from "./admin-settings.service";

class UpdateTriggerDto {
  @IsOptional() @IsBoolean() isEnabled?: boolean;
  @IsOptional() @IsIn(["both", "email", "inapp"]) deliveryMethod?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) recipientRoles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) recipientUserIds?: string[];
}

class UpdateEmailConfigDto {
  @IsOptional() @IsIn(["outlook", "gmail"]) provider?: string;
  @IsOptional() @IsString() senderAddress?: string;
  @IsOptional() @IsString() senderName?: string;
}

class UpdateOperationsSettingsDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsNumber() @Min(0)
  fuelPricePerLitre?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString()
  fuelPriceSource?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsISO8601()
  fuelPriceFetchedAt?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @Type(() => Number) @IsNumber() @Min(0)
  travelRatePerKm?: number | null;
}

class SetIntegrationValueDto {
  @IsString() value!: string;
}

@ApiTags("Admin Settings")
@ApiBearerAuth()
@Controller("admin/settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminSettingsController {
  constructor(
    private readonly service: AdminSettingsService,
    private readonly integrations: IntegrationKeysService
  ) {}

  @Get("notifications")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List all notification trigger configs ordered enabled-first then alphabetical." })
  @ApiResponse({ status: 200, description: "List all notification trigger configs ordered enabled-first then alphabetical." })
  listTriggers() {
    return this.service.listTriggers();
  }

  @Patch("notifications/:trigger")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update a trigger's isEnabled / deliveryMethod / recipients. 404 if trigger is not in the catalogue." })
  @ApiResponse({ status: 200, description: "Update a trigger's isEnabled / deliveryMethod / recipients. 404 if trigger is not in the catalogue." })
  updateTrigger(@Param("trigger") trigger: string, @Body() dto: UpdateTriggerDto) {
    return this.service.updateTrigger(trigger, dto);
  }

  @Get("email")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Get the email provider config singleton. Creates one on first access." })
  @ApiResponse({ status: 200, description: "Get the email provider config singleton. Creates one on first access." })
  getEmailConfig() {
    return this.service.getEmailConfig();
  }

  @Patch("email")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update the email provider config." })
  @ApiResponse({ status: 200, description: "Update the email provider config." })
  updateEmailConfig(@Body() dto: UpdateEmailConfigDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateEmailConfig(actor.sub, dto);
  }

  @Get("email/test")
  @RequirePermissions("platform.admin")
  @ApiOperation({
    summary:
      "Verify the configured email provider can reach the mail server. Never throws — returns { success, message } in the 200 body."
  })
  @ApiResponse({ status: 200, description: '{ success: boolean, message: string }' })
  testEmail() {
    return this.service.testEmailConnection();
  }

  @Get("operations")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Get the operations settings singleton (fuel price, travel rate). Creates the row on first access." })
  @ApiResponse({ status: 200, description: "Get the operations settings singleton (fuel price, travel rate). Creates the row on first access." })
  getOperationsSettings() {
    return this.service.getOperationsSettings();
  }

  @Patch("operations")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update operations settings (fuel price / travel rate). Omit a field to leave unchanged; pass null to clear." })
  @ApiResponse({ status: 200, description: "Update operations settings (fuel price / travel rate)." })
  updateOperationsSettings(
    @Body() dto: UpdateOperationsSettingsDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateOperationsSettings(actor.sub, dto);
  }

  @Get("users")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "All active users with first role name — used by the notification recipient picker." })
  @ApiResponse({ status: 200, description: "All active users with first role name — used by the notification recipient picker." })
  listUsers() {
    return this.service.listUsersForRecipientPicker();
  }

  // Third-party integration API keys (Geoapify, fuelpricesqld, future). Same
  // shape as ProviderKeyManager for AI keys: the browser only ever sees
  // configured/not-configured — never the decrypted value. Set/replace is
  // a single PUT with the plaintext body; delete clears the encrypted
  // column (env-var fallback may still make it "configured").
  @Get("integrations")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Status of every known third-party integration key (configured / source / updatedAt)." })
  @ApiResponse({ status: 200, description: "IntegrationCredentialStatus[]" })
  listIntegrations() {
    return this.integrations.list();
  }

  @Put("integrations/:slug")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Encrypt and store an integration key. Body: { value }. Never returned." })
  @ApiResponse({ status: 200, description: "IntegrationCredentialStatus" })
  async setIntegration(
    @Param("slug") slug: string,
    @Body() dto: SetIntegrationValueDto,
    @CurrentUser() actor: { sub: string }
  ) {
    if (!dto?.value || !dto.value.trim()) throw new BadRequestException("value is required.");
    return this.integrations.setValue(slug, dto.value, actor.sub);
  }

  @Delete("integrations/:slug")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Clear the stored value. Env-var fallback (if configured in Azure) still applies." })
  @ApiResponse({ status: 200, description: "IntegrationCredentialStatus" })
  clearIntegration(@Param("slug") slug: string, @CurrentUser() actor: { sub: string }) {
    return this.integrations.clear(slug, actor.sub);
  }
}
