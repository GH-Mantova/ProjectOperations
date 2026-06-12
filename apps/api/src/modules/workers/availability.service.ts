import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  AvailabilityRangeQueryDto,
  CreateWorkerLeaveDto,
  CreateWorkerUnavailabilityDto,
  UpdateWorkerLeaveStatusDto
} from "./dto/availability.dto";

type Actor = { sub: string; permissions: string[]; isSuperUser?: boolean };

/**
 * Business logic for worker leave, unavailability, and the scheduler's
 * availability overlay.
 *
 * Create operations enforce ownership: the actor must own the worker
 * profile (via internalUserId) or be a super-user — `resources.manage`
 * alone is not enough to lodge records for another worker. Self-approval
 * of leave is blocked even for admins. No audit entries are written.
 */
@Injectable()
export class WorkerAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  // Actor either owns the worker profile (via internalUserId) OR is a
  // super-user. resources.manage on its own is no longer enough to lodge for
  // another worker — this stops a worker who happens to hold the role from
  // spoofing leave/unavailability for someone else. Workers admin via super-
  // user accounts; can be relaxed to a dedicated HR role later.
  private async assertCanActOnWorker(actor: Actor, workerProfileId: string) {
    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: workerProfileId },
      select: { id: true, internalUserId: true }
    });
    if (!worker) throw new NotFoundException("Worker not found.");

    const isSelf = worker.internalUserId === actor.sub;
    const isAdmin = Boolean(actor.isSuperUser);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(
        "You can only lodge availability records for yourself unless you are an admin."
      );
    }
    return worker;
  }

  // ── Leaves ───────────────────────────────────────────────────────────────

  /**
   * Create a leave request; status defaults to PENDING (schema default).
   *
   * The actor must own the worker profile or be a super-user; the actor is
   * recorded as requestedById.
   *
   * @param dto - workerProfileId, leaveType, startDate/endDate, optional notes
   * @param actor - authenticated user (sub + isSuperUser flag)
   * @returns the created WorkerLeave record
   * @throws BadRequestException when endDate is before startDate
   * @throws NotFoundException when the worker does not exist
   * @throws ForbiddenException when lodging for another worker without super-user
   */
  async createLeave(dto: CreateWorkerLeaveDto, actor: Actor) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }
    await this.assertCanActOnWorker(actor, dto.workerProfileId);

    return this.prisma.workerLeave.create({
      data: {
        workerProfileId: dto.workerProfileId,
        leaveType: dto.leaveType,
        startDate: start,
        endDate: end,
        notes: dto.notes ?? null,
        requestedById: actor.sub
      }
    });
  }

  /**
   * List leave requests, newest startDate first, with worker, approver,
   * and requester names included.
   *
   * @param workerProfileId - optional filter to a single worker
   * @returns WorkerLeave records of all statuses
   */
  async listLeaves(workerProfileId?: string) {
    return this.prisma.workerLeave.findMany({
      where: workerProfileId ? { workerProfileId } : {},
      orderBy: { startDate: "desc" },
      include: {
        workerProfile: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        requestedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  /**
   * Set a leave request's status (approve / decline / cancel).
   *
   * Self-approval is blocked even for admins; cancelling one's own request
   * is allowed. On APPROVED, approvedById/approvedAt are stamped with the
   * actor and now; any other status resets both to null.
   *
   * @param id - leave request id
   * @param dto - new status and optional notes (falls back to existing notes)
   * @param actor - authenticated user performing the change
   * @returns the updated WorkerLeave record
   * @throws NotFoundException when the leave request does not exist
   * @throws ForbiddenException when approving one's own leave request
   */
  async setLeaveStatus(id: string, dto: UpdateWorkerLeaveStatusDto, actor: Actor) {
    const existing = await this.prisma.workerLeave.findUnique({
      where: { id },
      include: { workerProfile: { select: { internalUserId: true } } }
    });
    if (!existing) throw new NotFoundException("Leave request not found.");

    // Block self-approval — even an admin must not approve their own leave.
    // (CANCELLED is allowed self-serve so a worker can cancel their own
    // request without admin help.)
    if (
      dto.status === "APPROVED" &&
      existing.workerProfile.internalUserId === actor.sub
    ) {
      throw new ForbiddenException("You cannot approve your own leave request.");
    }

    return this.prisma.workerLeave.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes ?? existing.notes,
        approvedById: dto.status === "APPROVED" ? actor.sub : null,
        approvedAt: dto.status === "APPROVED" ? new Date() : null
      }
    });
  }

  /**
   * Hard-delete a leave request.
   *
   * @param id - leave request id
   * @returns { id } of the deleted record
   * @throws NotFoundException when the leave request does not exist
   */
  async deleteLeave(id: string) {
    const existing = await this.prisma.workerLeave.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Leave request not found.");
    await this.prisma.workerLeave.delete({ where: { id } });
    return { id };
  }

  // ── Unavailability ───────────────────────────────────────────────────────

  /**
   * Create an unavailability block (RDO, training, hold), optionally
   * recurring weekly on recurringDay (0=Sun..6=Sat) within its date range.
   *
   * The actor must own the worker profile or be a super-user.
   *
   * @param dto - workerProfileId, reason, startDate/endDate, optional recurringDay
   * @param actor - authenticated user (sub + isSuperUser flag)
   * @returns the created WorkerUnavailability record
   * @throws BadRequestException when endDate is before startDate
   * @throws NotFoundException when the worker does not exist
   * @throws ForbiddenException when lodging for another worker without super-user
   */
  async createUnavailability(dto: CreateWorkerUnavailabilityDto, actor: Actor) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }
    await this.assertCanActOnWorker(actor, dto.workerProfileId);

    return this.prisma.workerUnavailability.create({
      data: {
        workerProfileId: dto.workerProfileId,
        reason: dto.reason,
        startDate: start,
        endDate: end,
        recurringDay: dto.recurringDay ?? null
      }
    });
  }

  /**
   * List unavailability blocks, newest startDate first, with worker names
   * included.
   *
   * @param workerProfileId - optional filter to a single worker
   * @returns WorkerUnavailability records (recurrence NOT expanded here)
   */
  async listUnavailability(workerProfileId?: string) {
    return this.prisma.workerUnavailability.findMany({
      where: workerProfileId ? { workerProfileId } : {},
      orderBy: { startDate: "desc" },
      include: {
        workerProfile: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  /**
   * Hard-delete an unavailability block.
   *
   * @param id - unavailability block id
   * @returns { id } of the deleted record
   * @throws NotFoundException when the block does not exist
   */
  async deleteUnavailability(id: string) {
    const existing = await this.prisma.workerUnavailability.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Unavailability not found.");
    await this.prisma.workerUnavailability.delete({ where: { id } });
    return { id };
  }

  // ── Calendar overlay ─────────────────────────────────────────────────────
  // Returns a flat list of bars the scheduler can stack onto its worker rows.
  // Approved leave + ad-hoc unavailability + weekly-recurring days expanded
  // to concrete instances within the requested window.

  /**
   * Build the scheduler calendar overlay for a date window: a flat list of
   * bars (kind "leave" or "unavailability") to stack onto worker rows.
   *
   * Only APPROVED leave is included; unavailability of any kind overlapping
   * the window is included. Weekly-recurring unavailability is expanded
   * into one-day bars (id suffixed `::YYYY-MM-DD`) for each matching UTC
   * day-of-week, capped to the [from, to] window.
   *
   * @param query - from/to ISO dates and optional workerProfileId filter
   * @returns leave bars followed by unavailability bars
   * @throws BadRequestException when to is before from
   */
  async overlay(query: AvailabilityRangeQueryDto) {
    const from = new Date(query.from);
    const to = new Date(query.to);
    if (to < from) throw new BadRequestException("to must be after from.");

    const [leaves, unavailability] = await Promise.all([
      this.prisma.workerLeave.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: to },
          endDate: { gte: from },
          ...(query.workerProfileId ? { workerProfileId: query.workerProfileId } : {})
        },
        select: {
          id: true,
          workerProfileId: true,
          leaveType: true,
          startDate: true,
          endDate: true,
          notes: true
        }
      }),
      this.prisma.workerUnavailability.findMany({
        where: {
          startDate: { lte: to },
          endDate: { gte: from },
          ...(query.workerProfileId ? { workerProfileId: query.workerProfileId } : {})
        },
        select: {
          id: true,
          workerProfileId: true,
          reason: true,
          startDate: true,
          endDate: true,
          recurringDay: true
        }
      })
    ]);

    const leaveBars = leaves.map((l) => ({
      kind: "leave" as const,
      id: l.id,
      workerProfileId: l.workerProfileId,
      label: l.leaveType,
      notes: l.notes,
      startDate: l.startDate,
      endDate: l.endDate
    }));

    const unavailabilityBars: Array<{
      kind: "unavailability";
      id: string;
      workerProfileId: string;
      label: string;
      startDate: Date;
      endDate: Date;
      recurringDay: number | null;
    }> = [];

    for (const u of unavailability) {
      if (u.recurringDay === null) {
        unavailabilityBars.push({
          kind: "unavailability",
          id: u.id,
          workerProfileId: u.workerProfileId,
          label: u.reason,
          startDate: u.startDate,
          endDate: u.endDate,
          recurringDay: null
        });
      } else {
        // Expand weekly recurrence: every matching day-of-week between max(from, u.startDate)
        // and min(to, u.endDate) becomes a one-day bar. Caps the range to [from, to] so
        // the response is bounded.
        const rangeStart = u.startDate > from ? new Date(u.startDate) : new Date(from);
        const rangeEnd = u.endDate < to ? new Date(u.endDate) : new Date(to);
        rangeStart.setUTCHours(0, 0, 0, 0);
        rangeEnd.setUTCHours(0, 0, 0, 0);
        for (
          let d = new Date(rangeStart);
          d <= rangeEnd;
          d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
        ) {
          if (d.getUTCDay() === u.recurringDay) {
            const dayEnd = new Date(d);
            dayEnd.setUTCHours(23, 59, 59, 999);
            unavailabilityBars.push({
              kind: "unavailability",
              id: `${u.id}::${d.toISOString().slice(0, 10)}`,
              workerProfileId: u.workerProfileId,
              label: u.reason,
              startDate: new Date(d),
              endDate: dayEnd,
              recurringDay: u.recurringDay
            });
          }
        }
      }
    }

    return [...leaveBars, ...unavailabilityBars];
  }

  // Conflict check used by the scheduler before assigning a worker to a shift.
  // Returns any leave or unavailability that overlaps the proposed shift window.
  /**
   * Conflict check used by the scheduler before assigning a worker to a
   * shift.
   *
   * Builds the overlay for the shift window and returns any leave or
   * unavailability bars that overlap [startAt, endAt].
   *
   * @param workerProfileId - worker to check
   * @param startAt - proposed shift start
   * @param endAt - proposed shift end
   * @returns overlapping overlay bars (empty when the worker is clear)
   * @throws BadRequestException when endAt is before startAt
   */
  async conflictsForShift(workerProfileId: string, startAt: Date, endAt: Date) {
    const overlay = await this.overlay({
      from: startAt.toISOString(),
      to: endAt.toISOString(),
      workerProfileId
    });
    return overlay.filter((bar) => bar.startDate <= endAt && bar.endDate >= startAt);
  }
}
