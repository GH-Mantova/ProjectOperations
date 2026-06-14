import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ClientQuotesService } from "./client-quotes.service";
import { QuotePdfService } from "./quote-pdf.service";
import { QuoteSendService } from "./quote-send.service";
import {
  CreateClientQuoteDto,
  ReorderDto,
  SendQuoteDto,
  UpdateClientQuoteDto,
  UpsertAssumptionDto,
  UpsertCostLineDto,
  UpsertCostOptionDto,
  UpsertExclusionDto,
  UpsertProvisionalLineDto
} from "./dto/client-quotes.dto";

type RequestUser = { sub: string };

@ApiTags("Client Quotes")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("tenders/:tenderId/quotes")
export class ClientQuotesController {
  constructor(
    private readonly service: ClientQuotesService,
    private readonly pdf: QuotePdfService,
    private readonly sender: QuoteSendService
  ) {}

  // ── Quote CRUD ─────────────────────────────────────────────────────
  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List all client quotes for a tender, grouped by client/revision" })
  @ApiResponse({ status: 200, description: "List all client quotes for a tender, grouped by client/revision." })
  list(@Param("tenderId") tenderId: string) {
    return this.service.listByTender(tenderId);
  }

  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary: "Create a new ClientQuote for a client; bumps revision if one already exists"
  })
  @ApiResponse({ status: 201, description: "New quote with suggested cost lines (from scope) or copied from source." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateClientQuoteDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.create(tenderId, actor.sub, dto);
  }

  @Get(":quoteId")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Get a ClientQuote with all related lines, options, assumptions, exclusions" })
  @ApiResponse({ status: 200, description: "Get a ClientQuote with all related lines, options, assumptions, exclusions." })
  getOne(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.getOne(tenderId, quoteId);
  }

  @Patch(":quoteId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update quote-level fields (adjustment, mode, status, toggles)" })
  @ApiResponse({ status: 200, description: "Update quote-level fields (adjustment, mode, status, toggles)." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpdateClientQuoteDto
  ) {
    return this.service.update(tenderId, quoteId, dto);
  }

  @Delete(":quoteId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Hard-delete a quote and all related cost lines, options, assumptions, exclusions" })
  @ApiResponse({ status: 200, description: "Deleted quote ID." })
  delete(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.delete(tenderId, quoteId, actor.sub);
  }

  // ── Summary (internal — clientFacingTotal is the one the PDF renders) ─
  @Get(":quoteId/summary")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Server-computed totals incl. adjustment — adjustment is INTERNAL ONLY" })
  @ApiResponse({ status: 200, description: "Server-computed totals incl. adjustment — adjustment is INTERNAL ONLY." })
  summary(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.summary(tenderId, quoteId);
  }

  // ── Cost lines CRUD ─────────────────────────────────────────────────
  @Get(":quoteId/cost-lines")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List cost lines for a client quote." })
  @ApiResponse({ status: 200, description: "Cost lines." })
  listCostLines(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listCostLines(tenderId, quoteId);
  }
  @Post(":quoteId/cost-lines")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a cost line on a client quote." })
  @ApiResponse({ status: 201, description: "Cost line created." })
  createCostLine(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertCostLineDto
  ) {
    return this.service.createCostLine(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/cost-lines/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a cost line on a client quote." })
  @ApiResponse({ status: 200, description: "Updated cost line." })
  @ApiResponse({ status: 404, description: "Cost line not found." })
  updateCostLine(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpsertCostLineDto
  ) {
    return this.service.updateCostLine(tenderId, quoteId, lineId, dto);
  }
  @Delete(":quoteId/cost-lines/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a cost line from a client quote." })
  @ApiResponse({ status: 200, description: "Deleted cost line ID." })
  @ApiResponse({ status: 404, description: "Cost line not found." })
  deleteCostLine(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.deleteCostLine(tenderId, quoteId, lineId);
  }
  @Post(":quoteId/cost-lines/reorder")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Bulk reorder cost lines on a client quote." })
  @ApiResponse({ status: 200, description: "Reordered cost lines." })
  reorderCostLines(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: ReorderDto
  ) {
    return this.service.reorderCostLines(tenderId, quoteId, dto.order);
  }

  // ── Provisional lines CRUD ─────────────────────────────────────────
  @Get(":quoteId/provisional-lines")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List provisional lines for a client quote." })
  @ApiResponse({ status: 200, description: "Provisional lines." })
  listProvisional(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listProvisional(tenderId, quoteId);
  }
  @Post(":quoteId/provisional-lines")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a provisional line on a client quote." })
  @ApiResponse({ status: 201, description: "Provisional line created." })
  createProvisional(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertProvisionalLineDto
  ) {
    return this.service.createProvisional(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/provisional-lines/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a provisional line on a client quote." })
  @ApiResponse({ status: 200, description: "Updated provisional line." })
  @ApiResponse({ status: 404, description: "Provisional line not found." })
  updateProvisional(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpsertProvisionalLineDto
  ) {
    return this.service.updateProvisional(tenderId, quoteId, lineId, dto);
  }
  @Delete(":quoteId/provisional-lines/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a provisional line from a client quote." })
  @ApiResponse({ status: 200, description: "Deleted provisional line ID." })
  @ApiResponse({ status: 404, description: "Provisional line not found." })
  deleteProvisional(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.deleteProvisional(tenderId, quoteId, lineId);
  }

  // ── Cost options CRUD ──────────────────────────────────────────────
  @Get(":quoteId/cost-options")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List cost options for a client quote." })
  @ApiResponse({ status: 200, description: "Cost options." })
  listOptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listOptions(tenderId, quoteId);
  }
  @Post(":quoteId/cost-options")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a cost option on a client quote." })
  @ApiResponse({ status: 201, description: "Cost option created." })
  createOption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertCostOptionDto
  ) {
    return this.service.createOption(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/cost-options/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a cost option on a client quote." })
  @ApiResponse({ status: 200, description: "Updated cost option." })
  @ApiResponse({ status: 404, description: "Cost option not found." })
  updateOption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpsertCostOptionDto
  ) {
    return this.service.updateOption(tenderId, quoteId, lineId, dto);
  }
  @Delete(":quoteId/cost-options/:lineId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a cost option from a client quote." })
  @ApiResponse({ status: 200, description: "Deleted cost option ID." })
  @ApiResponse({ status: 404, description: "Cost option not found." })
  deleteOption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.deleteOption(tenderId, quoteId, lineId);
  }

  // ── Assumptions CRUD ───────────────────────────────────────────────
  @Get(":quoteId/assumptions")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List assumptions for a client quote." })
  @ApiResponse({ status: 200, description: "Quote assumptions." })
  listAssumptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listAssumptions(tenderId, quoteId);
  }
  @Post(":quoteId/assumptions")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create an assumption on a client quote." })
  @ApiResponse({ status: 201, description: "Assumption created." })
  createAssumption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertAssumptionDto
  ) {
    return this.service.createAssumption(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/assumptions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update an assumption on a client quote." })
  @ApiResponse({ status: 200, description: "Updated assumption." })
  @ApiResponse({ status: 404, description: "Assumption not found." })
  updateAssumption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string,
    @Body() dto: UpsertAssumptionDto
  ) {
    return this.service.updateAssumption(tenderId, quoteId, id, dto);
  }
  @Delete(":quoteId/assumptions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete an assumption from a client quote." })
  @ApiResponse({ status: 200, description: "Deleted assumption ID." })
  @ApiResponse({ status: 404, description: "Assumption not found." })
  deleteAssumption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string
  ) {
    return this.service.deleteAssumption(tenderId, quoteId, id);
  }
  @Post(":quoteId/assumptions/copy-from-tender")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Copy assumptions from the parent tender to a client quote." })
  @ApiResponse({ status: 201, description: "Assumptions copied." })
  copyAssumptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.copyAssumptionsFromTender(tenderId, quoteId);
  }

  // ── Exclusions CRUD ────────────────────────────────────────────────
  @Get(":quoteId/exclusions")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List exclusions for a client quote." })
  @ApiResponse({ status: 200, description: "Quote exclusions." })
  listExclusions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listExclusions(tenderId, quoteId);
  }
  @Post(":quoteId/exclusions")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create an exclusion on a client quote." })
  @ApiResponse({ status: 201, description: "Exclusion created." })
  createExclusion(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertExclusionDto
  ) {
    return this.service.createExclusion(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/exclusions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update an exclusion on a client quote." })
  @ApiResponse({ status: 200, description: "Updated exclusion." })
  @ApiResponse({ status: 404, description: "Exclusion not found." })
  updateExclusion(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string,
    @Body() dto: UpsertExclusionDto
  ) {
    return this.service.updateExclusion(tenderId, quoteId, id, dto);
  }
  @Delete(":quoteId/exclusions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete an exclusion from a client quote." })
  @ApiResponse({ status: 200, description: "Deleted exclusion ID." })
  @ApiResponse({ status: 404, description: "Exclusion not found." })
  deleteExclusion(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string
  ) {
    return this.service.deleteExclusion(tenderId, quoteId, id);
  }
  @Post(":quoteId/exclusions/copy-from-tender")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Copy exclusions from the parent tender to a client quote." })
  @ApiResponse({ status: 201, description: "Exclusions copied." })
  copyExclusions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.copyExclusionsFromTender(tenderId, quoteId);
  }

  // ── Suggested adjustment ───────────────────────────────────────────
  @Get("client-suggestion/:clientId")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Suggested adjustment % for a client, based on preferenceScore + winRate" })
  @ApiResponse({ status: 200, description: "Suggested adjustment % for a client, based on preferenceScore + winRate." })
  suggestion(@Param("clientId") clientId: string) {
    return this.service.suggestion(clientId);
  }

  // ── PDF ────────────────────────────────────────────────────────────
  @Get(":quoteId/pdf")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Stream a per-quote PDF (uses clientFacingTotal; adjustment never rendered)" })
  @ApiResponse({ status: 200, description: "Stream a per-quote PDF (uses clientFacingTotal; adjustment never rendered)." })
  @Header("Cache-Control", "no-store")
  async renderPdf(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @CurrentUser() actor: RequestUser,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const { buffer, filename } = await this.pdf.generate(tenderId, quoteId, actor.sub);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  // ── Send (Outlook) ─────────────────────────────────────────────────
  @Post(":quoteId/send")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Send the quote via Outlook; optionally attaches the PDF. Marks quote SENT." })
  @ApiResponse({ status: 201, description: "Send the quote via Outlook; optionally attaches the PDF. Marks quote SENT." })
  async send(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: SendQuoteDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.sender.send(tenderId, quoteId, actor.sub, dto);
  }
}
