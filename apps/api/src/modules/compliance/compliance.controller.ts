import {
  BadRequestException,
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
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ComplianceService } from "./compliance.service";

class UpsertQualificationDto {
  @IsOptional() @IsString() qualType?: string;
  @IsOptional() @IsString() licenceNumber?: string | null;
  @IsOptional() @IsString() issuingAuthority?: string | null;
  @IsOptional() @IsString() issueDate?: string | null;
  @IsOptional() @IsString() expiryDate?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class BlockDto {
  @IsBoolean() blocked!: boolean;
  @IsOptional() @IsString() reason?: string | null;
}

class ExpiringQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(90) days?: number;
}

@ApiTags("Compliance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("compliance")
export class ComplianceController {
  constructor(private readonly service: ComplianceService) {}

  // ─── Dashboards / lists ─────────────────────────────────────────────────
  @Get("dashboard")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Expiring licences, insurances, and qualifications within 30 days." })
  dashboard() {
    return this.service.getExpiringItems(30);
  }

  @Get("expiring")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Expiring items within `days` (default 30, max 90)." })
  @ApiQuery({ name: "days", required: false })
  expiring(@Query() q: ExpiringQuery) {
    return this.service.getExpiringItems(q.days ?? 30);
  }

  @Get("blocked-subcontractors")
  @RequirePermissions("compliance.view")
  @ApiOperation({ summary: "Subcontractors currently blocked from engagement on compliance grounds." })
  blockedSubcontractors() {
    return this.service.listBlockedSubcontractors();
  }

  // ─── Worker qualifications ──────────────────────────────────────────────
  @Get("workers/:workerProfileId/qualifications")
  @RequirePermissions("compliance.view")
  listQualifications(@Param("workerProfileId") workerProfileId: string) {
    return this.service.listQualifications(workerProfileId);
  }

  @Post("workers/:workerProfileId/qualifications")
  @RequirePermissions("compliance.manage")
  @ApiResponse({ status: 201, description: "Qualification created." })
  createQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Body() dto: UpsertQualificationDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createQualification(workerProfileId, dto as never, actor.sub);
  }

  @Patch("workers/:workerProfileId/qualifications/:qualId")
  @RequirePermissions("compliance.manage")
  patchQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Param("qualId") qualId: string,
    @Body() dto: UpsertQualificationDto
  ) {
    return this.service.updateQualification(workerProfileId, qualId, dto as never);
  }

  @Delete("workers/:workerProfileId/qualifications/:qualId")
  @RequirePermissions("compliance.manage")
  deleteQualification(
    @Param("workerProfileId") workerProfileId: string,
    @Param("qualId") qualId: string
  ) {
    return this.service.deleteQualification(workerProfileId, qualId);
  }

  // ─── Alerts + manual block ──────────────────────────────────────────────
  @Post("alerts/send-now")
  @RequirePermissions("compliance.admin")
  @ApiOperation({ summary: "Manually trigger the daily expiry-alert pass right now." })
  async sendNow() {
    const sent = await this.service.checkAndSendExpiryAlerts();
    return { sent };
  }

  @Patch("subcontractors/:id/block")
  @RequirePermissions("compliance.admin")
  @ApiOperation({ summary: "Manually toggle a subcontractor's compliance block." })
  block(@Param("id") id: string, @Body() dto: BlockDto) {
    if (dto.blocked && !dto.reason) {
      throw new BadRequestException("reason is required when blocking.");
    }
    return this.service.manualBlock(id, dto.blocked, dto.reason ?? null);
  }
}
