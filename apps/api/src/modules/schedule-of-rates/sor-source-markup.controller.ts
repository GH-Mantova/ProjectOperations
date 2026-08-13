import {
  Body,
  Controller,
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
import { IsEnum, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";
import { Prisma, SorRateSourceType } from "@prisma/client";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { SorSourceMarkupService } from "./sor-source-markup.service";

class SetMarkupDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  markupPct?: number | null;
}

class LinkInternalDto {
  @IsString() rateRowId!: string;
}

class LinkVendorDto {
  @IsString() subRateId!: string;
  @IsEnum(SorRateSourceType)
  @IsIn([SorRateSourceType.SUBBIE, SorRateSourceType.SUPPLIER])
  sourceType!: "SUBBIE" | "SUPPLIER";
}

class SetCategoryMarkupsDto {
  /**
   * Object keyed by SorCategory string (LABOUR / PLANT / WASTE / SUBCONTRACTOR)
   * with numeric percentages, e.g. `{ "LABOUR": 15, "PLANT": 10 }`.
   * Values pass through {@link SorSourceMarkupService.parsePeriodMarkups}
   * before being stored, so unknown keys / non-numeric values are dropped.
   */
  @IsOptional()
  categoryMarkups?: Record<string, number> | null;
}

@ApiTags("Schedule of Rates")
@ApiBearerAuth()
@Controller("schedule-of-rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SorSourceMarkupController {
  constructor(
    private readonly service: SorSourceMarkupService,
    private readonly prisma: PrismaService,
  ) {}

  /** Set (or clear) the per-line markup % override. Pass `null` to reset to the category default. */
  @Patch("rates/:id/markup")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Set or clear a SoR line's markup % override." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Markup updated." })
  @ApiResponse({ status: 404, description: "Rate not found." })
  async setMarkup(@Param("id") rateId: string, @Body() dto: SetMarkupDto) {
    return this.prisma.sorRate.update({
      where: { id: rateId },
      data: {
        markupPct:
          dto.markupPct == null
            ? null
            : (dto.markupPct as unknown as number),
      },
    });
  }

  /** Link a SoR line to an internal RateRow (rate hub). */
  @Post("rates/:id/link-internal")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Link a SoR line to an internal RateRow." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Linked." })
  linkInternal(
    @Param("id") rateId: string,
    @Body() dto: LinkInternalDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.linkInternalRate(rateId, dto.rateRowId, actor.sub);
  }

  /** Link a SoR line to a vendor SubcontractorRate (SUBBIE or SUPPLIER). */
  @Post("rates/:id/link-vendor")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Link a SoR line to a vendor SubcontractorRate." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Linked." })
  linkVendor(
    @Param("id") rateId: string,
    @Body() dto: LinkVendorDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.linkVendorRate(
      rateId,
      dto.subRateId,
      dto.sourceType,
      actor.sub,
    );
  }

  /** Promote a MANUAL line into the internal rate hub (creates a RateRow + links). */
  @Post("rates/:id/promote-to-hub")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Promote a MANUAL SoR line into the rate hub." })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Promoted." })
  promote(
    @Param("id") rateId: string,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.promoteToHub(rateId, actor.sub);
  }

  /** Replace the period's default category markups map. */
  @Patch("periods/:id/category-markups")
  @RequirePermissions("rates.manage")
  @ApiOperation({ summary: "Set the period's default category markups map." })
  @ApiParam({ name: "id", description: "SorPeriod id" })
  @ApiResponse({ status: 200, description: "Category markups updated." })
  async setCategoryMarkups(
    @Param("id") periodId: string,
    @Body() dto: SetCategoryMarkupsDto,
  ) {
    const cleaned = this.service.parsePeriodMarkups(
      (dto.categoryMarkups ?? null) as never,
    );
    return this.prisma.sorPeriod.update({
      where: { id: periodId },
      data: {
        categoryMarkups: Object.keys(cleaned).length
          ? (cleaned as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }
}
