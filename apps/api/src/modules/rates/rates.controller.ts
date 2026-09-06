import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateRateTableDto } from "./dto/create-rate-table.dto";
import { UpdateRateTableDto } from "./dto/update-rate-table.dto";
import { CreateRateColumnDto, UpdateRateColumnDto } from "./dto/rate-column.dto";
import { CreateRateRowDto, UpdateRateRowDto } from "./dto/rate-row.dto";
import { RatesImportApplyDto } from "./dto/rates-import.dto";
import { PatchChargeStepsDto } from "./dto/charge-steps.dto";
import { RateTablesService } from "./rate-tables.service";
import { RateResolverService } from "./rate-resolver.service";
import { RatesExportService } from "./rates-export.service";
import { RatesImportService } from "./rates-import.service";
import { RateXlsmExportService } from "./rate-xlsm-export.service";
import { RateXlsmImportService } from "./rate-xlsm-import.service";

const PLATFORM_ADMIN = "platform.admin";

@ApiTags("Rates")
@ApiBearerAuth()
@Controller("rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RatesController {
  constructor(
    private readonly tables: RateTablesService,
    private readonly resolver: RateResolverService,
    private readonly exporter: RatesExportService,
    private readonly importer: RatesImportService,
    private readonly xlsmExporter: RateXlsmExportService,
    private readonly xlsmImporter: RateXlsmImportService
  ) {}

  // ── Export ───────────────────────────────────────────────────────────

  @Get("export")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Export the live Rates & Lists surface as an .xlsx (one tab per surface). Half 1 of the round-trip — the import PR consumes the same shape."
  })
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @ApiResponse({ status: 200, description: "Rates workbook stream." })
  async exportRates(@Res({ passthrough: false }) res: Response): Promise<void> {
    const { buffer, filename } = await this.exporter.buildWorkbook();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  // ── Import (round-trip half 2) ───────────────────────────────────────

  @Post("import/preview")
  @RequirePermissions("rates.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({
    summary:
      "Parse an edited rates workbook and return a preview diff (add / change / no-change per surface). Writes NOTHING."
  })
  @ApiResponse({ status: 200, description: "Preview diff with operations for /import/apply." })
  @ApiResponse({ status: 400, description: "No file, wrong file type, or corrupt workbook." })
  async importPreview(@UploadedFile() file?: Express.Multer.File) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Upload an .xlsx file in the 'file' field.");
    }
    return this.importer.preview(file.buffer);
  }

  @Post("import/apply")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Apply the operations from /import/preview. Idempotent — a re-run with unchanged data is a no-op."
  })
  @ApiResponse({ status: 200, description: "Counts of adds/updates per surface." })
  async importApply(@Body() dto: RatesImportApplyDto) {
    return this.importer.apply(dto.operations ?? []);
  }

  // ── Tables ───────────────────────────────────────────────────────────

  @Get("tables")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "List flexible rate tables with their columns." })
  @ApiResponse({ status: 200, description: "RateTable[] with columns." })
  listTables() {
    return this.tables.listTables();
  }

  @Get("tables/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Fetch a rate table with columns and active rows." })
  @ApiResponse({ status: 200, description: "RateTable with columns and rows." })
  @ApiResponse({ status: 404, description: "Rate table not found." })
  getTable(@Param("id") id: string) {
    return this.tables.getTable(id);
  }

  @Post("tables")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Create a flexible rate table." })
  @ApiResponse({ status: 201, description: "Created RateTable." })
  @ApiResponse({ status: 409, description: "Slug already exists." })
  createTable(@Body() dto: CreateRateTableDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.tables.createTable(actor.sub, dto);
  }

  @Patch("tables/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Update a rate table's metadata." })
  @ApiResponse({ status: 200, description: "Updated RateTable." })
  @ApiResponse({ status: 404, description: "Rate table not found." })
  updateTable(
    @Param("id") id: string,
    @Body() dto: UpdateRateTableDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.tables.updateTable(actor.sub, id, dto);
  }

  @Delete("tables/:id")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Delete a rate table. Restricted to platform admins pending the authority seam (TODO: move behind seam)."
  })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 403, description: "Non-admin attempted whole-table delete." })
  deleteTable(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    if (!actor.permissions.includes(PLATFORM_ADMIN)) {
      throw new ForbiddenException("Whole-table delete is restricted to platform admins.");
    }
    return this.tables.deleteTable(id, actor.sub);
  }

  // ── Columns ──────────────────────────────────────────────────────────

  @Post("tables/:tableId/columns")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Add a column to a rate table." })
  @ApiResponse({ status: 201, description: "Created RateColumn." })
  @ApiResponse({ status: 400, description: "Structure validation failed." })
  @ApiResponse({ status: 409, description: "Column name already exists on this table." })
  createColumn(@Param("tableId") tableId: string, @Body() dto: CreateRateColumnDto) {
    return this.tables.createColumn(tableId, dto);
  }

  @Patch("tables/:tableId/columns/:columnId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Update a rate column." })
  @ApiResponse({ status: 200, description: "Updated RateColumn." })
  @ApiResponse({ status: 400, description: "Structure validation failed." })
  updateColumn(
    @Param("tableId") tableId: string,
    @Param("columnId") columnId: string,
    @Body() dto: UpdateRateColumnDto
  ) {
    return this.tables.updateColumn(tableId, columnId, dto);
  }

  @Delete("tables/:tableId/columns/:columnId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Delete a rate column." })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({
    status: 409,
    description: "Table still has rows; deactivate them first (cell keys reference the column)."
  })
  deleteColumn(
    @Param("tableId") tableId: string,
    @Param("columnId") columnId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.tables.deleteColumn(tableId, columnId, actor.sub);
  }

  // ── Rows ─────────────────────────────────────────────────────────────

  @Post("tables/:tableId/rows")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Add a row to a rate table (validated per spec §4)." })
  @ApiResponse({ status: 201, description: "Created RateRow." })
  @ApiResponse({ status: 400, description: "Row validation failed." })
  createRow(
    @Param("tableId") tableId: string,
    @Body() dto: CreateRateRowDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.tables.createRow(actor.sub, tableId, dto);
  }

  @Patch("tables/:tableId/rows/:rowId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Update a rate row (re-validates cells if supplied)." })
  @ApiResponse({ status: 200, description: "Updated RateRow." })
  @ApiResponse({ status: 400, description: "Row validation failed." })
  updateRow(
    @Param("tableId") tableId: string,
    @Param("rowId") rowId: string,
    @Body() dto: UpdateRateRowDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.tables.updateRow(actor.sub, tableId, rowId, dto);
  }

  @Delete("tables/:tableId/rows/:rowId")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Soft-delete a rate row (sets isActive=false)." })
  @ApiResponse({ status: 200, description: "The deactivated RateRow." })
  deleteRow(@Param("tableId") tableId: string, @Param("rowId") rowId: string) {
    return this.tables.deleteRow(tableId, rowId);
  }

  // ── Resolver ─────────────────────────────────────────────────────────

  @Post("resolve/:slug")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Resolve a rate. R0 reads legacy tables by default; unknown slugs fall through to the flexible model."
  })
  @ApiResponse({ status: 200, description: "{ rowId, value, unit, source: 'legacy'|'ratetable' }" })
  @ApiResponse({ status: 404, description: "No matching rate row." })
  resolve(@Param("slug") slug: string, @Body() keys: Record<string, unknown>) {
    return this.resolver.resolveRate(slug, keys ?? {});
  }

  // ── Hub .xlsm import (S5) ────────────────────────────────────────────

  /**
   * POST /rates/import/:tableSlug
   *
   * Multipart file upload against a specific RateTable slug.
   *
   * Without ?commit=true: parse and validate only — returns the stage result
   * (errors, warnings, preview rows, impact summary). Writes NOTHING.
   *
   * With ?commit=true: if stage passes (valid=true) the rows are committed
   * in a single all-or-nothing transaction (existing active rows soft-deleted,
   * new rows inserted, audit entry written). Returns the same stage result
   * enriched with { committed: true }.
   *
   * On validation failure with ?commit=true the endpoint returns 400 with the
   * errors — no rows are written.
   */
  @Post("import/:tableSlug")
  @RequirePermissions("rates.manage")
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiQuery({
    name: "commit",
    required: false,
    type: String,
    description: "Pass commit=true to apply validated rows in one transaction."
  })
  @ApiOperation({
    summary:
      "S5 hub import: parse a .xlsm/.xlsx file for a specific RateTable. " +
      "Add ?commit=true to execute the all-or-nothing write after validation passes."
  })
  @ApiResponse({ status: 200, description: "Stage result (+ committed flag when ?commit=true)." })
  @ApiResponse({ status: 400, description: "No file, corrupt workbook, or validation errors." })
  @ApiResponse({ status: 404, description: "RateTable slug not found." })
  async importTableSlug(
    @Param("tableSlug") tableSlug: string,
    @Query("commit") commit: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException("Upload an .xlsx or .xlsm file in the 'file' field.");
    }

    const stageResult = await this.xlsmImporter.stageImport(file.buffer, tableSlug);

    if (commit === "true") {
      if (!stageResult.valid) {
        throw new BadRequestException({
          message: "Import validation failed — no rows written.",
          errors: stageResult.errors,
          warnings: stageResult.warnings
        });
      }
      await this.xlsmImporter.commitImport(stageResult, tableSlug, actor.sub);
      return { ...stageResult, committed: true };
    }

    return stageResult;
  }

  // ── Hub .xlsm export (S5) ────────────────────────────────────────────

  /**
   * GET /rates/export/:tableSlug
   *
   * Download the active rows of the named RateTable as a ready-to-reimport
   * .xlsx file. Filename: <slug>-rates.xlsx.
   *
   * Guard: rates.view OR rates.manage (manage is already sufficient; we also
   * accept rates.view so read-only users can download without manage access).
   * Since RequirePermissions is OR-logic by convention we use "rates.manage"
   * as the minimum gate (adjust when rates.view is added to the permission set).
   */
  @Get("export/:tableSlug")
  @RequirePermissions("rates.manage")
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @ApiOperation({
    summary:
      "S5 hub export: download a specific RateTable as an .xlsx workbook. " +
      "Header row matches RateColumn names so the file round-trips through /import/:tableSlug."
  })
  @ApiResponse({ status: 200, description: ".xlsx workbook buffer." })
  @ApiResponse({ status: 404, description: "RateTable slug not found." })
  async exportTableSlug(
    @Param("tableSlug") tableSlug: string,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const buffer = await this.xlsmExporter.exportTable(tableSlug);
    const filename = `${tableSlug}-rates.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  // ── Charge steps ──────────────────────────────────────────────────────

  @Get("tables/:id/charge-steps")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Get the charge-step list and open-tender impact for a rate table." })
  @ApiResponse({ status: 200, description: "{ chargeSteps, openTenderCount }" })
  @ApiResponse({ status: 404, description: "Rate table not found." })
  getChargeSteps(@Param("id") id: string) {
    return this.tables.getChargeStepsInfo(id);
  }

  @Patch("tables/:id/charge-steps")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Replace the charge-step list for a rate table, and optionally the line fields it may name. " +
      "Validated server-side: first step must be 'start', ops must be known, and field references must " +
      "name a column on the table or a declared line field."
  })
  @ApiResponse({ status: 200, description: "Updated RateTable." })
  @ApiResponse({
    status: 400,
    description:
      "Validation error — unknown op, first step not start, a field name that is neither a column nor a " +
      "line field, a text line field used in the sum, or a line-field declaration that clashes with a column."
  })
  @ApiResponse({ status: 404, description: "Rate table not found." })
  patchChargeSteps(
    @Param("id") id: string,
    @Body() dto: PatchChargeStepsDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    // RATE_LINE_FIELDS_V1 — `lineFields` is passed through as given, including
    // `undefined`, which the service reads as "leave the declaration alone".
    return this.tables.patchChargeSteps(actor.sub, id, dto.steps, dto.lineFields);
  }
}
