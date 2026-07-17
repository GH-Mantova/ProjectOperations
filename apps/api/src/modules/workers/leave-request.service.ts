import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthorityService } from "../authorization/authority.service";

// ── DTOs (exported for the controller) ──────────────────────────────────────

export const LEAVE_REQUEST_TYPES = ["ANNUAL", "PERSONAL", "UNPAID", "OTHER"] as const;
export type LeaveRequestTypeValue = (typeof LEAVE_REQUEST_TYPES)[number];

export interface SubmitLeaveRequestDto {
  /** WorkerProfile id of the requester (must match self unless super-user). */
  workerId: string;
  type: LeaveRequestTypeValue;
  /** ISO date string — inclusive start. */
  startDate: string;
  /** ISO date string — inclusive end; must be on or after startDate. */
  endDate: string;
  /** Hours — for partial-day requests. */
  hours?: number;
  reason?: string;
}

export interface DecideLeaveRequestDto {
  /** APPROVED or REJECTED. */
  decision: "APPROVED" | "REJECTED";
  reason?: string;
}

// ── Actor type (same shape as JWT payload) ──────────────────────────────────
export type Actor = { sub: string; permissions: string[]; isSuperUser?: boolean };

/**
 * Business logic for the HR self-service LeaveRequest lifecycle.
 *
 * Submit   — any authenticated user for their own linked WorkerProfile.
 * Approve  — the worker's manager (resolved via User.managerId) or a super-user,
 *            checked through the AuthorityService seam.
 * Reject   — same authority as approve.
 * List     — self sees own requests; workers.manage sees all (or subordinate subset).
 *
 * On APPROVAL a WorkerLeave row is created so the scheduler's overlay endpoint
 * immediately respects the time off without a separate admin step.
 */
@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authority: AuthorityService
  ) {}

  // ── Submit ────────────────────────────────────────────────────────────────

  /**
   * Submit a leave request. The actor must own the worker profile (via
   * internalUserId) or be a super-user; non-super-users cannot submit for
   * other workers.
   */
  async submit(dto: SubmitLeaveRequestDto, actor: Actor) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end < start) {
      throw new BadRequestException("endDate must be on or after startDate.");
    }

    const worker = await this.prisma.workerProfile.findUnique({
      where: { id: dto.workerId },
      select: { id: true, internalUserId: true }
    });
    if (!worker) throw new NotFoundException("Worker not found.");

    const isSelf = worker.internalUserId === actor.sub;
    const isAdmin = Boolean(actor.isSuperUser);
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException(
        "You can only submit leave requests for your own worker profile."
      );
    }

    return this.prisma.leaveRequest.create({
      data: {
        workerId: dto.workerId,
        type: dto.type,
        startDate: start,
        endDate: end,
        hours: dto.hours ?? null,
        reason: dto.reason ?? null
      },
      include: { worker: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  // ── Decide (approve / reject) ─────────────────────────────────────────────

  /**
   * Approve or reject a leave request.
   *
   * Authority is resolved via AuthorityService.check — action key
   * "leave.approve". With the default open-ceiling (no rules configured)
   * anyone with workers.manage permission can approve. When rules are
   * configured the seam enforces the org hierarchy.
   *
   * Self-approval is blocked even for super-users.
   * On APPROVED: creates a WorkerLeave row so the scheduler sees the time off.
   * On REJECTED: leaves WorkerLeave null.
   */
  async decide(id: string, dto: DecideLeaveRequestDto, actor: Actor) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, internalUserId: true, firstName: true, lastName: true } }
      }
    });
    if (!request) throw new NotFoundException("Leave request not found.");
    if (request.status !== "PENDING") {
      throw new BadRequestException(
        `Leave request is already ${request.status.toLowerCase()} and cannot be changed.`
      );
    }

    // Block self-approval
    if (dto.decision === "APPROVED" && request.worker.internalUserId === actor.sub) {
      throw new ForbiddenException("You cannot approve your own leave request.");
    }

    // Check authority seam (open ceiling with no rules configured)
    const authDecision = await this.authority.check({
      userId: actor.sub,
      action: "leave.approve"
    });
    if (!authDecision.allowed) {
      throw new ForbiddenException(
        "Your authority ceiling does not permit approving leave requests."
      );
    }

    // On approval: write a WorkerLeave row so the scheduler calendar overlay picks it up
    if (dto.decision === "APPROVED") {
      const workerLeave = await this.prisma.workerLeave.create({
        data: {
          workerProfileId: request.workerId,
          leaveType: request.type.toLowerCase(),
          startDate: request.startDate,
          endDate: request.endDate,
          status: "APPROVED",
          notes: request.reason ?? null,
          requestedById: request.worker.internalUserId ?? null,
          approvedById: actor.sub,
          approvedAt: new Date()
        }
      });

      return this.prisma.leaveRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: actor.sub,
          approvedAt: new Date(),
          workerLeaveId: workerLeave.id
        },
        include: { worker: { select: { id: true, firstName: true, lastName: true } } }
      });
    }

    // REJECTED — no WorkerLeave row
    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedById: actor.sub,
        approvedAt: new Date()
      },
      include: { worker: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  // ── List ──────────────────────────────────────────────────────────────────

  /**
   * List leave requests.
   *
   * With workers.manage: returns all requests (or for a specific workerId).
   * Without: returns only the actor's own requests (via internalUserId link).
   */
  async list(actor: Actor, workerId?: string) {
    const canManageAll = actor.isSuperUser || actor.permissions.includes("workers.manage");

    if (canManageAll) {
      return this.prisma.leaveRequest.findMany({
        where: workerId ? { workerId } : {},
        orderBy: { startDate: "desc" },
        include: {
          worker: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } }
        }
      });
    }

    // Self-serve: find the actor's own WorkerProfile
    const ownProfile = await this.prisma.workerProfile.findUnique({
      where: { internalUserId: actor.sub },
      select: { id: true }
    });
    if (!ownProfile) return [];

    return this.prisma.leaveRequest.findMany({
      where: { workerId: ownProfile.id },
      orderBy: { startDate: "desc" },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  // ── Get pending requests for manager's direct reports ─────────────────────

  /**
   * Returns PENDING leave requests for all workers whose linked User reports
   * to the given managerId (one level deep in the managerId hierarchy).
   * Used on the manager approvals surface.
   */
  async pendingForManager(managerUserId: string) {
    // Resolve direct reports
    const reports = await this.prisma.user.findMany({
      where: { managerId: managerUserId },
      select: { id: true, workerProfile: { select: { id: true } } }
    });

    const workerIds = reports
      .map((u) => u.workerProfile?.id)
      .filter((id): id is string => Boolean(id));

    if (!workerIds.length) return [];

    return this.prisma.leaveRequest.findMany({
      where: { workerId: { in: workerIds }, status: "PENDING" },
      orderBy: { startDate: "asc" },
      include: {
        worker: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  // ── Org chart data ────────────────────────────────────────────────────────

  /**
   * Returns the user roster with managerId populated so the frontend can
   * render an org-chart view. Only active users are included.
   */
  async orgChart() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        managerId: true,
        workerProfile: { select: { id: true, role: true } }
      },
      orderBy: { lastName: "asc" }
    });
  }
}
