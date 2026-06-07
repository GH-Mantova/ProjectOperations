import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../platform/notifications.service";
import { EmailService } from "../email/email.service";

const INCIDENT_TYPES = [
  "near_miss",
  "first_aid",
  "medical_treatment",
  "lost_time",
  "dangerous_occurrence",
  "property_damage"
] as const;
const INCIDENT_SEVERITIES = ["low", "medium", "high", "critical"] as const;
const INCIDENT_STATUSES = ["open", "investigating", "closed"] as const;

const HAZARD_TYPES = [
  "physical",
  "chemical",
  "biological",
  "ergonomic",
  "electrical",
  "fire",
  "environmental",
  "other"
] as const;
const HAZARD_RISK_LEVELS = ["low", "medium", "high", "extreme"] as const;
const HAZARD_STATUSES = ["open", "in_progress", "closed"] as const;

const SEQ_ID = 1;

type CreateIncidentInput = {
  tenderId?: string | null;
  projectId?: string | null;
  incidentDate: string;
  location: string;
  incidentType: string;
  severity: string;
  description: string;
  immediateAction?: string | null;
  witnesses?: string[];
  documentPaths?: string[];
};

type UpdateIncidentInput = Partial<CreateIncidentInput> & {
  rootCause?: string | null;
  corrective?: string | null;
  status?: string;
};

type CreateHazardInput = {
  tenderId?: string | null;
  projectId?: string | null;
  observationDate: string;
  location: string;
  hazardType: string;
  riskLevel: string;
  description: string;
  immediateAction?: string | null;
  assignedToId?: string | null;
  dueDate?: string | null;
  documentPaths?: string[];
};

type UpdateHazardInput = Partial<CreateHazardInput> & { status?: string };

/**
 * Service layer for the safety module — incident reports and hazard
 * observations (Forms & Compliance).
 *
 * Incident numbers are auto-issued as `IS-INC###` and hazard numbers as
 * `IS-HAZ###`, both backed by dedicated sequence tables (`SafetyIncidentNumberSequence`
 * and `HazardNumberSequence`) incremented inside a transaction so concurrent
 * creates never collide. The current reporter is taken from the JWT actor
 * (mandatory — there is no "system reporter" path); witness names persist as
 * a `string[]` on the incident record rather than as related User rows so
 * external/site witnesses can be captured without requiring a user account.
 * `documentPaths` is a parallel `string[]` of SharePoint-relative paths to
 * supporting evidence (photos, statements, MoM) — the safety module stores
 * paths only, the SharePoint adapter is responsible for upload/retrieval.
 *
 * Create flows fire-and-forget a notification fan-out via
 * {@link NotificationsService} to all users holding the `safety.admin`
 * permission (plus the assignee for hazards), and additionally enqueue an
 * email via {@link EmailService} for `critical`-severity incidents.
 * Notification failures are caught and logged but never bubble to the
 * caller — reporting an incident must always succeed even if downstream
 * notification plumbing is unavailable.
 */
@Injectable()
export class SafetyService {
  private readonly logger = new Logger(SafetyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailService
  ) {}

