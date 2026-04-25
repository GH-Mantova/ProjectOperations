import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../../common/auth/authenticated-request.interface";
import { GanttService } from "./gantt.service";

class UpsertGanttTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() discipline?: string | null;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsString() colour?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) dependencies?: string[];
  @IsOptional() @IsString() assignedToId?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() sortOrder?: number;
}

@ApiTags("Project Gantt")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("projects/:projectId/gantt")
export class GanttController {
  constructor(private readonly service: GanttService) {}

  @Get()
  @RequirePermissions("projects.view")
  @ApiOperation({ summary: "List Gantt tasks for the project (team-scoped)." })
  @ApiResponse({ status: 200, description: "Tasks listed." })
  list(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.list(projectId, user);
  }

  @Post()
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Create a Gantt task on the project." })
  @ApiResponse({ status: 201, description: "Task created." })
  create(
    @Param("projectId") projectId: string,
    @Body() dto: UpsertGanttTaskDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.create(projectId, dto as never, user);
  }

  @Patch(":taskId")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Update a Gantt task." })
  @ApiResponse({ status: 200, description: "Task updated." })
  patch(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpsertGanttTaskDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.update(projectId, taskId, dto as never, user);
  }

  @Delete(":taskId")
  @RequirePermissions("projects.manage")
  @ApiOperation({ summary: "Delete a Gantt task." })
  @ApiResponse({ status: 200, description: "Task deleted." })
  remove(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.remove(projectId, taskId, user);
  }

  @Post("generate")
  @RequirePermissions("projects.manage")
  @ApiOperation({
    summary: "Generate Gantt tasks from the project's source-tender scope. One task per discipline."
  })
  generate(@Param("projectId") projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.generateFromScope(projectId, user);
  }
}
