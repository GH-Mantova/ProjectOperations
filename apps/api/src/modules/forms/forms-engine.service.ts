import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../platform/notifications.service";
import { RulesEngineService, type FieldRule, type RuleAction } from "./rules-engine.service";

type ValueMap = Record<string, unknown>;

type ApprovalChainStep = {
  stepNumber: number;
  assignToRole?: string;
  assignToUserId?: string;
  dueHours?: number;
};

type TemplateSettings = {
  requiresApproval?: boolean;
  approvalChain?: ApprovalChainStep[];
  pdfExport?: boolean;
  allowOffline?: boolean;
  complianceGates?: string[];
};

const submissionDetailInclude = {
  templateVersion: {
    include: {
      template: true,
      sections: {
        orderBy: { sectionOrder: "asc" },
        include: {
          fields: { orderBy: { fieldOrder: "asc" } }
        }
      }
    }
  },
  values: { orderBy: { createdAt: "asc" } },
  approvals: { orderBy: { stepNumber: "asc" } },
  triggeredRecords: true,
  attachments: true,
  signatures: true
} as const;

@Injectable()
export class FormsEngineService {
  private readonly logger = new Logger(FormsEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesEngineService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  // ── Draft creation ────────────────────────────────────────────────────

  async createDraft(templateId: string, userId: string) {
    // Find latest active version of the template — engine consumers always
    // submit against the most recently published version unless they're
    // resuming a draft tied to an older version.
    const template = await this.prisma.formTemplate.findUnique({
      where: { id: templateId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 1 }
      }
    });
    if (!template) throw new NotFoundException("Form template not found.");
    const version = template.versions[0];
    if (!version) {
      throw new BadRequestException(
        "Form template has no versions yet — publish a version before submitting."
      );
    }

    // Auto-populate context from the user's current clock-on state. Best-effort:
    // if no active timesheet, leave context empty so the worker can still fill
    // a form (e.g. site induction before being allocated).
    const context: Record<string, unknown> = {};
    const activeTimesheet = await this.prisma.timesheet.findFirst({
      where: {
        workerProfile: { internalUserId: userId },
        clockOnTime: { not: null },
        clockOffTime: null
      },
      include: {
        project: { select: { id: true, projectManagerId: true, supervisorId: true } },
        allocation: { select: { id: true } }
      },
      orderBy: { date: "desc" }
    });
    if (activeTimesheet) {
      context.projectId = activeTimesheet.projectId;
      context.timesheetId = activeTimesheet.id;
      context.allocationId = activeTimesheet.allocationId;
      if (activeTimesheet.project?.projectManagerId) {
        context.projectManagerId = activeTimesheet.project.projectManagerId;
      }
      if (activeTimesheet.project?.supervisorId) {
        context.supervisorId = activeTimesheet.project.supervisorId;
      }
    }

    const draft = await this.prisma.formSubmission.create({
      data: {
        templateVersionId: version.id,
        submittedById: userId,
        status: "draft",
        context: context as Prisma.InputJsonValue
      },
      include: submissionDetailInclude
    });

    return draft;
  }

  // ── Update values + return live field state ────────────────────────────

