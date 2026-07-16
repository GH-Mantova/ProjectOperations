import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CommitmentService } from "./commitment.service";
import {
  CreateCommitmentChangeDto,
  CreateCommitmentDto,
  ListCommitmentsQueryDto,
  UpdateCommitmentDto
} from "./dto/commitment.dto";

/**
 * REST endpoints for budget-facing commitment tracking (ERP gap A).
 *
 * Permission seam mirrors the procurement module:
 *   Read → procurement.view
 *   Draft / edit → procurement.manage
 *   Approve / status transitions → procurement.approve
 */
@ApiTags("Commitments")
@ApiBearerAuth()
@Controller("commitments")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommitmentController {
  constructor(private readonly service: CommitmentService) {}

  // ── List / budget summary ──────────────────────────────────────────────

  @Get()
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "List commitments, optionally filtered by jobId/status" })
  @ApiResponse({ status: 200 })
  listCommitments(@Query() query: ListCommitmentsQueryDto) {
    return this.service.listCommitments(query);
  }

  @Get("budget-summary")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "Budget summary for a job — committed vs approved totals" })
  @ApiResponse({ status: 200 })
  getBudgetSummary(@Query("jobId") jobId: string) {
    return this.service.getJobBudgetSummary(jobId);
  }

  @Get(":id")
  @RequirePermissions("procurement.view")
  @ApiOperation({ summary: "Get a single commitment with items and changes" })
  @ApiResponse({ status: 200 })
  getCommitment(@Param("id") id: string) {
    return this.service.getCommitment(id);
  }

  // ── Create / Update ────────────────────────────────────────────────────

  @Post()
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Create a DRAFT commitment on a job" })
  @ApiResponse({ status: 201 })
  createCommitment(
    @Body() dto: CreateCommitmentDto,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.createCommitment(dto, actorId);
  }

  @Patch(":id")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Edit a commitment (DRAFT or APPROVED only)" })
  @ApiResponse({ status: 200 })
  updateCommitment(
    @Param("id") id: string,
    @Body() dto: UpdateCommitmentDto,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.updateCommitment(id, dto, actorId);
  }

  // ── Status transitions ─────────────────────────────────────────────────

  @Patch(":id/approve")
  @RequirePermissions("procurement.approve")
  @ApiOperation({ summary: "Approve a DRAFT commitment" })
  @ApiResponse({ status: 200 })
  approveCommitment(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.approveCommitment(id, actorId);
  }

  @Patch(":id/close")
  @RequirePermissions("procurement.approve")
  @ApiOperation({ summary: "Close an APPROVED commitment (work complete)" })
  @ApiResponse({ status: 200 })
  closeCommitment(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.closeCommitment(id, actorId);
  }

  @Patch(":id/cancel")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Cancel a commitment" })
  @ApiResponse({ status: 200 })
  cancelCommitment(
    @Param("id") id: string,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.cancelCommitment(id, actorId);
  }

  // ── Commitment Changes (variations / VOs) ──────────────────────────────

  @Post(":id/changes")
  @RequirePermissions("procurement.manage")
  @ApiOperation({ summary: "Add a variation / VO to a commitment" })
  @ApiResponse({ status: 201 })
  addChange(
    @Param("id") commitmentId: string,
    @Body() dto: CreateCommitmentChangeDto,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.addChange(commitmentId, dto, actorId);
  }

  @Patch("changes/:changeId/approve")
  @RequirePermissions("procurement.approve")
  @ApiOperation({ summary: "Approve a PENDING commitment variation" })
  @ApiResponse({ status: 200 })
  approveChange(
    @Param("changeId") changeId: string,
    @CurrentUser("id") actorId: string
  ) {
    return this.service.approveChange(changeId, actorId);
  }
}
