import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { BulkStatusDto, QuickEditDto, TenderQueryDto } from "./dto/tender-query.dto";
import {
  CreateTenderFilterPresetDto,
  UpdateTenderFilterPresetDto
} from "./dto/tender-filter-preset.dto";
import {
  CreateTenderActivityDto,
  CreateTenderClarificationDto,
  CreateTenderFollowUpDto,
  CreateTenderNoteDto,
  PreviewTenderImportDto,
  UpdateTenderActivityDto,
  UpsertTenderDto
} from "./dto/tender.dto";

class UpdateTenderStatusDto {
  @IsString()
  status!: string;
}

class UpdateTenderProbabilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number | null;
}
import { TenderingService } from "./tendering.service";

@ApiTags("Tendering")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderingController {
  constructor(private readonly service: TenderingService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List tenders with filters, search, and sort" })
  @ApiQuery({ name: "q", required: false, description: "Search across tender number, title, and client names" })
  @ApiQuery({ name: "status", required: false, description: "Comma-separated list of statuses" })
  @ApiQuery({ name: "estimatorId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "discipline", required: false, description: "SO|Str|Asb|Civ|Prv — filters tenders that have scope items in this discipline" })
  @ApiQuery({ name: "valueMin", required: false })
  @ApiQuery({ name: "valueMax", required: false })
  @ApiQuery({ name: "dueDateFrom", required: false, description: "ISO date" })
  @ApiQuery({ name: "dueDateTo", required: false, description: "ISO date" })
  @ApiQuery({ name: "probability", required: false, description: "Hot|Warm|Cold" })
  @ApiQuery({ name: "sortBy", required: false })
  @ApiQuery({ name: "sortDir", required: false, enum: ["asc", "desc"] })
  list(@Query() query: TenderQueryDto) {
    return this.service.list(query);
  }

  @Post("bulk-status")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Bulk update the status of up to 50 tenders in a single transaction" })
  @ApiResponse({ status: 200, description: "Updated summary with count and the affected tender rows." })
  bulkStatus(@Body() dto: BulkStatusDto, @CurrentUser() actor: { sub: string }) {
    return this.service.bulkUpdateStatus(dto.tenderIds, dto.status, actor.sub);
  }

  @Get("filter-presets")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List saved filter presets for the current user" })
  listPresets(@CurrentUser() actor: { sub: string }) {
    return this.service.listFilterPresets(actor.sub);
  }

  @Post("filter-presets")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Save a filter preset for the current user" })
  createPreset(@Body() dto: CreateTenderFilterPresetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createFilterPreset(actor.sub, dto);
  }

  @Patch("filter-presets/:id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Update a saved filter preset" })
  updatePreset(
    @Param("id") id: string,
    @Body() dto: UpdateTenderFilterPresetDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateFilterPreset(actor.sub, id, dto);
  }

  @Delete("filter-presets/:id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Delete a saved filter preset" })
  deletePreset(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteFilterPreset(actor.sub, id);
  }

  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a tender" })
  create(@Body() dto: UpsertTenderDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto, actor.sub);
  }

  @Post(":id/notes")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add a tender note" })
  addNote(@Param("id") id: string, @Body() dto: CreateTenderNoteDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addNote(id, dto, actor.sub);
  }

  @Post(":id/clarifications")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add a tender clarification" })
  addClarification(@Param("id") id: string, @Body() dto: CreateTenderClarificationDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addClarification(id, dto, actor.sub);
  }

  @Post(":id/follow-ups")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Add a tender follow-up" })
  addFollowUp(@Param("id") id: string, @Body() dto: CreateTenderFollowUpDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addFollowUp(id, dto, actor.sub);
  }

  @Get(":id/activities")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List unified tender activities" })
  listActivities(@Param("id") id: string) {
    return this.service.listActivities(id);
  }

  @Post(":id/activities")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a unified tender activity" })
  addActivity(@Param("id") id: string, @Body() dto: CreateTenderActivityDto, @CurrentUser() actor: { sub: string }) {
    return this.service.addActivity(id, dto, actor.sub);
  }

  @Patch(":id/activities/:activityId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a unified tender activity" })
  updateActivity(
    @Param("id") id: string,
    @Param("activityId") activityId: string,
    @Body() dto: UpdateTenderActivityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateActivity(id, activityId, dto, actor.sub);
  }

  @Post("import/preview")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Preview tender import rows from CSV text" })
  previewImport(@Body() dto: PreviewTenderImportDto) {
    return this.service.previewImport(dto.csvText);
  }

  @Post("import/commit")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create tenders from CSV text" })
  commitImport(@Body() dto: PreviewTenderImportDto, @CurrentUser() actor: { sub: string }) {
    return this.service.commitImport(dto.csvText, actor.sub);
  }

  @Get(":id")
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Get tender detail" })
  getById(@Param("id") id: string) {
    return this.service.getById(id);
  }

  @Patch(":id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a tender" })
  update(@Param("id") id: string, @Body() dto: UpsertTenderDto, @CurrentUser() actor: { sub: string }) {
    return this.service.update(id, dto, actor.sub);
  }

  @Post(":id/duplicate")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Duplicate a tender (copies fields and clients, resets lifecycle dates and outcomes)" })
  @ApiResponse({ status: 201, description: "Newly created tender copy." })
  duplicate(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.duplicate(id, actor.sub);
  }

  @Patch(":id/status")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update only the stage/status of a tender (used by the Kanban drag-drop flow)" })
  @ApiResponse({ status: 200, description: "Updated tender record with the new status and all existing relations preserved." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTenderStatusDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateStatus(id, dto.status, actor.sub);
  }

  @Patch(":id/probability")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update only the probability of a tender (preserves all related records)" })
  updateProbability(
    @Param("id") id: string,
    @Body() dto: UpdateTenderProbabilityDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateProbability(id, dto.probability ?? null, actor.sub);
  }

  @Patch(":id/quick-edit")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Patch a limited set of tender fields in one call and log a single activity entry" })
  @ApiResponse({ status: 200, description: "Updated tender." })
  quickEdit(
    @Param("id") id: string,
    @Body() dto: QuickEditDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.quickEdit(id, dto, actor.sub);
  }
}
