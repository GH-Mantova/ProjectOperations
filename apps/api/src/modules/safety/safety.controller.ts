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

@ApiTags("Safety")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("safety")
export class SafetyController {
  constructor(private readonly service: SafetyService) {}

  @Get("dashboard")
  @RequirePermissions("safety.view")
  @ApiOperation({ summary: "Open incidents/hazards counts + 5 most-recent of each." })
  @ApiResponse({ status: 200, description: "Safety dashboard summary." })
  dashboard() {
    return this.service.dashboard();
  }

  // Incidents
  @Get("incidents")
  @RequirePermissions("safety.view")
  listIncidents(@Query() q: ListIncidentsQuery) {
    return this.service.listIncidents(q);
  }

  @Get("incidents/:id")
  @RequirePermissions("safety.view")
  getIncident(@Param("id") id: string) {
    return this.service.getIncident(id);
  }

  @Post("incidents")
  @RequirePermissions("safety.manage")
  createIncident(@Body() dto: CreateIncidentDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createIncident(dto as never, actor.sub);
  }

  @Patch("incidents/:id")
  @RequirePermissions("safety.manage")
  patchIncident(@Param("id") id: string, @Body() dto: UpdateIncidentDto) {
    return this.service.updateIncident(id, dto as never);
  }

  @Post("incidents/:id/close")
  @RequirePermissions("safety.admin")
  closeIncident(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.service.closeIncident(id, actor.sub);
  }

  // Hazards
  @Get("hazards")
  @RequirePermissions("safety.view")
  listHazards(@Query() q: ListHazardsQuery) {
    return this.service.listHazards(q);
  }

  @Get("hazards/:id")
  @RequirePermissions("safety.view")
  getHazard(@Param("id") id: string) {
    return this.service.getHazard(id);
  }

  @Post("hazards")
  @RequirePermissions("safety.manage")
  createHazard(@Body() dto: CreateHazardDto, @CurrentUser() actor: { sub: string }) {
    return this.service.createHazard(dto as never, actor.sub);
  }

  @Patch("hazards/:id")
  @RequirePermissions("safety.manage")
  patchHazard(@Param("id") id: string, @Body() dto: UpdateHazardDto) {
    return this.service.updateHazard(id, dto as never);
  }

  @Post("hazards/:id/close")
  @RequirePermissions("safety.admin")
  closeHazard(@Param("id") id: string) {
    return this.service.closeHazard(id);
  }
}
