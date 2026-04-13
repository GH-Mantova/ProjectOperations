import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateNotificationDto } from "./dto/create-notification.dto";
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

  @Patch(":id/read")
  @RequirePermissions("notifications.manage")
  @ApiOperation({ summary: "Mark a notification as read" })
  markRead(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.notificationsService.markRead(id, actor.sub);
  }
}
