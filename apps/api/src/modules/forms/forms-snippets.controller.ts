import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CreateSnippetDto, SnippetsQueryDto, UpdateSnippetDto } from "./dto/forms-snippets.dto";
import { FormsSnippetsService } from "./forms-snippets.service";

/**
 * REST endpoints for the reusable content-snippet library.
 *
 * Reads require `forms.view`; writes require `forms.manage`.
 * Both are gated behind JWT + PermissionsGuard, matching the pattern
 * used by FormsController for template authoring.
 */
@ApiTags("Forms")
@ApiBearerAuth()
@Controller("forms/snippets")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FormsSnippetsController {
  constructor(private readonly service: FormsSnippetsService) {}

  /**
   * List content snippets.
   *
   * @returns paginated `{ items, total, page, pageSize }`
   */
  @Get()
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List content snippets" })
  @ApiResponse({ status: 200, description: "List content snippets." })
  listSnippets(@Query() query: SnippetsQueryDto) {
    return this.service.listSnippets(query);
  }

  /**
   * Get a single snippet by id.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  @Get(":id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get content snippet" })
  @ApiResponse({ status: 200, description: "Get content snippet." })
  getSnippet(@Param("id") id: string) {
    return this.service.getSnippet(id);
  }

  /**
   * Get a single snippet by its unique code.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  @Get("by-code/:code")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get content snippet by code" })
  @ApiResponse({ status: 200, description: "Get content snippet by code." })
  getSnippetByCode(@Param("code") code: string) {
    return this.service.getSnippetByCode(code);
  }

  /**
   * Create a new content snippet.
   *
   * @throws ConflictException when the code already exists
   */
  @Post()
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Create content snippet" })
  @ApiResponse({ status: 201, description: "Created content snippet." })
  createSnippet(@Body() dto: CreateSnippetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createSnippet(dto, actor.sub);
  }

  /**
   * Update a content snippet. Bumps the version counter.
   *
   * @throws NotFoundException when the snippet does not exist
   */
  @Patch(":id")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Update content snippet" })
  @ApiResponse({ status: 200, description: "Updated content snippet." })
  updateSnippet(@Param("id") id: string, @Body() dto: UpdateSnippetDto, @CurrentUser() actor: { sub: string }) {
    return this.service.updateSnippet(id, dto, actor.sub);
  }

  /**
   * Delete a content snippet. Blocked when live form fields reference it.
   *
   * @throws ConflictException when form fields reference this snippet
   */
  @Delete(":id")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Delete content snippet (only when not referenced by any form field)" })
  @ApiResponse({ status: 200, description: "Deleted content snippet." })
  @ApiResponse({ status: 409, description: "Snippet is referenced by form fields." })
  deleteSnippet(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.deleteSnippet(id, actor.sub);
  }
}
