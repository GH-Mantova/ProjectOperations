import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderQueryDto } from "./dto/tender-query.dto";
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
import { TenderingService } from "./tendering.service";

@ApiTags("Tendering")
@ApiBearerAuth()
@Controller("tenders")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderingController {
  constructor(private readonly service: TenderingService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List tenders" })
  list(@Query() query: TenderQueryDto) {
    return this.service.list(query);
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

  @Patch(":id/status")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update only the stage/status of a tender (used by the Kanban drag-drop flow)" })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateTenderStatusDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateStatus(id, dto.status, actor.sub);
  }
}
