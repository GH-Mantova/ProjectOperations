import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
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

  // D365-parity global relevance search. No RequirePermissions on the route
  // itself — the service filters per-entity by the caller's permissions so a
  // user with e.g. only jobs.view still gets Job results but nothing else.
  @Get("relevance")
  @ApiOperation({ summary: "Global relevance search across live platform entities" })
  @ApiResponse({ status: 200, description: "Typed results from tenders, jobs, clients, contacts, contracts, assets." })
  @ApiQuery({ name: "q", required: true, type: String, description: "Search term (min 2 chars)" })
  searchRelevance(@Query("q") query: string, @CurrentUser() user: AuthenticatedUser) {
    return this.searchService.searchRelevance(query ?? "", user?.permissions ?? []);
  }

  @Post("entries")
  @RequirePermissions("search.view")
  @ApiOperation({ summary: "Register a search entry for later module use" })
  @ApiResponse({ status: 201, description: "Register a search entry for later module use." })
  register(@Body() dto: RegisterSearchEntryDto) {
    return this.searchService.register(dto);
  }
}
