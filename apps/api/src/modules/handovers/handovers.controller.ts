import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { HandoversService } from "./handovers.service";
import { CreateHandoverBodyDto, PatchHandoverValuesDto } from "./dto/handover.dto";

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
  constructor(private readonly service: HandoversService) {}

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
}
