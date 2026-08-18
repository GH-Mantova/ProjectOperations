import { IsOptional, IsString } from "class-validator";

/**
 * Body for `POST /handovers/:id/finalise`.
 *
 * All fields are optional — the service derives what it needs from the
 * handover's contract → project → tender chain.  Callers may supply a
 * `projectManagerId` and/or `siteId` to pre-wire them on the created job,
 * matching the same optional fields accepted by the upstream
 * `convertTenderToJob` endpoint.
 */
export class FinaliseHandoverDto {
  /**
   * Optional job name override.  When omitted the service falls back to the
   * project name resolved from the handover's contract.
   */
  @IsOptional()
  @IsString()
  jobName?: string;

  /** Optional: pre-assign a project manager on the created job. */
  @IsOptional()
  @IsString()
  projectManagerId?: string;

  /** Optional: attach a site to the created job. */
  @IsOptional()
  @IsString()
  siteId?: string;

  /** Optional: carry all tender documents to the job (default false). */
  @IsOptional()
  carryTenderDocuments?: boolean;
}