  async updateValues(submissionId: string, userId: string, values: ValueMap) {
    const submission = await this.requireOwnedDraft(submissionId, userId);
    const template = await this.loadTemplateForVersion(submission.templateVersionId);

    // Persist each non-empty value as a FormSubmissionValue row, upserting
    // by (submissionId, fieldKey). Keep prior values for fields not in the
    // current payload — a partial PATCH should not blow them away.
    const allFields = (template.sections ?? []).flatMap((s) => s.fields ?? []);
    const fieldByKey = new Map(allFields.map((f) => [f.fieldKey, f]));

    for (const [fieldKey, raw] of Object.entries(values)) {
      const field = fieldByKey.get(fieldKey);
      if (!field) continue;
      const existing = await this.prisma.formSubmissionValue.findFirst({
        where: { submissionId: submission.id, fieldKey }
      });
      const data = this.shapeValue(field.fieldType, raw);
      if (existing) {
        await this.prisma.formSubmissionValue.update({
          where: { id: existing.id },
          data: { ...data, fieldId: field.id }
        });
      } else {
        await this.prisma.formSubmissionValue.create({
          data: { submissionId: submission.id, fieldKey, fieldId: field.id, ...data }
        });
      }
    }

    // After save, evaluate field visibility + required state across ALL stored
    // values so the client can update the form without a page reload.
    const merged = await this.collectValues(submission.id);
    const fieldVisibility: Record<string, boolean> = {};
    const fieldRequired: Record<string, boolean> = {};
    for (const field of allFields) {
      const conditions = (field.conditions ?? []) as unknown as FieldRule[];
      fieldVisibility[field.fieldKey] = this.rules.evaluateFieldVisibility(conditions, merged);
      fieldRequired[field.fieldKey] = this.rules.evaluateFieldRequired(
        field.isRequired,
        conditions,
        merged
      );
    }
    return { fieldVisibility, fieldRequired };
  }

  // ── Submit pipeline ────────────────────────────────────────────────────

  async submitForm(
    submissionId: string,
    userId: string,
    gpsLat?: number,
    gpsLng?: number
  ) {
    const submission = await this.requireOwnedDraft(submissionId, userId);
    const template = await this.loadTemplateForVersion(submission.templateVersionId);
    const settings = (template.template.settings ?? {}) as TemplateSettings;
    const merged = await this.collectValues(submission.id);

    // 1. Validate
    const validation = this.rules.validateValues(template, merged);
    if (!validation.valid) {
      throw new UnprocessableEntityException({ errors: validation.errors });
    }

    // 2. Compliance gates
    const gateResult = await this.rules.checkComplianceGates(
      { category: template.template.category, settings },
      userId
    );
    if (!gateResult.passed) {
      throw new UnprocessableEntityException({ complianceFailures: gateResult.failures });
    }

    // 3. Mark submitted, capture GPS
    const updated = await this.prisma.formSubmission.update({
      where: { id: submission.id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        gpsLat: gpsLat !== undefined ? new Prisma.Decimal(gpsLat) : null,
        gpsLng: gpsLng !== undefined ? new Prisma.Decimal(gpsLng) : null
      }
    });

    // 4. Run on_submit actions — create records, send notifications
    const actions = this.rules.collectOnSubmitActions(template, merged);
    await this.executeServerActions(actions, updated, merged);

    // 5. Approval chain (if configured)
    if (settings.requiresApproval && Array.isArray(settings.approvalChain) && settings.approvalChain.length > 0) {
      await this.createApprovalChain(updated.id, settings.approvalChain);
      const firstStep = settings.approvalChain[0];
      await this.notifyApprover(updated.id, firstStep, template.template.name);
    }

    await this.audit.write({
      actorId: userId,
      action: "forms.submission.submitted",
      entityType: "FormSubmission",
      entityId: updated.id,
      metadata: { templateId: template.template.id, category: template.template.category }
    });

    return this.getSubmissionDetail(updated.id);
  }

  // ── Approve / Reject / Resubmit ────────────────────────────────────────

