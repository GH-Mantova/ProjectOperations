import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderLabelsService } from "./tender-labels.service";

class LabelOverrideDto {
  @IsString()
  key!: string;

  /** Null or blank string = delete the override (revert to the default). */
  @IsOptional()
  @IsString()
  label?: string | null;
}

class UpdateTenderingLabelsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LabelOverrideDto)
  overrides!: LabelOverrideDto[];
}

/**
 * REST controller for org-wide Tendering display-label overrides.
 *
 * `GET /tenders/labels` is available to any authenticated user (the label
 * map is needed to render Tendering pages). `PUT /tenders/labels` requires
 * `tenders.manage` — it never changes DB keys, enum values, routes or
 * permission codes, only the display text rendered for known keys.
 */
@ApiTags("Tendering Labels")
@ApiBearerAuth()
@Controller("tenders/labels")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderLabelsController {
  constructor(private readonly service: TenderLabelsService) {}

  @Get()
  @ApiOperation({ summary: "Get the merged Tendering label map (defaults + overrides)" })
  @ApiResponse({ status: 200, description: "Full label map keyed by canonical label key." })
  list() {
    return this.service.list();
  }

  @Put()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Upsert / reset one or more Tendering label overrides" })
  @ApiResponse({ status: 200, description: "Full label map after the change." })
  update(@Body() dto: UpdateTenderingLabelsDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateMany(
      dto.overrides.map((o) => ({ key: o.key, label: o.label ?? null })),
      actor.sub
    );
  }
}
