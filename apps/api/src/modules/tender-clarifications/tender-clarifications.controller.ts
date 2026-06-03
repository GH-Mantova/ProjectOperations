import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderClarificationsService } from "./tender-clarifications.service";

const NOTE_TYPES = ["call", "email", "meeting", "note", "response"] as const;

class CreateClarificationDto {
  @IsString() @IsIn(["sent", "received"]) direction!: "sent" | "received";
  @IsString() text!: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @IsIn(NOTE_TYPES as unknown as string[]) noteType?: string;
  @IsOptional() @IsString() clientId?: string | null;
}

class UpdateClarificationDto {
  @IsOptional() @IsString() @IsIn(["sent", "received"]) direction?: "sent" | "received";
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @IsIn(NOTE_TYPES as unknown as string[]) noteType?: string;
  @IsOptional() @IsString() clientId?: string | null;
}

@ApiTags("Tender Clarification Notes")
@ApiBearerAuth()
@Controller("tenders/:tenderId/clarification-notes")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderClarificationsController {
  constructor(private readonly service: TenderClarificationsService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "List sent/received clarification notes on a tender, newest first." })
  @ApiQuery({
    name: "clientId",
    required: false,
    type: String,
    description: "Filter notes to a single client. Omit to return all notes for the tender."
  })
  @ApiResponse({ status: 200, description: "Clarification notes with author metadata." })
  list(@Param("tenderId") tenderId: string, @Query("clientId") clientId?: string) {
    return this.service.list(tenderId, clientId);
  }

  @Post()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Log a new sent/received clarification on a tender." })
  @ApiResponse({ status: 201, description: "Created clarification note." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: CreateClarificationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(tenderId, actor.sub, dto);
  }

  @Patch(":id")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Update a clarification note (direction, text, date)." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("id") id: string,
    @Body() dto: UpdateClarificationDto
  ) {
    return this.service.update(tenderId, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a clarification note from a tender." })
  @ApiResponse({ status: 204, description: "Clarification note deleted." })
  @ApiResponse({ status: 404, description: "Clarification note not found on this tender." })
  async remove(
    @Param("tenderId") tenderId: string,
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string }
  ) {
    await this.service.remove(tenderId, id, actor.sub);
  }
}
