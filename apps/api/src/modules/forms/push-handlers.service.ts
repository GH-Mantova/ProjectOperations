import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { MaintenanceService } from "../maintenance/maintenance.service";
import { PushExecutorService, type PushContext, type PushResult } from "./push-executor.service";

/**
 * F-9b — registers the Plant Pre-Start push handlers into the
 * PushExecutorService's runtime registry on module init.
 *
 * Three handlers ship in this slice:
 *   - assets:record_usage_reading — stub (returns `ok: false`) until F-7
 *     (`AssetsService.recordUsageReading`) merges; the executor still
 *     writes a FormTriggeredRecord with `status="failed"` and the reason
 *     so authors see a clear error rather than "no handler registered".
 *     Swap the stub body for the real service call when F-7 lands.
 *   - maintenance:create_defect — creates one AssetBreakdown per entry in
 *     a repeating defect section via MaintenanceService.upsertBreakdown
 *     (single-writer rule, sot/06-active-specs.md §4.1).
 *   - maintenance:flag_major_defect — when a defect's severity is
 *     "Major", flips the asset to OUT_OF_SERVICE via
 *     MaintenanceService.updateAssetStatus so AssetStatusHistory records
 *     the change.
 *
 * Handlers here NEVER write directly to Prisma; every push goes through
 * the owning module's service method.
 */
@Injectable()
export class PushHandlersService implements OnModuleInit {
  private readonly logger = new Logger(PushHandlersService.name);

  constructor(
    private readonly executor: PushExecutorService,
    private readonly maintenance: MaintenanceService
  ) {}

  onModuleInit(): void {
    this.executor.registerHandler(
      "assets",
      "record_usage_reading",
      (ctx, config) => this.handleRecordUsageReading(ctx, config)
    );
    this.executor.registerHandler("maintenance", "create_defect", (ctx, config) =>
      this.handleCreateDefect(ctx, config)
    );
    this.executor.registerHandler("maintenance", "flag_major_defect", (ctx, config) =>
      this.handleFlagMajorDefect(ctx, config)
    );
    this.logger.log("Registered 3 Plant Pre-Start push handlers (record_usage_reading stubbed pending F-7)");
  }

  /**
   * `assets:record_usage_reading` stub.
   *
   * Real implementation is blocked on F-7
   * (`AssetsService.recordUsageReading`). Once F-7 merges, replace the
   * body with a call that resolves the asset from
   * `config.assetFromFieldKey`, reads the reading value from
   * `ctx.values[config.readingFieldKey]`, and calls
   * `AssetsService.recordUsageReading` — never touching
   * `prisma.assetUsageReading.*` directly (single-writer rule).
   *
   * Returning `ok: false` produces a FormTriggeredRecord row with
   * `status="failed"` and a clear lastError, so the retry UI (this slice)
   * and Marco's audit spine both surface the gap explicitly.
   */
  private async handleRecordUsageReading(
    _ctx: PushContext,
    _config: Record<string, unknown>
  ): Promise<PushResult> {
    return {
      ok: false,
      error:
        "F-7 not shipped: AssetsService.recordUsageReading is unavailable. Handler wired but stubbed."
    };
  }

  /**
   * `maintenance:create_defect` — persists one AssetBreakdown per entry in
   * a repeating defect section. Reads entries from the values-json blob
   * carried on the field named by `config.entriesFieldKey`, or falls back
   * to a single entry composed from the current field context when the
   * field isn't a repeating section.
   *
   * Expected config keys:
   *   - `assetFromFieldKey` — form field key whose value is the target
   *     asset id (typically an asset_picker).
   *   - `entriesFieldKey` — repeating-section entries key (each entry is
   *     `{ summary, severity, notes? }`). Optional; when omitted the
   *     handler reads `summary`/`severity` directly from ctx.values.
   *   - `defaultSeverity` — severity to apply when an entry is missing
   *     one; defaults to "MEDIUM".
   */
  private async handleCreateDefect(
    ctx: PushContext,
    config: Record<string, unknown>
  ): Promise<PushResult> {
    const assetFromFieldKey = String(config.assetFromFieldKey ?? "");
    const entriesFieldKey = config.entriesFieldKey
      ? String(config.entriesFieldKey)
      : undefined;
    const defaultSeverity = String(config.defaultSeverity ?? "MEDIUM");

    if (!assetFromFieldKey) {
      return { ok: false, error: "config.assetFromFieldKey is required" };
    }
    const assetId = ctx.values[assetFromFieldKey];
    if (typeof assetId !== "string" || assetId.length === 0) {
      return {
        ok: false,
        error: `Field "${assetFromFieldKey}" did not yield an asset id`
      };
    }

    const entries = this.readDefectEntries(ctx, entriesFieldKey);
    if (entries.length === 0) {
      return {
        ok: false,
        error: entriesFieldKey
          ? `No defect entries found under "${entriesFieldKey}"`
          : "No defect summary/severity in submission"
      };
    }

    const createdIds: string[] = [];
    for (const entry of entries) {
      const created = await this.maintenance.upsertBreakdown(undefined, {
        assetId,
        reportedAt: new Date().toISOString(),
        severity: (entry.severity ?? defaultSeverity).toUpperCase(),
        status: "OPEN",
        summary: entry.summary ?? "Defect raised from form submission",
        notes: entry.notes ?? undefined
      });
      createdIds.push(created.id);
    }

    return { ok: true, recordId: createdIds.join(",") };
  }

