import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsBoolean,
  IsDecimal,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString
} from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { MapLocationsService, type MapLocationKind } from "./map-locations.service";

const MAP_LOCATION_PERMISSION = "masterdata.manage";

class CreateMapLocationDto {
  @IsString() name!: string;
  @IsEnum(["TIP", "POI"]) kind!: MapLocationKind;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsString() addressLine1!: string;
  @IsString() suburb!: string;
  @IsString() state!: string;
  @IsString() postcode!: string;
  @IsOptional() @IsNumber() latitude?: number | null;
  @IsOptional() @IsNumber() longitude?: number | null;
  @IsOptional() @IsString() facility?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class UpdateMapLocationDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(["TIP", "POI"]) kind?: MapLocationKind;
  @IsOptional() @IsString() categoryId?: string | null;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() suburb?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsNumber() latitude?: number | null;
  @IsOptional() @IsNumber() longitude?: number | null;
  @IsOptional() @IsString() facility?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

@ApiTags("Map Locations")
@ApiBearerAuth()
@Controller("map-locations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MapLocationsController {
  constructor(private readonly service: MapLocationsService) {}

  @Get()
  @ApiOperation({ summary: "List active map locations. Filter by ?kind=TIP|POI. TIPs include ratesStatus." })
  @ApiQuery({ name: "kind", required: false, enum: ["TIP", "POI"] })
  @ApiResponse({ status: 200, description: "Array of map locations." })
  list(@Query("kind") kind?: string) {
    const kindFilter = kind === "TIP" || kind === "POI" ? kind : undefined;
    return this.service.list(kindFilter);
  }

  @Get("orphan-facilities")
  @ApiOperation({
    summary:
      "Return DISTINCT EstimateWasteRate.facility values with no matching MapLocation. Used by the Tip-from-waste-rates dropdown."
  })
  @ApiResponse({ status: 200, description: "Array of facility strings." })
  orphanFacilities() {
    return this.service.orphanFacilities();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single map location by ID." })
  @ApiResponse({ status: 200, description: "Map location." })
  @ApiResponse({ status: 404, description: "Not found." })
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermissions(MAP_LOCATION_PERMISSION)
  @ApiOperation({ summary: "Create a map location. Requires masterdata.manage." })
  @ApiResponse({ status: 201, description: "Created location." })
  create(@Body() dto: CreateMapLocationDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermissions(MAP_LOCATION_PERMISSION)
  @ApiOperation({
    summary:
      "Update a map location. Requires masterdata.manage. " +
      "Rename guard: if a TIP's facility is changed and rate rows exist for the old value, returns 409."
  })
  @ApiResponse({ status: 200, description: "Updated location." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 409, description: "Facility rename blocked — rate rows reference old name." })
  update(@Param("id") id: string, @Body() dto: UpdateMapLocationDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions(MAP_LOCATION_PERMISSION)
  @ApiOperation({ summary: "Soft-delete (deactivate) a map location. Requires masterdata.manage." })
  @ApiResponse({ status: 200, description: "Deleted (deactivated)." })
  @ApiResponse({ status: 404, description: "Not found." })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
