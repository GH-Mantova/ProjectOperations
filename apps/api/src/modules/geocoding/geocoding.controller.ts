import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { GeocodingService } from "./geocoding.service";
import { SiteResolverService } from "./site-resolver.service";

class ResolveSiteDto {
  @IsOptional() @IsString() formatted?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() addressLine1?: string;
  @IsOptional() @IsString() suburb?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postcode?: string;
  @IsOptional() @IsString() clientId?: string;
}

@ApiTags("Geocoding")
@ApiBearerAuth()
@Controller("geo")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GeocodingController {
  constructor(
    private readonly geocoding: GeocodingService,
    private readonly siteResolver: SiteResolverService
  ) {}

  // Tender/site-address entry needs autocomplete for any authenticated user
  // who can view master-data (tenderers, estimators). The API key stays
  // server-side; the browser only ever sees the trimmed suggestion list.
  @Get("autocomplete")
  @RequirePermissions("masterdata.view")
  @ApiOperation({
    summary:
      "Proxy Geoapify address autocomplete. Reads the API key server-side. Returns { configured, results }."
  })
  @ApiResponse({ status: 200, description: "GeoAutocompleteResult" })
  autocomplete(@Query("text") text: string) {
    return this.geocoding.autocomplete(text ?? "");
  }

  // Find-or-create the Site for a chosen suggestion. Only fires on an explicit
  // pick from the client — never on keystroke — so the DB does not accumulate
  // partial addresses.
  @Post("sites/resolve")
  @RequirePermissions("masterdata.manage")
  @ApiOperation({
    summary:
      "Find-or-create a Site matching the given address parts. Matches on normalised address, returns { site, created }."
  })
  @ApiResponse({ status: 201, description: "ResolveSiteResult" })
  resolveSite(@Body() dto: ResolveSiteDto) {
    return this.siteResolver.findOrCreate(dto);
  }
}
