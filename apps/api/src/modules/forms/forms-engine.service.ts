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

/**
 * Reduce a list of numeric operands using the named operation. Returns
 * `null` when the input is empty (there's nothing to compute) so callers
 * can persist an empty cell rather than fabricating a zero.
 *
 * Exported for the unit tests; keep pure so it can be reasoned about
 * without a Prisma round-trip.
 */
export function computeCalculation(
  operation: string,
  operands: number[],
  decimals = 2
): number | null {
  if (operands.length === 0) return null;
  let raw: number;
  switch (operation) {
    case "sum":
      raw = operands.reduce((a, b) => a + b, 0);
      break;
    case "difference":
      raw = operands.slice(1).reduce((a, b) => a - b, operands[0]);
      break;
    case "product":
      raw = operands.reduce((a, b) => a * b, 1);
      break;
    case "average":
      raw = operands.reduce((a, b) => a + b, 0) / operands.length;
      break;
    case "min":
      raw = Math.min(...operands);
      break;
    case "max":
      raw = Math.max(...operands);
      break;
    default:
      return null;
  }
  const factor = Math.pow(10, Math.max(0, Math.min(6, decimals)));
  return Math.round(raw * factor) / factor;
}

type ApprovalChainStep = {
  stepNumber: number;
  assignToRole?: string;
  assignToUserId?: string;
  dueHours?: number;
};

/** One option in an inspection response set (e.g. Pass / Fail / N/A). */
export type ResponseSetOption = {
  value: string;
  label?: string;
  score: number;
  isPassing?: boolean;
  isNA?: boolean;
  color?: string;
};

/** Response set — a reusable set of scoreable choices used by inspection fields. */
export type ResponseSet = {
  key?: string;
  name?: string;
  options: ResponseSetOption[];
};

/** Field-level scoring metadata stored in FormField.config.scoreConfig. */
export type FieldScoreConfig = {
  /** Multiplier applied to the option's score. Defaults to 1. */
  weight?: number;
  /** When false the field is skipped entirely — even a scored option won't count. */
  countsTowardScore?: boolean;
  /** Inline response set for this field, or a key into template.settings.responseSets. */
  responseSet?: ResponseSet;
  responseSetKey?: string;
};

type TemplateSettings = {
  requiresApproval?: boolean;
  approvalChain?: ApprovalChainStep[];
  pdfExport?: boolean;
  allowOffline?: boolean;
  complianceGates?: string[];
  /** Threshold in [0,100] that a submission's scorePct must meet to PASS. */
  passThresholdPct?: number;
  /** Named response sets that fields can reference by key. */
  responseSets?: Record<string, ResponseSet>;
};

export type SubmissionScoring = {
  score: number | null;
  maxScore: number | null;
  scorePct: number | null;
  outcome: "PASS" | "FAIL" | "PARTIAL" | "NA" | null;
  perSection: Array<{ sectionId: string; title: string; score: number; maxScore: number }>;
};

/**
 * Compute an inspection score for a submission from field-level scoreConfig
 * and choice-level response sets.
 *
 * Pure and exported so the unit tests and the web builder can share the
 * exact same math. Fields without a scoreConfig or without a valid option
 * match are treated as unscored — they contribute 0 to both score and
 * maxScore. NA options are excluded from maxScore so a genuinely
 * not-applicable line doesn't drag the percentage down.
 *
 * Outcome rules (against `passThresholdPct`, default 100):
 *   - maxScore === 0 → NA (nothing was actually scored)
 *   - scorePct >= threshold → PASS
 *   - scorePct <= 0 → FAIL
 *   - otherwise PARTIAL
 */
