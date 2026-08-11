import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Context resolved for a single push binding execution.
 * Carries the submission's field values keyed by fieldKey, and the full
 * submission record so handlers can read context (projectId, etc.).
 */
export interface PushContext {
  submissionId: string;
  /** Flat value map: fieldKey → submitted value (entry 0 for repeating sections). */
  values: Record<string, unknown>;
  /** Submission context blob (project/timesheet/supervisor ids etc.). */
  submissionContext: Record<string, unknown>;
}

/**
 * Result returned by a push handler.
 * On success, `recordId` is the id of the record created/updated.
 * On failure, `error` carries the human-readable reason.
 */
export type PushResult =
  | { ok: true; recordId: string }
  | { ok: false; error: string };

/**
 * A push action handler registered for a targetModule + targetAction pair.
 * F-9b will register the Plant Pre-Start handlers here.
 */
export type PushHandler = (
  ctx: PushContext,
  config: Record<string, unknown>
) => Promise<PushResult>;

/**
 * F-9a — post-commit push executor.
 *
 * Given a sealed FormSubmission, loads all enabled FormFieldPushBinding rows
 * for the template-version fields that match the requested applyOn stage, and
 * for each binding:
 *   1. Resolves the target record from config (e.g. assetFromFieldKey).
 *   2. Dispatches to the registered handler for targetModule/targetAction.
 *   3. On success: writes a FormTriggeredRecord row (audit link).
 *   4. On failure: writes a FormTriggeredRecord row with status="failed" and
 *      lastError set — the submission is NEVER rolled back (section 4.4 LOCKED).
 *
 * Execution is idempotent: if a FormTriggeredRecord already exists for a
 * (submissionId, bindingId) pair the executor skips the binding so retries
 * never double-write.
 *
 * Handlers are registered via registerHandler() so F-9b can add the Plant
 * Pre-Start actions (record_usage_reading, defect creation, Major-severity flag)
 * without touching this executor's core loop.
 */
@Injectable()
export class PushExecutorService {
  private readonly logger = new Logger(PushExecutorService.name);

  /** Registry of handler functions keyed by "targetModule:targetAction". */
  private readonly handlers = new Map<string, PushHandler>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register a push handler for a targetModule + targetAction pair.
   * Called by F-9b (and beyond) to wire concrete implementations without
   * touching this executor's core loop.
   *
   * @param targetModule - e.g. "assets"
   * @param targetAction - e.g. "record_usage_reading"
   * @param handler - async function that performs the push
   */
  registerHandler(targetModule: string, targetAction: string, handler: PushHandler): void {
    const key = `${targetModule}:${targetAction}`;
    this.handlers.set(key, handler);
  }

