import { Controller, Get, Header, Param, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { EstimateExportService } from "./estimate-export.service";

type RequestUser = { sub: string };

@ApiTags("Estimate Export")
@ApiBearerAuth()
@Controller("tenders/:id/export")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class EstimateExportController {
  constructor(private readonly service: EstimateExportService) {}

  @Get("pdf")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "Stream a client-facing IS quote PDF for the tender. Totals are recomputed from raw EstimateItem lines on every call; stored totals are never trusted. Logs an EstimateExport audit row."
  })
  @ApiProduces("application/pdf")
  @ApiResponse({ status: 200, description: "PDF stream with IS_Quote_<tenderNumber>.pdf filename." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  @Header("Cache-Control", "no-store")
  async pdf(
    @Param("id") tenderId: string,
    @CurrentUser() actor: RequestUser,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportPdf(tenderId, actor.sub);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }

  @Get("excel")
  @RequirePermissions("tenders.view")
  @ApiOperation({
    summary:
      "Stream an internal-facing Excel workbook (Summary / Labour Detail / Plant & Disposal Detail) for the tender. Logs an EstimateExport audit row."
  })
  @ApiProduces("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  @ApiResponse({ status: 200, description: "XLSX stream with IS_Estimate_<tenderNumber>.xlsx filename." })
  @ApiResponse({ status: 404, description: "Tender not found." })
  @Header("Cache-Control", "no-store")
  async excel(
    @Param("id") tenderId: string,
    @CurrentUser() actor: RequestUser,
    @Res({ passthrough: false }) res: Response
  ): Promise<void> {
    const { buffer, filename } = await this.service.exportExcel(tenderId, actor.sub);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  }
}