export function computeScoring(
  template: {
    settings?: unknown;
    sections?: Array<{
      id?: string;
      title?: string;
      fields?: Array<{
        fieldKey: string;
        fieldType: string;
        config?: unknown;
        optionsJson?: unknown;
      }>;
    }>;
  },
  values: ValueMap
): SubmissionScoring {
  const settings = (template.settings ?? {}) as TemplateSettings;
  const threshold =
    typeof settings.passThresholdPct === "number" &&
    Number.isFinite(settings.passThresholdPct)
      ? Math.max(0, Math.min(100, settings.passThresholdPct))
      : 100;
  const catalog = settings.responseSets ?? {};

  const perSection: SubmissionScoring["perSection"] = [];
  let total = 0;
  let totalMax = 0;

  for (const section of template.sections ?? []) {
    let sectionScore = 0;
    let sectionMax = 0;
    for (const field of section.fields ?? []) {
      const config = (field.config ?? {}) as { scoreConfig?: FieldScoreConfig };
      const sc = config.scoreConfig;
      if (!sc) continue;
      if (sc.countsTowardScore === false) continue;
      const weight = typeof sc.weight === "number" && Number.isFinite(sc.weight) ? sc.weight : 1;

      const set: ResponseSet | undefined =
        sc.responseSet ?? (sc.responseSetKey ? catalog[sc.responseSetKey] : undefined);
      const options = set?.options ?? [];
      if (options.length === 0) continue;

      const raw = values[field.fieldKey];
      const match = options.find((o) => o.value === raw);
      const optionMax = options.reduce(
        (acc, o) => (o.isNA ? acc : Math.max(acc, o.score)),
        0
      );

      if (match?.isNA) {
        // NA: neither score nor max counts.
        continue;
      }
      if (match) {
        sectionScore += match.score * weight;
        sectionMax += optionMax * weight;
      } else {
        // Unanswered scored field — still contributes to maxScore so the
        // percentage reflects skipped work.
        sectionMax += optionMax * weight;
      }
    }
    total += sectionScore;
    totalMax += sectionMax;
    perSection.push({
      sectionId: section.id ?? "",
      title: section.title ?? "",
      score: round2(sectionScore),
      maxScore: round2(sectionMax)
    });
  }

  if (totalMax === 0) {
    return {
      score: null,
      maxScore: null,
      scorePct: null,
      outcome: hasAnyScoreConfig(template) ? "NA" : null,
      perSection
    };
  }

  const pct = (total / totalMax) * 100;
  const rounded = round2(pct);
  const outcome: SubmissionScoring["outcome"] =
    rounded >= threshold ? "PASS" : rounded <= 0 ? "FAIL" : "PARTIAL";
  return {
    score: round2(total),
    maxScore: round2(totalMax),
    scorePct: rounded,
    outcome,
    perSection
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hasAnyScoreConfig(template: {
  sections?: Array<{ fields?: Array<{ config?: unknown }> }>;
}): boolean {
  for (const s of template.sections ?? []) {
    for (const f of s.fields ?? []) {
      const cfg = (f.config ?? {}) as { scoreConfig?: FieldScoreConfig };
      if (cfg.scoreConfig) return true;
    }
  }
  return false;
}

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
  signatures: true,
  correctiveActions: {
    orderBy: { createdAt: "asc" as const },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true } }
    }
  }
} as const;

