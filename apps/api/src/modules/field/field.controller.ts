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
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  CreatePreStartDto,
  CreateTimesheetDto,
  FieldListQueryDto,
  UpdatePreStartDto,
  UpdateTimesheetDto
} from "./dto/field.dto";
import { FieldService } from "./field.service";

type RequestUser = { sub: string; permissions: string[] };

function ctx(user: RequestUser) {
  return { userId: user.sub, permissions: new Set(user.permissions ?? []) };
}

@ApiTags("Field")
@ApiBearerAuth()
@Controller("field")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FieldController {
  constructor(private readonly service: FieldService) {}

  // ── Allocations + documents ───────────────────────────────────────────
  @Get("my-allocations")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary: "List active + upcoming allocations for the signed-in worker. Includes project meta, site address, scope codes, and PM contact."
  })
  myAllocations(@CurrentUser() user: RequestUser) {
    return this.service.myAllocations(ctx(user));
  }

  @Get("my-allocations/:allocationId/documents")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "List project documents visible to the allocated worker." })
  @ApiResponse({ status: 404, description: "Allocation not found or not yours." })
  documents(@Param("allocationId") allocationId: string, @CurrentUser() user: RequestUser) {
    return this.service.documentsForAllocation(allocationId, ctx(user));
  }

  // ── Pre-start checklists ──────────────────────────────────────────────
  @Get("pre-starts")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "List my pre-start checklists (paginated, newest first)." })
  listPreStarts(@Query() query: FieldListQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.listPreStarts(query, ctx(user));
  }

  @Post("pre-starts")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Create a DRAFT pre-start checklist for an allocation + date." })
  @ApiResponse({ status: 201, description: "Created DRAFT checklist." })
  @ApiResponse({ status: 409, description: "A pre-start for this job on this date already exists." })
  createPreStart(@Body() dto: CreatePreStartDto, @CurrentUser() user: RequestUser) {
    return this.service.createPreStart(dto, ctx(user));
  }

  @Get("pre-starts/:id")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Get a pre-start checklist. Workers can only read their own; field.manage can read any." })
  getPreStart(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.getPreStart(id, ctx(user));
  }

  @Patch("pre-starts/:id")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Update a DRAFT pre-start checklist." })
  @ApiResponse({ status: 400, description: "Checklist has already been submitted." })
  updatePreStart(
    @Param("id") id: string,
    @Body() dto: UpdatePreStartDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.service.updatePreStart(id, dto, ctx(user));
  }

  @Post("pre-starts/:id/submit")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary:
      "Submit a DRAFT pre-start. Requires fitForWork = true and workerSignature. Writes PRESTART_SUBMITTED activity log and notifies the PM."
  })
  submitPreStart(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.submitPreStart(id, ctx(user));
  }

  // ── Timesheets ─────────────────────────────────────────────────────────
  @Get("timesheets")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "List my timesheets (paginated, newest first)." })
  listTimesheets(@Query() query: FieldListQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.listTimesheets(query, ctx(user));
  }

  @Post("timesheets")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Create a DRAFT timesheet for an allocation + date." })
  @ApiResponse({ status: 409, description: "A timesheet for this job on this date already exists." })
  createTimesheet(@Body() dto: CreateTimesheetDto, @CurrentUser() user: RequestUser) {
    return this.service.createTimesheet(dto, ctx(user));
  }

  @Patch("timesheets/:id")
  @RequirePermissions("field.view")
  @ApiOperation({ summary: "Update a DRAFT timesheet." })
  updateTimesheet(
    @Param("id") id: string,
    @Body() dto: UpdateTimesheetDto,
    @CurrentUser() user: RequestUser
  ) {
    return this.service.updateTimesheet(id, dto, ctx(user));
  }

  @Post("timesheets/:id/submit")
  @RequirePermissions("field.view")
  @ApiOperation({
    summary:
      "Submit a DRAFT timesheet. Writes TIMESHEET_SUBMITTED activity log and notifies the PM."
  })
  submitTimesheet(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.submitTimesheet(id, ctx(user));
  }

  @Post("timesheets/:id/approve")
  @RequirePermissions("field.manage")
  @ApiOperation({ summary: "Approve a submitted timesheet (PM / WHS / Admin)." })
  approveTimesheet(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.service.approveTimesheet(id, ctx(user));
  }
}
