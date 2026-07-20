import { BadRequestException, Controller, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";
import type { Response } from "express";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { ReportingService } from "./reporting.service";
import { ReportingExportService, type ReportExportFormat } from "./reporting-export.service";

class ReportRunQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

class ReportExportQueryDto extends ReportRunQueryDto {
  @IsIn(["xlsx", "csv", "pdf"])
  format!: ReportExportFormat;
}

@ApiTags("Reporting")
@ApiBearerAuth()
@Controller("reporting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly exporter: ReportingExportService
  ) {}

  @Get("definitions")
  @RequirePermissions("reporting.view")
  @ApiOperation({ summary: "List available cross-module report definitions with parameters and columns." })
  @ApiResponse({ status: 200, description: "ReportDefinitionSummary[]." })
  listDefinitions() {
    return this.reporting.listDefinitions();
  }

  @Get(":reportKey")
  @RequirePermissions("reporting.view")
  @ApiOperation({ summary: "Run a report and return rows + optional totals." })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  @ApiResponse({ status: 200, description: "ReportRunResponse." })
  @ApiResponse({ status: 404, description: "Unknown report." })
  run(@Param("reportKey") reportKey: string, @Query() query: ReportRunQueryDto) {
    return this.reporting.run(reportKey, query);
  }

  @Get(":reportKey/export")
  @RequirePermissions("reporting.view")
  @ApiOperation({ summary: "Export a report as xlsx, csv or pdf." })
  @ApiQuery({ name: "format", required: true, enum: ["xlsx", "csv", "pdf"] })
  @ApiQuery({ name: "from", required: false })
  @ApiQuery({ name: "to", required: false })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "clientId", required: false })
  async export(
    @Param("reportKey") reportKey: string,
    @Query() query: ReportExportQueryDto,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const { format, ...params } = query;
    if (!format) throw new BadRequestException("format query parameter is required");
    const { buffer, filename, contentType } = await this.exporter.export(reportKey, format, params);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }
}
