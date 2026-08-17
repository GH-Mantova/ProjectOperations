import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { WithdrawalReviewService } from "./withdrawal-review.service";

class WithdrawalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/**
 * REST surface for the tender withdrawn-review workflow.
 *
 * POST /tenders/:id/withdraw            — DRAFT/ESTIMATING → WITHDRAWN + PENDING_REVIEW  (tenders.manage)
 * POST /tenders/:id/withdrawal/reopen   — PENDING_REVIEW → IN_PROGRESS                    (tenders.review)
 * POST /tenders/:id/withdrawal/confirm  — PENDING_REVIEW → WITHDRAWN + CONFIRMED (exits Pipeline) (tenders.review)
 * GET  /tenders/:id/withdrawal/reviews  — append-only decision ledger                     (tenders.view)
 *
 * Reviewer authority is verified in-service against the JWT permissions +
 * super-user flag so any future non-HTTP callers stay consistent.
 */
@ApiTags("Tendering")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WithdrawalReviewController {
  constructor(private readonly service: WithdrawalReviewService) {}

  @Post(":id/withdraw")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary: "Withdraw a Draft/Estimating tender (moves to Withdrawn pending review)"
  })
  @ApiResponse({ status: 201, description: "Tender withdrawn — pending reviewer decision." })
  @ApiResponse({ status: 400, description: "Tender is not in Draft or Estimating." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  withdraw(
    @Param("id") id: string,
    @Body() dto: WithdrawalActionDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.withdraw(id, dto.reason, {
      sub: actor.sub,
      permissions: actor.permissions,
      isSuperUser: actor.isSuperUser
    });
  }

  @Post(":id/withdrawal/reopen")
  @RequirePermissions("tenders.review")
  @ApiOperation({ summary: "Reviewer action — reopen a Withdrawn (pending review) tender to Estimating" })
  @ApiResponse({ status: 201, description: "Tender reopened to Estimating." })
  @ApiResponse({ status: 400, description: "Tender is not Withdrawn (pending review)." })
  @ApiResponse({ status: 403, description: "Reviewer permission required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  reopen(
    @Param("id") id: string,
    @Body() dto: WithdrawalActionDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.reopen(id, dto.reason, {
      sub: actor.sub,
      permissions: actor.permissions,
      isSuperUser: actor.isSuperUser
    });
  }

  @Post(":id/withdrawal/confirm")
  @RequirePermissions("tenders.review")
  @ApiOperation({
    summary: "Reviewer action — confirm withdrawal (tender exits Pipeline board, appears only on Register)"
  })
  @ApiResponse({ status: 201, description: "Withdrawal confirmed — tender exits Pipeline." })
  @ApiResponse({ status: 400, description: "Tender is not Withdrawn (pending review)." })
  @ApiResponse({ status: 403, description: "Reviewer permission required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  confirm(
    @Param("id") id: string,
    @Body() dto: WithdrawalActionDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.confirm(id, dto.reason, {
      sub: actor.sub,
      permissions: actor.permissions,
      isSuperUser: actor.isSuperUser
    });
  }

  @Get(":id/withdrawal/reviews")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List the withdrawn-review decision history for a tender (newest-first)" })
  @ApiResponse({ status: 200, description: "Withdrawal review decisions." })
  listReviews(@Param("id") id: string) {
    return this.service.listReviews(id);
  }
}
