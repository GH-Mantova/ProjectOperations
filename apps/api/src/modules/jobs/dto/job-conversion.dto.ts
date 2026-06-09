import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsDateString, IsIn, IsOptional, IsString } from "class-validator";

/**
 * Payload for `PATCH /tenders/:tenderId/award`. Identifies which tender
 * client is being marked as the winner; the service layer clears
 * `isAwarded` from any prior winner on the same tender.
 */
export class AwardTenderClientDto {
  @IsString()
  tenderClientId!: string;
}

/**
 * Payload for `PATCH /tenders/:tenderId/contract`. The supplied
 * `tenderClientId` must already be the awarded client.
 * `contractIssuedAt` defaults to "now" server-side when omitted.
 */
export class IssueTenderContractDto {
  @IsString()
  tenderClientId!: string;

  @IsOptional()
  @IsDateString()
  contractIssuedAt?: string;
}

/**
 * Payload for `POST /tenders/:tenderId/convert-to-job`. Creates a fresh
 * job from a contracted, awarded tender. `name` is required; the rest
 * default off the tender (e.g. `description`) or stay null.
 *
 * `jobNumber` (PR B05) is canonical `J-YYYY-NNN`: omit to let the server
 * generate one via {@link JobNumberService.generate}, or supply one
 * that matches the canonical regex. Legacy `JOB-YYYY-NNN` inputs are
 * rejected with 400.
 *
 * Document carry-forward (`carryTenderDocuments` +
 * `tenderDocumentIds`):
 *   - `carryTenderDocuments = false` → no documents carried (the IDs
 *     array must be empty or absent, else 400).
 *   - `carryTenderDocuments = true`, no IDs → all tender documents are
 *     carried.
 *   - `carryTenderDocuments = true`, with IDs → only the listed
 *     documents are carried (all IDs must belong to this tender).
 */
export class ConvertTenderToJobDto {
  @IsOptional()
  @IsString()
  jobNumber?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  siteId?: string;

  @IsOptional()
  @IsString()
  projectManagerId?: string;

  @IsOptional()
  @IsString()
  supervisorId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  carryTenderDocuments?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenderDocumentIds?: string[];
}

/**
 * Payload for `POST /tenders/:tenderId/convert-to-job/reuse-archived`.
 * Reopens an archived job and attaches the tender's new conversion to
 * it as a fresh stage. Inherits all conversion fields and document
 * carry-forward semantics from {@link ConvertTenderToJobDto}.
 *
 * `archivedJobId` is preferred for the lookup; when omitted, the
 * required `jobNumber` is used to look up the archived row instead
 * (`declare` overrides the parent's now-optional decoration without
 * re-emitting the field). `stageName` is required — the new stage is
 * inserted at the end of the reopened job's stage list.
 */
export class ReuseArchivedJobConversionDto extends ConvertTenderToJobDto {
  @IsOptional()
  @IsString()
  archivedJobId?: string;

  @IsString()
  stageName!: string;

  @IsString()
  declare jobNumber: string;
}

/**
 * Payload for `PATCH /tenders/:tenderId/rollback-lifecycle`. Moves a
 * tender backwards through its lifecycle to `targetStage` and clears
 * award + contract state on every tender client. For `AWARDED` and
 * `CONTRACT_ISSUED` targets, `tenderClientId` identifies which client
 * to re-mark as awarded (and contract-issued); when omitted, the
 * service falls back to the previously-awarded or first-listed client.
 *
 * If the tender already has a source job, that job is archived and
 * detached as part of the same transaction.
 */
export class RollbackTenderLifecycleDto {
  @IsString()
  @IsIn(["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"])
  targetStage!: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED";

  @IsOptional()
  @IsString()
  tenderClientId?: string;
}