  /**
   * `maintenance:flag_major_defect` — when any defect entry has severity
   * "Major"/"MAJOR"/"CRITICAL", flip the target asset to
   * OUT_OF_SERVICE. Idempotent-guarded by the underlying service, which
   * throws Conflict when the asset already holds the requested status —
   * caught here and treated as a no-op success so the retry loop stays
   * clean.
   *
   * Config keys: same shape as create_defect (assetFromFieldKey,
   * entriesFieldKey, optional blockedStatus override, default
   * "OUT_OF_SERVICE").
   */
  private async handleFlagMajorDefect(
    ctx: PushContext,
    config: Record<string, unknown>
  ): Promise<PushResult> {
    const assetFromFieldKey = String(config.assetFromFieldKey ?? "");
    const entriesFieldKey = config.entriesFieldKey
      ? String(config.entriesFieldKey)
      : undefined;
    const blockedStatus = String(config.blockedStatus ?? "OUT_OF_SERVICE");

    if (!assetFromFieldKey) {
      return { ok: false, error: "config.assetFromFieldKey is required" };
    }
    const assetId = ctx.values[assetFromFieldKey];
    if (typeof assetId !== "string" || assetId.length === 0) {
      return { ok: false, error: `Field "${assetFromFieldKey}" did not yield an asset id` };
    }

    const entries = this.readDefectEntries(ctx, entriesFieldKey);
    const isMajor = entries.some((e) => {
      const sev = (e.severity ?? "").toUpperCase();
      return sev === "MAJOR" || sev === "CRITICAL";
    });
    if (!isMajor) {
      return { ok: true, recordId: assetId };
    }

    try {
      await this.maintenance.updateAssetStatus(
        assetId,
        { status: blockedStatus, note: "Blocked by form Major-severity defect" }
      );
      return { ok: true, recordId: assetId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already has that status")) {
        return { ok: true, recordId: assetId };
      }
      return { ok: false, error: message };
    }
  }

  /**
   * Pulls defect entries out of the submission. When `entriesFieldKey` is
   * given and points at a repeating-section JSON array, each element is
   * treated as one defect. Otherwise falls back to a single-entry read
   * from the flat context (summary/severity/notes keys).
   *
   * The flat map from PushContext only carries entry 0 for repeating
   * sections; for the multi-entry case the handler reads the full set out
   * of the submission's value rows keyed by the section's own value
   * fields. We keep it simple: if the field's valueJson is an array, that
   * is the entry list; otherwise we look up sibling summary/severity in
   * ctx.values.
   */
  private readDefectEntries(
    ctx: PushContext,
    entriesFieldKey: string | undefined
  ): Array<{ summary?: string; severity?: string; notes?: string }> {
    if (entriesFieldKey) {
      const raw = ctx.values[entriesFieldKey];
      if (Array.isArray(raw)) {
        const entries: Array<{ summary?: string; severity?: string; notes?: string }> = [];
        for (const entry of raw) {
          if (!entry || typeof entry !== "object") continue;
          const e = entry as Record<string, unknown>;
          entries.push({
            summary: typeof e.summary === "string" ? e.summary : undefined,
            severity: typeof e.severity === "string" ? e.severity : undefined,
            notes: typeof e.notes === "string" ? e.notes : undefined
          });
        }
        return entries;
      }
    }
    const summary = ctx.values.summary ?? ctx.values.defect_summary;
    const severity = ctx.values.severity ?? ctx.values.defect_severity;
    if (summary === undefined && severity === undefined) return [];
    return [
      {
        summary: typeof summary === "string" ? summary : undefined,
        severity: typeof severity === "string" ? severity : undefined
      }
    ];
  }
}
