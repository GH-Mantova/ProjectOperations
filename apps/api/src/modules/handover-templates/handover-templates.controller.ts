import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  FieldSourceName,
  FieldTypeName,
  HandoverTemplatesService
} from "./handover-templates.service";

const MANAGE = "handovertemplate.manage";

// ─── DTOs ────────────────────────────────────────────────────────────────────

class AddSectionDto {
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

class UpdateSectionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) label?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

class AddFieldDto {
  @IsString() @MinLength(1) @MaxLength(200) label!: string;
  @IsIn(["text", "money", "date", "list", "attachment", "contact"]) type!: FieldTypeName;
  @IsIn(["auto", "capture", "attach", "derived"]) sourceType!: FieldSourceName;
  @IsOptional() @IsString() autoBinding?: string;
  @IsOptional() @IsString() listId?: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

class UpdateFieldDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) label?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsString() autoBinding?: string;
  @IsOptional() @IsString() listId?: string;
}

// ─── Controller ──────────────────────────────────────────────────────────────

@ApiTags("Handover Templates")
@ApiBearerAuth()
@Controller("handover-templates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HandoverTemplatesController {
  constructor(private readonly service: HandoverTemplatesService) {}

  @Get("active")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Get the currently-published handover template (sections + non-retired fields)" })
  @ApiResponse({ status: 200, description: "Active template with sections and fields." })
  getActive() {
    return this.service.getActive();
  }

  @Get("draft")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Get the current working draft template" })
  @ApiResponse({ status: 200, description: "Draft template with sections (including retired fields)." })
  @ApiResponse({ status: 404, description: "No draft exists." })
  getDraft() {
    return this.service.getDraftOrThrow();
  }

  @Post("draft")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Create a new draft by cloning the active template" })
  @ApiResponse({ status: 201, description: "Draft created." })
  @ApiResponse({ status: 409, description: "A draft already exists." })
  createDraft() {
    return this.service.createDraftFromActive();
  }

  // ── Section endpoints ────────────────────────────────────────────────────

  @Post("draft/sections")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Add a section to the draft" })
  addSection(@Body() dto: AddSectionDto) {
    return this.service.addSection(dto);
  }

  @Patch("draft/sections/:sectionId")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Rename or reorder a draft section (key is stable)" })
  updateSection(@Param("sectionId") sectionId: string, @Body() dto: UpdateSectionDto) {
    return this.service.updateSection(sectionId, dto);
  }

  @Delete("draft/sections/:sectionId")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Remove a section from the draft (cascades to fields on this draft)" })
  removeSection(@Param("sectionId") sectionId: string) {
    return this.service.removeSection(sectionId);
  }

  // ── Field endpoints ──────────────────────────────────────────────────────

  @Post("draft/sections/:sectionId/fields")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Add a field to a draft section" })
  addField(@Param("sectionId") sectionId: string, @Body() dto: AddFieldDto) {
    return this.service.addField(sectionId, dto);
  }

  @Patch("draft/fields/:fieldId")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Update a draft field's mutable attributes (key is immutable)" })
  updateField(@Param("fieldId") fieldId: string, @Body() dto: UpdateFieldDto) {
    return this.service.updateField(fieldId, dto);
  }

  @Delete("draft/fields/:fieldId")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Retire a draft field (sets retiredAt; never hard-deletes)" })
  retireField(@Param("fieldId") fieldId: string) {
    return this.service.retireField(fieldId);
  }

  // ── Publish ──────────────────────────────────────────────────────────────

  @Post("draft/publish")
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: "Publish the current draft as a new active version" })
  @ApiResponse({ status: 201, description: "Draft published as new active version." })
  @ApiResponse({ status: 400, description: "Draft is empty." })
  @ApiResponse({ status: 404, description: "No draft exists." })
  publishDraft(@CurrentUser() actor: { sub: string }) {
    return this.service.publishDraft(actor.sub);
  }
}
