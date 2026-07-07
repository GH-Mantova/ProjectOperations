import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ApprovalsService } from "./approvals.service";
import { ListApprovalDecisionsQueryDto } from "./dto/list-approval-decisions.query.dto";
import { OverruleApprovalDecisionDto } from "./dto/overrule-approval-decision.dto";
import { RecordApprovalDecisionDto } from "./dto/record-approval-decision.dto";

@ApiTags("Approvals")
@ApiBearerAuth()
@Controller("approvals/decisions")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get()
  @RequirePermissions("approvals.view")
  @ApiOperation({ summary: "List approval decisions for a record (chronological)" })
  @ApiQuery({ name: "entityType", required: true, type: String })
  @ApiQuery({ name: "entityId", required: true, type: String })
  @ApiResponse({ status: 200, description: "Approval decisions for the record." })
  list(@Query() query: ListApprovalDecisionsQueryDto) {
    return this.approvals.listForRecord(query.entityType, query.entityId);
  }

  @Post()
  @RequirePermissions("approvals.decide")
  @ApiOperation({
    summary:
      "Record an approval decision (routed through AuthorityService.check — the seam refuses APPROVED when the amount exceeds a matched authority rule)."
  })
  @ApiResponse({ status: 201, description: "Approval decision recorded." })
  record(
    @Body() dto: RecordApprovalDecisionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.approvals.recordDecision(dto, actor.sub);
  }

  @Post(":id/overrule")
  @RequirePermissions("approvals.overrule")
  @ApiOperation({
    summary:
      "Overrule a prior approval decision as a senior in the managerId reporting chain of the prior decider."
  })
  @ApiResponse({ status: 201, description: "Overrule recorded; prior decision marked OVERRULED." })
  overrule(
    @Param("id") id: string,
    @Body() dto: OverruleApprovalDecisionDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.approvals.overrule(id, dto, actor.sub);
  }
}
