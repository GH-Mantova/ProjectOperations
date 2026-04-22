import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
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

@ApiTags("Admin Settings")
@ApiBearerAuth()
@Controller("admin/settings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminSettingsController {
  constructor(private readonly service: AdminSettingsService) {}

  @Get("notifications")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List all notification trigger configs ordered enabled-first then alphabetical." })
  listTriggers() {
    return this.service.listTriggers();
  }

  @Patch("notifications/:trigger")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update a trigger's isEnabled / deliveryMethod / recipients. 404 if trigger is not in the catalogue." })
  updateTrigger(@Param("trigger") trigger: string, @Body() dto: UpdateTriggerDto) {
    return this.service.updateTrigger(trigger, dto);
  }

  @Get("email")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Get the email provider config singleton. Creates one on first access." })
  getEmailConfig() {
    return this.service.getEmailConfig();
  }

  @Patch("email")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update the email provider config." })
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

  @Get("users")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "All active users with first role name — used by the notification recipient picker." })
  listUsers() {
    return this.service.listUsersForRecipientPicker();
  }
}
