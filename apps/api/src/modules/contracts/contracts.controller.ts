import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ContractStatus, VariationStatus } from "@prisma/client";
import { IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";
import { ContractsService } from "./contracts.service";

class CreateContractDto {
  @IsString() projectId!: string;
  @Type(() => Number) @IsNumber() contractValue!: number;
  @IsOptional() @Type(() => Number) @IsNumber() retentionPct?: number;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() notes?: string;
}

class UpdateContractDto {
  @IsOptional() @Type(() => Number) @IsNumber() contractValue?: number;
  @IsOptional() @Type(() => Number) @IsNumber() retentionPct?: number;
  @IsOptional() @IsDateString() startDate?: string | null;
  @IsOptional() @IsDateString() endDate?: string | null;
  @IsOptional() @IsIn(Object.values(ContractStatus)) status?: ContractStatus;
  @IsOptional() @IsString() notes?: string | null;
}

class CreateVariationDto {
  @IsString() description!: string;
  @IsOptional() @IsString() requestedBy?: string;
  @IsOptional() @Type(() => Number) @IsNumber() pricedAmount?: number;
  @IsOptional() @IsDateString() receivedDate?: string;
  @IsOptional() @IsString() notes?: string;
}

class UpdateVariationDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsIn(Object.values(VariationStatus)) status?: VariationStatus;
  @IsOptional() @Type(() => Number) @IsNumber() pricedAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() approvedAmount?: number;
  @IsOptional() @IsDateString() pricedDate?: string;
  @IsOptional() @IsDateString() submittedDate?: string;
  @IsOptional() @IsDateString() approvedDate?: string;
  @IsOptional() @IsString() notes?: string | null;
}

class CreateClaimDto {
  @IsDateString() claimMonth!: string;
}

class UpdateClaimItemDto {
  @IsOptional() @Type(() => Number) @IsNumber() thisClaimPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() thisClaimAmount?: number;
  @IsOptional() @IsString() description?: string;
}

class ApproveClaimDto {
  @Type(() => Number) @IsNumber() totalApproved!: number;
}

class PayClaimDto {
  @Type(() => Number) @IsNumber() totalPaid!: number;
  @IsDateString() paidDate!: string;
}

class ListContractsQuery extends PaginationQueryDto {
  @IsOptional() @IsIn(Object.values(ContractStatus)) status?: ContractStatus;
  @IsOptional() @IsString() projectId?: string;
}

function actor(user: AuthenticatedUser) {
  return { id: user.sub, permissions: new Set(user.permissions) as ReadonlySet<string> };
}

@ApiTags("Contracts")
@ApiBearerAuth()
@Controller("contracts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "List contracts with project + client info, filterable by status / projectId." })
  list(@Query() q: ListContractsQuery) {
    return this.service.listContracts({
      status: q.status,
      projectId: q.projectId,
      page: q.page,
      pageSize: q.pageSize,
      limit: q.limit
    });
  }

  @Get(":id")
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "Full contract with variations and progress-claim headers." })
  get(@Param("id") id: string) {
    return this.service.getContract(id);
  }

  @Post()
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Create a contract for a project. One contract per project — 409 if already exists." })
  @ApiResponse({ status: 201, description: "Created with auto-assigned IS-C### number." })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createContract(user.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Update contract. contractValue changes require finance.admin." })
  update(@Param("id") id: string, @Body() dto: UpdateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateContract(id, actor(user), dto);
  }

  // ── Variations ───────────────────────────────────────────────────────
  @Get(":id/variations")
  @RequirePermissions("finance.view")
  listVariations(@Param("id") id: string) {
    return this.service.listVariations(id);
  }

  @Post(":id/variations")
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Add a variation (status=RECEIVED). Auto-assigned IS-V### number." })
  createVariation(
    @Param("id") id: string,
    @Body() dto: CreateVariationDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.createVariation(id, user.sub, dto);
  }

  @Patch(":id/variations/:variationId")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Update a variation. Status transitions enforced RECEIVED→PRICED→SUBMITTED→APPROVED. Approved variations auto-append to the active DRAFT claim if one exists."
  })
  updateVariation(
    @Param("id") id: string,
    @Param("variationId") variationId: string,
    @Body() dto: UpdateVariationDto
  ) {
    return this.service.updateVariation(id, variationId, dto);
  }

  // ── Progress claims ──────────────────────────────────────────────────
  @Get(":id/claims")
  @RequirePermissions("finance.view")
  listClaims(@Param("id") id: string) {
    return this.service.listClaims(id);
  }

  @Get(":id/claims/:claimId")
  @RequirePermissions("finance.view")
  getClaim(@Param("id") id: string, @Param("claimId") claimId: string) {
    return this.service.getClaim(id, claimId);
  }

  @Post(":id/claims")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Create a DRAFT claim. Auto-populates line items from scope-discipline subtotals + APPROVED variations not yet claimed."
  })
  @ApiResponse({ status: 409, description: "A claim already exists for this contract + month." })
  createClaim(
    @Param("id") id: string,
    @Body() dto: CreateClaimDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.createClaim(id, user.sub, dto);
  }

  @Patch(":id/claims/:claimId/items/:itemId")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Update a line item. thisClaimPct triggers server-side $ calculation; thisClaimAmount overrides and clears pct."
  })
  updateClaimItem(
    @Param("id") id: string,
    @Param("claimId") claimId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateClaimItemDto
  ) {
    return this.service.updateClaimItem(id, claimId, itemId, dto);
  }

  @Post(":id/claims/:claimId/submit")
  @RequirePermissions("finance.manage")
  submitClaim(@Param("id") id: string, @Param("claimId") claimId: string) {
    return this.service.submitClaim(id, claimId);
  }

  @Post(":id/claims/:claimId/approve")
  @RequirePermissions("finance.admin")
  @ApiOperation({ summary: "Approve a submitted claim. retentionHeld = totalApproved × contract.retentionPct / 100." })
  approveClaim(
    @Param("id") id: string,
    @Param("claimId") claimId: string,
    @Body() dto: ApproveClaimDto
  ) {
    return this.service.approveClaim(id, claimId, dto);
  }

  @Post(":id/claims/:claimId/pay")
  @RequirePermissions("finance.admin")
  payClaim(
    @Param("id") id: string,
    @Param("claimId") claimId: string,
    @Body() dto: PayClaimDto
  ) {
    return this.service.payClaim(id, claimId, dto);
  }
}
