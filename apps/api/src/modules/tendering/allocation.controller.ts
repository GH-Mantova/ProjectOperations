import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNotEmpty, IsString, MaxLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AllocationService } from "./allocation.service";

class EstimatorTargetDto {
  @IsString()
  @IsNotEmpty()
  estimatorId!: string;
}

class AllocatePoolDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  estimatorIds!: string[];
}

class RejectAllocationDto {
  /**
   * Blank-reason rejection is enforced twice on purpose: this decorator turns a
   * missing/empty field into a 400 before the service runs, and
   * `AllocationService.reject()` still trims and re-checks so a non-HTTP caller
   * cannot skip the rule. The service remains the authority.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

/**
 * REST surface for the estimator allocation lifecycle (EW-2d).
 *
 * Pure wiring — every endpoint delegates straight to `AllocationService`
 * (EW-2b/2c) and holds no business logic of its own. State-machine rules,
 * authority checks and audit writes all live in the service so non-HTTP callers
 * (EW-3 alerts, EW-4 board) obey the same rules.
 *
 * POST /tenders/allocations/:id/allocate-single — direct assign          (tenders.allocate)
 * POST /tenders/allocations/:id/allocate-pool   — offer to a pool        (tenders.allocate)
 * POST /tenders/allocations/:id/self-claim      — estimator claims       (tenders.manage)
 * POST /tenders/allocations/:id/reject          — estimator declines     (tenders.manage)
 * POST /tenders/allocations/:id/override        — allocator re-assigns   (tenders.allocate)
 * POST /tenders/allocations/:id/transfer        — post-rejection reassign(tenders.allocate)
 * POST /tenders/allocations/:id/push-back       — return to unallocated  (tenders.allocate)
 *
 * `self-claim` and `reject` are the estimator's OWN actions, so the estimator
 * id is taken from the JWT (`actor.sub`) and never from the request body. A
 * body-supplied id would let any `tenders.manage` holder reject the tender
 * assigned to somebody else — the service's "must be the assigned estimator"
 * check compares against the id it is handed, so the id has to be the caller's.
 *
 * Alert dispatch (EW-3) is deliberately not called from here.
 */
@ApiTags("Tender Allocation")
@ApiBearerAuth()
@Controller("tenders/allocations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AllocationController {
  constructor(private readonly service: AllocationService) {}

  @Post(":id/allocate-single")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "Allocator assigns a tender directly to one estimator" })
  @ApiResponse({ status: 201, description: "Tender allocated to the estimator." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender or estimator not found." })
  allocateSingle(
    @Param("id") id: string,
    @Body() dto: EstimatorTargetDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.allocateSingle(id, dto.estimatorId, actor.sub);
  }

  @Post(":id/allocate-pool")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({
    summary: "Allocator offers a tender to a pool of estimators (auto-assigns if any has capacity)"
  })
  @ApiResponse({ status: 201, description: "Tender pooled, or auto-assigned to the least-loaded candidate." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  allocatePool(
    @Param("id") id: string,
    @Body() dto: AllocatePoolDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.allocatePool(id, dto.estimatorIds, actor.sub);
  }

  @Post(":id/self-claim")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Estimator claims an Unallocated or Pool tender (race-guarded)" })
  @ApiResponse({ status: 201, description: "Tender claimed by the calling estimator." })
  @ApiResponse({ status: 403, description: "tenders.manage required." })
  @ApiResponse({ status: 409, description: "Tender already claimed." })
  selfClaim(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.selfClaim(id, actor.sub);
  }

  @Post(":id/reject")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Assigned estimator declines a tender with a required reason" })
  @ApiResponse({ status: 201, description: "Tender rejected — allocator must transfer or push back." })
  @ApiResponse({ status: 400, description: "Rejection reason missing or blank." })
  @ApiResponse({
    status: 403,
    description: "tenders.manage required, or the caller is not the assigned estimator."
  })
  @ApiResponse({ status: 404, description: "Tender not found." })
  reject(
    @Param("id") id: string,
    @Body() dto: RejectAllocationDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.reject(id, actor.sub, dto.reason, actor.sub);
  }

  @Post(":id/override")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({
    summary: "Allocator re-assigns a tender from any state (audit records the displaced estimator)"
  })
  @ApiResponse({ status: 201, description: "Tender re-assigned." })
  @ApiResponse({ status: 400, description: "Invalid body." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender or estimator not found." })
  override(
    @Param("id") id: string,
    @Body() dto: EstimatorTargetDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.override(id, dto.estimatorId, actor.sub);
  }

  @Post(":id/transfer")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "Allocator hands a Rejected tender to a new estimator" })
  @ApiResponse({ status: 201, description: "Rejected tender transferred." })
  @ApiResponse({
    status: 400,
    description: "Tender is not Rejected — re-pointing a live tender is override, not transfer."
  })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender or estimator not found." })
  transfer(
    @Param("id") id: string,
    @Body() dto: EstimatorTargetDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.transfer(id, dto.estimatorId, actor.sub);
  }

  @Post(":id/push-back")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({
    summary: "Allocator returns a tender to the unallocated pool (valid from any state)"
  })
  @ApiResponse({ status: 201, description: "Tender returned to Unallocated." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  pushBack(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.pushBack(id, actor.sub);
  }
}
