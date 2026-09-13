import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequireAnyPermission, RequirePermissions } from "../../common/auth/permissions.decorator";
import { AllocationService } from "./allocation.service";
import { CapacityService } from "./capacity.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

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

class SuggestQueryDto {
  @IsString()
  @IsNotEmpty()
  tenderId!: string;
}

/**
 * Both fields optional so a caller can move one dial without restating the
 * other, but "neither supplied" is rejected by `CapacityService` — an empty
 * body would otherwise CREATE a default capacity row nobody asked for.
 *
 * Bounds are duplicated in the service on purpose (see the comment on
 * RejectAllocationDto): the DTO turns bad input into a 400 before the service
 * runs, and the service re-checks so a non-HTTP caller cannot write a 400%
 * availability and corrupt every utilisation figure on the board.
 */
class UpdateEstimatorCapacityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  availabilityPct?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  concurrentCap?: number;
}

class CreateDelegateDto {
  @IsString()
  @IsNotEmpty()
  delegateId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
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
 * GET  /tenders/allocations/:id/history         — candidates + rejections (tenders.manage)
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
  constructor(
    private readonly service: AllocationService,
    private readonly capacity: CapacityService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

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

  @Get(":id/history")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary: "Allocation trail for one tender: state, assignee, pool candidates and rejections"
  })
  @ApiResponse({ status: 200, description: "Allocation history for the tender." })
  @ApiResponse({ status: 403, description: "tenders.manage required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  history(@Param("id") id: string) {
    return this.capacity.getAllocationHistory(id);
  }

  // ── Delegate window endpoints (EW-5) ──────────────────────────────────────
  //
  // GET  /tenders/allocations/delegates       — list active + future windows
  // POST /tenders/allocations/delegates       — create a new window
  // DELETE /tenders/allocations/delegates/:id — revoke (delete) a window
  //
  // All three are gated on tenders.allocate. The static path "delegates" MUST
  // be registered before the greedy :id routes above — Nest resolves controllers
  // in registration order but within a single controller resolves static
  // segments before parameterised ones (same rule as TenderingController vs
  // AllocationController). These are annotated as static so they cannot shadow
  // :id routes.

  @Get("delegates")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "List active and future allocator delegate windows" })
  @ApiResponse({ status: 200, description: "Array of AllocatorDelegate rows (active + future only)." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  async listDelegates() {
    const now = new Date();
    const rows = await this.prisma.allocatorDelegate.findMany({
      where: { endDate: { gte: now } },
      orderBy: { startDate: "asc" },
      include: {
        delegate: { select: { firstName: true, lastName: true } },
        grantedBy: { select: { firstName: true, lastName: true } }
      }
    });
    return rows.map((r) => ({
      id: r.id,
      delegateId: r.delegateId,
      delegateName: `${r.delegate.firstName} ${r.delegate.lastName}`.trim(),
      grantedById: r.grantedById,
      grantedByName: `${r.grantedBy.firstName} ${r.grantedBy.lastName}`.trim(),
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      createdAt: r.createdAt.toISOString()
    }));
  }

  @Post("delegates")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "Grant a new allocator delegate window" })
  @ApiResponse({ status: 201, description: "Delegate window created." })
  @ApiResponse({ status: 400, description: "Invalid body or date range." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Delegate user not found." })
  async createDelegate(
    @Body() dto: CreateDelegateDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date format.");
    }
    if (start > end) {
      throw new Error("startDate must be on or before endDate.");
    }
    if (end < new Date()) {
      throw new Error("endDate must be in the future.");
    }

    const delegate = await this.prisma.user.findUnique({ where: { id: dto.delegateId }, select: { id: true, firstName: true, lastName: true } });
    if (!delegate) throw new NotFoundException("Delegate user not found.");

    const grantor = await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { id: true, firstName: true, lastName: true } });

    const row = await this.prisma.allocatorDelegate.create({
      data: {
        delegateId: dto.delegateId,
        grantedById: actor.sub,
        startDate: start,
        endDate: end
      }
    });

    await this.audit.write({
      actorId: actor.sub,
      action: "tenders.delegate.create",
      entityType: "AllocatorDelegate",
      entityId: row.id,
      metadata: { delegateId: dto.delegateId, startDate: dto.startDate, endDate: dto.endDate }
    });

    return {
      id: row.id,
      delegateId: row.delegateId,
      delegateName: `${delegate.firstName} ${delegate.lastName}`.trim(),
      grantedById: row.grantedById,
      grantedByName: grantor ? `${grantor.firstName} ${grantor.lastName}`.trim() : actor.sub,
      startDate: row.startDate.toISOString(),
      endDate: row.endDate.toISOString(),
      createdAt: row.createdAt.toISOString()
    };
  }

  @Delete("delegates/:delegateWindowId")
  @HttpCode(204)
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "Revoke an allocator delegate window" })
  @ApiResponse({ status: 204, description: "Delegate window deleted." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Delegate window not found." })
  async deleteDelegate(
    @Param("delegateWindowId") delegateWindowId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    const row = await this.prisma.allocatorDelegate.findUnique({ where: { id: delegateWindowId } });
    if (!row) throw new NotFoundException("Delegate window not found.");

    await this.prisma.allocatorDelegate.delete({ where: { id: delegateWindowId } });

    await this.audit.write({
      actorId: actor.sub,
      action: "tenders.delegate.delete",
      entityType: "AllocatorDelegate",
      entityId: delegateWindowId,
      metadata: { delegateId: row.delegateId, startDate: row.startDate, endDate: row.endDate }
    });
  }
}

/**
 * EW-4 capacity board — read surface plus the one capacity write.
 *
 * A SECOND controller class in this file rather than a third file: Nest binds
 * one path prefix per class and the board lives at `/tenders/capacity-board`,
 * not under `/tenders/allocations`. EW-4 says not to add a third controller
 * just for the board, and the module already uses exactly this
 * two-classes-one-file shape (ScopeRedesignController + ScopeCardCuttingController,
 * ScopeWasteController + ScopeCardWasteController).
 *
 * Registration order matters: TenderingController owns `GET /tenders/:id`, so
 * this class MUST be listed before it in TenderingModule or `capacity-board`
 * is swallowed as an id. It is registered next to AllocationController, which
 * carries the same constraint and the same comment.
 *
 * GET /tenders/capacity-board                              (tenders.allocate)
 * GET /tenders/capacity-board/suggest?tenderId=            (tenders.allocate)
 * PUT /tenders/capacity-board/estimators/:userId/capacity  (allocate, or manage on self)
 */
@ApiTags("Tender Allocation")
@ApiBearerAuth()
@Controller("tenders/capacity-board")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CapacityBoardController {
  constructor(private readonly capacity: CapacityService) {}

  @Get()
  @RequirePermissions("tenders.allocate")
  @ApiOperation({
    summary: "Estimator utilisation plus every unallocated tender with a suggested estimator"
  })
  @ApiResponse({ status: 200, description: "Capacity board payload." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  board() {
    return this.capacity.getCapacityBoard();
  }

  @Get("suggest")
  @RequirePermissions("tenders.allocate")
  @ApiOperation({ summary: "Suggested estimator for one tender, with a displayable reason" })
  @ApiQuery({ name: "tenderId", required: true })
  @ApiResponse({ status: 200, description: "{ suggestedEstimatorId, reason }." })
  @ApiResponse({ status: 400, description: "tenderId missing or blank." })
  @ApiResponse({ status: 403, description: "tenders.allocate required." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  suggest(@Query() query: SuggestQueryDto) {
    return this.capacity.suggestEstimatorWithReason(query.tenderId);
  }

  @Put("estimators/:userId/capacity")
  @RequireAnyPermission("tenders.allocate", "tenders.manage")
  @ApiOperation({ summary: "Upsert an estimator's availability and concurrent cap" })
  @ApiResponse({ status: 200, description: "Capacity stored." })
  @ApiResponse({ status: 400, description: "Empty body or a value out of range." })
  @ApiResponse({
    status: 403,
    description:
      "Requires tenders.allocate, or tenders.manage when editing your own capacity."
  })
  @ApiResponse({ status: 404, description: "Estimator not found." })
  updateCapacity(
    @Param("userId") userId: string,
    @Body() dto: UpdateEstimatorCapacityDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    // The guard has already established the caller holds allocate OR manage.
    // The residual rule — which EW-4 states but no decorator can express — is
    // that a manage-only holder may edit ONLY their own row. Fail closed: an
    // allocator edits anyone, everybody else must be the subject.
    //
    // `actor.sub` is the JWT subject; AuthenticatedUser has no `id` field, so
    // EW-4's `req.user.id === userId` is read as `actor.sub === userId`.
    const isAllocator =
      actor.isSuperUser === true || actor.permissions.includes("tenders.allocate");

    if (!isAllocator && actor.sub !== userId) {
      throw new ForbiddenException(
        "tenders.allocate is required to edit another estimator's capacity."
      );
    }

    return this.capacity.upsertEstimatorCapacity(
      userId,
      { availabilityPct: dto.availabilityPct, concurrentCap: dto.concurrentCap },
      actor.sub
    );
  }
}
