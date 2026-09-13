import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IsNumber, IsOptional } from "class-validator";
import { Type } from "class-transformer";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { SorPushBackService } from "./sor-push-back.service";

class PushBackDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ordinary?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  oneAndHalf?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  double?: number | null;
}

@ApiTags("Schedule of Rates")
@ApiBearerAuth()
@Controller("schedule-of-rates")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SorPushBackController {
  constructor(private readonly service: SorPushBackService) {}

  /**
   * Preview the impact of pushing a SoR line's figures back to the master hub.
   * Shows which columns land, who is frozen, and which open tenders would pick
   * up the change at their first lock.
   */
  @Get("rates/:id/push-back/preview")
  @RequirePermissions("rates.push-back")
  @ApiOperation({
    summary: "Preview push-back of a SoR line to the master hub.",
  })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 200, description: "Preview returned." })
  @ApiResponse({ status: 400, description: "Cannot push — MANUAL or no anchor." })
  @ApiResponse({ status: 403, description: "Period is not ACTIVE." })
  @ApiResponse({ status: 404, description: "SorRate not found." })
  getPreview(
    @Param("id") rateId: string,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.getPreview(rateId, actor.sub);
  }

  /**
   * Push a confirmed SoR line edit back to the master hub.
   * Body `{ ordinary, oneAndHalf, double }` must match the live SoR figures
   * (stale-detection); on mismatch a 409 is returned so the UI reopens the dialog.
   */
  @Post("rates/:id/push-back")
  @RequirePermissions("rates.push-back")
  @ApiOperation({
    summary: "Push a SoR line's confirmed figures back to the master hub.",
  })
  @ApiParam({ name: "id", description: "SorRate id" })
  @ApiResponse({ status: 201, description: "Push applied." })
  @ApiResponse({ status: 400, description: "Cannot push — MANUAL or no anchor." })
  @ApiResponse({ status: 403, description: "Period is not ACTIVE." })
  @ApiResponse({ status: 404, description: "SorRate not found." })
  @ApiResponse({ status: 409, description: "Line changed since preview — reopen it." })
  pushBack(
    @Param("id") rateId: string,
    @Body() dto: PushBackDto,
    @CurrentUser() actor: { sub: string },
  ) {
    return this.service.pushBack(rateId, actor.sub, {
      ordinary: dto.ordinary ?? null,
      oneAndHalf: dto.oneAndHalf ?? null,
      double: dto.double ?? null,
    });
  }

  /**
   * Return the hub's current figures for every non-MANUAL line in a period.
   * Used by S6b's at-rest drift lines. Readable by anyone with `rates.manage`.
   */
  @Get("periods/:periodId/push-back/hub-figures")
  @RequirePermissions("rates.manage")
  @ApiOperation({
    summary:
      "Return current hub figures for every non-MANUAL line in a period (drift display).",
  })
  @ApiParam({ name: "periodId", description: "SorPeriod id" })
  @ApiResponse({ status: 200, description: "Hub figures map returned." })
  getHubFigures(@Param("periodId") periodId: string) {
    return this.service.getHubFigures(periodId);
  }
}
