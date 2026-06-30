import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { PublicHolidaysService } from "./public-holidays.service";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class ListHolidaysQueryDto {
  @IsOptional() @IsString() @MaxLength(32) region?: string;
  @IsOptional() @Matches(ISO_DATE, { message: "from must be YYYY-MM-DD" }) from?: string;
  @IsOptional() @Matches(ISO_DATE, { message: "to must be YYYY-MM-DD" }) to?: string;
}

class CreateHolidayDto {
  @Matches(ISO_DATE, { message: "date must be YYYY-MM-DD" }) date!: string;
  @IsString() @MinLength(1) @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(32) region?: string;
}

@ApiTags("Public Holidays")
@ApiBearerAuth()
@Controller("public-holidays")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PublicHolidaysController {
  constructor(private readonly service: PublicHolidaysService) {}

  @Get()
  @ApiOperation({
    summary: "List public holidays for a region within an optional date window."
  })
  @ApiQuery({ name: "region", required: false, description: "Region code (default QLD)." })
  @ApiQuery({ name: "from", required: false, description: "Inclusive lower bound YYYY-MM-DD." })
  @ApiQuery({ name: "to", required: false, description: "Inclusive upper bound YYYY-MM-DD." })
  @ApiResponse({ status: 200, description: "Holidays sorted by date ascending." })
  list(@Query() query: ListHolidaysQueryDto) {
    return this.service.list({ region: query.region, from: query.from, to: query.to });
  }

  @Post()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Create a public holiday (admin)." })
  @ApiResponse({ status: 201, description: "Created public holiday row." })
  @ApiResponse({ status: 400, description: "Validation failure or duplicate (date, region)." })
  create(@Body() dto: CreateHolidayDto) {
    return this.service.create({ date: dto.date, name: dto.name, region: dto.region });
  }

  @Delete(":id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Delete a public holiday (admin)." })
  @ApiResponse({ status: 200, description: "Deleted." })
  @ApiResponse({ status: 404, description: "Holiday not found." })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
