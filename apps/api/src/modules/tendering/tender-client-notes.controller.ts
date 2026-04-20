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

@ApiTags("Tender Client Notes")
@ApiBearerAuth()
@Controller("tenders/:tenderId/clients/:clientId/notes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderClientNotesController {
  constructor(private readonly service: TenderClientNotesService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List per-client notes on this tender (newest first)" })
  @ApiResponse({ status: 200, description: "Notes array with createdBy metadata." })
  list(@Param("tenderId") tenderId: string, @Param("clientId") clientId: string) {
    return this.service.list(tenderId, clientId);
  }

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
