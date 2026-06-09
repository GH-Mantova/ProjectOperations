import { Body, Controller, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  AwardTenderClientDto,
  ConvertTenderToJobDto,
  IssueTenderContractDto,
  ReuseArchivedJobConversionDto,
  RollbackTenderLifecycleDto
} from "./dto/job-conversion.dto";
import { JobsService } from "./jobs.service";

/**
 * HTTP surface for the tender → job lifecycle: award a tender client,
 * issue a contract, convert to a job (fresh or by reusing an archived
 * one), and roll the lifecycle back if needed. All routes require
 * `tenderconversion.manage` and are protected by JWT + the
 * {@link PermissionsGuard}. Mounted under `/tenders/:tenderId/...` so the
 * routes sit alongside the read-only tender surface.
 */
@ApiTags("Tender Conversion")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderConversionController {
  constructor(private readonly service: JobsService) {}

  /** Mark a tender client as the winner; clears any prior winner and moves the tender to `AWARDED`. */
  @Patch(":tenderId/award")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({ summary: "Award a tender client" })
  award(
    @Param("tenderId") tenderId: string,
    @Body() dto: AwardTenderClientDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.awardTenderClient(tenderId, dto.tenderClientId, actor.sub);
  }

  /** Issue a contract against the awarded tender client; moves the tender to `CONTRACT_ISSUED`. */
  @Patch(":tenderId/contract")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({ summary: "Issue contract from awarded tender client" })
  issueContract(
    @Param("tenderId") tenderId: string,
    @Body() dto: IssueTenderContractDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.issueContract(tenderId, dto, actor.sub);
  }

  /** Convert a contracted awarded tender into a brand-new job; provisions a SharePoint folder and optionally carries documents forward. */
  @Post(":tenderId/convert-to-job")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({ summary: "Convert a contracted awarded tender to a job" })
  convert(
    @Param("tenderId") tenderId: string,
    @Body() dto: ConvertTenderToJobDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.convertTenderToJob(tenderId, dto, actor.sub);
  }

  /** Reopen an archived job and attach the tender's new conversion to it as a fresh stage. */
  @Post(":tenderId/convert-to-job/reuse-archived")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({ summary: "Reuse an archived job conversion as a new stage" })
  reuseArchived(
    @Param("tenderId") tenderId: string,
    @Body() dto: ReuseArchivedJobConversionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.reuseArchivedJobConversion(tenderId, dto, actor.sub);
  }

  /** Move a tender backwards through its lifecycle; archives any attached source job and detaches it from the tender. */
  @Patch(":tenderId/rollback-lifecycle")
  @RequirePermissions("tenderconversion.manage")
  @ApiOperation({ summary: "Roll back a converted or contracted tender to Awarded or Contract" })
  rollbackLifecycle(
    @Param("tenderId") tenderId: string,
    @Body() dto: RollbackTenderLifecycleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.rollbackTenderLifecycle(tenderId, dto, actor.sub);
  }
}
