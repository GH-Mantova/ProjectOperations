import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MinLength
} from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { KnowledgeService } from "./knowledge.service";
import { KbArticleStatus } from "@prisma/client";

class ListKbArticlesQueryDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(KbArticleStatus) status?: KbArticleStatus;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateKbArticleDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) body!: string;
  @IsString() @MinLength(1) category!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

class UpdateKbArticleDto {
  @IsOptional() @IsString() @MinLength(1) title?: string;
  @IsOptional() @IsString() @MinLength(1) body?: string;
  @IsOptional() @IsString() @MinLength(1) category?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

/**
 * REST surface for the internal Knowledge Base / SOP library
 * (case management slice 2).
 *
 * Endpoints operate on KbArticle records — asbestos procedures, safe work
 * methods, common defect fixes, and how-tos for internal staff.
 *
 * Permissions:
 *   `knowledge.view`   — GET /kb/articles (PUBLISHED only), GET /kb/articles/:id
 *   `knowledge.manage` — all writes + full read access (DRAFT + PUBLISHED)
 *
 * The publish endpoint flips status DRAFT → PUBLISHED. Delete is hard-delete.
 */
@ApiTags("Knowledge Base")
@ApiBearerAuth()
@Controller("kb/articles")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  /** Paginated list of KB articles. Viewers see PUBLISHED only; managers see all. */
  @Get()
  @RequirePermissions("knowledge.view")
  @ApiOperation({ summary: "List KB articles (viewers: PUBLISHED only; managers: all)." })
  @ApiQuery({ name: "q", required: false, description: "Full-text search (title + body)" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "status", required: false, enum: KbArticleStatus })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Paginated KB articles." })
  list(
    @Query() query: ListKbArticlesQueryDto,
    @CurrentUser() actor: { sub: string; permissions?: string[]; isSuperUser?: boolean }
  ) {
    const includeAll =
      actor.isSuperUser === true ||
      (actor.permissions ?? []).includes("knowledge.manage");
    return this.service.list(query as never, includeAll);
  }

  /** Fetch a single KB article. Viewers cannot see DRAFT articles (404). */
  @Get(":id")
  @RequirePermissions("knowledge.view")
  @ApiOperation({ summary: "Get a KB article by id." })
  @ApiParam({ name: "id", description: "KB article id" })
  @ApiResponse({ status: 200, description: "KB article found." })
  @ApiResponse({ status: 404, description: "Not found (or draft not visible to viewer)." })
  get(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string; permissions?: string[]; isSuperUser?: boolean }
  ) {
    const includeAll =
      actor.isSuperUser === true ||
      (actor.permissions ?? []).includes("knowledge.manage");
    return this.service.get(id, includeAll);
  }

  /** Create a new KB article (defaults to DRAFT). */
  @Post()
  @RequirePermissions("knowledge.manage")
  @ApiOperation({ summary: "Create a KB article (status defaults to DRAFT)." })
  @ApiResponse({ status: 201, description: "Article created." })
  create(
    @Body() dto: CreateKbArticleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.create(dto as never, actor.sub);
  }

  /** PATCH update a KB article (title, body, category, tags). */
  @Patch(":id")
  @RequirePermissions("knowledge.manage")
  @ApiOperation({ summary: "Update a KB article." })
  @ApiParam({ name: "id", description: "KB article id" })
  @ApiResponse({ status: 200, description: "Updated article." })
  @ApiResponse({ status: 404, description: "Not found." })
  update(@Param("id") id: string, @Body() dto: UpdateKbArticleDto) {
    return this.service.update(id, dto as never);
  }

  /** Flip a DRAFT article to PUBLISHED. */
  @Post(":id/publish")
  @HttpCode(200)
  @RequirePermissions("knowledge.manage")
  @ApiOperation({ summary: "Publish a DRAFT KB article." })
  @ApiParam({ name: "id", description: "KB article id" })
  @ApiResponse({ status: 200, description: "Article published." })
  @ApiResponse({ status: 404, description: "Not found." })
  @ApiResponse({ status: 409, description: "Already published." })
  publish(@Param("id") id: string) {
    return this.service.publish(id);
  }

  /** Hard-delete a KB article. */
  @Delete(":id")
  @HttpCode(204)
  @RequirePermissions("knowledge.manage")
  @ApiOperation({ summary: "Delete a KB article." })
  @ApiParam({ name: "id", description: "KB article id" })
  @ApiResponse({ status: 204, description: "Deleted." })
  @ApiResponse({ status: 404, description: "Not found." })
  async delete(@Param("id") id: string) {
    await this.service.delete(id);
  }
}
