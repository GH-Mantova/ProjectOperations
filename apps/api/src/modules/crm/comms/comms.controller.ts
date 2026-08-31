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
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString
} from "class-validator";
import { CurrentUser } from "../../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import { COMM_ENTITY_TYPES, CommsService } from "./comms.service";

const TASK_STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

// ── DTOs ─────────────────────────────────────────────────────────────────────

class CreateThreadDto {
  @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType!: string;
  @IsString() entityId!: string;
  @IsOptional() @IsString() subject?: string | null;
}

class ListThreadsQueryDto {
  @IsOptional() @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeArchived?: boolean;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

class PostMessageDto {
  @IsString() body!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @ArrayUnique()
  mentions?: string[];
}

class CreateTaskDto {
  @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType!: string;
  @IsString() entityId!: string;
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() threadId?: string | null;
  @IsOptional() @IsString() dueAt?: string | null;
}

class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string | null;
  @IsOptional() @IsString() assigneeId?: string | null;
  @IsOptional() @IsString() dueAt?: string | null;
  @IsOptional() @IsIn(TASK_STATUSES as unknown as string[]) status?: string;
}

class ListTasksQueryDto {
  @IsOptional() @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType?: string;
  @IsOptional() @IsString() entityId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsIn(TASK_STATUSES as unknown as string[]) status?: string;
  @IsOptional()
  @Type(() => Boolean)
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  overdueOnly?: boolean;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

/** CRM-S7/S8: Log a contact interaction on a tender or opportunity. */
class LogContactDto {
  @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType!: string;
  @IsNotEmpty() @IsString() entityId!: string;
  @IsNotEmpty() @IsString() subject!: string;
  @IsNotEmpty() @IsString() body!: string;
  /** CRM-S8: optional next-action due date (ISO string). Creates a CommTask in the same transaction. */
  @IsOptional() @IsString() nextActionAt?: string | null;
  /** CRM-S8: optional next-action note / title. Defaults to "Follow up" when nextActionAt is set but note is absent. */
  @IsOptional() @IsString() nextActionNote?: string | null;
}

/** CRM-S7: Query params for last-interaction single lookup. */
class LastInteractionQueryDto {
  @IsIn(COMM_ENTITY_TYPES as unknown as string[]) entityType!: string;
  @IsNotEmpty() @IsString() entityId!: string;
}

/** CRM-S7: Batch last-interaction request body. */
class LastInteractionBatchDto {
  @IsArray()
  @ArrayUnique()
  pairs!: Array<{ entityType: string; entityId: string }>;
}

/**
 * CRM-4: REST surface for the comms hub (internal threads + To-Do).
 *
 * Permissions:
 *   Reads   → `crm.view`
 *   Writes  → `crm.manage`
 *
 * Actor id is drawn from the JWT — the client never supplies createdById /
 * authorId on the wire, so a signed-in user can't forge activity as another
 * user via a request body.
 */
@ApiTags("CRM Comms")
@ApiBearerAuth()
@Controller("crm/comms")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommsController {
  constructor(private readonly service: CommsService) {}

  // ── Threads ────────────────────────────────────────────────────────────────

  @Get("threads")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List comm threads, optionally filtered by entity." })
  @ApiQuery({ name: "entityType", required: false, enum: COMM_ENTITY_TYPES })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "includeArchived", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of threads." })
  listThreads(@Query() query: ListThreadsQueryDto) {
    return this.service.listThreads(query as never);
  }

  @Get("threads/:id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get a thread with its messages and tasks." })
  @ApiParam({ name: "id", description: "Thread id" })
  @ApiResponse({ status: 200, description: "Thread with messages and tasks." })
  @ApiResponse({ status: 404, description: "Thread not found." })
  getThread(@Param("id") id: string) {
    return this.service.getThread(id);
  }

  @Post("threads")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a new thread anchored to an entity." })
  @ApiResponse({ status: 201, description: "Thread created." })
  createThread(
    @Body() dto: CreateThreadDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createThread({
      entityType: dto.entityType as never,
      entityId: dto.entityId,
      subject: dto.subject ?? null,
      createdById: actor.sub
    });
  }

  @Post("threads/:id/archive")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Soft-archive a thread." })
  @ApiParam({ name: "id", description: "Thread id" })
  archiveThread(@Param("id") id: string) {
    return this.service.archiveThread(id);
  }

