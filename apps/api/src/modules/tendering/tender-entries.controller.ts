import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  TENDER_ENTRY_STATUSES,
  TENDER_ENTRY_TYPES,
  TenderEntriesService
} from "./tender-entries.service";

class CreateTenderEntryDto {
  @IsIn([...TENDER_ENTRY_TYPES])
  type!: string;

  @IsOptional() @IsString() subject?: string;

  @IsString()
  body!: string;

  @IsOptional() @IsDateString() dueDate?: string;

  @IsOptional() @IsString() assigneeId?: string;

  @IsOptional() @IsIn([...TENDER_ENTRY_STATUSES]) status?: string;
}

class UpdateTenderEntryDto {
  @IsOptional() @IsIn([...TENDER_ENTRY_TYPES]) type?: string;

  @IsOptional() @IsString() subject?: string;

  @IsOptional() @IsString() body?: string;

  @IsOptional() @IsDateString() dueDate?: string | null;

  @IsOptional() @IsString() assigneeId?: string | null;

  @IsOptional() @IsIn([...TENDER_ENTRY_STATUSES]) status?: string;
}

@ApiTags("Tender Entries")
@ApiBearerAuth()
@Controller("tenders/:tenderId/entries")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderEntriesController {
  constructor(private readonly service: TenderEntriesService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List unified communication entries for a tender (newest first)" })
  @ApiParam({ name: "tenderId", description: "Tender id whose entries are listed" })
  @ApiQuery({
    name: "type",
    required: false,
    enum: [...TENDER_ENTRY_TYPES],
    description: "Filter to a single entry type"
  })
  @ApiQuery({ name: "assigneeId", required: false, description: "Filter by assignee user id" })
  @ApiQuery({ name: "status", required: false, enum: [...TENDER_ENTRY_STATUSES] })
  @ApiQuery({ name: "from", required: false, description: "ISO date — lower bound on createdAt" })
  @ApiQuery({ name: "to", required: false, description: "ISO date — upper bound on createdAt" })
  @ApiResponse({ status: 200, description: "Entries with author + assignee metadata." })
  @ApiResponse({ status: 400, description: "Invalid type or status filter value." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  list(
    @Param("tenderId") tenderId: string,
    @Query("type") type?: string,
    @Query("assigneeId") assigneeId?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.service.list(tenderId, { type, assigneeId, status, from, to });
  }

  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Create a unified communication entry on a tender" })
  @ApiParam({ name: "tenderId", description: "Tender id to attach the entry to" })
  @ApiResponse({ status: 201, description: "Created entry." })
  @ApiResponse({
    status: 400,
    description:
      "Validation failed (missing body, invalid type/status, conditional fields, or unknown/inactive assignee)."
  })
  @ApiResponse({ status: 404, description: "Tender not found." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateTenderEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(tenderId, dto, actor.sub);
  }

  @Patch(":entryId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update an entry — body, subject, due date, assignee, status, or type" })
  @ApiParam({ name: "tenderId", description: "Tender id owning the entry" })
  @ApiParam({ name: "entryId", description: "Entry id to update" })
  @ApiResponse({ status: 200, description: "Updated entry." })
  @ApiResponse({
    status: 400,
    description:
      "Validation failed (empty body, invalid type/status, conditional fields, or unknown/inactive assignee)."
  })
  @ApiResponse({ status: 404, description: "Entry not found on this tender." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("entryId") entryId: string,
    @Body() dto: UpdateTenderEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.update(tenderId, entryId, dto, actor.sub);
  }

  @Delete(":entryId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Soft-delete an entry by setting status='cancelled'" })
  @ApiParam({ name: "tenderId", description: "Tender id owning the entry" })
  @ApiParam({ name: "entryId", description: "Entry id to cancel" })
  @ApiResponse({ status: 200, description: "Entry id + new status." })
  @ApiResponse({ status: 404, description: "Entry not found on this tender." })
  remove(
    @Param("tenderId") tenderId: string,
    @Param("entryId") entryId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.remove(tenderId, entryId, actor.sub);
  }
}
