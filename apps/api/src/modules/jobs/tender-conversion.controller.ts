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

@ApiTags("Tender Conversion")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderConversionController {
  constructor(private readonly service: JobsService) {}

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
