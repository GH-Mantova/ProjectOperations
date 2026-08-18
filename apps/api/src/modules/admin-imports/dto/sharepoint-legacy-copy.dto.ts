/**
 * TFM-S7 — DTOs for the MIG-3 SharePoint legacy-copy plan and execute endpoints.
 *
 * These types mirror the service's PlanEntry / LegacyCopyPlan shapes and are
 * used by the controller for serialisation. They carry the destination-readiness
 * verdict added in TFM-S7.
 */

// ---------------------------------------------------------------------------
// Plan DTOs
// ---------------------------------------------------------------------------

/** A single file that would be copied during execute(). */
export class WouldCopyEntryDto {
  sourcePath!: string;
  destinationPath!: string;
  sizeBytes!: number;
}

/**
 * Per-tender readiness verdict in the plan response.
 * When destinationReady is false, wouldCopy is empty and destinationReason
 * explains why the tender was refused.
 */
export class PlanEntryDto {
  tenderId!: string;
  tenderTitle!: string;
  tNumber!: string;
  legacyFolderPath!: string;
  destinationFolderPath!: string;
  destinationReady!: boolean;
  destinationReason!: string | null;
  wouldCopy!: WouldCopyEntryDto[];
}

/** Top-level plan response. */
export class LegacyCopyPlanDto {
  matched!: PlanEntryDto[];
  /** Number of matched tenders whose destination folder is not ready */
  unreadyCount!: number;
  unmatchedTenders!: Array<{ tenderId: string; tNumber: string; tenderTitle: string }>;
  unmatchedLegacyFolders!: Array<{ tNumber: string; legacyFolderPath: string }>;
  noTNumberCount!: number;
  noDestination!: Array<{ tenderId: string; tNumber: string; tenderTitle: string }>;
}

// ---------------------------------------------------------------------------
// Execute DTOs
// ---------------------------------------------------------------------------

export class FileCopyResultDto {
  name!: string;
  outcome!: "copied" | "skipped" | "error";
  reason?: string;
}

export class MatchExecutionResultDto {
  tenderId!: string;
  tNumber!: string;
  files!: FileCopyResultDto[];
  copied!: number;
  alreadyPresent!: number;
  errors!: number;
}

export class LegacyCopyExecutionReportDto {
  matchesAttempted!: number;
  matchResults!: MatchExecutionResultDto[];
  totalCopied!: number;
  totalAlreadyPresent!: number;
  totalErrors!: number;
  unmatchedTenderCount!: number;
  noDestinationCount!: number;
  /** Tenders skipped at execute time because their destination was not ready */
  skippedUnreadyCount!: number;
}
