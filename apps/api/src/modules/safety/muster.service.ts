import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { MusterAttendeeStatus, MusterEventStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Service for evacuation muster / roll-call events.
 *
 * A MusterEvent is started by a WHS officer during an evacuation drill or
 * real emergency. On start, all currently-signed-in attendees
 * (SiteAttendance rows with signedOutAt IS NULL for the given site) are
 * snapshot into MusterAttendee rows with status UNKNOWN so the roll-call
 * screen can display them even if attendance records change afterwards.
 *
 * Officers check off each person as ACCOUNTED or MISSING. The event is
 * completed via the close endpoint, which stamps completedAt and sets
 * status to COMPLETED. Only one ACTIVE event per site is permitted at a
 * time.
 */
@Injectable()
export class MusterService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Events ─────────────────────────────────────────────────────────────

  /**
   * Start a new muster event for a site.
   *
   * Enforces that there is no existing ACTIVE event for the site (409 if
   * one already exists). Within a single transaction, creates the
   * MusterEvent and one MusterAttendee row per currently-signed-in worker
   * (SiteAttendance.signedOutAt IS NULL). All attendees start as UNKNOWN.
   *
   * @param siteId - the site UUID.
   * @param actorId - JWT subject of the starting officer.
   * @returns the created MusterEvent with its attendees count.
   * @throws ConflictException - when an ACTIVE muster event already exists.
   * @throws NotFoundException - when siteId does not match a site.
   */
  async startMuster(siteId: string, actorId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true }
    });
    if (!site) throw new NotFoundException("Site not found.");

    const existing = await this.prisma.musterEvent.findFirst({
      where: { siteId, status: MusterEventStatus.ACTIVE },
      select: { id: true }
    });
    if (existing) {
      throw new ConflictException(
        `An active muster event already exists for this site (id: ${existing.id}). Complete or cancel it before starting a new one.`
      );
    }

    // Snapshot the current on-site attendance in a transaction.
    const onSite = await this.prisma.siteAttendance.findMany({
      where: { siteId, signedOutAt: null },
      select: { id: true, workerProfileId: true }
    });

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.musterEvent.create({
        data: {
          siteId,
          startedById: actorId,
          status: MusterEventStatus.ACTIVE
        }
      });

      if (onSite.length > 0) {
        await tx.musterAttendee.createMany({
          data: onSite.map((att) => ({
            musterEventId: created.id,
            siteAttendanceId: att.id,
            workerProfileId: att.workerProfileId,
            status: MusterAttendeeStatus.UNKNOWN
          }))
        });
      }

      return created;
    });

    return { ...event, snapshotCount: onSite.length };
  }

  /**
   * Get a muster event with its attendees.
   *
   * @param eventId - muster event UUID.
   * @returns the event with attendees including worker name info.
   * @throws NotFoundException - when no event matches.
   */
  async getMusterEvent(eventId: string) {
    const event = await this.prisma.musterEvent.findUnique({
      where: { id: eventId },
      include: {
        site: { select: { id: true, name: true } },
        startedBy: { select: { id: true, firstName: true, lastName: true } },
        attendees: {
          include: {
            workerProfile: {
              select: { id: true, firstName: true, lastName: true }
            },
            checkedBy: {
              select: { id: true, firstName: true, lastName: true }
            }
          },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }]
        }
      }
    });
    if (!event) throw new NotFoundException("Muster event not found.");
    return event;
  }

  /**
   * List muster events for a site, newest-first.
   *
   * @param siteId - the site UUID.
   * @param status - optional filter (ACTIVE | COMPLETED | CANCELLED).
   * @returns list of events with summary counts (no attendee rows).
   */
  async listMusterEvents(siteId: string, status?: MusterEventStatus) {
    const where = { siteId, ...(status ? { status } : {}) };
    return this.prisma.musterEvent.findMany({
      where,
      include: {
        startedBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { attendees: true } }
      },
      orderBy: { startedAt: "desc" }
    });
  }

  /**
   * Mark an attendee as ACCOUNTED or MISSING.
   *
   * Only valid while the parent MusterEvent is ACTIVE.
   *
   * @param attendeeId - the MusterAttendee UUID.
   * @param status - ACCOUNTED or MISSING.
   * @param actorId - JWT subject of the checking officer.
   * @returns the updated MusterAttendee row.
   * @throws NotFoundException - when the attendee does not exist.
   * @throws BadRequestException - when status is invalid or the event is not ACTIVE.
   */
  async checkAttendee(
    attendeeId: string,
    status: MusterAttendeeStatus,
    actorId: string
  ) {
    if (
      status !== MusterAttendeeStatus.ACCOUNTED &&
      status !== MusterAttendeeStatus.MISSING
    ) {
      throw new BadRequestException("status must be ACCOUNTED or MISSING.");
    }

    const attendee = await this.prisma.musterAttendee.findUnique({
      where: { id: attendeeId },
      include: { musterEvent: { select: { status: true } } }
    });
    if (!attendee) throw new NotFoundException("Muster attendee not found.");
    if (attendee.musterEvent.status !== MusterEventStatus.ACTIVE) {
      throw new BadRequestException(
        "Attendee can only be checked off while the muster event is ACTIVE."
      );
    }

    return this.prisma.musterAttendee.update({
      where: { id: attendeeId },
      data: { status, checkedAt: new Date(), checkedById: actorId }
    });
  }

  /**
   * Complete (close) a muster event.
   *
   * Stamps completedAt and sets status to COMPLETED. The event must be
   * ACTIVE — completing an already-completed or cancelled event is a 400.
   *
   * @param eventId - the MusterEvent UUID.
   * @param actorId - JWT subject of the completing officer (for audit).
   * @returns the updated MusterEvent.
   * @throws NotFoundException - when the event does not exist.
   * @throws BadRequestException - when the event is not ACTIVE.
   */
  async completeMuster(eventId: string, actorId: string) {
    void actorId; // retained for future audit-log use
    const event = await this.prisma.musterEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true }
    });
    if (!event) throw new NotFoundException("Muster event not found.");
    if (event.status !== MusterEventStatus.ACTIVE) {
      throw new BadRequestException(
        `Muster event is already ${event.status} and cannot be completed.`
      );
    }

    return this.prisma.musterEvent.update({
      where: { id: eventId },
      data: { status: MusterEventStatus.COMPLETED, completedAt: new Date() }
    });
  }

  /**
   * Cancel a muster event.
   *
   * Only ACTIVE events may be cancelled.
   *
   * @param eventId - the MusterEvent UUID.
   * @param actorId - JWT subject of the cancelling officer.
   * @returns the updated MusterEvent.
   * @throws NotFoundException - when the event does not exist.
   * @throws BadRequestException - when the event is not ACTIVE.
   */
  async cancelMuster(eventId: string, actorId: string) {
    void actorId;
    const event = await this.prisma.musterEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true }
    });
    if (!event) throw new NotFoundException("Muster event not found.");
    if (event.status !== MusterEventStatus.ACTIVE) {
      throw new BadRequestException(
        `Muster event is already ${event.status} and cannot be cancelled.`
      );
    }

    return this.prisma.musterEvent.update({
      where: { id: eventId },
      data: { status: MusterEventStatus.CANCELLED, completedAt: new Date() }
    });
  }

  // ─── Headcount ──────────────────────────────────────────────────────────

  /**
   * Live on-site headcount for a site.
   *
   * Returns the count of SiteAttendance rows with signedOutAt IS NULL for
   * the given site, plus the currently-active muster event id (if any).
   *
   * @param siteId - the site UUID.
   * @returns `{ count, activeMusterEventId }`.
   */
  async headcount(siteId: string) {
    const [count, activeMuster] = await this.prisma.$transaction([
      this.prisma.siteAttendance.count({
        where: { siteId, signedOutAt: null }
      }),
      this.prisma.musterEvent.findFirst({
        where: { siteId, status: MusterEventStatus.ACTIVE },
        select: { id: true }
      })
    ]);

    return {
      siteId,
      count,
      activeMusterEventId: activeMuster?.id ?? null
    };
  }
}
