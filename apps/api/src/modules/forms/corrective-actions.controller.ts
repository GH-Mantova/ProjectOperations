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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { CorrectiveActionsService } from "./corrective-actions.service";
import {
  CloseCorrectiveActionDto,
  CreateCorrectiveActionDto,
  ListCorrectiveActionsDto,
  UpdateCorrectiveActionDto
} from "./dto/corrective-actions.dto";

/**
 * REST endpoints for corrective-action (CAPA) management.
 *
 * Authority:
 *   - `forms.manage` — list all, create, update any, close any
 *   - `forms.view`   — list (read-only, may be scoped by assignedToId)
 */
@ApiTags("Corrective Actions")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("forms/corrective-actions")
export class CorrectiveActionsController {
  constructor(private readonly service: CorrectiveActionsService) {}

  /**
   * List corrective actions with optional filters.
   *
   * @param query - filter and pagination options
   * @returns paginated `{ items, total, page, pageSize }`
   */
  @Get()
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "List corrective actions (CAPA register) with optional status/submission/assignee filters." })
  @ApiResponse({ status: 200, description: "Paginated corrective-action list." })
  list(@Query() query: ListCorrectiveActionsDto) {
    return this.service.list(query);
  }

  /**
   * Get a single corrective action by id.
   *
   * @param id - corrective action id
   * @returns the action with assignee, closer and submission summary
   * @throws NotFoundException when the action does not exist
   */
  @Get(":id")
  @RequirePermissions("forms.view")
  @ApiOperation({ summary: "Get a single corrective action by id." })
  @ApiResponse({ status: 200, description: "Corrective action detail." })
  getOne(@Param("id") id: string) {
    return this.service.getOne(id);
  }

  /**
   * Manually create a corrective action (manager-raised, not engine-triggered).
   *
   * @param dto - action fields including optional submissionId link
   * @returns the created action
   */
  @Post()
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Manually create a corrective action against an optional submission." })
  @ApiResponse({ status: 201, description: "Created corrective action." })
  create(@Body() dto: CreateCorrectiveActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  /**
   * Update title, description, assignee, due date, priority, or advance status.
   *
   * @param id - corrective action id
   * @param dto - fields to update (partial PATCH semantics)
   * @returns the updated action
   * @throws NotFoundException when the action does not exist
   * @throws ForbiddenException when trying to reopen a closed action
   */
  @Patch(":id")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Update a corrective action (title, assignee, due date, priority, status)." })
  @ApiResponse({ status: 200, description: "Updated corrective action." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateCorrectiveActionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.update(id, dto, user.sub);
  }

  /**
   * Close out a corrective action with a mandatory note and optional evidence.
   *
   * @param id - corrective action id
   * @param dto - close-out note (required) and optional evidence path
   * @returns the closed action
   * @throws BadRequestException when the note is blank or the action is already closed
   */
  @Post(":id/close")
  @RequirePermissions("forms.manage")
  @ApiOperation({ summary: "Close out a corrective action with a mandatory note and optional evidence path." })
  @ApiResponse({ status: 201, description: "Closed corrective action." })
  close(
    @Param("id") id: string,
    @Body() dto: CloseCorrectiveActionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.close(id, dto, user.sub);
  }
}
