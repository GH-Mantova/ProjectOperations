import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Prisma } from "@prisma/client";
import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { GlobalListsService } from "./global-lists.service";

const ADMIN_PERMISSION = "platform.admin";

class CreateListDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() type?: "STATIC";
}

class CreateItemDto {
  @IsOptional() @IsString() value?: string;
  @IsString() label!: string;
  @IsOptional() metadata?: Prisma.JsonValue;
  @IsOptional() @IsInt() sortOrder?: number;
}

class UpdateItemDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() metadata?: Prisma.JsonValue;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

class ReorderEntryDto {
  @IsString() itemId!: string;
  @IsInt() sortOrder!: number;
}

class ReorderDto {
  @IsArray() @ArrayNotEmpty() @ValidateNested({ each: true }) @Type(() => ReorderEntryDto)
  order!: ReorderEntryDto[];
}

function toActor(actor: AuthenticatedUser) {
  return { id: actor.sub, isAdmin: actor.permissions.includes(ADMIN_PERMISSION) };
}

@ApiTags("Global Lists")
@ApiBearerAuth()
@Controller("lists")
@UseGuards(JwtAuthGuard)
export class GlobalListsController {
  constructor(private readonly service: GlobalListsService) {}

  @Get()
  @ApiOperation({ summary: "List all GlobalList records with type, sourceModule, and itemCount." })
  @ApiResponse({ status: 200, description: "Sorted system-first then alphabetical." })
  list() {
    return this.service.listAll();
  }

  @Get(":slug")
  @ApiOperation({
    summary:
      "Resolve a list including its items. DYNAMIC lists proxy to their sourceModule (assets, workers)."
  })
  @ApiResponse({ status: 200, description: "List metadata plus items array." })
  @ApiResponse({ status: 404, description: "List not found." })
  getBySlug(@Param("slug") slug: string) {
    return this.service.getBySlug(slug);
  }

  @Get(":slug/items")
  @ApiOperation({ summary: "Return only the items array for a list — used by dropdowns." })
  async getItems(@Param("slug") slug: string) {
    const resolved = await this.service.getBySlug(slug);
    return resolved.items;
  }

  @Post()
  @ApiOperation({ summary: "Create a new STATIC list. DYNAMIC lists are system-only." })
  @ApiResponse({ status: 201, description: "Created list." })
  @ApiResponse({ status: 409, description: "Name or slug already exists." })
  create(@Body() dto: CreateListDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.createList(actor.sub, dto);
  }

  @Post(":slug/items")
  @ApiOperation({ summary: "Add an item to a STATIC list." })
  @ApiResponse({ status: 201, description: "Created (or unarchived if value previously existed archived)." })
  @ApiResponse({ status: 409, description: "Value already exists in list (or is archived and owned by another user)." })
  createItem(@Param("slug") slug: string, @Body() dto: CreateItemDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.createItem(slug, toActor(actor), dto);
  }

  @Patch(":slug/items/:itemId")
  @ApiOperation({
    summary: "Update a list item. Creator can edit own items; admins can edit any."
  })
  @ApiResponse({ status: 403, description: "Not creator and not admin." })
  updateItem(
    @Param("slug") slug: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateItemDto,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.updateItem(slug, itemId, toActor(actor), dto);
  }

  @Delete(":slug/items/:itemId")
  @ApiOperation({
    summary:
      "Archive a list item (never hard-deleted). Archived items keep resolving on existing records but disappear from dropdowns."
  })
  archiveItem(
    @Param("slug") slug: string,
    @Param("itemId") itemId: string,
    @CurrentUser() actor: AuthenticatedUser
  ) {
    return this.service.archiveItem(slug, itemId, toActor(actor));
  }

  @Post(":slug/items/reorder")
  @ApiOperation({
    summary:
      "Bulk update sortOrder on items in a single transaction. System lists require platform.admin to reorder."
  })
  @ApiResponse({ status: 403, description: "Non-admin attempted to reorder a system list." })
  reorder(@Param("slug") slug: string, @Body() dto: ReorderDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.service.reorder(slug, toActor(actor), dto.order);
  }
}