  /**
   * Execute all enabled push bindings for the given submission that match
   * the specified applyOn stage ("submit" | "approval").
   *
   * Must only be called AFTER the submission has been saved and is sealed
   * (sealedAt is set). A push never fires on an unsealed submission.
   *
   * Failures are recorded on the audit spine but never propagate — the
   * submission save is never rolled back (section 4.4 LOCKED principle).
   *
   * @param submissionId - the sealed submission to process
   * @param applyOn - stage: "submit" for the submit flow, "approval" for approval
   */
  async executePushes(submissionId: string, applyOn: "submit" | "approval"): Promise<void> {
    // Load the submission together with its template-version fields that
    // carry push bindings for this stage.
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id: submissionId },
      include: {
        values: { where: { entryIndex: 0 } },
        templateVersion: {
          include: {
            sections: {
              include: {
                fields: {
                  include: {
                    pushBindings: {
                      where: { isEnabled: true, applyOn }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!submission) {
      this.logger.warn(`PushExecutor: submission ${submissionId} not found — skipping pushes`);
      return;
    }

    // Guard: never push on an unsealed submission (section 4.4 / F-5 LOCKED).
    if (!submission.sealedAt) {
      this.logger.debug(
        `PushExecutor: submission ${submissionId} is not sealed — skipping pushes`
      );
      return;
    }

    // Build flat value map from the submission's stored values (entry 0).
    const values: Record<string, unknown> = {};
    for (const val of submission.values) {
      if (val.valueText !== null) values[val.fieldKey] = val.valueText;
      else if (val.valueNumber !== null) values[val.fieldKey] = Number(val.valueNumber);
      else if (val.valueBoolean !== null) values[val.fieldKey] = val.valueBoolean;
      else if (val.valueDateTime !== null) values[val.fieldKey] = val.valueDateTime;
      else if (val.valueJson !== null) values[val.fieldKey] = val.valueJson;
    }

    const submissionContext = (submission.context ?? {}) as Record<string, unknown>;

    const ctx: PushContext = {
      submissionId,
      values,
      submissionContext
    };

    // Collect all enabled bindings across all fields in this template version.
    const bindings: Array<{
      id: string;
      targetModule: string;
      targetAction: string;
      config: Record<string, unknown>;
    }> = [];

    for (const section of submission.templateVersion.sections) {
      for (const field of section.fields) {
        for (const binding of field.pushBindings) {
          bindings.push({
            id: binding.id,
            targetModule: binding.targetModule,
            targetAction: binding.targetAction,
            config: (binding.config ?? {}) as Record<string, unknown>
          });
        }
      }
    }

    if (bindings.length === 0) return;

    // Load existing triggered records for this submission to enforce idempotency.
    const existingRecords = await this.prisma.formTriggeredRecord.findMany({
      where: {
        submissionId,
        bindingId: { not: null }
      },
      select: { bindingId: true }
    });
    const executedBindingIds = new Set(
      existingRecords.map((r) => r.bindingId).filter(Boolean) as string[]
    );

    for (const binding of bindings) {
      // Idempotency: skip if this binding already has an audit record.
      if (executedBindingIds.has(binding.id)) {
        this.logger.debug(
          `PushExecutor: binding ${binding.id} already executed for submission ${submissionId} — skipping`
        );
        continue;
      }

      const handlerKey = `${binding.targetModule}:${binding.targetAction}`;
      const handler = this.handlers.get(handlerKey);

      if (!handler) {
        // No handler registered — record as failed so it surfaces on the audit spine.
        this.logger.warn(
          `PushExecutor: no handler registered for "${handlerKey}" (binding ${binding.id})`
        );
        await this.writeAuditRecord({
          submissionId,
          bindingId: binding.id,
          recordType: `${binding.targetModule}:${binding.targetAction}`,
          recordId: "",
          status: "failed",
          lastError: `No handler registered for "${handlerKey}"`
        });
        continue;
      }

      let result: PushResult;
      try {
        result = await handler(ctx, binding.config);
      } catch (err) {
        result = {
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        };
      }

      if (result.ok) {
        await this.writeAuditRecord({
          submissionId,
          bindingId: binding.id,
          recordType: `${binding.targetModule}:${binding.targetAction}`,
          recordId: result.recordId,
          status: "success",
          lastError: null
        });
      } else {
        this.logger.warn(
          `PushExecutor: binding ${binding.id} failed for submission ${submissionId}: ${result.error}`
        );
        await this.writeAuditRecord({
          submissionId,
          bindingId: binding.id,
          recordType: `${binding.targetModule}:${binding.targetAction}`,
          recordId: "",
          status: "failed",
          lastError: result.error
        });
      }
    }
  }

  /**
   * Retry all failed push bindings for a submission.
   *
   * Finds FormTriggeredRecord rows with status="failed" that have a bindingId,
   * deletes them (so the idempotency guard lets them re-run), then calls
   * executePushes for the same applyOn stage.
   *
   * F-9b's UI will call this via a service method or controller route.
   * No HTTP route is added in this slice (F-9a).
   *
   * @param submissionId - submission to retry pushes for
   * @param applyOn - stage to re-run ("submit" | "approval")
   */
  async retryFailedPushes(
    submissionId: string,
    applyOn: "submit" | "approval" = "submit"
  ): Promise<void> {
    // Delete only failed binding-linked records so they are re-attempted.
    await this.prisma.formTriggeredRecord.deleteMany({
      where: {
        submissionId,
        status: "failed",
        bindingId: { not: null }
      }
    });

    await this.executePushes(submissionId, applyOn);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async writeAuditRecord(opts: {
    submissionId: string;
    bindingId: string;
    recordType: string;
    recordId: string;
    status: string;
    lastError: string | null;
  }): Promise<void> {
    try {
      await this.prisma.formTriggeredRecord.create({
        data: {
          submissionId: opts.submissionId,
          bindingId: opts.bindingId,
          recordType: opts.recordType,
          recordId: opts.recordId,
          status: opts.status,
          lastError: opts.lastError,
          attempts: 1
        }
      });
    } catch (err) {
      // Audit write failure must never surface — the submission is already committed.
      this.logger.error(
        `PushExecutor: failed to write audit record for submission ${opts.submissionId} binding ${opts.bindingId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }
}
