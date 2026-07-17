import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SurveysService, SurveyQuestion } from "./surveys.service";

// ─── DTOs ──────────────────────────────────────────────────────────────────

class SurveyQuestionDto implements SurveyQuestion {
  @IsString() id!: string;
  @IsString() prompt!: string;
  @IsIn(["rating", "text"]) type!: "rating" | "text";
  @IsBoolean() required!: boolean;
  @IsOptional() @Type(() => Number) min?: number;
  @IsOptional() @Type(() => Number) max?: number;
}

class CreateSurveyDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string | null;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyQuestionDto)
  questions!: SurveyQuestionDto[];
  @IsOptional() @IsBoolean() isDefault?: boolean;
}

class SurveyAnswerDto {
  @IsString() questionId!: string;
  value!: string | number;
}

class CreateSurveyResponseDto {
  @IsString() clientId!: string;
  @IsOptional() @IsString() jobId?: string | null;
  @IsOptional() @IsString() projectId?: string | null;
  @IsArray() @ValidateNested({ each: true }) @Type(() => SurveyAnswerDto)
  answers!: SurveyAnswerDto[];
}

// ─── Controller ─────────────────────────────────────────────────────────────

@ApiTags("Surveys")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  /** Create a survey template. */
  @Post("surveys")
  @RequirePermissions("clients.manage")
  @ApiOperation({ summary: "Create a customer satisfaction survey template." })
  @ApiResponse({ status: 201, description: "Survey created." })
  createSurvey(@Body() dto: CreateSurveyDto) {
    return this.service.createSurvey(dto);
  }

  /** List all survey templates. */
  @Get("surveys")
  @RequirePermissions("clients.view")
  @ApiOperation({ summary: "List customer satisfaction survey templates." })
  @ApiResponse({ status: 200, description: "Survey templates." })
  listSurveys() {
    return this.service.listSurveys();
  }

  /** Capture a survey response for a client. */
  @Post("surveys/:id/responses")
  @RequirePermissions("clients.manage")
  @ApiOperation({ summary: "Capture a survey response for a client." })
  @ApiResponse({ status: 201, description: "Response recorded. Client.preferenceScore updated." })
  @ApiResponse({ status: 404, description: "Survey or client not found." })
  createResponse(
    @Param("id") surveyId: string,
    @Body() dto: CreateSurveyResponseDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createResponse(surveyId, dto, actor.sub);
  }

  /** Get client satisfaction aggregate. */
  @Get("clients/:clientId/satisfaction")
  @RequirePermissions("clients.view")
  @ApiOperation({ summary: "Client satisfaction aggregate: mean score, count, last submission date, latest comments." })
  @ApiResponse({ status: 200, description: "Client satisfaction summary." })
  @ApiResponse({ status: 404, description: "Client not found." })
  getClientSatisfaction(@Param("clientId") clientId: string) {
    return this.service.getClientSatisfaction(clientId);
  }
}