  async approveStep(submissionId: string, approverId: string, comment?: string) {
    const pending = await this.prisma.formApproval.findFirst({
      where: { submissionId, status: "pending" },
      orderBy: { stepNumber: "asc" }
    });
    if (!pending) throw new BadRequestException("No pending approval steps.");
    if (pending.assignedToId && pending.assignedToId !== approverId) {
      throw new ForbiddenException("This approval step is assigned to another user.");
    }

    await this.prisma.formApproval.update({
      where: { id: pending.id },
      data: {
        status: "approved",
        decidedAt: new Date(),
        comment: comment ?? null,
        assignedToId: pending.assignedToId ?? approverId
      }
    });

    const remaining = await this.prisma.formApproval.findFirst({
      where: { submissionId, status: "pending" },
      orderBy: { stepNumber: "asc" }
    });
    if (remaining) {
      const submission = await this.prisma.formSubmission.findUnique({
        where: { id: submissionId },
        include: { templateVersion: { include: { template: true } } }
      });
      if (remaining.assignedToId) {
        void this.notifications
          .create(
            {
              userId: remaining.assignedToId,
              title: "Form approval needed",
              body: `Submission of ${submission?.templateVersion.template.name ?? "form"} is ready for your approval.`,
              severity: "info",
              linkUrl: `/forms/submissions/${submissionId}`
            },
            approverId
          )
          .catch(() => undefined);
      }
    } else {
      await this.prisma.formSubmission.update({
        where: { id: submissionId },
        data: { status: "approved" }
      });
      const submission = await this.prisma.formSubmission.findUnique({
        where: { id: submissionId }
      });
      if (submission?.submittedById) {
        void this.notifications
          .create(
            {
              userId: submission.submittedById,
              title: "Form approved",
              body: "Your form submission has been fully approved.",
              severity: "info",
              linkUrl: `/forms/submissions/${submissionId}`
            },
            approverId
          )
          .catch(() => undefined);
      }
    }

    return this.getSubmissionDetail(submissionId);
  }

