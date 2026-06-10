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
import { Type } from "class-transformer";
import { IsArray, IsInt, IsOptional, IsString, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SafetyService } from "./safety.service";

class ListIncidentsQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class ListHazardsQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() riskLevel?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

class CreateIncidentDto {
  @IsString() incidentDate!: string;
  @IsString() location!: string;
  @IsString() incidentType!: string;
  @IsString() severity!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() tenderId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() immediateAction?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) witnesses?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) documentPaths?: string[];
}

class UpdateIncidentDto {
  @IsOptional() @IsString() incidentDate?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() incidentType?: string;
  @IsOptional() @IsString() severity?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() tenderId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() immediateAction?: string | null;
  @IsOptional() @IsString() rootCause?: string | null;
  @IsOptional() @IsString() corrective?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) witnesses?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) documentPaths?: string[];
}

class CreateHazardDto {
  @IsString() observationDate!: string;
  @IsString() location!: string;
  @IsString() hazardType!: string;
  @IsString() riskLevel!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() tenderId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() immediateAction?: string | null;
  @IsOptional() @IsString() assignedToId?: string | null;
  @IsOptional() @IsString() dueDate?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) documentPaths?: string[];
}

class UpdateHazardDto {
  @IsOptional() @IsString() observationDate?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() hazardType?: string;
  @IsOptional() @IsString() riskLevel?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() tenderId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsOptional() @IsString() immediateAction?: string | null;
  @IsOptional() @IsString() assignedToId?: string | null;
  @IsOptional() @IsString() dueDate?: string | null;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) documentPaths?: string[];
}

/**
 * HTTP surface for the safety module — incident reports and hazard
 * observations (Forms & Compliance).
 *
 * All routes are JWT-guarded and permission-gated: `safety.view` for reads
 * and dashboard, `safety.manage` for create/patch, `safety.admin` for the
 * audited close flows. The controller is a thin pass-through to
 * {@link SafetyService}; auto-numbering (`IS-INC###` / `IS-HAZ###`),
 * notification fan-out, and witness/documentPaths array semantics live in
 * the service layer.
 */
@ApiTags("Safety")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("safety")
export class SafetyController {
  constructor(private readonly service: SafetyService) {}

  /**
   * Open incidents/hazards counts + 5 most-recent of each.
   *
   * Requires `safety.view`.
   *
   * @returns the dashboard summary from {@link SafetyService.dashboard}.
   */
  @Get("dashboard")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Open incidents/hazards counts + 5 most-recent of each." })
  @ApiResponse({ status: 200, description: "Safety dashboard summary." })
  dashboard() {
    return this.service.dashboard();
  }

