import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { QuoteService } from "./quote.service";
import type { TcClause } from "./tc-parser";

class ClauseDto {
  @IsString() number!: string;
  @IsString() heading!: string;
  @IsString() body!: string;
}

class UpdateTandCDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClauseDto)
  clauses!: ClauseDto[];
}

class CreateTextDto {
  @IsString() text!: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class UpdateTextDto {
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class ReorderEntryDto {
  @IsString() id!: string;
  @IsInt() @Min(0) sortOrder!: number;
}

class ReorderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  order!: ReorderEntryDto[];
}

@ApiTags("Quote")
@ApiBearerAuth()
@Controller("tenders/:tenderId")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class QuoteController {
  constructor(private readonly service: QuoteService) {}

  // ── T&C ──────────────────────────────────────────────────────────────
  @Get("tandc")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "Get the per-tender T&C clauses. Auto-creates from the IS standard set (tc-text.const) on first access."
  })
  @ApiResponse({ status: 200, description: "TenderTandC record with 21-clause array." })
  getTandC(@Param("tenderId") tenderId: string) {
    return this.service.getTandC(tenderId);
  }

  @Patch("tandc")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Replace the clauses array. Used by the auto-save on each textarea blur." })
  updateTandC(@Param("tenderId") tenderId: string, @Body() dto: UpdateTandCDto) {
    return this.service.updateTandC(tenderId, dto.clauses as TcClause[]);
  }

  @Post("tandc/reset")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Reset all clauses to the IS standard text from tc-text.const." })
  resetAllTandC(@Param("tenderId") tenderId: string) {
    return this.service.resetAllTandC(tenderId);
  }

  @Post("tandc/reset/:clauseNumber")
  @RequirePermissions("tenders.manage")
  @ApiOperation({
    summary: "Reset a single clause to its IS standard text. clauseNumber is a string (supports 17A)."
  })
  @ApiResponse({ status: 404, description: "Clause number does not exist in the standard set." })
  resetClause(@Param("tenderId") tenderId: string, @Param("clauseNumber") clauseNumber: string) {
    return this.service.resetClause(tenderId, clauseNumber);
  }

  // ── Assumptions ──────────────────────────────────────────────────────
  @Get("assumptions")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "List assumptions ordered by sortOrder. If none exist, pre-seeds the IS standard assumption list on first read."
  })
  listAssumptions(@Param("tenderId") tenderId: string) {
    return this.service.listAssumptions(tenderId);
  }

  @Post("assumptions")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add an assumption row." })
  createAssumption(@Param("tenderId") tenderId: string, @Body() dto: CreateTextDto) {
    return this.service.createAssumption(tenderId, dto.text, dto.sortOrder);
  }

  @Patch("assumptions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Edit an assumption's text or sortOrder (used by auto-save on blur)." })
  updateAssumption(
    @Param("tenderId") tenderId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTextDto
  ) {
    return this.service.updateAssumption(tenderId, id, dto);
  }

  @Delete("assumptions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Hard-delete an assumption row." })
  deleteAssumption(@Param("tenderId") tenderId: string, @Param("id") id: string) {
    return this.service.deleteAssumption(tenderId, id);
  }

  @Post("assumptions/reorder")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Bulk sortOrder update for drag-and-drop reorder." })
  reorderAssumptions(@Param("tenderId") tenderId: string, @Body() dto: ReorderDto) {
    return this.service.reorderAssumptions(tenderId, dto.order);
  }

  // ── Exclusions ───────────────────────────────────────────────────────
  @Get("exclusions")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "List exclusions ordered by sortOrder. Pre-seeds the IS standard exclusion list on first read."
  })
  listExclusions(@Param("tenderId") tenderId: string) {
    return this.service.listExclusions(tenderId);
  }

  @Post("exclusions")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add an exclusion row." })
  createExclusion(@Param("tenderId") tenderId: string, @Body() dto: CreateTextDto) {
    return this.service.createExclusion(tenderId, dto.text, dto.sortOrder);
  }

  @Patch("exclusions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Edit an exclusion's text or sortOrder." })
  updateExclusion(
    @Param("tenderId") tenderId: string,
    @Param("id") id: string,
    @Body() dto: UpdateTextDto
  ) {
    return this.service.updateExclusion(tenderId, id, dto);
  }

  @Delete("exclusions/:id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Hard-delete an exclusion row." })
  deleteExclusion(@Param("tenderId") tenderId: string, @Param("id") id: string) {
    return this.service.deleteExclusion(tenderId, id);
  }

  @Post("exclusions/reorder")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Bulk sortOrder update for drag-and-drop reorder." })
  reorderExclusions(@Param("tenderId") tenderId: string, @Body() dto: ReorderDto) {
    return this.service.reorderExclusions(tenderId, dto.order);
  }

  // ── Export history ───────────────────────────────────────────────────
  @Get("exports")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "List past PDF/Excel exports for this tender (most recent first, capped at 20). PDF/Excel generation itself lives at /tenders/:id/export/pdf and /export/excel."
  })
  listExports(@Param("tenderId") tenderId: string) {
    return this.service.listExports(tenderId);
  }
}
