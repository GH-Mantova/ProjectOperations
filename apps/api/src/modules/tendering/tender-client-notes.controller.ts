import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderClientNotesService } from "./tender-client-notes.service";

class CreateTenderClientNoteDto {
  @IsOptional()
  @IsIn(["note", "call", "email", "meeting", "site_visit"])
  noteType?: string;

  @IsOptional() @IsString() subject?: string;

  @IsString()
  body!: string;

  @IsOptional() @IsDateString() occurredAt?: string;
}

/**
 * REST controller for per-client interaction notes on a tender, under
 * /tenders/:tenderId/clients/:clientId/notes.
 *
 * JWT + permission gated: reads need `tenders.view`, writes need
 * `tenders.manage`. The client must be linked to the tender via
 * TenderClient or every route 404s.
 */
@ApiTags("Tender Client Notes")
@ApiBearerAuth()
@Controller("tenders/:tenderId/clients/:clientId/notes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderClientNotesController {
  constructor(private readonly service: TenderClientNotesService) {}

  /**
   * List per-client notes on this tender (newest first).
   *
   * @returns notes array with createdBy metadata, ordered by occurredAt desc
   */
  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List per-client notes on this tender (newest first)" })
  @ApiResponse({ status: 200, description: "Notes array with createdBy metadata." })
  list(@Param("tenderId") tenderId: string, @Param("clientId") clientId: string) {
    return this.service.list(tenderId, clientId);
  }

  /**
   * Log a per-client interaction (note, call, email, meeting, site visit).
   *
   * @param dto - body (required), optional noteType (defaults to "note"), subject, occurredAt (defaults to now)
   * @returns the created note with createdBy metadata
   */
  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Log a per-client interaction (note, call, email, meeting, site visit)" })
  @ApiResponse({ status: 201, description: "Created note." })
  create(
    @Param("tenderId") tenderId: string,
    @Param("clientId") clientId: string,
    @Body() dto: CreateTenderClientNoteDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(tenderId, clientId, dto, actor.sub);
  }

  /**
   * Delete a per-client note (hard delete).
   *
   * @param noteId - note id (must belong to this tender + client pair)
   * @returns { id } of the deleted note
   */
  @Delete(":noteId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a per-client note" })
  @ApiResponse({ status: 200, description: "Deleted." })
  remove(
    @Param("tenderId") tenderId: string,
    @Param("clientId") clientId: string,
    @Param("noteId") noteId: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.remove(tenderId, clientId, noteId, actor.sub);
  }
}
