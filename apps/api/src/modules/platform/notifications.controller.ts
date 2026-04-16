import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { AssignFollowUpNotificationDto } from "./dto/assign-follow-up-notification.dto";
import { SyncFollowUpNotificationsDto } from "./dto/sync-follow-up-notifications.dto";
import { TriageFollowUpNotificationDto } from "./dto/triage-follow-up-notification.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("notifications")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("me")
  @RequirePermissions("notifications.view")
  @ApiOperation({ summary: "List notifications for the current user" })
  myNotifications(@CurrentUser() actor: { sub: string }) {
    return this.notificationsService.listForUser(actor.sub);
  }

  @Post()
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Create a notification" })
  create(@Body() dto: CreateNotificationDto, @CurrentUser() actor: { sub: string }) {
    return this.notificationsService.create(dto, actor.sub);
  }

  @Get("follow-ups/shared")
  @RequirePermissions("notifications.view")
  @ApiOperation({ summary: "List shared live follow-up notifications" })
  sharedFollowUps(@CurrentUser() actor: { sub: string }) {
    return this.notificationsService.listSharedFollowUps(actor.sub);
  }

  @Post("follow-ups/sync")
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Sync shared live follow-up notifications" })
  syncFollowUps(@Body() dto: SyncFollowUpNotificationsDto, @CurrentUser() actor: { sub: string }) {
    return this.notificationsService.syncFollowUps(dto, actor.sub);
  }

  @Patch("follow-ups/:id/triage")
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Update shared live follow-up triage state" })
  triageFollowUp(
    @Param("id") id: string,
    @Body() dto: TriageFollowUpNotificationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.notificationsService.triageFollowUp(id, dto, actor.sub);
  }

  @Patch("follow-ups/:id/assign")
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Reassign shared live follow-up ownership" })
  assignFollowUp(
    @Param("id") id: string,
    @Body() dto: AssignFollowUpNotificationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.notificationsService.assignFollowUp(id, dto, actor.sub);
  }

  @Patch(":id/read")
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Mark a notification as read" })
  markRead(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.notificationsService.markRead(id, actor.sub);
  }
}
