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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import {
  CreateSavedViewDto,
  ListSavedViewsQueryDto,
  UpdateSavedViewDto
} from "./dto/saved-view.dto";
import { SavedViewsService, type SavedViewSort } from "./saved-views.service";

@ApiTags("SavedViews")
@ApiBearerAuth()
@Controller("saved-views")
@UseGuards(JwtAuthGuard)
export class SavedViewsController {
  constructor(private readonly service: SavedViewsService) {}

  @Get()
  @ApiOperation({ summary: "List the current user's saved views (optionally filtered by entityType)" })
  @ApiResponse({ status: 200, description: "List of saved views owned by the current user." })
  list(@CurrentUser() actor: { sub: string }, @Query() query: ListSavedViewsQueryDto) {
    return this.service.list(actor.sub, query.entityType);
  }

  @Post()
  @ApiOperation({ summary: "Create a new saved view for the current user" })
  @ApiResponse({ status: 201, description: "Created saved view." })
  create(@CurrentUser() actor: { sub: string }, @Body() dto: CreateSavedViewDto) {
    return this.service.create(actor.sub, {
      entityType: dto.entityType,
      name: dto.name,
      filters: dto.filters,
      columns: dto.columns,
      sort: dto.sort as SavedViewSort | null | undefined,
      isDefault: dto.isDefault
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a saved view by id" })
  @ApiResponse({ status: 200, description: "Saved view." })
  @ApiResponse({ status: 404, description: "Not found or not owned by current user." })
  getById(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.getById(actor.sub, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a saved view (name, filters, columns, sort, default)" })
  @ApiResponse({ status: 200, description: "Updated saved view." })
  update(
    @CurrentUser() actor: { sub: string },
    @Param("id") id: string,
    @Body() dto: UpdateSavedViewDto
  ) {
    return this.service.update(actor.sub, id, {
      name: dto.name,
      filters: dto.filters,
      columns: dto.columns,
      sort: dto.sort as SavedViewSort | null | undefined,
      isDefault: dto.isDefault
    });
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a saved view" })
  @ApiResponse({ status: 200, description: "Deleted." })
  remove(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.remove(actor.sub, id);
  }

  @Post(":id/default")
  @ApiOperation({ summary: "Mark this saved view as the default for its entityType" })
  @ApiResponse({ status: 201, description: "Saved view marked default." })
  setDefault(@CurrentUser() actor: { sub: string }, @Param("id") id: string) {
    return this.service.setDefault(actor.sub, id);
  }
}
