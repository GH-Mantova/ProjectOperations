import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_STATUSES,
  PilotFeedbackService,
  type FeedbackCategory,
  type FeedbackStatus
} from "./pilot-feedback.service";

class CreatePilotFeedbackDto {
  @IsString() @MaxLength(255) route!: string;
  @IsIn([...FEEDBACK_CATEGORIES]) category!: FeedbackCategory;
  @IsString() @MinLength(1) @MaxLength(4000) message!: string;
}

class UpdatePilotFeedbackStatusDto {
  @IsIn([...FEEDBACK_STATUSES]) status!: FeedbackStatus;
}

@ApiTags("Pilot Feedback")
@ApiBearerAuth()
@Controller("feedback")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PilotFeedbackController {
  constructor(private readonly service: PilotFeedbackService) {}

  @Post()
  @ApiOperation({ summary: "Submit pilot feedback (any logged-in user)" })
  @ApiResponse({ status: 201, description: "Created feedback row." })
  create(@Body() dto: CreatePilotFeedbackDto, @CurrentUser() actor: { sub: string }) {
    return this.service.create(actor.sub, {
      route: dto.route,
      category: dto.category,
      message: dto.message
    });
  }

  @Get()
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "List all pilot feedback (admin)" })
  @ApiResponse({ status: 200, description: "Feedback entries, new first, with submitter." })
  list() {
    return this.service.list();
  }

  @Patch(":id")
  @RequirePermissions("platform.admin")
  @ApiOperation({ summary: "Update triage status of a feedback row (admin)" })
  @ApiResponse({ status: 200, description: "Updated feedback row." })
  updateStatus(@Param("id") id: string, @Body() dto: UpdatePilotFeedbackStatusDto) {
    return this.service.updateStatus(id, dto.status);
  }
}
