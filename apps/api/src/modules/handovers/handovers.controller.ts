import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { HandoversService } from "./handovers.service";
import { HandoverComplianceService } from "./handover-compliance.service";
import { CreateHandoverBodyDto, PatchHandoverValuesDto } from "./dto/handover.dto";
import { AddManualComplianceItemDto, UpdateComplianceItemDto } from "./dto/handover-compliance.dto";

const PERM = "tenderconversion.manage";

/**
 * REST endpoints for handover instances (B-HW-6).
 *
 * All routes require JWT + `tenderconversion.manage` permission.
 *
 * POST /handovers               — create a handover for a contract
 * GET  /handovers/:id           — get handover + values + completionPct
 * PATCH /handovers/:id/values   — upsert one or more field values
 */
@ApiTags("Handovers")
@ApiBearerAuth()
@Controller("handovers")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HandoversController {
  constructor(
    private readonly service: HandoversService,
    private readonly complianceService: HandoverComplianceService
  ) {}

  /**
   * Create a handover for a contract.
   *
   * Pins the currently-active HandoverTemplate version (or the supplied
   * `templateVersionId`), performs one-way prefill from the awarded ClientQuote,
   * and returns the created handover with its initial HandoverValue rows.
   *
   * @param dto  - contractId + optional templateVersionId
   * @param user - authenticated actor
   * @returns the created Handover (status=draft, completionPct computed)
   * @throws NotFoundException when the contract or active template is missing
   * @throws BadRequestException when the contract has no linked project/tender
   */
  @Post()
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Create a handover for a contract; pins active template, prefills from awarded quote." })
  @ApiResponse({ status: 201, description: "Handover created with prefilled values." })
  @ApiResponse({ status: 400, description: "Contract has no linked project or tender." })
  @ApiResponse({ status: 404, description: "Contract or active template not found." })
  create(@Body() dto: CreateHandoverBodyDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(user.sub, dto.contractId, dto.templateVersionId);
  }

  /**
   * Get a handover by id, including all HandoverValue rows and the pinned
   * template version (sections + non-retired fields). `completionPct` is
   * stored on the Handover row and recomputed on every PATCH /values call.
   *
   * @param id - handover id
   * @returns Handover with nested values and templateVersion
   * @throws NotFoundException when the handover does not exist
   */
  @Get(":id")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Get handover with values and pinned template." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiResponse({ status: 200, description: "Handover with values and template." })
  @ApiResponse({ status: 404, description: "Handover not found." })
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  /**
   * Upsert a batch of field values for a handover.
   *
   * For each item: creates or updates the HandoverValue row keyed by
   * `(handoverId, fieldKey)`. If the field had an auto-prefilled
   * `sourceValue` and the new value differs, `isOverridden` is set to true.
   * Optional `sectionDone` flag marks/unmarks the section as complete.
   *
   * After all upserts the `completionPct` is recomputed on the Handover row.
   *
   * @param id  - handover id
   * @param dto - array of { fieldKey, value, sectionDone? }
   * @returns the updated Handover with all HandoverValue rows
   * @throws NotFoundException when the handover does not exist
   * @throws BadRequestException when the handover is finalised
   */
  @Patch(":id/values")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Upsert field values; sets isOverridden when a prefilled value changes." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiResponse({ status: 200, description: "Values updated; completionPct recomputed." })
  @ApiResponse({ status: 400, description: "Handover is finalised or values array is empty." })
  @ApiResponse({ status: 404, description: "Handover not found." })
  patchValues(
    @Param("id") id: string,
    @Body() dto: PatchHandoverValuesDto
  ) {
    return this.service.patchValues(id, dto.values);
  }

  // ── Compliance items (B-HW-9) ───────────────────────────────────────────────

  /**
   * List all compliance-obligation rows for a handover.
   *
   * @param id - handover id
   * @returns Array of HandoverComplianceItem rows ordered by createdAt asc.
   * @throws NotFoundException when the handover does not exist.
   */
  @Get(":id/compliance-items")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "List compliance-obligation items for a handover." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiResponse({ status: 200, description: "Compliance items." })
  @ApiResponse({ status: 404, description: "Handover not found." })
  listComplianceItems(@Param("id") id: string) {
    return this.complianceService.list(id);
  }

  /**
   * Derive compliance-obligation suggestions from the handover's scope-of-works
   * and persist them.  Existing suggested rows are not overwritten.
   *
   * @param id - handover id
   * @returns The full list of compliance items after the derive run.
   * @throws BadRequestException when the handover is finalised.
   * @throws NotFoundException when the handover does not exist.
   */
  @Post(":id/compliance-items/derive")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Derive and persist compliance-obligation suggestions from scope items." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiResponse({ status: 201, description: "Suggestions derived; returns fresh list." })
  @ApiResponse({ status: 400, description: "Handover is finalised." })
  @ApiResponse({ status: 404, description: "Handover not found." })
  deriveComplianceSuggestions(@Param("id") id: string) {
    return this.complianceService.deriveSuggestions(id);
  }

  /**
   * Add a manual compliance-obligation row to a handover.
   *
   * @param id  - handover id
   * @param dto - obligation details (type, responsibleParty, optional status/docRef)
   * @returns The created HandoverComplianceItem row.
   * @throws BadRequestException when the handover is finalised or type is empty.
   * @throws NotFoundException when the handover does not exist.
   */
  @Post(":id/compliance-items")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Add a manual compliance-obligation item to a handover." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiResponse({ status: 201, description: "Compliance item created." })
  @ApiResponse({ status: 400, description: "Handover is finalised or type is empty." })
  @ApiResponse({ status: 404, description: "Handover not found." })
  addManualComplianceItem(
    @Param("id") id: string,
    @Body() dto: AddManualComplianceItemDto
  ) {
    return this.complianceService.addManual(id, dto);
  }

  /**
   * Patch a compliance-obligation row.  Only supplied fields are changed.
   *
   * @param id     - handover id (used for routing; ownership validated via item)
   * @param itemId - compliance item id
   * @param dto    - fields to patch
   * @returns The updated row.
   * @throws BadRequestException when the handover is finalised.
   * @throws NotFoundException when the item does not exist.
   */
  @Patch(":id/compliance-items/:itemId")
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Patch a compliance-obligation item." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiParam({ name: "itemId", description: "Compliance item id." })
  @ApiResponse({ status: 200, description: "Compliance item updated." })
  @ApiResponse({ status: 400, description: "Handover is finalised or type is empty." })
  @ApiResponse({ status: 404, description: "Compliance item not found." })
  updateComplianceItem(
    @Param("id") _id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateComplianceItemDto
  ) {
    return this.complianceService.update(itemId, dto);
  }

  /**
   * Delete a compliance-obligation row.
   *
   * @param id     - handover id (routing; ownership validated via item)
   * @param itemId - compliance item id
   * @throws BadRequestException when the handover is finalised.
   * @throws NotFoundException when the item does not exist.
   */
  @Delete(":id/compliance-items/:itemId")
  @HttpCode(204)
  @RequirePermissions(PERM)
  @ApiOperation({ summary: "Delete a compliance-obligation item." })
  @ApiParam({ name: "id", description: "Handover id." })
  @ApiParam({ name: "itemId", description: "Compliance item id." })
  @ApiResponse({ status: 204, description: "Compliance item deleted." })
  @ApiResponse({ status: 400, description: "Handover is finalised." })
  @ApiResponse({ status: 404, description: "Compliance item not found." })
  removeComplianceItem(
    @Param("id") _id: string,
    @Param("itemId") itemId: string
  ) {
    return this.complianceService.remove(itemId);
  }
}
