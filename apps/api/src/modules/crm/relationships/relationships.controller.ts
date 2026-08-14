import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { IsOptional, IsString, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { RelationshipsService } from "./relationships.service";

// ── DTOs ──────────────────────────────────────────────────────────────────────

class ListNotesQueryDto {
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateNoteDto {
  @IsOptional() @IsString() accountId?: string | null;
  @IsOptional() @IsString() contactId?: string | null;
  @IsString() @MinLength(1) body!: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * CRM-2: REST surface for relationship notes and intelligence nudges.
 *
 * Read routes:    crm.view
 * Mutating routes: crm.manage
 *
 * Mirrors the auth-guard pattern established in accounts.controller.ts.
 */
@ApiTags("CRM Relationships")
@ApiBearerAuth()
@Controller("crm/relationships")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RelationshipsController {
  constructor(private readonly service: RelationshipsService) {}

  // ── Notes ────────────────────────────────────────────────────────────────

  @Get("notes")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List relationship notes, optionally scoped by accountId or contactId." })
  @ApiQuery({ name: "accountId", required: false })
  @ApiQuery({ name: "contactId", required: false })
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
  @ApiOperation({ summary: "Create a relationship note against an Account and/or Contact." })
  @ApiResponse({ status: 201, description: "Note created." })
  createNote(
    @Body() dto: CreateNoteDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createNote({
      accountId: dto.accountId,
      contactId: dto.contactId,
      authorId: actor.sub,
      body: dto.body
    });
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

  // ── Intelligence nudges ───────────────────────────────────────────────────

  @Get("accounts/:accountId/going-cold")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary: "Going-cold nudge for an Account.",
    description:
      "Derives a relationship-health status from the most recent lastContactedAt across the Account's contacts. " +
      "Statuses: warm (<30 days), cooling (30–59 days), cold (60+ days), never_contacted."
  })
  @ApiParam({ name: "accountId", description: "Account id" })
  @ApiResponse({ status: 200, description: "Going-cold signal." })
  @ApiResponse({ status: 404, description: "Account not found." })
  deriveGoingCold(@Param("accountId") accountId: string) {
    return this.service.deriveGoingCold(accountId);
  }

  @Get("accounts/:accountId/repeat-business")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary: "Repeat-business signal for an Account.",
    description:
      "Surfaces repeat-business signals from the Account's linked Client win/loss cache. " +
      "Read-only — never writes into transactional owners."
  })
  @ApiParam({ name: "accountId", description: "Account id" })
  @ApiResponse({ status: 200, description: "Repeat-business signal." })
  @ApiResponse({ status: 404, description: "Account not found." })
  repeatBusinessSignal(@Param("accountId") accountId: string) {
    return this.service.repeatBusinessSignal(accountId);
  }
}
