import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { AllocationsService } from "./allocations.service";
import { CreateAllocationDto } from "./dto/create-allocation.dto";
import { UpdateAllocationDto } from "./dto/update-allocation.dto";

/**
 * Authenticated principal shape extracted from the JWT — only `sub` (the user
 * id) is consumed by this controller so the type is intentionally narrow.
 */
type RequestUser = { sub: string };

/**
 * HTTP surface for the §9 Scheduler allocations module — the worker- and
 * asset-to-project wiring that drives shift rostering and equipment
 * assignment.
 *
 * Routes are nested under `projects/:projectId/allocations`, so every
 * operation is scoped to a single project and a 404 is returned both when the
 * parent project is missing AND when an allocation id resolves to a different
 * project (no cross-project leakage via guessed allocation ids).
 *
 * Permission model:
 *  - {@link list}   — `projects.view`     (read-only consumers, e.g. the
 *                                          project crew widget)
 *  - {@link create} — `resources.manage`  (allocator role)
 *  - {@link update} — `resources.manage`
 *  - {@link remove} — `resources.manage`
 *
 * Non-obvious semantics — all enforced inside {@link AllocationsService}:
 *  - For WORKER allocations, overlapping allocations on OTHER projects in
 *    `MOBILISING` or `ACTIVE` status are returned as WARNINGS, not as a 4xx —
 *    schedulers double-book intentionally on tight crews and the UI is
 *    expected to surface the conflicts.
 *  - The competency gate (Project.requiredQualifications vs WorkerQualification)
 *    is evaluated on every WORKER create and returned in the response, but it
 *    is SOFT-WARN only: the allocation is created regardless. When the worker
 *    is missing or expired on a required qual, an `AuditLog` row
 *    (`allocation.unqualified_override`) is written capturing the allocator
 *    for after-the-fact review.
 *  - `type`, `workerProfileId`, and `assetId` are immutable after create.
 *    A re-target is a delete + create, never an update.
 *  - {@link remove} is a hard delete with NO activity log entry —
 *    allocations are operational scheduling records, not audit-critical.
 *    The convert/award and status-transition events are where the audit
 *    weight sits.
 */
@ApiTags("Allocations")
@ApiBearerAuth()
@Controller("projects/:projectId/allocations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AllocationsController {
  constructor(private readonly service: AllocationsService) {}

  /**
   * List worker and asset allocations for a project, grouped by type.
   *
   * Returns a `{ workers: [], assets: [] }` shape (rather than a single flat
   * list with a `type` discriminator) because the UI renders these as two
   * separate panels and the split is more convenient at the call site.
   * Rows inside each group are ordered by `startDate` then `createdAt`.
   *
   * @throws NotFoundException when the parent project does not exist.
   */
  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List worker + asset allocations for a project, grouped." })
  @ApiResponse({ status: 200, description: "{ workers: [], assets: [] }" })
  @ApiResponse({ status: 404, description: "Project not found." })
  list(@Param("projectId") projectId: string) {
    return this.service.listForProject(projectId);
  }

  /**
   * Create a worker or asset allocation on a project.
   *
   * Behaviour delegated to {@link AllocationsService.create}:
   *  - Validates the type/target pairing: WORKER requires `workerProfileId`
   *    and rejects `assetId`; ASSET requires `assetId` and rejects
   *    `workerProfileId`. 400 on violation.
   *  - Rejects `endDate < startDate` with 400.
   *  - For WORKER allocations, finds overlapping allocations on OTHER projects
   *    in `MOBILISING`/`ACTIVE` status and returns them in `warnings`.
   *    Overlap is intentional information, never a hard block.
   *  - Writes a `ProjectActivityLog` row (`WORKER_ALLOCATED` or
   *    `ASSET_ALLOCATED`).
   *  - For WORKER allocations: fires a notification email (best-effort), and
   *    creates an in-app notification for the worker's linked internal user
   *    when one is present.
   *  - Runs the competency gate against `Project.requiredQualifications` and
   *    always returns a `competency` verdict — soft-warn only.
   *
   * @returns `{ allocation, warnings, competency }` — see schema in the
   *          ApiResponse decorator.
   * @throws BadRequestException on type/target mismatch or invalid dates.
   * @throws NotFoundException when the parent project does not exist.
   */
  @Post()
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary:
      "Create a worker or asset allocation on a project. For WORKER allocations, overlapping allocations on other active/mobilising projects are surfaced as warnings (no hard block). The competency gate is evaluated against Project.requiredQualifications and returned on every response — soft-warn only: the allocation is still created when the worker fails the gate, and an AuditLog row is written capturing the allocator."
  })
  @ApiResponse({
    status: 201,
    description:
      "{ allocation, warnings: [{ projectId, projectNumber, projectName, startDate, endDate }], competency: { allowed, missing[], expired[], expiringSoon[] } }"
  })
  @ApiResponse({
    status: 400,
    description: "Type/target mismatch (WORKER requires workerProfileId, ASSET requires assetId)."
  })
  @ApiResponse({ status: 404, description: "Project not found." })
  create(
    @Param("projectId") projectId: string,
    @Body() dto: CreateAllocationDto,
    @CurrentUser() actor: RequestUser
  ) {
    return this.service.create(projectId, dto, { userId: actor.sub });
  }

  /**
   * Update a mutable subset of an allocation: `roleOnProject`, `startDate`,
   * `endDate`, `notes`. `type`, `workerProfileId`, and `assetId` are
   * immutable — a re-target is a delete + create, not an update, so the
   * activity-log lineage stays clean.
   *
   * Date validation re-runs against the effective dates (the incoming value
   * if provided, else the stored value) so a partial PATCH can never invert
   * the allocation window.
   *
   * @throws NotFoundException when the allocation id does not belong to the
   *         project in the URL (defends against cross-project id-guessing).
   * @throws BadRequestException when the resulting `endDate < startDate`.
   */
  @Patch(":allocId")
  @RequirePermissions("resources.manage")
  @ApiOperation({ summary: "Update role/dates/notes. type, workerProfileId, and assetId are immutable." })
  @ApiResponse({ status: 200, description: "Updated allocation." })
  @ApiResponse({ status: 404, description: "Allocation not found for this project." })
  update(
    @Param("projectId") projectId: string,
    @Param("allocId") allocId: string,
    @Body() dto: UpdateAllocationDto
  ) {
    return this.service.update(projectId, allocId, dto);
  }

  /**
   * Hard-delete an allocation. Operational record, not audit-critical, so no
   * `ProjectActivityLog` entry is written — the create/update events provide
   * sufficient lineage.
   *
   * @throws NotFoundException when the allocation id does not belong to the
   *         project in the URL.
   */
  @Delete(":allocId")
  @RequirePermissions("resources.manage")
  @ApiOperation({
    summary: "Hard delete an allocation — operational record, not audit-critical. No activity log entry."
  })
  @ApiResponse({ status: 200, description: "{ deleted: true }" })
  @ApiResponse({ status: 404, description: "Allocation not found for this project." })
  remove(@Param("projectId") projectId: string, @Param("allocId") allocId: string) {
    return this.service.remove(projectId, allocId);
  }
}
