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
  ApiBody,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength
} from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import {
  LEAVE_REQUEST_TYPES,
  LeaveRequestService,
  LeaveRequestTypeValue
} from "./leave-request.service";

// ── Request DTOs ─────────────────────────────────────────────────────────────

class SubmitLeaveRequestBody {
  @ApiProperty({ description: "WorkerProfile id of the worker requesting leave." })
  @IsString()
  workerId!: string;

  @ApiProperty({ enum: LEAVE_REQUEST_TYPES })
  @IsIn(LEAVE_REQUEST_TYPES as readonly string[])
  type!: LeaveRequestTypeValue;

  @ApiProperty({ description: "Inclusive start date (ISO)." })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: "Inclusive end date (ISO); must be >= startDate." })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: "Hours for partial-day requests." })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  hours?: number;

  @ApiPropertyOptional({ description: "Reason / notes from the worker." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

class DecideLeaveRequestBody {
  @ApiProperty({ enum: ["APPROVED", "REJECTED"] })
  @IsEnum(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @ApiPropertyOptional({ description: "Optional notes from the manager." })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

/**
 * HR self-service leave request endpoints.
 *
 * GET  /workers/leave-requests              — list (self or all if workers.manage)
 * GET  /workers/leave-requests/pending      — PENDING requests for manager's reports
 * GET  /workers/leave-requests/org-chart    — user roster with managerId for org view
 * POST /workers/leave-requests              — submit a leave request (self-serve)
 * PATCH /workers/leave-requests/:id/decide  — approve or reject (workers.manage)
 */
@ApiTags("Leave Requests")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("workers/leave-requests")
export class LeaveRequestController {
  constructor(private readonly service: LeaveRequestService) {}

  /**
   * List leave requests. Workers see their own; workers.manage sees all
   * (optionally filtered by workerId query param).
   */
  @Get()
  @ApiOperation({ summary: "List leave requests (self or all if workers.manage)." })
  @ApiResponse({ status: 200, description: "Array of leave requests." })
  @ApiQuery({ name: "workerId", required: false, type: String })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("workerId") workerId?: string
  ) {
    return this.service.list(user, workerId);
  }

  /**
   * PENDING requests for the authenticated manager's direct reports.
   * Used on the manager approvals surface.
   */
  @Get("pending")
  @RequirePermissions("workers.manage")
  @ApiOperation({ summary: "PENDING leave requests for the manager's direct reports." })
  @ApiResponse({ status: 200, description: "Array of pending leave requests." })
  pendingForManager(@CurrentUser() user: AuthenticatedUser) {
    return this.service.pendingForManager(user.sub);
  }

  /**
   * User roster with managerId for rendering an org-chart view.
   */
  @Get("org-chart")
  @RequirePermissions("workers.manage")
  @ApiOperation({ summary: "Active users with managerId for org-chart rendering." })
  @ApiResponse({ status: 200, description: "Array of user nodes." })
  orgChart() {
    return this.service.orgChart();
  }

  /**
   * Submit a leave request. The actor must own the WorkerProfile (via
   * User.internalUserId link) or be a super-user.
   */
  @Post()
  @ApiOperation({ summary: "Submit a leave request (self-serve; super-users may submit for any worker)." })
  @ApiResponse({ status: 201, description: "Created leave request (status PENDING)." })
  @ApiBody({ type: SubmitLeaveRequestBody })
  submit(@Body() dto: SubmitLeaveRequestBody, @CurrentUser() user: AuthenticatedUser) {
    return this.service.submit(dto, user);
  }

  /**
   * Approve or reject a leave request. Requires workers.manage.
   * On APPROVED, a WorkerLeave row is written so the scheduler sees it.
   * Self-approval is blocked server-side.
   */
  @Patch(":id/decide")
  @RequirePermissions("workers.manage")
  @ApiOperation({ summary: "Approve or reject a leave request (workers.manage). Creates WorkerLeave on APPROVED." })
  @ApiResponse({ status: 200, description: "Updated leave request." })
  @ApiResponse({ status: 400, description: "Already decided or invalid input." })
  @ApiResponse({ status: 403, description: "Self-approval or authority ceiling exceeded." })
  @ApiResponse({ status: 404, description: "Leave request not found." })
  @ApiBody({ type: DecideLeaveRequestBody })
  decide(
    @Param("id") id: string,
    @Body() dto: DecideLeaveRequestBody,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.decide(id, dto, user);
  }
}