  @Post("threads/:id/unarchive")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Restore a soft-archived thread." })
  @ApiParam({ name: "id", description: "Thread id" })
  unarchiveThread(@Param("id") id: string) {
    return this.service.unarchiveThread(id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  @Post("threads/:id/messages")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Post a message to a thread." })
  @ApiParam({ name: "id", description: "Thread id" })
  @ApiResponse({ status: 201, description: "Message posted." })
  postMessage(
    @Param("id") threadId: string,
    @Body() dto: PostMessageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.postMessage({
      threadId,
      authorId: actor.sub,
      body: dto.body,
      mentions: dto.mentions
    });
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────

  @Get("tasks")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "List comm tasks with optional filters." })
  @ApiQuery({ name: "entityType", required: false, enum: COMM_ENTITY_TYPES })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "assigneeId", required: false })
  @ApiQuery({ name: "status", required: false, enum: TASK_STATUSES })
  @ApiQuery({ name: "overdueOnly", required: false })
  @ApiResponse({ status: 200, description: "Paginated list of tasks." })
  listTasks(@Query() query: ListTasksQueryDto) {
    return this.service.listTasks(query as never);
  }

  @Get("tasks/:id")
  @RequirePermissions("crm.view")
  @ApiOperation({ summary: "Get a task by id." })
  @ApiParam({ name: "id", description: "Task id" })
  @ApiResponse({ status: 200, description: "Task found." })
  @ApiResponse({ status: 404, description: "Task not found." })
  getTask(@Param("id") id: string) {
    return this.service.getTask(id);
  }

  @Post("tasks")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Create a task against an entity (optional thread link)." })
  @ApiResponse({ status: 201, description: "Task created." })
  createTask(
    @Body() dto: CreateTaskDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createTask({
      entityType: dto.entityType as never,
      entityId: dto.entityId,
      title: dto.title,
      description: dto.description ?? null,
      assigneeId: dto.assigneeId ?? null,
      threadId: dto.threadId ?? null,
      dueAt: dto.dueAt ?? null,
      createdById: actor.sub
    });
  }

  @Patch("tasks/:id")
  @RequirePermissions("crm.manage")
  @ApiOperation({ summary: "Update a task (title/description/assignee/due/status)." })
  @ApiParam({ name: "id", description: "Task id" })
  updateTask(@Param("id") id: string, @Body() dto: UpdateTaskDto) {
    return this.service.updateTask(id, dto as never);
  }

  // ── CRM-S7: Interaction log ────────────────────────────────────────────────

  @Post("log-contact")
  @RequirePermissions("crm.manage")
  @ApiOperation({
    summary:
      "Log a contact interaction on a tender or opportunity. Creates one thread (kind=logged_contact) + one message."
  })
  @ApiResponse({ status: 201, description: "Thread and message created." })
  @ApiResponse({ status: 400, description: "Validation error." })
  logContact(
    @Body() dto: LogContactDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.logContact({
      entityType: dto.entityType as never,
      entityId: dto.entityId,
      subject: dto.subject,
      body: dto.body,
      createdById: actor.sub,
      nextActionAt: dto.nextActionAt ?? null,
      nextActionNote: dto.nextActionNote ?? null
    });
  }

  @Get("last-interaction")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary:
      "Last interaction for a tender or opportunity (max CommMessage.createdAt across logged_contact threads). Returns null when none."
  })
  @ApiQuery({ name: "entityType", required: true, enum: COMM_ENTITY_TYPES })
  @ApiQuery({ name: "entityId", required: true })
  @ApiResponse({ status: 200, description: "Last interaction or null." })
  lastInteraction(@Query() query: LastInteractionQueryDto) {
    return this.service.lastInteractionFor(
      query.entityType as never,
      query.entityId
    );
  }

  @Post("last-interaction/batch")
  @RequirePermissions("crm.view")
  @ApiOperation({
    summary:
      "Batch last-interaction lookup for the Tenders Register. POST a list of (entityType, entityId) pairs; returns an array of last-interaction results (null entries omitted — callers key by entityId)."
  })
  @ApiResponse({ status: 200, description: "Array of last-interaction results." })
  async lastInteractionBatch(@Body() dto: LastInteractionBatchDto) {
    const map = await this.service.lastInteractionBatch(
      dto.pairs as never
    );
    // Convert Map to array for JSON serialisation.
    return Array.from(map.values());
  }
}
