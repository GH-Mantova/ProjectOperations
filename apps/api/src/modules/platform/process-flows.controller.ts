import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ProcessFlowsService } from "./process-flows.service";

class AdvanceStageDto {
  @IsString()
  targetStageId!: string;
}

// Reads/writes on the stage bar are guarded by the underlying record's
// own permission — the engine never grants access on its own. Slice 1
// only wires Tender; extending to another entity means adding a
// per-entity guard (e.g. a separate controller with the right permission)
// so a token that can read a Project can't advance a Tender stage bar.
@ApiTags("Business Process Flows — Tender")
@ApiBearerAuth()
@Controller("tenders/:tenderId/process-flow")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderProcessFlowController {
  constructor(private readonly service: ProcessFlowsService) {}

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Get the active Tender process flow + this tender's instance." })
  @ApiResponse({ status: 200, description: "Active flow + instance (instance may be null)." })
  get(@Param("tenderId") tenderId: string) {
    return this.service.getInstance("Tender", tenderId);
  }

  @Post("advance")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Advance (or start) the tender's process instance to a stage." })
  @ApiResponse({ status: 200, description: "Updated instance." })
  advance(
    @Param("tenderId") tenderId: string,
    @Body() dto: AdvanceStageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.advance("Tender", tenderId, dto.targetStageId, actor.sub);
  }
}
