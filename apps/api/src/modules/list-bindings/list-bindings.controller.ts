import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CreateListBindingDto,
  ListBindingConsumerTypeDto,
  UpdateListBindingDto
} from "./dto/list-binding.dto";
import { ListBindingsService } from "./list-bindings.service";

const PLATFORM_ADMIN = "platform.admin";

@ApiTags("List Bindings")
@ApiBearerAuth()
@Controller("list-bindings")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ListBindingsController {
  constructor(private readonly service: ListBindingsService) {}

  @Get()
  @RequirePermissions("lists.manage")
  @ApiOperation({ summary: "List bindings, optionally filtered by listId or consumerType." })
  @ApiQuery({ name: "listId", required: false })
  @ApiQuery({ name: "consumerType", required: false, enum: ListBindingConsumerTypeDto })
  @ApiResponse({ status: 200, description: "ListBinding[]." })
  list(
    @Query("listId") listId?: string,
    @Query("consumerType") consumerType?: ListBindingConsumerTypeDto
  ) {
    return this.service.list({ listId, consumerType });
  }

  @Get("where-used/:listId")
  @RequirePermissions("lists.manage")
  @ApiOperation({ summary: "Where-used report for a list — the 'Linked to' tab data." })
  @ApiResponse({ status: 200, description: "{ listId, listSlug, count, bindings[] }" })
  @ApiResponse({ status: 404, description: "List not found." })
  whereUsed(@Param("listId") listId: string) {
    return this.service.whereUsed(listId);
  }

  @Post()
  @RequirePermissions("lists.manage")
  @ApiOperation({ summary: "Create a list binding." })
  @ApiResponse({ status: 201, description: "Created ListBinding." })
  @ApiResponse({ status: 409, description: "Binding already exists." })
  create(@Body() dto: CreateListBindingDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @RequirePermissions("lists.manage")
  @ApiOperation({ summary: "Update a binding's label." })
  @ApiResponse({ status: 200, description: "Updated ListBinding." })
  update(@Param("id") id: string, @Body() dto: UpdateListBindingDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @RequirePermissions("lists.manage")
  @ApiOperation({
    summary:
      "Delete a binding. Restricted to platform admins pending the authority seam (TODO: move behind seam)."
  })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 403, description: "Non-admin attempted binding delete." })
  remove(@Param("id") id: string, @CurrentUser() actor: AuthenticatedUser) {
    if (!actor.permissions.includes(PLATFORM_ADMIN)) {
      throw new ForbiddenException("Binding delete is restricted to platform admins.");
    }
    return this.service.remove(id, actor.sub);
  }
}
