import {
  Body,
  Controller,
  Delete,
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
import { AutomationsService } from "./automations.service";
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto
} from "./dto/automation.dto";

@ApiTags("Automations")
@ApiBearerAuth()
@Controller("automations")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AutomationsController {
  constructor(private readonly automations: AutomationsService) {}

  @Get()
  @RequirePermissions("automations.view")
  @ApiOperation({ summary: "List automation rules" })
  @ApiResponse({ status: 200, description: "List automation rules." })
  list() {
    return this.automations.list();
  }

  @Get(":id")
  @RequirePermissions("automations.view")
  @ApiOperation({ summary: "Get a single automation rule" })
  @ApiResponse({ status: 200, description: "Get a single automation rule." })
  get(@Param("id") id: string) {
    return this.automations.get(id);
  }

  @Get(":id/runs")
  @RequirePermissions("automations.view")
  @ApiOperation({ summary: "Recent evaluation log for a rule" })
  @ApiResponse({ status: 200, description: "Recent evaluation log for a rule." })
  recentRuns(@Param("id") id: string, @Query("limit") limit?: string) {
    const parsed = limit ? Number.parseInt(limit, 10) : 20;
    return this.automations.recentRuns(id, Number.isFinite(parsed) ? parsed : 20);
  }

  @Post()
  @RequirePermissions("automations.manage")
  @ApiOperation({ summary: "Create an automation rule" })
  @ApiResponse({ status: 201, description: "Create an automation rule." })
  create(@Body() dto: CreateAutomationRuleDto, @CurrentUser() actor: { sub: string }) {
    return this.automations.create(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("automations.manage")
  @ApiOperation({ summary: "Update an automation rule (also used to enable/disable)" })
  @ApiResponse({ status: 200, description: "Update an automation rule." })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAutomationRuleDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.automations.update(id, dto, actor.sub);
  }

  @Delete(":id")
  @RequirePermissions("automations.manage")
  @ApiOperation({ summary: "Delete an automation rule" })
  @ApiResponse({ status: 200, description: "Delete an automation rule." })
  remove(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.automations.remove(id, actor.sub);
  }

  @Post(":id/test-fire")
  @RequirePermissions("automations.manage")
  @ApiOperation({
    summary: "Fire a rule against a synthetic payload for admin testing"
  })
  @ApiResponse({ status: 201, description: "Rule fired; returns the newest run row." })
  testFire(
    @Param("id") id: string,
    @Body() body: { payload?: Record<string, unknown> },
    @CurrentUser() actor: { sub: string }
  ) {
    return this.automations.testFire(id, body?.payload ?? {}, actor.sub);
  }
}