/**
 * Orchestrates the worker-facing form lifecycle: draft -> submit ->
 * approval chain -> approved/rejected, plus triggered side effects.
 *
 * On submit it validates values via RulesEngineService, enforces
 * compliance gates, can auto-create safety incidents / hazard
 * observations / asset breakdowns, dispatches notifications
 * (fire-and-forget) and writes audit entries. Failed on_submit actions
 * are logged and swallowed — they never fail the submission.
 */
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

  /**
   * Create a draft submission against the latest version of a template.
   *
   * Best-effort auto-population: if the user has an active (clocked-on)
   * timesheet, project/timesheet/allocation/PM/supervisor ids are copied
   * into the draft's context; otherwise context is left empty.
   *
   * @param templateId - template to draft against
   * @param userId - submitter; stored as submittedById
   * @returns the draft submission with full detail includes
   * @throws NotFoundException when the template does not exist
   * @throws BadRequestException when the template has no versions
   */
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

  /**
   * Persist draft values (partial PATCH semantics) and return live field state.
   *
   * Values are upserted per (submissionId, fieldKey); fields not present in
   * the payload keep their stored values. Unknown field keys are ignored.
   *
   * @param submissionId - draft owned by userId
   * @param values - map of fieldKey to raw value, shaped per field type
   * @returns `{ fieldVisibility, fieldRequired }` evaluated over all stored values
   * @throws NotFoundException when the submission or its version does not exist
   * @throws ForbiddenException when the draft belongs to another user
   * @throws BadRequestException when the submission is not in draft status
   */
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

  /**
   * Run the full submit pipeline for an owned draft.
   *
   * Steps: validate values; check compliance gates; mark submitted with
   * optional GPS; execute on_submit actions (record creation,
   * notifications — failures logged, not thrown); create the approval
   * chain and notify the first approver if configured; write a
   * `forms.submission.submitted` audit entry.
   *
   * @param gpsLat - optional latitude captured at submit; null when omitted
   * @param gpsLng - optional longitude captured at submit; null when omitted
   * @returns the submission with full detail includes
   * @throws UnprocessableEntityException when validation or a compliance gate fails
   * @throws NotFoundException / ForbiddenException / BadRequestException per draft-ownership checks
   */
  async submitForm(
    submissionId: string,
    userId: string,
    gpsLat?: number,
    gpsLng?: number
  ) {
    const submission = await this.requireOwnedDraft(submissionId, userId);
    const template = await this.loadTemplateForVersion(submission.templateVersionId);
    const settings = (template.template.settings ?? {}) as TemplateSettings;
    const collected = await this.collectValues(submission.id);
    // Recompute calculation fields server-side — the client value is never
    // trusted. The updated map feeds validation and every downstream step.
    const merged = await this.recomputeCalculations(submission.id, template, collected);

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

    // 3. Compute inspection score + outcome (null when template has no
    // scoreConfig anywhere — the field is just a data-collection form).
    const scoring = computeScoring(template, merged);

    // 4. Mark submitted, capture GPS + scoring result
    const updated = await this.prisma.formSubmission.update({
      where: { id: submission.id },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        gpsLat: gpsLat !== undefined ? new Prisma.Decimal(gpsLat) : null,
        gpsLng: gpsLng !== undefined ? new Prisma.Decimal(gpsLng) : null,
        score: scoring.score !== null ? new Prisma.Decimal(scoring.score) : null,
        maxScore: scoring.maxScore !== null ? new Prisma.Decimal(scoring.maxScore) : null,
        scorePct: scoring.scorePct !== null ? new Prisma.Decimal(scoring.scorePct) : null,
        outcome: scoring.outcome
      }
    });

    // 5. Run on_submit actions — create records, send notifications
    const actions = this.rules.collectOnSubmitActions(template, merged);
    await this.executeServerActions(actions, updated, merged);

    // 6. Approval chain (if configured)
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

  /**
   * Approve the lowest-numbered pending step of a submission's chain.
   *
   * If further steps remain, the next assignee is notified; otherwise the
   * submission moves to `approved` and the submitter is notified. Steps with
   * no assignee can be approved by anyone holding the permission, and the
   * approver is recorded as the assignee.
   *
   * @param comment - optional comment stored on the step
   * @returns the submission with full detail includes
   * @throws BadRequestException when no pending approval step exists
   * @throws ForbiddenException when the step is assigned to a different user
   */
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

  /**
   * Reject the lowest-numbered pending step and move the submission to `rejected`.
   *
   * The comment is mandatory and is relayed to the submitter via a warning
   * notification (fire-and-forget).
   *
   * @param comment - rejection reason; must be non-blank
   * @returns the submission with full detail includes
   * @throws BadRequestException when the comment is blank or no pending step exists
   * @throws ForbiddenException when the step is assigned to a different user
   */
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

  /**
   * Return a rejected submission to draft so its owner can fix and resubmit.
   *
   * Deletes all approval rows and resets status in one transaction. The
   * prior submittedAt stamp is intentionally left in place — the next
   * submit overwrites it.
   *
   * @returns the submission with full detail includes
   * @throws NotFoundException when the submission does not exist
   * @throws ForbiddenException when the submission belongs to another user
   * @throws BadRequestException when the submission is not in rejected status
   */
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

  /**
   * List a user's own submissions, optionally filtered by status/template.
   *
   * @param opts - optional exact-match status and templateId filters
   * @returns submissions with template + approvals, most recently updated first
   */
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

  /**
   * List pending approval steps explicitly assigned to a user.
   *
   * Role-assigned steps with no assignedToId are NOT returned here.
   *
   * @returns pending FormApproval rows with submission detail, earliest due first
   */
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

  /**
   * Aggregate submission counts and a status breakdown for dashboards.
   *
   * Note: overdueApprovals is a global count of pending approvals past
   * their dueAt — it ignores the from/to/templateId filters.
   *
   * byStatus keys are folded to lowercase before accumulation: mixed-case
   * legacy rows exist (seed and schema default write "SUBMITTED"/"DRAFT";
   * the engine writes "draft"/"submitted"/"rejected"), and the response
   * contract is lowercase — so "SUBMITTED" and "submitted" land in the
   * same bucket. See QA S3-006.
   *
   * @param filters - optional submittedAt date range and templateId
   * @returns `{ totalSubmissions, byStatus, overdueApprovals, byOutcome, avgScorePct }`
   */
  async getAnalytics(filters: { from?: string; to?: string; templateId?: string } = {}) {
    const where: Prisma.FormSubmissionWhereInput = {
      ...(filters.from ? { submittedAt: { gte: new Date(filters.from) } } : {}),
      ...(filters.to ? { submittedAt: { lte: new Date(filters.to) } } : {}),
      ...(filters.templateId ? { templateVersion: { templateId: filters.templateId } } : {})
    };
    const [total, byStatusRows, overdue, byOutcomeRows, scoreAgg] = await Promise.all([
      this.prisma.formSubmission.count({ where }),
      this.prisma.formSubmission.groupBy({
        by: ["status"],
        where,
        _count: { _all: true }
      }),
      this.prisma.formApproval.count({
        where: { status: "pending", dueAt: { lt: new Date() } }
      }),
      // Scoring roll-up — only rows with a computed outcome contribute.
      this.prisma.formSubmission.groupBy({
        by: ["outcome"],
        where: { ...where, outcome: { not: null } },
        _count: { _all: true }
      }),
      this.prisma.formSubmission.aggregate({
        where: { ...where, scorePct: { not: null } },
        _avg: { scorePct: true }
      })
    ]);
    const byStatus: Record<string, number> = {};
    for (const row of byStatusRows) {
      const key = row.status.toLowerCase();
      byStatus[key] = (byStatus[key] ?? 0) + row._count._all;
    }
    const byOutcome: Record<string, number> = {};
    for (const row of byOutcomeRows) {
      if (!row.outcome) continue;
      byOutcome[row.outcome] = (byOutcome[row.outcome] ?? 0) + row._count._all;
    }
    const avgScorePct = scoreAgg._avg.scorePct !== null ? Number(scoreAgg._avg.scorePct) : null;
    return {
      totalSubmissions: total,
      byStatus,
      overdueApprovals: overdue,
      byOutcome,
      avgScorePct
    };
  }

  /**
   * Dashboard batch-2 widget aggregate: KPI + top-N view of every form
   * approval still pending across the whole system.
   *
   * "Waiting" = FormApproval.status === "pending". The items list is
   * ordered by dueAt ASC (nulls last) so overdue rows lead. Callers use
   * this from the Form Approvals Waiting widget — it deliberately spans
   * all assignees, unlike getPendingApprovalsFor which is per-user.
   *
   * @param limit - top-N items to include (default 5, min 1, max 20)
   * @returns `{ total, overdue, items }`
   */
  async getApprovalsWaiting(limit = 5) {
    const take = Math.max(1, Math.min(limit, 20));
    const now = new Date();
    const [total, overdue, rows] = await Promise.all([
      this.prisma.formApproval.count({ where: { status: "pending" } }),
      this.prisma.formApproval.count({
        where: { status: "pending", dueAt: { lt: now } }
      }),
      this.prisma.formApproval.findMany({
        where: { status: "pending" },
        include: {
          assignedTo: { select: { id: true, firstName: true, lastName: true } },
          submission: {
            select: {
              id: true,
              submittedAt: true,
              submittedBy: { select: { id: true, firstName: true, lastName: true } },
              templateVersion: {
                select: { template: { select: { id: true, name: true, code: true } } }
              }
            }
          }
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
        take
      })
    ]);
    return {
      total,
      overdue,
      items: rows.map((r) => ({
        id: r.id,
        submissionId: r.submissionId,
        stepNumber: r.stepNumber,
        assignedToId: r.assignedToId,
        assignedToName: r.assignedTo
          ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}`.trim()
          : null,
        assignedToRole: r.assignedToRole,
        dueAt: r.dueAt,
        overdue: r.dueAt ? r.dueAt < now : false,
        submittedAt: r.submission.submittedAt,
        submittedByName: r.submission.submittedBy
          ? `${r.submission.submittedBy.firstName} ${r.submission.submittedBy.lastName}`.trim()
          : null,
        templateId: r.submission.templateVersion.template.id,
        templateName: r.submission.templateVersion.template.name,
        templateCode: r.submission.templateVersion.template.code
      }))
    };
  }

  /**
   * Dashboard batch-2 widget aggregate: pre-start submissions logged
   * anywhere in the system between 00:00 and 23:59:59.999 of the caller's
   * current calendar day (server-local time).
   *
   * A submission counts when the template code OR name contains
   * "prestart"/"pre-start" (case-insensitive) and the row is NOT a draft.
   * The "expected" denominator (crews scheduled today) is DEFERRED to
   * B-P0c — this endpoint deliberately returns a count only.
   *
   * @param now - override clock (tests)
   * @returns `{ count, latestSubmittedAt }`
   */
  async getPreStartsToday(now: Date = new Date()) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 86_400_000 - 1);
    const templateWhere: Prisma.FormSubmissionWhereInput = {
      submittedAt: { gte: start, lte: end },
      status: { notIn: ["draft", "DRAFT"] },
      templateVersion: {
        template: {
          OR: [
            { code: { contains: "prestart", mode: "insensitive" } },
            { name: { contains: "prestart", mode: "insensitive" } }
          ]
        }
      }
    };
    const [count, latest] = await Promise.all([
      this.prisma.formSubmission.count({ where: templateWhere }),
      this.prisma.formSubmission.findFirst({
        where: templateWhere,
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true }
      })
    ]);
    return { count, latestSubmittedAt: latest?.submittedAt ?? null };
  }

  // ── Detail helpers ─────────────────────────────────────────────────────

  /**
   * Fetch a submission with the full detail include set (template version,
   * sections/fields, values, approvals, triggered records, attachments,
   * signatures).
   *
   * @returns the submission detail payload
   * @throws NotFoundException when the submission does not exist
   */
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
            // Notify the assignee for corrective actions created by the engine.
            if (action.recordType === "corrective_action") {
              const ca = await this.prisma.correctiveAction.findUnique({
                where: { id: recordId },
                select: { assignedToId: true, title: true }
              });
              if (ca?.assignedToId) {
                void this.notifications
                  .create(
                    {
                      userId: ca.assignedToId,
                      title: "Corrective action assigned",
                      body: `You have been assigned a corrective action: ${ca.title}`,
                      severity: "warning",
                      linkUrl: `/forms/corrective-actions/${recordId}`
                    },
                    submission.submittedById ?? undefined
                  )
                  .catch(() => undefined);
              }
            }
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

    if (action.recordType === "corrective_action") {
      const title =
        action.correctiveActionTitle ??
        this.stringValue(values, "corrective_action_title") ??
        "Corrective action raised from form";
      const description =
        action.correctiveActionDescription ??
        this.stringValue(values, "description") ??
        this.stringValue(values, "corrective_action_description") ??
        null;
      const priority = action.correctiveActionPriority ?? "medium";
      // Resolve assignee from context — the rule can supply a role, or
      // the engine falls back to the form's supervisor/PM context.
      const assignedToRole =
        action.correctiveActionAssignToRole ??
        action.notificationTarget ??
        null;
      const ctxSupervisor = ctx.supervisorId ?? null;
      const ctxPM = ctx.projectManagerId ?? null;
      const assignedToId: string | null =
        assignedToRole === "supervisor"
          ? ctxSupervisor
          : assignedToRole === "project_manager"
            ? ctxPM
            : null;

      const created = await this.prisma.correctiveAction.create({
        data: {
          submissionId: submission.id,
          sourceFieldKey: action.target ?? null,
          title,
          description,
          assignedToId,
          assignedToRole,
          priority,
          status: "open"
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
    if (fieldType === "calculation") {
      // The client value is presentational only — never trust it. The server
      // recomputes on submit; for draft PATCHes we drop it entirely so a
      // stale client number can't linger on the row.
      return empty;
    }
    if (fieldType === "toggle" || fieldType === "checkbox") {
      return { ...empty, valueBoolean: Boolean(raw) };
    }
    if (fieldType === "terms") {
      // Persist {accepted, version, acceptedAt} as JSON so the audit trail
      // can prove which version of the text was agreed to. Anything that
      // isn't a strict `accepted:true` collapses to empty so isRequired
      // checks catch un-ticked terms.
      if (typeof raw === "object" && raw !== null && (raw as { accepted?: unknown }).accepted === true) {
        return { ...empty, valueJson: raw as Prisma.InputJsonValue };
      }
      return empty;
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

  /**
   * Recompute every calculation field on the submission and write the
   * result to its FormSubmissionValue row.
   *
   * The server treats client-side numbers as presentational; this is what
   * makes the "calculation" field trustworthy. Operand values are read
   * from the current stored values map, coerced to numbers, and combined
   * per the field's `config.operation`.
   */
  private async recomputeCalculations(
    submissionId: string,
    template: { sections?: Array<{ fields?: Array<{ id: string; fieldKey: string; fieldType: string; config?: unknown }> }> },
    values: ValueMap
  ): Promise<ValueMap> {
    const merged: ValueMap = { ...values };
    for (const section of template.sections ?? []) {
      for (const field of section.fields ?? []) {
        if (field.fieldType !== "calculation") continue;
        const config = (field.config ?? {}) as {
          operation?: string;
          operandKeys?: string[];
          decimals?: number;
        };
        const operands = (config.operandKeys ?? [])
          .map((key) => merged[key])
          .map((v) => (typeof v === "number" ? v : Number(v)))
          .filter((n) => Number.isFinite(n)) as number[];
        const result = computeCalculation(config.operation ?? "sum", operands, config.decimals ?? 2);
        merged[field.fieldKey] = result;
        const existing = await this.prisma.formSubmissionValue.findFirst({
          where: { submissionId, fieldKey: field.fieldKey }
        });
        const data =
          result === null
            ? { valueText: null, valueNumber: null, valueBoolean: null, valueDateTime: null, valueJson: Prisma.JsonNull as Prisma.NullableJsonNullValueInput }
            : {
                valueText: null,
                valueNumber: new Prisma.Decimal(result),
                valueBoolean: null,
                valueDateTime: null,
                valueJson: Prisma.JsonNull as Prisma.NullableJsonNullValueInput
              };
        if (existing) {
          await this.prisma.formSubmissionValue.update({
            where: { id: existing.id },
            data: { ...data, fieldId: field.id }
          });
        } else {
          await this.prisma.formSubmissionValue.create({
            data: { submissionId, fieldKey: field.fieldKey, fieldId: field.id, ...data }
          });
        }
      }
    }
    return merged;
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
