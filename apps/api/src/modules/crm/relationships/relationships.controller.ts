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
import { IsNotEmpty, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { RelationshipsService } from "./relationships.service";

// ── DTOs ─────────────────────────────────────────────────────────────────────

class ListNotesQueryDto {
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() authorId?: string;
  @IsOptional() @Type(() => Number) @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @Min(1) limit?: number;
}

class CreateNoteDto {
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsString() contactId?: string | null;
  @IsNotEmpty() @IsString() body!: string;
}

class UpdateNoteDto {
  @IsNotEmpty() @IsString() body!: string;
}

class GoingColdQueryDto {
  @IsOptional() @Type(() => Number) @Min(1) thresholdDays?: number;
}

// ── Controller ───────────────────────────────────────────────────────────────

/**
 * CRM-2: REST surface for relationship intelligence.
 *
 * Notes routes:           crm.manage (write) / crm.view (read)
 * Derived read routes:    crm.view
 */
@ApiTags("CRM Relationships")
@ApiBearerAuth()
@Controller("crm/relationships")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RelationshipsController {
  constructor(private readonly service: RelationshipsService) {}

  // ── Notes ─────────────────────────────────────────────────────────────────

  @Get("notes")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List relationship notes (filterable by accountId/contactId/authorId)." })
  @ApiQuery({ name: "accountId", required: false })
  @ApiQuery({ name: "contactId", required: false })
  @ApiQuery({ name: "authorId", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of relationship notes." })
  listNotes(@Query() query: ListNotesQueryDto) {
    return this.service.listNotes(query as never);
  }

  @Get("notes/:id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get a relationship note by id." })
  @ApiParam({ name: "id", description: "Note id" })
  @ApiResponse({ status: 200, description: "Note found." })
  @ApiResponse({ status: 404, description: "Note not found." })
  getNote(@Param("id") id: string) {
    return this.service.getNote(id);
  }

  @Post("notes")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a relationship note against an account and/or contact." })
  @ApiResponse({ status: 201, description: "Note created." })
  @ApiResponse({ status: 400, description: "Validation error." })
  createNote(@Body() dto: CreateNoteDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createNote({
      accountId: dto.accountId,
      contactId: dto.contactId,
      authorId: actor.sub,
      body: dto.body
    });
  }

  @Patch("notes/:id")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Update the body of a relationship note." })
  @ApiParam({ name: "id", description: "Note id" })
  @ApiResponse({ status: 200, description: "Note updated." })
  @ApiResponse({ status: 404, description: "Note not found." })
  updateNote(@Param("id") id: string, @Body() dto: UpdateNoteDto) {
    return this.service.updateNote(id, { body: dto.body });
  }

  @Delete("notes/:id")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Delete a relationship note." })
  @ApiParam({ name: "id", description: "Note id" })
  @ApiResponse({ status: 200, description: "Note deleted." })
  @ApiResponse({ status: 404, description: "Note not found." })
  deleteNote(@Param("id") id: string) {
    return this.service.deleteNote(id);
  }

  // ── Derived reads ─────────────────────────────────────────────────────────

  @Get("going-cold")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary:
      "Accounts with contacts not recently contacted (going-cold nudge). Default threshold: 30 days."
  })
  @ApiQuery({ name: "thresholdDays", required: false, description: "Days threshold (default 30)." })
  @ApiResponse({ status: 200, description: "List of accounts with cold contacts." })
  getGoingColdAccounts(@Query() query: GoingColdQueryDto) {
    return this.service.getGoingColdAccounts(query.thresholdDays);
  }

  @Get("repeat-business")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary:
      "Accounts with repeat-business signal (linked Client has won > 1 tender). Read-only roll-up."
  })
  @ApiResponse({ status: 200, description: "List of repeat-business accounts." })
  getRepeatBusinessAccounts() {
    return this.service.getRepeatBusinessAccounts();
  }
}
