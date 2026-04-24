import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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
}

class UpdateClarificationDto {
  @IsOptional() @IsString() @IsIn(["sent", "received"]) direction?: "sent" | "received";
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @IsIn(NOTE_TYPES as unknown as string[]) noteType?: string;
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
  @ApiResponse({ status: 200, description: "Clarification notes with author metadata." })
  list(@Param("tenderId") tenderId: string) {
    return this.service.list(tenderId);
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
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Delete a clarification note from a tender." })
  remove(@Param("tenderId") tenderId: string, @Param("id") id: string) {
    return this.service.remove(tenderId, id);
  }
}
