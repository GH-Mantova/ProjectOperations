import { Controller, Get, Header, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CalendarService } from "./calendar.service";
import {
  CalendarSyncedEventDto,
  CalendarSyncRunResultDto,
  CalendarSyncStatusDto
} from "./dto/calendar.dto";

@ApiTags("Calendar Sync")
@ApiBearerAuth()
@Controller("calendar-sync")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CalendarController {
  constructor(private readonly service: CalendarService) {}

  @Post("run")
  @RequirePermissions("calendar.sync")
  @ApiOperation({ summary: "Sync the current user's schedulable items to their calendar" })
  @ApiResponse({ status: 201, type: CalendarSyncRunResultDto })
  run(@CurrentUser() actor: { sub: string }): Promise<CalendarSyncRunResultDto> {
    return this.service.runSync(actor.sub);
  }

  @Get("status")
  @RequirePermissions("calendar.sync")
  @ApiOperation({ summary: "Current calendar sync mode and counts for the caller" })
  @ApiResponse({ status: 200, type: CalendarSyncStatusDto })
  status(@CurrentUser() actor: { sub: string }): Promise<CalendarSyncStatusDto> {
    return this.service.getStatus(actor.sub);
  }

  @Get("events")
  @RequirePermissions("calendar.sync")
  @ApiOperation({ summary: "List the calendar events recorded for the caller" })
  @ApiResponse({ status: 200, type: CalendarSyncedEventDto, isArray: true })
  events(@CurrentUser() actor: { sub: string }): Promise<CalendarSyncedEventDto[]> {
    return this.service.listEvents(actor.sub);
  }

  // Optional interim path while the live Graph calendar adapter is
  // pending. Returns an iCalendar (text/calendar) feed of the caller's
  // active synced events. Outlook / Google / Apple Calendar can
  // subscribe to this once Marco arranges a public-but-authenticated
  // proxy. Mock-mode-safe — no Graph credential required.
  @Get("feed.ics")
  @RequirePermissions("calendar.sync")
  @Header("Content-Type", "text/calendar; charset=utf-8")
  @Header("Content-Disposition", "inline; filename=\"projectops-calendar.ics\"")
  @ApiOperation({ summary: "iCalendar (RFC 5545) feed of the caller's active synced events" })
  @ApiResponse({ status: 200, description: "text/calendar payload" })
  feed(@CurrentUser() actor: { sub: string }): Promise<string> {
    return this.service.buildIcsFeed(actor.sub);
  }
}