  // Incidents
  /**
   * List safety incidents with optional filters and pagination.
   *
   * Requires `safety.view`. See {@link SafetyService.listIncidents} for
   * filter semantics and page-size clamping.
   *
   * @param q - `status` / `severity` / `type` / `page` / `limit` query.
   * @returns paginated `{ items, total, page, pageSize }`.
   */
  @Get("incidents")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "List safety incidents with optional filters and pagination." })
  @ApiResponse({ status: 200, description: "Paginated incidents list." })
  listIncidents(@Query() q: ListIncidentsQuery) {
    return this.service.listIncidents(q);
  }

  /**
   * Fetch a single incident by id.
   *
   * Requires `safety.view`.
   *
   * @param id - incident UUID.
   * @returns the incident with reporter/closer/tender/project relations.
   * @throws NotFoundException — when the incident is missing.
   */
  @Get("incidents/:id")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Get a safety incident by ID." })
  @ApiResponse({ status: 200, description: "Incident record." })
  @ApiResponse({ status: 404, description: "Incident not found." })
  getIncident(@Param("id") id: string) {
    return this.service.getIncident(id);
  }

  /**
   * Create a new safety incident.
   *
   * Requires `safety.manage`. The current JWT subject becomes
   * `reportedById` (mandatory). The service auto-issues an `IS-INC###`
   * number, persists `witnesses` / `documentPaths` arrays, and
   * fires-and-forgets notification + (critical-only) email fan-out.
   *
   * @param dto - incident payload.
   * @param actor - JWT principal; `actor.sub` is recorded as reporter.
   * @returns the created incident row.
   */
  @Post("incidents")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Create a safety incident report." })
  @ApiResponse({ status: 201, description: "Incident created." })
  createIncident(@Body() dto: CreateIncidentDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createIncident(dto as never, actor.sub);
  }

  /**
   * Partially update an incident.
   *
   * Requires `safety.manage`. `witnesses` and `documentPaths` fully
   * replace existing arrays. Setting `status: "closed"` here does NOT
   * record `closedAt` / `closedById` — use the dedicated close endpoint.
   *
   * @param id - incident UUID.
   * @param dto - partial payload.
   * @returns the updated incident row.
   * @throws NotFoundException — when the incident is missing.
   */
  @Patch("incidents/:id")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Partially update a safety incident." })
  @ApiResponse({ status: 200, description: "Updated incident." })
  @ApiResponse({ status: 404, description: "Incident not found." })
  patchIncident(@Param("id") id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.updateIncident(id, dto as never);
  }

  /**
   * Close an incident (audited).
   *
   * Requires `safety.admin`. Stamps `closedAt` to now and records the
   * current JWT subject as `closedById`.
   *
   * @param id - incident UUID.
   * @param actor - JWT principal; `actor.sub` is recorded as closer.
   * @returns the updated incident row.
   * @throws NotFoundException — when the incident is missing.
   */
  @Post("incidents/:id/close")
  @RequirePermissions("safety.admin")
  @ApiOperation({ summary: "Close a safety incident (stamps closedAt and closedById)." })
  @ApiResponse({ status: 200, description: "Incident closed." })
  @ApiResponse({ status: 404, description: "Incident not found." })
  closeIncident(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.closeIncident(id, actor.sub);
  }

  // Hazards
  /**
   * List hazard observations with optional filters and pagination.
   *
   * Requires `safety.view`. See {@link SafetyService.listHazards} for
   * filter semantics and page-size clamping.
   *
   * @param q - `status` / `riskLevel` / `type` / `page` / `limit` query.
   * @returns paginated `{ items, total, page, pageSize }`.
   */
  @Get("hazards")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "List hazard observations with optional filters and pagination." })
  @ApiResponse({ status: 200, description: "Paginated hazards list." })
  listHazards(@Query() q: ListHazardsQuery) {
    return this.service.listHazards(q);
  }

  /**
   * Fetch a single hazard observation by id.
   *
   * Requires `safety.view`.
   *
   * @param id - hazard UUID.
   * @returns the hazard with reporter/assignee/tender/project relations.
   * @throws NotFoundException — when the hazard is missing.
   */
  @Get("hazards/:id")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Get a hazard observation by ID." })
  @ApiResponse({ status: 200, description: "Hazard record." })
  @ApiResponse({ status: 404, description: "Hazard not found." })
  getHazard(@Param("id") id: string) {
    return this.service.getHazard(id);
  }

  /**
   * Create a new hazard observation.
   *
   * Requires `safety.manage`. The current JWT subject becomes
   * `reportedById` (mandatory). The service auto-issues an `IS-HAZ###`
   * number, persists the `documentPaths` array, and fires-and-forgets a
   * notification fan-out to safety admins plus the assignee.
   *
   * @param dto - hazard payload.
   * @param actor - JWT principal; `actor.sub` is recorded as reporter.
   * @returns the created hazard row.
   */
  @Post("hazards")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Create a hazard observation." })
  @ApiResponse({ status: 201, description: "Hazard created." })
  createHazard(@Body() dto: CreateHazardDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createHazard(dto as never, actor.sub);
  }

  /**
   * Partially update a hazard observation.
   *
   * Requires `safety.manage`. `documentPaths` fully replaces the existing
   * array. `dueDate` accepts an explicit `null` to clear it. Setting
   * `status: "closed"` here does NOT stamp `closedAt` — use the dedicated
   * close endpoint.
   *
   * @param id - hazard UUID.
   * @param dto - partial payload.
   * @returns the updated hazard row.
   * @throws NotFoundException — when the hazard is missing.
   */
  @Patch("hazards/:id")
  @RequirePermissions("safety.manage")
  @ApiOperation({ summary: "Partially update a hazard observation." })
  @ApiResponse({ status: 200, description: "Updated hazard." })
  @ApiResponse({ status: 404, description: "Hazard not found." })
  patchHazard(@Param("id") id: string, @Body() dto: UpdateHazardDto) {
    return this.service.updateHazard(id, dto as never);
  }

  /**
   * Close a hazard observation (audited).
   *
   * Requires `safety.admin`. Stamps `closedAt` to now. Unlike incidents,
   * hazards do not record a `closedBy` user.
   *
   * @param id - hazard UUID.
   * @returns the updated hazard row.
   * @throws NotFoundException — when the hazard is missing.
   */
  @Post("hazards/:id/close")
  @RequirePermissions("safety.admin")
  @ApiOperation({ summary: "Close a hazard observation (stamps closedAt)." })
  @ApiResponse({ status: 200, description: "Hazard closed." })
  @ApiResponse({ status: 404, description: "Hazard not found." })
  closeHazard(@Param("id") id: string) {
    return this.service.closeHazard(id);
  }
}
