import { Body, Controller, Delete, Get, Param, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { NotificationPreferencesService } from "./notification-preferences.service";

class UpsertPreferenceDto {
  @IsIn(["both", "email", "inapp", "off"])
  channel!: string;
}

@ApiTags("Notification Preferences")
@ApiBearerAuth()
@Controller("notification-preferences")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationPreferencesController {
  constructor(private readonly service: NotificationPreferencesService) {}

  /**
   * List all notification triggers the caller is eligible for, each with
   * the admin-configured delivery method, the caller's stored channel
   * preference (null = inherit), and the computed effective channel
   * (intersection of admin × user).
   */
  @Get("me")
  @RequirePermissions("notifications.view")
  @ApiOperation({ summary: "List notification preferences for the current user" })
  @ApiResponse({
    status: 200,
    description: "Returns eligible triggers with stored and effective channel per trigger."
  })
  listForMe(@CurrentUser() actor: { sub: string }) {
    return this.service.listForUser(actor.sub);
  }

  /**
   * Upsert the caller's channel preference for a specific trigger.
   * `channel` must be one of: both | email | inapp | off.
   * The caller must be an eligible recipient for the trigger (else 403).
   * Setting `channel` equal to the admin default is allowed (still narrows only).
   */
  @Put("me/:trigger")
  @RequirePermissions("notifications.view")
  @ApiOperation({ summary: "Set channel preference for a specific trigger" })
  @ApiResponse({ status: 200, description: "Preference upserted." })
  @ApiResponse({ status: 400, description: "Invalid channel or trigger not enabled." })
  @ApiResponse({ status: 403, description: "Caller is not eligible for this trigger." })
  upsertForMe(
    @CurrentUser() actor: { sub: string },
    @Param("trigger") trigger: string,
    @Body() dto: UpsertPreferenceDto
  ) {
    return this.service.upsertForUser(actor.sub, trigger, dto.channel);
  }

  /**
   * Clear the caller's stored channel preference for a trigger (revert to
   * inheriting the admin default). Returns 404 if no preference was stored.
   */
  @Delete("me/:trigger")
  @RequirePermissions("notifications.view")
  @ApiOperation({ summary: "Clear channel preference for a specific trigger (revert to inherit)" })
  @ApiResponse({ status: 200, description: "Preference cleared." })
  @ApiResponse({ status: 404, description: "No stored preference for this trigger." })
  deleteForMe(
    @CurrentUser() actor: { sub: string },
    @Param("trigger") trigger: string
  ) {
    return this.service.deleteForUser(actor.sub, trigger);
  }
}
