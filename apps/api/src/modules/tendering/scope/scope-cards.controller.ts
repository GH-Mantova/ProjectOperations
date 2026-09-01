import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { ScopeRedesignService } from "../scope-redesign.service";
import {
  CreateSubLineQuoteDto,
  LinkToSubLineDto,
  UpdateSubLineQuoteDto
} from "../dto/scope-of-works.dto";

class SelectQuoteDto {
  // Currently a no-body POST; class kept for future body extensions.
  @IsOptional() @IsBoolean() _placeholder?: boolean;
}

/**
 * scope-subcontracted order 4: SUB line linkage and quote management.
 *
 * Routes:
 *   POST   /tenders/:tenderId/scope/items/:itemId/sub-link        link item to SUB line
 *   DELETE /tenders/:tenderId/scope/items/:itemId/sub-link        unlink item from SUB line
 *   GET    /tenders/:tenderId/scope/items/:itemId/quotes           list quotes on a SUB line
 *   POST   /tenders/:tenderId/scope/items/:itemId/quotes           add a quote
 *   PATCH  /tenders/:tenderId/scope/quotes/:quoteId               update a quote
 *   DELETE /tenders/:tenderId/scope/quotes/:quoteId               delete a quote
 *   POST   /tenders/:tenderId/scope/quotes/:quoteId/select        select a quote
 */
@ApiTags("Scope of Works — SUB linkage")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeSubLinkedItemController {
  constructor(private readonly service: ScopeRedesignService) {}

  // ── Linkage ──────────────────────────────────────────────────────────

  @Post("items/:itemId/sub-link")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Link a scope item to a SUB line that prices its work.",
    description:
      "Sets pricedBySubItemId on the covered item. The target must be a SUB-discipline " +
      "item on the same tender. The covered item's labour and plant stop contributing to " +
      "its discipline bucket (double-count guard)."
  })
  async linkToSubLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown
  ) {
    const dto = body as LinkToSubLineDto;
    return this.service.linkItemToSubLine(tenderId, itemId, dto.subItemId);
  }

  @Delete("items/:itemId/sub-link")
  @RequirePermissions("estimates.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Unlink a scope item from its SUB line.",
    description: "Clears pricedBySubItemId. The item's costs are restored to the discipline bucket."
  })
  async unlinkFromSubLine(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string
  ) {
    await this.service.unlinkItemFromSubLine(tenderId, itemId);
  }

  // ── Quotes ───────────────────────────────────────────────────────────

  @Get("items/:itemId/quotes")
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List all quotes for a SUB scope line." })
  async listQuotes(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string
  ) {
    return this.service.listSubLineQuotes(tenderId, itemId);
  }

  @Post("items/:itemId/quotes")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Add a quote to a SUB scope line.",
    description:
      "The item must be a SUB-discipline scope item. The new quote is unselected by default."
  })
  async addQuote(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown
  ) {
    const dto = body as CreateSubLineQuoteDto;
    return this.service.addSubLineQuote(tenderId, itemId, {
      subcontractorSupplierId: dto.subcontractorSupplierId,
      supplierNameFallback: dto.supplierNameFallback,
      amount: dto.amount,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : null,
      notes: dto.notes,
      tenderDocumentLinkId: dto.tenderDocumentLinkId
    });
  }

  @Patch("quotes/:quoteId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Update a sub line quote (amount, notes, supplier, document)." })
  async updateQuote(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() body: unknown
  ) {
    const dto = body as UpdateSubLineQuoteDto;
    return this.service.updateSubLineQuote(tenderId, quoteId, {
      subcontractorSupplierId: dto.subcontractorSupplierId,
      supplierNameFallback: dto.supplierNameFallback,
      amount: dto.amount,
      receivedAt: dto.receivedAt != null ? new Date(dto.receivedAt) : (dto.receivedAt === null ? null : undefined),
      notes: dto.notes,
      tenderDocumentLinkId: dto.tenderDocumentLinkId
    });
  }

  @Delete("quotes/:quoteId")
  @RequirePermissions("estimates.manage")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a sub line quote." })
  async deleteQuote(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string
  ) {
    await this.service.deleteSubLineQuote(tenderId, quoteId);
  }

  @Post("quotes/:quoteId/select")
  @RequirePermissions("estimates.manage")
  @ApiOperation({
    summary: "Select a quote for a SUB line.",
    description:
      "Marks this quote isSelected=true and deselects any other previously-selected " +
      "quote for the same scope item. The partial unique index enforces the one-selected-per-line constraint."
  })
  async selectQuote(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string
  ) {
    return this.service.selectSubLineQuote(tenderId, quoteId);
  }
}
