import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
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

/**
 * Body for `POST /contracts` — create the single contract for a project.
 *
 * One contract per project is enforced server-side. The contract number
 * is auto-assigned (IS-C###) and not accepted from the client.
 */
class CreateContractDto {
  /** Project id this contract is being created against. */
  @IsString() projectId!: string;
  /** Headline contract value in AUD. */
  @Type(() => Number) @IsNumber() contractValue!: number;
  /** Retention percentage withheld on each approved claim. Defaults to 0 when omitted. */
  @IsOptional() @Type(() => Number) @IsNumber() retentionPct?: number;
  /** Contract start date (ISO 8601). */
  @IsOptional() @IsDateString() startDate?: string;
  /** Contract end date (ISO 8601). */
  @IsOptional() @IsDateString() endDate?: string;
  /** Free-text notes attached to the contract. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Body for `PATCH /contracts/:id` — partial update of a contract.
 *
 * Changing `contractValue` requires the `finance.admin` permission;
 * passing `null` for `startDate` / `endDate` / `notes` clears those
 * fields while `undefined` leaves them unchanged.
 */
class UpdateContractDto {
  /** New headline contract value. Requires finance.admin. */
  @IsOptional() @Type(() => Number) @IsNumber() contractValue?: number;
  /** New retention percentage. */
  @IsOptional() @Type(() => Number) @IsNumber() retentionPct?: number;
  /** New start date, or null to clear. */
  @IsOptional() @IsDateString() startDate?: string | null;
  /** New end date, or null to clear. */
  @IsOptional() @IsDateString() endDate?: string | null;
  /** New contract status. */
  @IsOptional() @IsIn(Object.values(ContractStatus)) status?: ContractStatus;
  /** Replacement notes, or null to clear. */
  @IsOptional() @IsString() notes?: string | null;
}

/**
 * Body for `POST /contracts/:id/variations` — add a variation in RECEIVED status.
 *
 * `receivedDate` defaults to the server time when omitted. The variation
 * number (IS-V###) is auto-assigned.
 */
class CreateVariationDto {
  /** Description of the variation as it will appear on the claim line item. */
  @IsString() description!: string;
  /** Client / contact who requested the variation. */
  @IsOptional() @IsString() requestedBy?: string;
  /** Initial priced amount (AUD) — only required to progress beyond RECEIVED. */
  @IsOptional() @Type(() => Number) @IsNumber() pricedAmount?: number;
  /** Date the variation was received (ISO 8601). Defaults to now. */
  @IsOptional() @IsDateString() receivedDate?: string;
  /** Free-text notes attached to the variation. */
  @IsOptional() @IsString() notes?: string;
}

/**
 * Body for `PATCH /contracts/:id/variations/:variationId` — update a variation.
 *
 * Status transitions are one-way and enforced server-side:
 * RECEIVED → PRICED → SUBMITTED → APPROVED. Transitioning to APPROVED
 * with an approvedAmount auto-appends a Variation line item to the
 * contract's active DRAFT claim, if one exists.
 */
class UpdateVariationDto {
  /** Updated description. */
  @IsOptional() @IsString() description?: string;
  /** Next status (must be the immediate successor of the current status). */
  @IsOptional() @IsIn(Object.values(VariationStatus)) status?: VariationStatus;
  /** Priced amount (AUD). */
  @IsOptional() @Type(() => Number) @IsNumber() pricedAmount?: number;
  /** Final approved amount (AUD) — drives the auto-appended claim line on APPROVED. */
  @IsOptional() @Type(() => Number) @IsNumber() approvedAmount?: number;
  /** Date the variation was priced (ISO 8601). */
  @IsOptional() @IsDateString() pricedDate?: string;
  /** Date the variation was submitted to the client (ISO 8601). */
  @IsOptional() @IsDateString() submittedDate?: string;
  /** Date the client approved the variation (ISO 8601). */
  @IsOptional() @IsDateString() approvedDate?: string;
  /** Replacement notes, or null to clear. */
  @IsOptional() @IsString() notes?: string | null;
}

/**
 * Body for `POST /contracts/:id/claims` — create a DRAFT progress claim.
 *
 * `claimMonth` is normalised server-side to the first of the month in
 * UTC. Auto-populates line items from the linked tender's scope
 * subtotals plus APPROVED variations not yet claimed.
 */
class CreateClaimDto {
  /** Month being claimed (ISO 8601 date). Normalised to the first of the month, UTC. */
  @IsDateString() claimMonth!: string;
}

/**
 * Body for `PATCH /contracts/:id/claims/:claimId/items/:itemId` — update a claim line.
 *
 * If `thisClaimPct` is sent, the amount is calculated server-side as
 * contractValue × pct / 100 (2 d.p.). If `thisClaimAmount` is sent, it
 * overrides any pct and clears the stored pct. When both are sent, the
 * direct amount wins.
 */
class UpdateClaimItemDto {
  /** Percent complete on this line for this claim. */
  @IsOptional() @Type(() => Number) @IsNumber() thisClaimPct?: number;
  /** Direct amount override (AUD) — clears thisClaimPct. */
  @IsOptional() @Type(() => Number) @IsNumber() thisClaimAmount?: number;
  /** Updated line description. */
  @IsOptional() @IsString() description?: string;
}

/**
 * Body for `POST /contracts/:id/claims/:claimId/approve` — approve a SUBMITTED claim.
 *
 * `retentionHeld` is computed server-side as
 * `totalApproved × contract.retentionPct / 100` (2 d.p.).
 */
class ApproveClaimDto {
  /** Client-approved total for the claim (AUD). */
  @Type(() => Number) @IsNumber() totalApproved!: number;
}

/**
 * Body for `POST /contracts/:id/claims/:claimId/pay` — record payment on an APPROVED claim.
 */
class PayClaimDto {
  /** Total paid by the client (AUD). */
  @Type(() => Number) @IsNumber() totalPaid!: number;
  /** Date the payment was received (ISO 8601). */
  @IsDateString() paidDate!: string;
}

/**
 * Query string for `GET /contracts` — list contracts with optional filters.
 *
 * Inherits standard `page` / `pageSize` / `limit` semantics from
 * PaginationQueryDto (limit takes precedence over pageSize; effective
 * page size is clamped 1–100, default 20).
 */
class ListContractsQuery extends PaginationQueryDto {
  /** Filter to a single contract status. */
  @IsOptional() @IsIn(Object.values(ContractStatus)) status?: ContractStatus;
  /** Filter to contracts on a single project. */
  @IsOptional() @IsString() projectId?: string;
}

function actor(user: AuthenticatedUser) {
  return { id: user.sub, permissions: new Set(user.permissions) as ReadonlySet<string> };
}

/**
 * REST endpoints for contracts, variations, and progress claims under
 * /contracts (Module 7 — Award / Contract / Job Conversion).
 *
 * All routes require a JWT. Reads need `finance.view`, writes need
 * `finance.manage`, and approve/pay actions need `finance.admin`.
 * Contract-value changes additionally require `finance.admin`, enforced
 * in the service via the actor's permission set.
 */
@ApiTags("Contracts")
@ApiBearerAuth()
@Controller("contracts")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  /**
   * List contracts with project + client info, filterable by status / projectId.
   *
   * @param q - status / projectId filters plus page, pageSize, or limit
   * @returns { items, total, page, pageSize, limit } newest first
   */
  @Get()
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "List contracts with project + client info, filterable by status / projectId." })
  @ApiResponse({ status: 200, description: "List contracts with project + client info, filterable by status / projectId." })
  list(@Query() q: ListContractsQuery) {
    return this.service.listContracts({
      status: q.status,
      projectId: q.projectId,
      page: q.page,
      pageSize: q.pageSize,
      limit: q.limit
    });
  }

  /**
   * Full contract with variations and progress-claim headers.
   *
   * @param id - contract id
   * @returns the contract with project/client, variations, and claim headers
   * @throws NotFoundException when the contract does not exist
   */
  @Get(":id")
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "Full contract with variations and progress-claim headers." })
  @ApiResponse({ status: 200, description: "Full contract with variations and progress-claim headers." })
  get(@Param("id") id: string) {
    return this.service.getContract(id);
  }

  /**
   * Create a contract for a project. One contract per project — 409 if already exists.
   *
   * @param dto - projectId, contractValue, optional retentionPct / dates / notes
   * @returns the created contract with an auto-assigned IS-C### number
   * @throws NotFoundException when the project does not exist
   * @throws ConflictException when the project already has a contract
   */
  @Post()
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Create a contract for a project. One contract per project — 409 if already exists." })
  @ApiResponse({ status: 201, description: "Created with auto-assigned IS-C### number." })
  create(@Body() dto: CreateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createContract(user.sub, dto);
  }

  /**
   * Update contract. contractValue changes require finance.admin.
   *
   * @param id - contract id
   * @param dto - partial contract fields; null clears startDate/endDate/notes
   * @returns the updated contract
   * @throws NotFoundException when the contract does not exist
   * @throws BadRequestException when contractValue is changed without finance.admin
   */
  @Patch(":id")
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Update contract. contractValue changes require finance.admin." })
  @ApiResponse({ status: 200, description: "Update contract. contractValue changes require finance.admin." })
  update(@Param("id") id: string, @Body() dto: UpdateContractDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateContract(id, actor(user), dto);
  }

  // ── Variations ───────────────────────────────────────────────────────
  @Get(":id/variations")
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "List variations for a contract, ordered by auto-assigned variation number." })
  @ApiParam({ name: "id", description: "Contract id." })
  @ApiResponse({ status: 200, description: "Variations for the contract." })
  @ApiResponse({ status: 404, description: "Contract not found." })
  /**
   * List variations for a contract, ordered by auto-assigned variation number.
   *
   * @param id - contract id
   * @returns variations for the contract
   * @throws NotFoundException when the contract does not exist
   */
  listVariations(@Param("id") id: string) {
    return this.service.listVariations(id);
  }

  /**
   * Add a variation (status=RECEIVED). Auto-assigned IS-V### number.
   *
   * @param id - contract id
   * @param dto - description plus optional requestedBy / pricedAmount / receivedDate / notes
   * @returns the created variation (receivedDate defaults to now)
   * @throws NotFoundException when the contract does not exist
   */
  @Post(":id/variations")
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Add a variation (status=RECEIVED). Auto-assigned IS-V### number." })
  @ApiResponse({ status: 201, description: "Add a variation (status=RECEIVED). Auto-assigned IS-V### number." })
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
  @ApiResponse({ status: 200, description: "Update a variation. Status transitions enforced RECEIVED→PRICED→SUBMITTED→APPROVED. Approved variations auto-append to the active DRAFT claim if one exists." })
  /**
   * Update a variation. Status transitions enforced
   * RECEIVED→PRICED→SUBMITTED→APPROVED. Approved variations auto-append to
   * the active DRAFT claim if one exists.
   *
   * @param id - contract id
   * @param variationId - variation id to update
   * @param dto - partial variation fields including optional status change
   * @returns the updated variation
   * @throws NotFoundException when the variation is missing or belongs to another contract
   * @throws BadRequestException when the status transition is not allowed
   */
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
  @ApiOperation({ summary: "List progress claims for a contract, most recent claim month first." })
  @ApiParam({ name: "id", description: "Contract id." })
  @ApiResponse({ status: 200, description: "Progress-claim headers for the contract." })
  @ApiResponse({ status: 404, description: "Contract not found." })
  /**
   * List progress claims for a contract, most recent claim month first.
   *
   * @param id - contract id
   * @returns progress-claim headers for the contract
   * @throws NotFoundException when the contract does not exist
   */
  listClaims(@Param("id") id: string) {
    return this.service.listClaims(id);
  }

  @Get(":id/claims/:claimId")
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "Get a progress claim with line items and contract context." })
  @ApiParam({ name: "id", description: "Contract id." })
  @ApiParam({ name: "claimId", description: "Progress-claim id." })
  @ApiResponse({ status: 200, description: "Claim with line items and contract." })
  @ApiResponse({ status: 404, description: "Claim not found for this contract." })
  /**
   * Get a progress claim with line items and contract context.
   *
   * @param id - contract id
   * @param claimId - progress-claim id
   * @returns the claim with sorted line items and its contract
   * @throws NotFoundException when the claim is missing or belongs to another contract
   */
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
  /**
   * Create a DRAFT claim. Auto-populates line items from scope-discipline
   * subtotals + APPROVED variations not yet claimed.
   *
   * @param id - contract id
   * @param dto - claimMonth (normalised to the first of the month, UTC)
   * @returns the created DRAFT claim with auto-generated line items
   * @throws NotFoundException when the contract does not exist
   * @throws ConflictException when a claim already exists for this contract + month
   */
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
  @ApiResponse({ status: 200, description: "Update a line item. thisClaimPct triggers server-side $ calculation; thisClaimAmount overrides and clears pct." })
  /**
   * Update a line item. thisClaimPct triggers server-side $ calculation;
   * thisClaimAmount overrides and clears pct.
   *
   * @param id - contract id
   * @param claimId - progress-claim id
   * @param itemId - line item id
   * @param dto - thisClaimPct, thisClaimAmount, and/or description
   * @returns the full claim with recalculated totalClaimed
   * @throws NotFoundException when the line item is missing or not on this claim/contract
   */
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
  @ApiOperation({
    summary:
      "Submit a DRAFT claim. Sets status=SUBMITTED with submissionDate=now and fires a claim.submitted notification email."
  })
  @ApiParam({ name: "id", description: "Contract id." })
  @ApiParam({ name: "claimId", description: "Progress-claim id (must be DRAFT)." })
  @ApiResponse({ status: 200, description: "Claim transitioned to SUBMITTED." })
  @ApiResponse({ status: 400, description: "Claim is not in DRAFT status." })
  @ApiResponse({ status: 404, description: "Claim not found for this contract." })
  /**
   * Submit a DRAFT claim. Sets status=SUBMITTED with submissionDate=now and
   * fires a claim.submitted notification email.
   *
   * @param id - contract id
   * @param claimId - progress-claim id (must be DRAFT)
   * @returns the claim transitioned to SUBMITTED
   * @throws NotFoundException when the claim is missing or belongs to another contract
   * @throws BadRequestException when the claim is not in DRAFT status
   */
  submitClaim(@Param("id") id: string, @Param("claimId") claimId: string) {
    return this.service.submitClaim(id, claimId);
  }

  @Post(":id/claims/:claimId/approve")
  @RequirePermissions("finance.admin")
  @ApiOperation({ summary: "Approve a submitted claim. retentionHeld = totalApproved × contract.retentionPct / 100." })
  @ApiResponse({ status: 201, description: "Approve a submitted claim. retentionHeld = totalApproved × contract.retentionPct / 100." })
  /**
   * Approve a submitted claim. retentionHeld = totalApproved × contract.retentionPct / 100.
   *
   * @param id - contract id
   * @param claimId - progress-claim id (must be SUBMITTED)
   * @param dto - totalApproved amount
   * @returns the claim transitioned to APPROVED with retentionHeld set
   * @throws NotFoundException when the claim is missing or belongs to another contract
   * @throws BadRequestException when the claim is not in SUBMITTED status
   */
  approveClaim(
    @Param("id") id: string,
    @Param("claimId") claimId: string,
    @Body() dto: ApproveClaimDto
  ) {
    return this.service.approveClaim(id, claimId, dto);
  }

  @Post(":id/claims/:claimId/pay")
  @RequirePermissions("finance.admin")
  @ApiOperation({
    summary:
      "Record payment on an APPROVED claim. Sets status=PAID with totalPaid and paidDate."
  })
  @ApiParam({ name: "id", description: "Contract id." })
  @ApiParam({ name: "claimId", description: "Progress-claim id (must be APPROVED)." })
  @ApiResponse({ status: 200, description: "Claim transitioned to PAID." })
  @ApiResponse({ status: 400, description: "Claim is not in APPROVED status." })
  @ApiResponse({ status: 404, description: "Claim not found for this contract." })
  /**
   * Record payment on an APPROVED claim. Sets status=PAID with totalPaid and paidDate.
   *
   * @param id - contract id
   * @param claimId - progress-claim id (must be APPROVED)
   * @param dto - totalPaid amount and paidDate
   * @returns the claim transitioned to PAID
   * @throws NotFoundException when the claim is missing or belongs to another contract
   * @throws BadRequestException when the claim is not in APPROVED status
   */
  payClaim(
    @Param("id") id: string,
    @Param("claimId") claimId: string,
    @Body() dto: PayClaimDto
  ) {
    return this.service.payClaim(id, claimId, dto);
  }
}
