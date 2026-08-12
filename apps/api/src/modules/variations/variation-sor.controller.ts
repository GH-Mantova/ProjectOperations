import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { SorCategory } from "@prisma/client";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  VARIATION_SOR_TIERS,
  VariationSorService,
  type VariationSorTier,
} from "./variation-sor.service";

// -- DTOs ----------------------------------------------------------------

class CreateVariationSorLineDto {
  @IsOptional() @IsString() snapshotRateId?: string | null;
  @IsIn(VARIATION_SOR_TIERS as unknown as string[]) tier!: VariationSorTier;
  @IsNumber() @Min(0) quantity!: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() class?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @IsEnum(SorCategory) category?: SorCategory;
  @IsOptional() @IsNumber() @Min(0) rate?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsString() sorPeriodId?: string;
}

class UpdateVariationSorLineDto {
  @IsOptional() @IsIn(VARIATION_SOR_TIERS as unknown as string[]) tier?: VariationSorTier;
  @IsOptional() @IsNumber() @Min(0) quantity?: number;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsInt() sortOrder?: number;
}

// -- Controller ----------------------------------------------------------

/**
 * SoR S6 -- Variation Contract (VC) pricing REST surface.
 *
 * Mounted at /variations/:id/sor-lines. Read = finance.view, write =
 * finance.manage (same as the underlying Variation endpoints in
 * ContractsController).
 */
@ApiTags("Variations -- SoR Pricing")
@ApiBearerAuth()
@Controller("variations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VariationSorController {
  constructor(private readonly service: VariationSorService) {}

  @Get(":id/sor-lines")
  @RequirePermissions("finance.view")
  @ApiOperation({ summary: "List priced SoR lines on a variation with the running total." })
  @ApiParam({ name: "id", description: "Variation id" })
  @ApiResponse({ status: 200, description: "Lines + total." })
  @ApiResponse({ status: 404, description: "Variation not found." })
  list(@Param("id") id: string) {
    return this.service.listLines(id);
  }

  @Post(":id/sor-lines")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Add a priced line to a variation. Freezes rate from the locked Job SoR snapshot; triggers snapshot attach on first use when sorPeriodId is provided.",
  })
  @ApiParam({ name: "id", description: "Variation id" })
  @ApiResponse({ status: 201, description: "Line created; Variation.pricedAmount recomputed." })
  @ApiResponse({ status: 400, description: "Missing job link, missing snapshot, or invalid tier/rate." })
  @ApiResponse({ status: 404, description: "Variation or snapshot rate not found." })
  create(
    @Param("id") id: string,
    @Body() dto: CreateVariationSorLineDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.createLine(id, dto, actor.sub);
  }

  @Patch(":id/sor-lines/:lineId")
  @RequirePermissions("finance.manage")
  @ApiOperation({
    summary:
      "Update a variation SoR line. Rate stays frozen at the value copied at creation; quantity/tier/notes/sortOrder are editable.",
  })
  @ApiParam({ name: "id", description: "Variation id" })
  @ApiParam({ name: "lineId", description: "Variation SoR line id" })
  @ApiResponse({ status: 200, description: "Line updated; Variation.pricedAmount recomputed." })
  @ApiResponse({ status: 404, description: "Line not found on this variation." })
  update(
    @Param("id") id: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateVariationSorLineDto,
  ) {
    return this.service.updateLine(id, lineId, dto);
  }

  @Delete(":id/sor-lines/:lineId")
  @RequirePermissions("finance.manage")
  @ApiOperation({ summary: "Delete a variation SoR line and recompute the priced amount." })
  @ApiParam({ name: "id", description: "Variation id" })
  @ApiParam({ name: "lineId", description: "Variation SoR line id" })
  @ApiResponse({ status: 200, description: "Line deleted." })
  @ApiResponse({ status: 404, description: "Line not found on this variation." })
  remove(@Param("id") id: string, @Param("lineId") lineId: string) {
    return this.service.deleteLine(id, lineId);
  }
}