  async rejectStep(submissionId: string, approverId: string, comment: string) {
    if (!comment?.trim()) {
      throw new BadRequestException("A comment is required when rejecting a submission.");
    }
    const pending = await this.prisma.formApproval.findFirst({
      where: { submissionId, status: "pending" },
      orderBy: { stepNumber: "asc" }
    });
    if (!pending) throw new BadRequestException("No pending approval steps.");
    if (pending.assignedToId && pending.assignedToId !== approverId) {
      throw new ForbiddenException("This approval step is assigned to another user.");
    }

    await this.prisma.formApproval.update({
      where: { id: pending.id },
      data: {
        status: "rejected",
        decidedAt: new Date(),
        comment,
        assignedToId: pending.assignedToId ?? approverId
      }
    });
    await this.prisma.formSubmission.update({
      where: { id: submissionId },
      data: { status: "rejected" }
    });

    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId }
    });
    if (submission?.submittedById) {
      void this.notifications
        .create(
          {
            userId: submission.submittedById,
            title: "Form returned",
            body: `Your form submission was returned: ${comment}`,
            severity: "warning",
            linkUrl: `/forms/submissions/${submissionId}`
          },
          approverId
        )
        .catch(() => undefined);
    }

    return this.getSubmissionDetail(submissionId);
  }

  async resubmit(submissionId: string, userId: string) {
    const submission = await this.prisma.formSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException("Submission not found.");
    if (submission.submittedById !== userId) {
      throw new ForbiddenException("You cannot resubmit another worker's submission.");
    }
    if (submission.status !== "rejected") {
      throw new BadRequestException("Only rejected submissions can be resubmitted.");
    }
    await this.prisma.$transaction([
      this.prisma.formApproval.deleteMany({ where: { submissionId } }),
      this.prisma.formSubmission.update({
        where: { id: submissionId },
        // submittedAt is non-nullable; leave the prior stamp in place. The
        // next submit overwrites it.
        data: { status: "draft" }
      })
    ]);
    return this.getSubmissionDetail(submissionId);
  }

  // ── Listing + analytics ────────────────────────────────────────────────

  async getMySubmissions(userId: string, opts: { status?: string; templateId?: string } = {}) {
    return this.prisma.formSubmission.findMany({
      where: {
        submittedById: userId,
        ...(opts.status ? { status: opts.status } : {}),
        ...(opts.templateId ? { templateVersion: { templateId: opts.templateId } } : {})
      },
      include: {
        templateVersion: { include: { template: true } },
        approvals: { orderBy: { stepNumber: "asc" } }
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  async getPendingApprovalsFor(userId: string) {
    return this.prisma.formApproval.findMany({
      where: { assignedToId: userId, status: "pending" },
      include: {
        submission: {
          include: { templateVersion: { include: { template: true } }, submittedBy: true }
        }
      },
      orderBy: { dueAt: "asc" }
    });
  }

  async getAnalytics(filters: { from?: string; to?: string; templateId?: string } = {}) {
    const where: Prisma.FormSubmissionWhereInput = {
      ...(filters.from ? { submittedAt: { gte: new Date(filters.from) } } : {}),
      ...(filters.to ? { submittedAt: { lte: new Date(filters.to) } } : {}),
      ...(filters.templateId ? { templateVersion: { templateId: filters.templateId } } : {})
    };
    const [total, byStatusRows, overdue] = await Promise.all([
      this.prisma.formSubmission.count({ where }),
      this.prisma.formSubmission.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      }),
      this.prisma.formApproval.count({
        where: { status: "pending", dueAt: { lt: new Date() } }
      })
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) byStatus[row.status] = row._count._all;
    return { totalSubmissions: total, byStatus, overdueApprovals: overdue };
  }

  // ── Detail helpers ─────────────────────────────────────────────────────

  async getSubmissionDetail(submissionId: string) {
    const sub = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: submissionDetailInclude
    });
    if (!sub) throw new NotFoundException("Submission not found.");
    return sub;
  }

  // ── Internal: server action executor ───────────────────────────────────

  private async executeServerActions(
    actions: RuleAction[],
    submission: { id: string; submittedById: string | null; context: unknown },
    values: ValueMap
  ) {
    for (const action of actions) {
      try {
        if (action.type === "create_record") {
          const recordId = await this.createTriggeredRecord(action, submission, values);
          if (recordId) {
            await this.prisma.formTriggeredRecord.create({
              data: {
                submissionId: submission.id,
                recordType: action.recordType ?? "unknown",
                recordId
              }
            });
          }
        } else if (action.type === "send_notification") {
          await this.dispatchNotification(action, submission);
        }
      } catch (err) {
        this.logger.warn(
          `Form action ${action.type} failed for submission ${submission.id}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  private async createTriggeredRecord(
    action: RuleAction,
    submission: { id: string; submittedById: string | null; context: unknown },
    values: ValueMap
  ): Promise<string | null> {
    const ctx = (submission.context ?? {}) as Record<string, string | undefined>;
    const reportedById = submission.submittedById ?? null;
    if (!reportedById) return null;

    if (action.recordType === "safety_incident") {
      // Map common form field keys to incident fields. Templates that don't
      // populate these fall back to safe defaults so the gateway still creates
      // a record the WHS officer can flesh out later.
      const number = await this.nextSeq("safety_incident_number_sequences");
      const incidentNumber = `IS-INC-${String(number).padStart(4, "0")}`;
      const created = await this.prisma.safetyIncident.create({
        data: {
          incidentNumber,
          reportedById,
          projectId: ctx.projectId ?? null,
          incidentDate: this.dateValue(values, "incident_datetime") ?? new Date(),
          location: this.stringValue(values, "location") ?? "Site (auto-generated from form)",
          incidentType: this.normaliseIncidentType(this.stringValue(values, "incident_type")),
          severity: this.normaliseSeverity(this.stringValue(values, "severity")),
          description: this.stringValue(values, "description") ?? "Auto-generated from form submission",
          witnesses: [],
          documentPaths: []
        }
      });
      return created.id;
    }

    if (action.recordType === "hazard_observation") {
      const number = await this.nextSeq("hazard_number_sequences");
      const hazardNumber = `IS-HAZ-${String(number).padStart(4, "0")}`;
      const created = await this.prisma.hazardObservation.create({
        data: {
          hazardNumber,
          reportedById,
          projectId: ctx.projectId ?? null,
          observationDate: new Date(),
          location: this.stringValue(values, "location") ?? "Site (auto-generated from form)",
          hazardType: "other",
          riskLevel: this.normaliseRiskLevel(
            this.stringValue(values, "risk_rating_before") ?? this.stringValue(values, "risk_level")
          ),
          description:
            this.stringValue(values, "description") ??
            this.stringValue(values, "near_miss_description") ??
            "Auto-generated from form submission",
          documentPaths: []
        }
      });
      return created.id;
    }

    if (action.recordType === "maintenance_job") {
      const equipmentId = this.stringValue(values, "equipment");
      if (!equipmentId) return null;
      // Confirm the asset exists before pointing a breakdown at it.
      const asset = await this.prisma.asset.findUnique({
        where: { id: equipmentId },
        select: { id: true }
      });
      if (!asset) return null;
      const created = await this.prisma.assetBreakdown.create({
        data: {
          assetId: asset.id,
          reportedAt: new Date(),
          severity: "MEDIUM",
          status: "OPEN",
          summary:
            this.stringValue(values, "defect_details") ??
            "Plant pre-start flagged as not safe to operate"
        }
      });
      return created.id;
    }

    return null;
  }

  private async dispatchNotification(
    action: RuleAction,
    submission: { id: string; submittedById: string | null; context: unknown }
  ) {
    const target = action.notificationTarget ?? "supervisor";
    const message = action.notificationMessage ?? "Form submission requires attention.";
    const ctx = (submission.context ?? {}) as Record<string, string | undefined>;

    const recipients: string[] = [];
    if (target === "supervisor" && ctx.supervisorId) recipients.push(ctx.supervisorId);
    else if (target === "project_manager" && ctx.projectManagerId) recipients.push(ctx.projectManagerId);
    else if (target === "safety_admin") {
      const admins = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: "marco@initialservices.net" },
            {
              userRoles: {
                some: { role: { rolePermissions: { some: { permission: { code: "safety.admin" } } } } }
              }
            }
          ]
        },
        select: { id: true }
      });
      recipients.push(...admins.map((u) => u.id));
    } else if (target === "all_admins") {
      const admins = await this.prisma.user.findMany({
        where: { isSuperUser: true },
        select: { id: true }
      });
      recipients.push(...admins.map((u) => u.id));
    } else if (target.length > 0) {
      // Treat the target as a literal user id when nothing else matches.
      const user = await this.prisma.user.findUnique({ where: { id: target }, select: { id: true } });
      if (user) recipients.push(user.id);
    }

    const unique = Array.from(new Set(recipients));
    for (const userId of unique) {
      void this.notifications
        .create(
          {
            userId,
            title: "Form submission alert",
            body: message,
            severity: "warning",
            linkUrl: `/forms/submissions/${submission.id}`
          },
          submission.submittedById ?? undefined
        )
        .catch(() => undefined);
    }
  }

  private async createApprovalChain(submissionId: string, chain: ApprovalChainStep[]) {
    const now = Date.now();
    for (const step of chain) {
      await this.prisma.formApproval.create({
        data: {
          submissionId,
          stepNumber: step.stepNumber,
          assignedToId: step.assignToUserId ?? null,
          assignedToRole: step.assignToRole ?? null,
          status: "pending",
          dueAt: step.dueHours ? new Date(now + step.dueHours * 60 * 60 * 1000) : null
        }
      });
    }
  }

  private async notifyApprover(submissionId: string, step: ApprovalChainStep, templateName: string) {
    if (!step.assignToUserId) return;
    void this.notifications
      .create(
        {
          userId: step.assignToUserId,
          title: "Form awaiting approval",
          body: `${templateName} submission needs your review.`,
          severity: "info",
          linkUrl: `/forms/submissions/${submissionId}`
        },
        undefined
      )
      .catch(() => undefined);
  }

  // ── Private helpers ────────────────────────────────────────────────────

  private async requireOwnedDraft(submissionId: string, userId: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId }
    });
    if (!submission) throw new NotFoundException("Submission not found.");
    if (submission.submittedById !== userId) {
      throw new ForbiddenException("You cannot edit another worker's submission.");
    }
    if (submission.status !== "draft") {
      throw new BadRequestException("Only draft submissions can be edited.");
    }
    return submission;
  }

  private async loadTemplateForVersion(versionId: string) {
    const version = await this.prisma.formTemplateVersion.findUnique({
      where: { id: versionId },
      include: {
        template: true,
        sections: {
          orderBy: { sectionOrder: "asc" },
          include: { fields: { orderBy: { fieldOrder: "asc" } } }
        }
      }
    });
    if (!version) throw new NotFoundException("Form template version not found.");
    return version;
  }

  private async collectValues(submissionId: string): Promise<ValueMap> {
    const rows = await this.prisma.formSubmissionValue.findMany({ where: { submissionId } });
    const out: ValueMap = {};
    for (const r of rows) {
      if (r.valueText !== null) out[r.fieldKey] = r.valueText;
      else if (r.valueNumber !== null) out[r.fieldKey] = Number(r.valueNumber);
      else if (r.valueBoolean !== null) out[r.fieldKey] = r.valueBoolean;
      else if (r.valueDateTime !== null) out[r.fieldKey] = r.valueDateTime;
      else if (r.valueJson !== null) out[r.fieldKey] = r.valueJson;
    }
    return out;
  }

  private shapeValue(fieldType: string, raw: unknown) {
    const empty = {
      valueText: null,
      valueNumber: null,
      valueBoolean: null,
      valueDateTime: null,
      valueJson: Prisma.JsonNull as Prisma.NullableJsonNullValueInput
    };
    if (raw === null || raw === undefined) return empty;
    if (fieldType === "toggle" || fieldType === "checkbox") {
      return { ...empty, valueBoolean: Boolean(raw) };
    }
    if (
      fieldType === "number" ||
      fieldType === "currency" ||
      fieldType === "percentage" ||
      fieldType === "rating" ||
      fieldType === "slider" ||
      fieldType === "nps"
    ) {
      const n = typeof raw === "number" ? raw : Number(raw);
      return { ...empty, valueNumber: Number.isFinite(n) ? new Prisma.Decimal(n) : null };
    }
    if (fieldType === "date" || fieldType === "datetime" || fieldType === "time") {
      const d = typeof raw === "string" || typeof raw === "number" ? new Date(raw) : raw;
      return {
        ...empty,
        valueDateTime: d instanceof Date && !Number.isNaN(d.getTime()) ? d : null
      };
    }
    if (Array.isArray(raw) || typeof raw === "object") {
      return {
        ...empty,
        valueJson: raw as Prisma.InputJsonValue
      };
    }
    return { ...empty, valueText: String(raw) };
  }

  private stringValue(values: ValueMap, key: string): string | null {
    const v = values[key];
    if (v === undefined || v === null) return null;
    return String(v);
  }

  private dateValue(values: ValueMap, key: string): Date | null {
    const v = values[key];
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  private async nextSeq(table: "safety_incident_number_sequences" | "hazard_number_sequences") {
    // Row-locked sequence — same pattern used by SafetyService.
    const result = await this.prisma.$queryRawUnsafe<Array<{ last_number: number }>>(
      `UPDATE "${table}" SET "last_number" = "last_number" + 1 WHERE "id" = 1 RETURNING "last_number"`
    );
    if (result.length > 0) return result[0].last_number;
    const inserted = await this.prisma.$queryRawUnsafe<Array<{ last_number: number }>>(
      `INSERT INTO "${table}" ("id", "last_number") VALUES (1, 1) RETURNING "last_number"`
    );
    return inserted[0]?.last_number ?? 1;
  }

  private normaliseIncidentType(input: string | null): string {
    if (!input) return "near_miss";
    const t = input.toLowerCase().replace(/\s+/g, "_");
    const allowed = ["near_miss", "first_aid", "medical_treatment", "lost_time", "dangerous_occurrence", "property_damage"];
    return allowed.includes(t) ? t : "near_miss";
  }

  private normaliseSeverity(input: string | null): string {
    if (!input) return "low";
    const s = input.toLowerCase();
    return ["low", "medium", "high", "critical"].includes(s) ? s : "low";
  }

  private normaliseRiskLevel(input: string | null): string {
    if (!input) return "low";
    const r = input.toLowerCase();
    return ["low", "medium", "high", "extreme"].includes(r) ? r : "low";
  }
}