  // ─── Incidents ──────────────────────────────────────────────────────────
  /**
   * List safety incidents with optional filters and pagination.
   *
   * Page size is clamped to `[1, 100]` (default 25) and page to `>= 1`
   * (default 1). Results are ordered by `incidentDate` descending and
   * include reporter, tender, and project relations.
   *
   * @param filters - optional `status` / `severity` / `type` filters plus
   *   `page` / `limit` for pagination.
   * @returns `{ items, total, page, pageSize }` — `total` is the unfiltered
   *   count for the same `where` clause.
   */
  async listIncidents(filters: {
    status?: string;
    severity?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.severity) where.severity = filters.severity;
    if (filters.type) where.incidentType = filters.type;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.limit ?? 25));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.safetyIncident.findMany({
        where,
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true } },
          tender: { select: { id: true, tenderNumber: true, title: true } },
          project: { select: { id: true, projectNumber: true, name: true } }
        },
        orderBy: { incidentDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.safetyIncident.count({ where })
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * Fetch a single incident by id, with reporter, closer, tender, and
   * project relations populated.
   *
   * @param id - incident UUID.
   * @returns the incident row with relations.
   * @throws NotFoundException — when no incident matches `id`.
   */
  async getIncident(id: string) {
    const row = await this.prisma.safetyIncident.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
        tender: { select: { id: true, tenderNumber: true, title: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
    if (!row) throw new NotFoundException("Incident not found.");
    return row;
  }

  /**
   * Create a new safety incident.
   *
   * Auto-issues the next `IS-INC###` number from the sequence table, sets
   * `reportedById` to the JWT actor (mandatory — there is no anonymous
   * reporter path), trims `location` and `description`, and persists
   * `witnesses` and `documentPaths` as `string[]` arrays. After the row
   * commits, fires-and-forgets a notification fan-out to all `safety.admin`
   * users plus a `critical`-only email; notification failures never bubble.
   *
   * @param input - incident payload. `incidentType` must be one of
   *   `near_miss | first_aid | medical_treatment | lost_time |
   *   dangerous_occurrence | property_damage`; `severity` must be one of
   *   `low | medium | high | critical`. `location` and `description` are
   *   required and must be non-empty after trimming.
   * @param actorId - JWT subject id of the reporting user; persisted as
   *   `reportedById`.
   * @returns the created incident row.
   * @throws BadRequestException — when `incidentType` / `severity` is invalid
   *   or `location` / `description` is empty.
   */
  async createIncident(input: CreateIncidentInput, actorId: string) {
    this.assert(INCIDENT_TYPES, "incidentType", input.incidentType);
    this.assert(INCIDENT_SEVERITIES, "severity", input.severity);
    if (!input.location?.trim()) throw new BadRequestException("location is required.");
    if (!input.description?.trim()) throw new BadRequestException("description is required.");

    const incidentNumber = await this.nextIncidentNumber();
    const created = await this.prisma.safetyIncident.create({
      data: {
        incidentNumber,
        tenderId: input.tenderId ?? null,
        projectId: input.projectId ?? null,
        reportedById: actorId,
        incidentDate: new Date(input.incidentDate),
        location: input.location.trim(),
        incidentType: input.incidentType,
        severity: input.severity,
        description: input.description.trim(),
        immediateAction: input.immediateAction ?? null,
        witnesses: input.witnesses ?? [],
        documentPaths: input.documentPaths ?? []
      }
    });

    void this.notifyIncident(created.id, incidentNumber, input.severity, input.description.trim());
    return created;
  }

  /**
   * Partially update an incident.
   *
   * Validates `incidentType` / `severity` / `status` enum values when
   * present, then applies only the supplied fields. `incidentDate` is
   * re-parsed to a `Date`; `witnesses` and `documentPaths` arrays fully
   * replace the existing values (no merge). Closing via this method sets
   * `status: "closed"` but does NOT populate `closedAt` / `closedById` —
   * use {@link closeIncident} for the audited close path.
   *
   * @param id - incident UUID to update.
   * @param input - partial payload; any field set to `undefined` is left
   *   untouched.
   * @returns the updated incident row.
   * @throws BadRequestException — when an enum field carries an invalid
   *   value.
   * @throws NotFoundException — when `id` does not match an existing
   *   incident.
   */
  async updateIncident(id: string, input: UpdateIncidentInput) {
    this.assert(INCIDENT_TYPES, "incidentType", input.incidentType);
    this.assert(INCIDENT_SEVERITIES, "severity", input.severity);
    this.assert(INCIDENT_STATUSES, "status", input.status);
    await this.requireIncident(id);
    const data: Record<string, unknown> = {};
    for (const k of [
      "tenderId",
      "projectId",
      "location",
      "incidentType",
      "severity",
      "description",
      "immediateAction",
      "rootCause",
      "corrective",
      "status",
      "witnesses",
      "documentPaths"
    ] as const) {
      if (input[k] !== undefined) data[k] = input[k];
    }
    if (input.incidentDate) data.incidentDate = new Date(input.incidentDate);
    return this.prisma.safetyIncident.update({ where: { id }, data });
  }

  /**
   * Close an incident — sets `status: "closed"`, stamps `closedAt` to now,
   * and records the closer via `closedById`.
   *
   * Requires `safety.admin`. Re-closing an already-closed incident
   * overwrites `closedAt` / `closedById` (no idempotency guard).
   *
   * @param id - incident UUID to close.
   * @param actorId - JWT subject id of the closing user; persisted as
   *   `closedById`.
   * @returns the updated incident row.
   * @throws NotFoundException — when `id` does not match an existing
   *   incident.
   */
  async closeIncident(id: string, actorId: string) {
    await this.requireIncident(id);
    return this.prisma.safetyIncident.update({
      where: { id },
      data: { status: "closed", closedAt: new Date(), closedById: actorId }
    });
  }

  // ─── Hazards ────────────────────────────────────────────────────────────
  /**
   * List hazard observations with optional filters and pagination.
   *
   * Page size is clamped to `[1, 100]` (default 25) and page to `>= 1`
   * (default 1). Results are ordered by `observationDate` descending and
   * include reporter, assignee, tender, and project relations.
   *
   * @param filters - optional `status` / `riskLevel` / `type` filters plus
   *   `page` / `limit` for pagination.
   * @returns `{ items, total, page, pageSize }` — `total` is the unfiltered
   *   count for the same `where` clause.
   */
  async listHazards(filters: {
    status?: string;
    riskLevel?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.status) where.status = filters.status;
    if (filters.riskLevel) where.riskLevel = filters.riskLevel;
    if (filters.type) where.hazardType = filters.type;
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.limit ?? 25));
    const [items, total] = await this.prisma.$transaction([
      this.prisma.hazardObservation.findMany({
        where,
        include: {
          reportedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          tender: { select: { id: true, tenderNumber: true, title: true } },
          project: { select: { id: true, projectNumber: true, name: true } }
        },
        orderBy: { observationDate: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.hazardObservation.count({ where })
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * Fetch a single hazard observation by id, with reporter, assignee,
   * tender, and project relations populated.
   *
   * @param id - hazard observation UUID.
   * @returns the hazard row with relations.
   * @throws NotFoundException — when no hazard matches `id`.
   */
  async getHazard(id: string) {
    const row = await this.prisma.hazardObservation.findUnique({
      where: { id },
      include: {
        reportedBy: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        tender: { select: { id: true, tenderNumber: true, title: true } },
        project: { select: { id: true, projectNumber: true, name: true } }
      }
    });
    if (!row) throw new NotFoundException("Hazard not found.");
    return row;
  }

  /**
   * Create a new hazard observation.
   *
   * Auto-issues the next `IS-HAZ###` number from the sequence table, sets
   * `reportedById` to the JWT actor (mandatory), parses `dueDate` to a
   * `Date` when supplied, and persists `documentPaths` as a `string[]` of
   * SharePoint-relative paths. After commit, fires-and-forgets a
   * notification fan-out to all `safety.admin` users plus the assignee
   * (de-duplicated); notification failures never bubble. No email is sent
   * for hazards regardless of risk level.
   *
   * @param input - hazard payload. `hazardType` must be one of `physical |
   *   chemical | biological | ergonomic | electrical | fire | environmental
   *   | other`; `riskLevel` must be one of `low | medium | high | extreme`.
   *   `location` and `description` are required and must be non-empty after
   *   trimming.
   * @param actorId - JWT subject id of the reporting user; persisted as
   *   `reportedById`.
   * @returns the created hazard row.
   * @throws BadRequestException — when `hazardType` / `riskLevel` is invalid
   *   or `location` / `description` is empty.
   */
  async createHazard(input: CreateHazardInput, actorId: string) {
    this.assert(HAZARD_TYPES, "hazardType", input.hazardType);
    this.assert(HAZARD_RISK_LEVELS, "riskLevel", input.riskLevel);
    if (!input.location?.trim()) throw new BadRequestException("location is required.");
    if (!input.description?.trim()) throw new BadRequestException("description is required.");

    const hazardNumber = await this.nextHazardNumber();
    const created = await this.prisma.hazardObservation.create({
      data: {
        hazardNumber,
        tenderId: input.tenderId ?? null,
        projectId: input.projectId ?? null,
        reportedById: actorId,
        observationDate: new Date(input.observationDate),
        location: input.location.trim(),
        hazardType: input.hazardType,
        riskLevel: input.riskLevel,
        description: input.description.trim(),
        immediateAction: input.immediateAction ?? null,
        assignedToId: input.assignedToId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        documentPaths: input.documentPaths ?? []
      }
    });

    void this.notifyHazard(
      created.id,
      hazardNumber,
      input.riskLevel,
      input.description.trim(),
      input.assignedToId ?? null
    );
    return created;
  }

  /**
   * Partially update a hazard observation.
   *
   * Validates `hazardType` / `riskLevel` / `status` enum values when
   * present, then applies only the supplied fields. `observationDate` is
   * re-parsed to a `Date` when provided; `dueDate` accepts an explicit
   * `null` to clear it (distinct from `undefined`, which leaves the value
   * untouched). `documentPaths` fully replaces the existing array (no
   * merge). Closing via this method sets `status: "closed"` but does NOT
   * stamp `closedAt` — use {@link closeHazard} for the audited close path.
   *
   * @param id - hazard UUID to update.
   * @param input - partial payload; any field set to `undefined` is left
   *   untouched.
   * @returns the updated hazard row.
   * @throws BadRequestException — when an enum field carries an invalid
   *   value.
   * @throws NotFoundException — when `id` does not match an existing
   *   hazard.
   */
  async updateHazard(id: string, input: UpdateHazardInput) {
    this.assert(HAZARD_TYPES, "hazardType", input.hazardType);
    this.assert(HAZARD_RISK_LEVELS, "riskLevel", input.riskLevel);
    this.assert(HAZARD_STATUSES, "status", input.status);
    await this.requireHazard(id);
    const data: Record<string, unknown> = {};
    for (const k of [
      "tenderId",
      "projectId",
      "location",
      "hazardType",
      "riskLevel",
      "description",
      "immediateAction",
      "assignedToId",
      "status",
      "documentPaths"
    ] as const) {
      if (input[k] !== undefined) data[k] = input[k];
    }
    if (input.observationDate) data.observationDate = new Date(input.observationDate);
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    return this.prisma.hazardObservation.update({ where: { id }, data });
  }

  /**
   * Close a hazard observation — sets `status: "closed"` and stamps
   * `closedAt` to now.
   *
   * Requires `safety.admin`. Unlike incidents, hazards do not record a
   * `closedBy` user. Re-closing an already-closed hazard overwrites
   * `closedAt`.
   *
   * @param id - hazard UUID to close.
   * @returns the updated hazard row.
   * @throws NotFoundException — when `id` does not match an existing
   *   hazard.
   */
  async closeHazard(id: string) {
    await this.requireHazard(id);
    return this.prisma.hazardObservation.update({
      where: { id },
      data: { status: "closed", closedAt: new Date() }
    });
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────
  /**
   * Build the safety dashboard summary.
   *
   * Runs five queries in parallel: open-incidents grouped by severity,
   * open-hazards grouped by risk level, overdue-hazard count (open hazards
   * whose `dueDate` is in the past), the 5 most-recently-created incidents,
   * and the 5 most-recently-created hazards.
   *
   * @returns `{ openIncidents: { total, bySeverity }, openHazards: { total,
   *   byRiskLevel }, overdueHazards, recentIncidents, recentHazards }`.
   *   `bySeverity` / `byRiskLevel` are sparse objects keyed by the values
   *   actually present — absent keys mean zero, not missing.
   */
  async dashboard() {
    const now = new Date();
    const [openIncidents, openHazards, overdueHazards, recentIncidents, recentHazards] = await Promise.all([
      this.prisma.safetyIncident.groupBy({
        by: ["severity"],
        where: { status: { not: "closed" } },
        _count: { _all: true }
      }),
      this.prisma.hazardObservation.groupBy({
        by: ["riskLevel"],
        where: { status: { not: "closed" } },
        _count: { _all: true }
      }),
      this.prisma.hazardObservation.count({
        where: { status: { not: "closed" }, dueDate: { not: null, lt: now } }
      }),
      this.prisma.safetyIncident.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          incidentNumber: true,
          severity: true,
          status: true,
          location: true,
          incidentDate: true,
          description: true
        }
      }),
      this.prisma.hazardObservation.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          hazardNumber: true,
          riskLevel: true,
          status: true,
          location: true,
          observationDate: true,
          description: true,
          dueDate: true
        }
      })
    ]);

    const totals = (rows: Array<{ _count: { _all: number } }>) =>
      rows.reduce((s, r) => s + r._count._all, 0);

    return {
      openIncidents: {
        total: totals(openIncidents),
        bySeverity: Object.fromEntries(openIncidents.map((r) => [r.severity, r._count._all]))
      },
      openHazards: {
        total: totals(openHazards),
        byRiskLevel: Object.fromEntries(openHazards.map((r) => [r.riskLevel, r._count._all]))
      },
      overdueHazards,
      recentIncidents,
      recentHazards
    };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private async nextIncidentNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.safetyIncidentNumberSequence.upsert({
        where: { id: SEQ_ID },
        create: { id: SEQ_ID, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `IS-INC${String(row.lastNumber).padStart(3, "0")}`;
    });
  }

  private async nextHazardNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.hazardNumberSequence.upsert({
        where: { id: SEQ_ID },
        create: { id: SEQ_ID, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      return `IS-HAZ${String(row.lastNumber).padStart(3, "0")}`;
    });
  }

  private async requireIncident(id: string) {
    const row = await this.prisma.safetyIncident.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException("Incident not found.");
  }

  private async requireHazard(id: string) {
    const row = await this.prisma.hazardObservation.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException("Hazard not found.");
  }

  private assert(allowed: readonly string[], field: string, value: string | undefined) {
    if (value === undefined) return;
    if (!allowed.includes(value)) {
      throw new BadRequestException(`${field} must be one of: ${allowed.join(", ")}`);
    }
  }

  private async findSafetyAdmins() {
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              rolePermissions: { some: { permission: { code: "safety.admin" } } }
            }
          }
        }
      },
      select: { id: true, email: true }
    });
  }

  private async notifyIncident(id: string, incidentNumber: string, severity: string, description: string) {
    try {
      const recipients = await this.findSafetyAdmins();
      const title = `Safety incident reported — ${incidentNumber} (${severity})`;
      for (const user of recipients) {
        await this.notifications.create({
          userId: user.id,
          title,
          body: description.length > 160 ? `${description.slice(0, 157)}…` : description,
          severity: severity === "critical" || severity === "high" ? "HIGH" : "LOW",
          linkUrl: `/safety?incident=${id}`
        });
      }
      if (severity === "critical") {
        void this.email.sendNotificationEmail({
          trigger: "safety.incident_critical",
          subject: `[CRITICAL] Safety incident ${incidentNumber}`,
          html: `<p><strong>${incidentNumber}</strong> — ${description}</p>`,
          text: `${incidentNumber} — ${description}`
        });
      }
    } catch (err) {
      this.logger.warn(`notifyIncident failed for ${incidentNumber}: ${(err as Error).message}`);
    }
  }

  private async notifyHazard(
    id: string,
    hazardNumber: string,
    riskLevel: string,
    description: string,
    assignedToId: string | null
  ) {
    try {
      const recipients = await this.findSafetyAdmins();
      const allUsers = new Map(recipients.map((u) => [u.id, u]));
      if (assignedToId) {
        const assignee = await this.prisma.user.findUnique({
          where: { id: assignedToId },
          select: { id: true, email: true }
        });
        if (assignee) allUsers.set(assignee.id, assignee);
      }
      const title = `Hazard observation logged — ${hazardNumber} (${riskLevel} risk)`;
      for (const user of allUsers.values()) {
        await this.notifications.create({
          userId: user.id,
          title,
          body: description.length > 160 ? `${description.slice(0, 157)}…` : description,
          severity: riskLevel === "extreme" || riskLevel === "high" ? "HIGH" : "LOW",
          linkUrl: `/safety?hazard=${id}`
        });
      }
    } catch (err) {
      this.logger.warn(`notifyHazard failed for ${hazardNumber}: ${(err as Error).message}`);
    }
  }
}
