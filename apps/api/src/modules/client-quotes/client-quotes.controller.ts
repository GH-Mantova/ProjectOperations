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
  getOne(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.getOne(tenderId, quoteId);
  }

  @Patch(":quoteId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update quote-level fields (adjustment, mode, status, toggles)" })
  update(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpdateClientQuoteDto
  ) {
    return this.service.update(tenderId, quoteId, dto);
  }

  @Delete(":quoteId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a DRAFT quote (403 on SENT/SUPERSEDED)" })
  delete(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.delete(tenderId, quoteId);
  }

  // ── Summary (internal — clientFacingTotal is the one the PDF renders) ─
  @Get(":quoteId/summary")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Server-computed totals incl. adjustment — adjustment is INTERNAL ONLY" })
  summary(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.summary(tenderId, quoteId);
  }

  // ── Cost lines CRUD ─────────────────────────────────────────────────
  @Get(":quoteId/cost-lines")
  @RequirePermissions("tenders.view")
  listCostLines(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listCostLines(tenderId, quoteId);
  }
  @Post(":quoteId/cost-lines")
  @RequirePermissions("tenders.manage")
  createCostLine(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertCostLineDto
  ) {
    return this.service.createCostLine(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/cost-lines/:lineId")
  @RequirePermissions("tenders.manage")
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
  deleteCostLine(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("lineId") lineId: string
  ) {
    return this.service.deleteCostLine(tenderId, quoteId, lineId);
  }
  @Post(":quoteId/cost-lines/reorder")
  @RequirePermissions("tenders.manage")
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
  listProvisional(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listProvisional(tenderId, quoteId);
  }
  @Post(":quoteId/provisional-lines")
  @RequirePermissions("tenders.manage")
  createProvisional(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertProvisionalLineDto
  ) {
    return this.service.createProvisional(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/provisional-lines/:lineId")
  @RequirePermissions("tenders.manage")
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
  listOptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listOptions(tenderId, quoteId);
  }
  @Post(":quoteId/cost-options")
  @RequirePermissions("tenders.manage")
  createOption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertCostOptionDto
  ) {
    return this.service.createOption(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/cost-options/:lineId")
  @RequirePermissions("tenders.manage")
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
  listAssumptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listAssumptions(tenderId, quoteId);
  }
  @Post(":quoteId/assumptions")
  @RequirePermissions("tenders.manage")
  createAssumption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertAssumptionDto
  ) {
    return this.service.createAssumption(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/assumptions/:id")
  @RequirePermissions("tenders.manage")
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
  deleteAssumption(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string
  ) {
    return this.service.deleteAssumption(tenderId, quoteId, id);
  }
  @Post(":quoteId/assumptions/copy-from-tender")
  @RequirePermissions("tenders.manage")
  copyAssumptions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.copyAssumptionsFromTender(tenderId, quoteId);
  }

  // ── Exclusions CRUD ────────────────────────────────────────────────
  @Get(":quoteId/exclusions")
  @RequirePermissions("tenders.view")
  listExclusions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.listExclusions(tenderId, quoteId);
  }
  @Post(":quoteId/exclusions")
  @RequirePermissions("tenders.manage")
  createExclusion(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: UpsertExclusionDto
  ) {
    return this.service.createExclusion(tenderId, quoteId, dto);
  }
  @Patch(":quoteId/exclusions/:id")
  @RequirePermissions("tenders.manage")
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
  deleteExclusion(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Param("id") id: string
  ) {
    return this.service.deleteExclusion(tenderId, quoteId, id);
  }
  @Post(":quoteId/exclusions/copy-from-tender")
  @RequirePermissions("tenders.manage")
  copyExclusions(@Param("tenderId") tenderId: string, @Param("quoteId") quoteId: string) {
    return this.service.copyExclusionsFromTender(tenderId, quoteId);
  }

  // ── Suggested adjustment ───────────────────────────────────────────
  @Get("client-suggestion/:clientId")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Suggested adjustment % for a client, based on preferenceScore + winRate" })
  suggestion(@Param("clientId") clientId: string) {
    return this.service.suggestion(clientId);
  }

  // ── PDF ────────────────────────────────────────────────────────────
  @Get(":quoteId/pdf")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Stream a per-quote PDF (uses clientFacingTotal; adjustment never rendered)" })
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
  async send(
    @Param("tenderId") tenderId: string,
    @Param("quoteId") quoteId: string,
    @Body() dto: SendQuoteDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.sender.send(tenderId, quoteId, actor.sub, dto);
  }
}
