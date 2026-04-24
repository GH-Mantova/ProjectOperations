import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ScopeWasteService } from "./scope-waste.service";

const DISCIPLINES = ["SO", "Str", "Asb", "Civ", "Prv"] as const;

class UpsertWasteDto {
  @IsOptional() @IsIn(DISCIPLINES as unknown as string[]) discipline?: string;
  @IsOptional() @IsString() wbsRef?: string | null;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() wasteGroup?: string | null;
  @IsOptional() @IsString() wasteType?: string | null;
  @IsOptional() @IsString() wasteFacility?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() wasteTonnes?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() wasteLoads?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ratePerTonne?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() ratePerLoad?: number | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
}

class ReorderEntryDto {
  @IsString() itemId!: string;
  @Type(() => Number) @IsInt() @Min(0) sortOrder!: number;
}

class ReorderDto {
  @IsArray() order!: ReorderEntryDto[];
}

@ApiTags("Scope of Works — Waste")
@ApiBearerAuth()
@Controller("tenders/:tenderId/scope/waste")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScopeWasteController {
  constructor(private readonly service: ScopeWasteService) {}

  @Get()
  @RequirePermissions("estimates.view")
  @ApiOperation({ summary: "List waste disposal rows on the tender (optionally filtered by discipline)." })
  list(@Param("tenderId") tenderId: string, @Query("discipline") discipline?: string) {
    return this.service.list(tenderId, discipline);
  }

  @Post()
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Create a waste row. truckDays + lineTotal are derived server-side." })
  create(
    @Param("tenderId") tenderId: string,
    @Body() dto: UpsertWasteDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(tenderId, actor.sub, dto);
  }

  @Patch(":itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Partial update of a waste row. Re-derives truckDays + lineTotal." })
  update(
    @Param("tenderId") tenderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpsertWasteDto
  ) {
    return this.service.update(tenderId, itemId, dto);
  }

  @Delete(":itemId")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Delete a waste row." })
  remove(@Param("tenderId") tenderId: string, @Param("itemId") itemId: string) {
    return this.service.remove(tenderId, itemId);
  }

  @Post("reorder")
  @RequirePermissions("estimates.manage")
  @ApiOperation({ summary: "Bulk update sortOrder across multiple waste rows." })
  reorder(@Param("tenderId") tenderId: string, @Body() dto: ReorderDto) {
    return this.service.reorder(tenderId, dto.order);
  }
}
