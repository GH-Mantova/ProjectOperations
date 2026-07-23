import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsEnum, IsOptional } from "class-validator";
import { MusterAttendeeStatus, MusterEventStatus } from "@prisma/client";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { MusterService } from "./muster.service";

class ListMusterEventsQuery {
  @IsOptional()
  @IsEnum(MusterEventStatus)
  status?: MusterEventStatus;
}

class CheckAttendeeDto {
  @IsEnum(MusterAttendeeStatus)
  status!: MusterAttendeeStatus;
}

/**
 * HTTP surface for evacuation muster / roll-call events.
 *
 * All routes are JWT-guarded. `safety.view` is required for reads and the
 * headcount widget; `safety.manage` is required for start / check-off /
 * complete / cancel operations.
 *
 * The muster controller lives under `/safety/muster` to group it with the
 * broader safety surface without cluttering the existing SafetyController.
 */
@ApiTags("Muster")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("safety/muster")
export class MusterController {
  constructor(private readonly service: MusterService) {}

  /**
   * Live on-site headcount for a site.
   *
   * Returns the count of signed-in (not yet signed-out) workers and the
   * currently-active muster event id (if any).  Used by the headcount
   * widget on the site dashboard.
   *
   * Requires `safety.view`.
   *
   * @param siteId - the site UUID.
   * @returns `{ siteId, count, activeMusterEventId }`.
   */
  @Get("headcount/:siteId")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Live on-site headcount and active muster event id." })
  @ApiResponse({ status: 200, description: "Headcount and active muster event reference." })
  headcount(@Param("siteId") siteId: string) {
    return this.service.headcount(siteId);
  }

  /**
   * List muster events for a site, newest-first.
   *
   * Optionally filter by status (ACTIVE | COMPLETED | CANCELLED).
   *
   * Requires `safety.view`.
   *
   * @param siteId - the site UUID.
   * @param q - optional `status` filter.
   * @returns array of events with summary attendee counts.
   */
  @Get("events/:siteId")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "List muster events for a site." })
  @ApiResponse({ status: 200, description: "Muster events list." })
  listMusterEvents(
    @Param("siteId") siteId: string,
    @Query() q: ListMusterEventsQuery
  ) {
    return this.service.listMusterEvents(siteId, q.status);
  }

  /**
   * Get a single muster event with its full attendee roll-call.
   *
   * Requires `safety.view`.
   *
   * @param eventId - the MusterEvent UUID.
   * @returns event with attendees (worker names, check-off status).
   * @throws NotFoundException — when the event is missing.
   */
  @Get(":eventId")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Get a muster event with roll-call attendees." })
  @ApiResponse({ status: 200, description: "Muster event with attendees." })
  @ApiResponse({ status: 404, description: "Muster event not found." })
  getMusterEvent(@Param("eventId") eventId: string) {
    return this.service.getMusterEvent(eventId);
  }

  /**
   * Start a new muster event for a site.
   *
   * Snapshots all currently-signed-in workers into the roll-call with
   * status UNKNOWN.  Only one ACTIVE event per site is allowed.
   *
   * Requires `safety.manage`.
   *
   * @param siteId - the site UUID.
   * @param actor - JWT principal; becomes startedById.
   * @returns the created MusterEvent with snapshotCount.
   * @throws ConflictException — when an ACTIVE event already exists.
   * @throws NotFoundException — when siteId is invalid.
   */
  @Post("start/:siteId")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Start a new muster event for a site." })
  @ApiResponse({ status: 201, description: "Muster event started." })
  @ApiResponse({ status: 409, description: "An active muster already exists for this site." })
  startMuster(
    @Param("siteId") siteId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.startMuster(siteId, actor.sub);
  }

  /**
   * Mark a roll-call attendee as ACCOUNTED or MISSING.
   *
   * The parent event must be ACTIVE.
   *
   * Requires `safety.manage`.
   *
   * @param attendeeId - the MusterAttendee UUID.
   * @param dto - `{ status: "ACCOUNTED" | "MISSING" }`.
   * @param actor - JWT principal; becomes checkedById.
   * @returns the updated MusterAttendee row.
   * @throws NotFoundException — when attendee is missing.
   * @throws BadRequestException — when status is invalid or event is not ACTIVE.
   */
  @Post("attendees/:attendeeId/check")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Check off a muster attendee as ACCOUNTED or MISSING." })
  @ApiResponse({ status: 200, description: "Attendee status updated." })
  @ApiResponse({ status: 404, description: "Attendee not found." })
  checkAttendee(
    @Param("attendeeId") attendeeId: string,
    @Body() dto: CheckAttendeeDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.checkAttendee(attendeeId, dto.status, actor.sub);
  }

  /**
   * Complete (close) a muster event.
   *
   * The event must be ACTIVE. Stamps completedAt.
   *
   * Requires `safety.manage`.
   *
   * @param eventId - the MusterEvent UUID.
   * @param actor - JWT principal.
   * @returns the updated MusterEvent.
   * @throws NotFoundException — when the event is missing.
   * @throws BadRequestException — when the event is not ACTIVE.
   */
  @Post(":eventId/complete")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Complete (close) a muster event." })
  @ApiResponse({ status: 200, description: "Muster event completed." })
  @ApiResponse({ status: 404, description: "Muster event not found." })
  completeMuster(
    @Param("eventId") eventId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.completeMuster(eventId, actor.sub);
  }

  /**
   * Cancel a muster event.
   *
   * The event must be ACTIVE.
   *
   * Requires `safety.manage`.
   *
   * @param eventId - the MusterEvent UUID.
   * @param actor - JWT principal.
   * @returns the updated MusterEvent.
   * @throws NotFoundException — when the event is missing.
   * @throws BadRequestException — when the event is not ACTIVE.
   */
  @Post(":eventId/cancel")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Cancel an active muster event." })
  @ApiResponse({ status: 200, description: "Muster event cancelled." })
  @ApiResponse({ status: 404, description: "Muster event not found." })
  cancelMuster(
    @Param("eventId") eventId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.cancelMuster(eventId, actor.sub);
  }
}
