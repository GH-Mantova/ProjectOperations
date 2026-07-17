import {
  Body,
  Controller,
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
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString, IsBoolean } from "class-validator";
import { Type, Transform } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CasesService } from "./cases.service";

const CASE_TYPES = ["defect", "warranty", "rfi", "complaint", "other"] as const;
const CASE_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
const CASE_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

class ListCasesQueryDto {
  @IsOptional() @IsIn(CASE_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsIn(CASE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() clientId?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() projectId?: string;
  @IsOptional() @Transform(({ value }) => value === "true" || value === true) @IsBoolean() slaBreached?: boolean;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class CreateCaseDto {
  @IsOptional() @IsIn(CASE_TYPES as unknown as string[]) type?: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(CASE_PRIORITIES as unknown as string[]) priority?: string;
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsString() jobId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() assignedToId?: string | null;
  @IsOptional() @IsString() dueAt?: string | null;
}

class UpdateCaseDto {
  @IsOptional() @IsIn(CASE_TYPES as unknown as string[]) type?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsIn(CASE_STATUSES as unknown as string[]) status?: string;
  @IsOptional() @IsIn(CASE_PRIORITIES as unknown as string[]) priority?: string;
  @IsOptional() @IsString() clientId?: string | null;
  @IsOptional() @IsString() jobId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() assignedToId?: string | null;
  @IsOptional() @IsString() dueAt?: string | null;
  @IsOptional() @IsString() resolvedAt?: string | null;
  @IsOptional() @IsString() resolution?: string | null;
}

class AssignCaseDto {
  @IsOptional() @IsString() assignedToId!: string | null;
}

class CreateCommentDto {
  @IsString() body!: string;
}

/**
 * REST surface for Case management (slice 1 — PR cases-slice1).
 *
 * All read routes require `cases.view`; mutating routes (create, update,
 * assign, comment) require `cases.manage`. Status transitions are validated
 * server-side — illegal moves return 409.
 *
 * Cases cover defects, warranty items, RFIs, and complaints, and are
 * optionally linked to a Client, Job, or Project. Comments form the
 * resolution thread.
 */
@ApiTags("Cases")
@ApiBearerAuth()
@Controller("cases")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CasesController {
  constructor(private readonly service: CasesService) {}

  /** Paginated list of cases with filters for type, status, assignee, client, job, project, SLA breach. */
  @Get()
  @RequirePermissions("cases.view")
  @ApiOperation({ summary: "List cases with filters (type, status, assignee, SLA breach, etc.)" })
  @ApiQuery({ name: "type", required: false, enum: CASE_TYPES })
  @ApiQuery({ name: "status", required: false, enum: CASE_STATUSES })
  @ApiQuery({ name: "assignedToId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiQuery({ name: "jobId", required: false })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "slaBreached", required: false, type: "boolean" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of cases." })
  list(@Query() query: ListCasesQueryDto) {
    return this.service.list(query as never);
  }

  /** Fetch a single case by id, including its comment thread. */
  @Get(":id")
  @RequirePermissions("cases.view")
  @ApiOperation({ summary: "Get a case by id, including comments." })
  @ApiParam({ name: "id", description: "Case id" })
  @ApiResponse({ status: 200, description: "Case found." })
  @ApiResponse({ status: 404, description: "Case not found." })
  get(@Param("id") id: string) {
    return this.service.get(id);
  }

  /** Create a new case (status begins as 'open'). */
  @Post()
  @RequirePermissions("cases.manage")
  @ApiOperation({ summary: "Raise a new case (defect, warranty, RFI, complaint or other)." })
  @ApiResponse({ status: 201, description: "Case created." })
  create(@Body() dto: CreateCaseDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(dto as never, actor.sub);
  }

  /** PATCH update a case. Status transitions are validated; illegal moves return 409. */
  @Patch(":id")
  @RequirePermissions("cases.manage")
  @ApiOperation({ summary: "Update a case — title, description, type, status, priority, links, SLA fields." })
  @ApiParam({ name: "id", description: "Case id" })
  @ApiResponse({ status: 200, description: "Updated case." })
  @ApiResponse({ status: 404, description: "Case not found." })
  @ApiResponse({ status: 409, description: "Invalid status transition." })
  update(@Param("id") id: string, @Body() dto: UpdateCaseDto) {
    return this.service.update(id, dto as never);
  }

  /** Assign (or unassign) a case to a user. */
  @Patch(":id/assign")
  @RequirePermissions("cases.manage")
  @ApiOperation({ summary: "Assign a case to a user (set assignedToId; null to unassign)." })
  @ApiParam({ name: "id", description: "Case id" })
  @ApiResponse({ status: 200, description: "Case assigned." })
  @ApiResponse({ status: 404, description: "Case or user not found." })
  assign(@Param("id") id: string, @Body() dto: AssignCaseDto) {
    return this.service.assign(id, dto.assignedToId);
  }

  /** List all comments on a case, in chronological order. */
  @Get(":id/comments")
  @RequirePermissions("cases.view")
  @ApiOperation({ summary: "List comments on a case (chronological)." })
  @ApiParam({ name: "id", description: "Case id" })
  @ApiResponse({ status: 200, description: "List of comments." })
  @ApiResponse({ status: 404, description: "Case not found." })
  listComments(@Param("id") id: string) {
    return this.service.listComments(id);
  }

  /** Add a comment to the case thread. */
  @Post(":id/comments")
  @RequirePermissions("cases.manage")
  @ApiOperation({ summary: "Add a comment to a case." })
  @ApiParam({ name: "id", description: "Case id" })
  @ApiResponse({ status: 201, description: "Comment created." })
  @ApiResponse({ status: 404, description: "Case not found." })
  addComment(
    @Param("id") id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.addComment(id, actor.sub, dto.body);
  }
}
