import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { RegisterSearchEntryDto } from "./dto/register-search-entry.dto";
import { SearchService } from "./search.service";

@ApiTags("Search")
@ApiBearerAuth()
@Controller("search")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @RequirePermissions("search.view")
  @ApiOperation({ summary: "Search registered platform entries" })
  @ApiResponse({ status: 200, description: "Search registered platform entries." })
  @ApiQuery({ name: "q", required: false, type: String, description: "Search term" })
  search(@Query("q") query?: string) {
    return this.searchService.search(query);
  }

  @Post("entries")
  @RequirePermissions("search.view")
  @ApiOperation({ summary: "Register a search entry for later module use" })
  @ApiResponse({ status: 201, description: "Register a search entry for later module use." })
  register(@Body() dto: RegisterSearchEntryDto) {
    return this.searchService.register(dto);
  }
}
