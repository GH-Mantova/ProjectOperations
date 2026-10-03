// scope-enclosure.controller.ts
//
// ASB_ENCLOSURE_LINES_V1 -- REST endpoints for ScopeItemEnclosureLine.
//
// Nested under the scope item path:
//   GET    /tenders/:tenderId/scope/items/:itemId/enclosure-lines
//   POST   /tenders/:tenderId/scope/items/:itemId/enclosure-lines
//   PATCH  /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
//   DELETE /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
//
// Guards: JWT throughout, reads require estimates.view, writes require
// estimates.manage -- the same codes the scope item routes use.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScopeEnclosureService } from "./scope-enclosure.service";
import { CreateEnclosureLineDto, PatchEnclosureLineDto } from "./dto/scope-enclosure.dto";

/**
 * ASB_ENCLOSURE_LINES_V1 -- per-item enclosure line CRUD.
 *
 * Mounted under the per-item path, guarded like ScopeCostsController:
 * JWT throughout, reads require `estimates.view`, writes require
 * `estimates.manage`. Write bodies arrive as `unknown` and are
 * shape-asserted before being cast -- the same CodeQL taint sanitisation
 * pattern ScopeWasteController documents.
 */
@ApiTags("Scope of Works — Enclosure Lines")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/items/:itemId/enclosure-lines")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeEnclosureController {
  constructor(private readonly service: ScopeEnclosureService) {}

  private assertObjectBody(dto: unknown): asserts dto is Record<string, unknown> {
    if (typeof dto !== "object" || dto === null || Array.isArray(dto)) {
      throw new BadRequestException("Request body must be a JSON object.");
    }
  }

  /**
   * List the enclosure lines on a scope item, in sortOrder.
   *
   * @param tenderId - tender owning the item
   * @param itemId - scope item to list lines for
   * @returns the item's ScopeItemEnclosureLine rows (with money fields)
   * @throws NotFoundException when the item is missing or on another tender
   * @throws BadRequestException when the item is not an ASB item
   */
  @Get()
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List the enclosure lines on an ASB scope item, in sortOrder." })
  @ApiResponse({ status: 200, description: "List enclosure lines." })
  list(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.list(tenderId, itemId);
  }

  /**
   * Create an enclosure line on an ASB scope item.
   * Resolves unit and rate from the enclosure rate table, honouring locked rates.
   *
   * @param dto - { enclosureType, qty }
   * @param actor - JWT principal
   * @returns the created ScopeItemEnclosureLine row (with money fields)
   * @throws BadRequestException when the body is not an object, the item is
   *   not ASB, or the enclosureType is unknown / inactive
   * @throws NotFoundException when the item is missing or on another tender
   */
  @Post()
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Create an enclosure line on an ASB scope item. Resolves unit and rate from the enclosure rate table."
  })
  @ApiResponse({ status: 201, description: "Created enclosure line." })
  create(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: unknown,
    @CurrentUser() actor: { sub: string }
  ) {
    this.assertObjectBody(dto);
    return this.service.create(tenderId, itemId, actor.sub, dto as unknown as CreateEnclosureLineDto);
  }

  /**
   * Partial update of an enclosure line.
   * Allowed fields: qty, rateOverride, sortOrder.
   * Changing the type is not supported -- delete and re-add instead.
   *
   * @param lineId - the line to patch
   * @param dto - body asserted to be an object, then cast to the DTO
   * @returns the updated ScopeItemEnclosureLine row (with money fields)
   * @throws BadRequestException when the body is not an object
   * @throws NotFoundException when the line or its item does not match
   */
  @Patch(":lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary:
      "Partial update of an enclosure line. Changing the enclosure type is not supported; delete and re-add instead."
  })
  @ApiResponse({ status: 200, description: "Updated enclosure line." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string,
    @Body() dto: unknown
  ) {
    this.assertObjectBody(dto);
    return this.service.update(tenderId, itemId, lineId, dto as unknown as PatchEnclosureLineDto);
  }

  /**
   * Hard-deletes an enclosure line.
   *
   * @param lineId - the line to delete
   * @returns `{ deleted: true }`
   * @throws NotFoundException when the line or its item does not match
   * @throws BadRequestException when the item is not ASB
   */
  @Delete(":lineId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete an enclosure line from an ASB scope item." })
  @ApiResponse({ status: 200, description: "Deleted." })
  remove(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.remove(tenderId, itemId, lineId);
  }
}
