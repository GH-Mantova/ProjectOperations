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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { TenderRateSetService } from "./tender-rate-set.service";

class LockRateSetDto {
  @IsOptional()
  @IsString()
  sourceLabel?: string | null;
}

class UpdateRateEntryDto {
  /** Null clears the override; a number sets it. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  overrideValue?: number | null;
}

@ApiTags("Tender Rate Set")
@ApiBearerAuth()
@Controller("tenders/:tenderId/rate-set")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenderRateSetController {
  constructor(private readonly service: TenderRateSetService) {}

  @Post("lock")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Lock (snapshot or refresh) the rate set for a tender" })
  @ApiParam({ name: "tenderId", description: "Tender id" })
  @ApiResponse({ status: 201, description: "The locked rate set + entries grouped by rate table." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  lock(
    @Param("tenderId") tenderId: string,
    @Body() dto: LockRateSetDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.lock(tenderId, actor.sub, dto.sourceLabel);
  }

  @Get()
  @RequirePermissions("tenders.view")
  @ApiOperation({ summary: "Get the locked rate set for a tender (null if not locked)" })
  @ApiParam({ name: "tenderId", description: "Tender id" })
  @ApiResponse({ status: 200, description: "Rate set with entries grouped by rate table, or null." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  get(@Param("tenderId") tenderId: string) {
    return this.service.get(tenderId);
  }

  @Patch("entries/:entryId")
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Set or clear the override value on a rate entry" })
  @ApiParam({ name: "tenderId", description: "Tender id" })
  @ApiParam({ name: "entryId", description: "Rate entry id" })
  @ApiResponse({ status: 200, description: "The updated entry." })
  @ApiResponse({ status: 404, description: "Rate set or entry not found." })
  updateEntry(
    @Param("tenderId") tenderId: string,
    @Param("entryId") entryId: string,
    @Body() dto: UpdateRateEntryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    const value = dto.overrideValue === undefined ? null : dto.overrideValue;
    return this.service.updateEntry(tenderId, entryId, value, actor.sub);
  }

  @Delete()
  @RequirePermissions("tenders.manage")
  @ApiOperation({ summary: "Unlock the rate set for a tender (deletes the snapshot)" })
  @ApiParam({ name: "tenderId", description: "Tender id" })
  @ApiResponse({ status: 200, description: "{ unlocked: boolean }" })
  unlock(@Param("tenderId") tenderId: string, @CurrentUser() actor: { sub: string }) {
    return this.service.unlock(tenderId, actor.sub);
  }
}
