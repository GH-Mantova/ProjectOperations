import { ApiProperty } from "@nestjs/swagger";

/**
 * Response body for `GET /admin/jpm/reconciliation` — Phase A coverage snapshot.
 */
export class JpmReconciliationReportDto {
  @ApiProperty({ description: "Jobs that now point at a surviving Project (backfilled by shared source_tender_id)." })
  linkedPairs!: number;

  @ApiProperty({ description: "Jobs with no survivingProjectId — no Project matched their source tender." })
  orphanJobs!: number;

  @ApiProperty({ description: "Projects with no sourceJobId — no Job matched their source tender." })
  orphanProjects!: number;

  @ApiProperty({ description: "Total jobs table row count." })
  jobsTotal!: number;

  @ApiProperty({ description: "Total projects table row count." })
  projectsTotal!: number;

  @ApiProperty({ description: "Jobs whose source_tender_id is null (manual jobs — never linkable by tender)." })
  jobsWithoutSourceTender!: number;

  @ApiProperty({ description: "Projects whose source_tender_id is null (manually created — never linkable by tender)." })
  projectsWithoutSourceTender!: number;

  @ApiProperty({ description: "ISO timestamp the counts were generated at." })
  generatedAt!: string;
}
