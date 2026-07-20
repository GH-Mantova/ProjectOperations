import { Module } from "@nestjs/common";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { ReportingController } from "./reporting.controller";
import { ReportingService } from "./reporting.service";
import { ReportingExportService } from "./reporting-export.service";

/**
 * Cross-module BI reporting layer (slice 1).
 *
 * Read-only. Aggregates existing tables — no migrations, no warehouse.
 * Ships beside the per-module dashboard widget system as the
 * tabular/exportable surface (Excel / CSV / PDF).
 *
 * New report definitions drop into REPORT_DEFS in reporting.service — the
 * controller, exporter, and web page all pick them up without further wiring.
 */
@Module({
  imports: [PdfRenderingModule],
  controllers: [ReportingController],
  providers: [ReportingService, ReportingExportService],
  exports: [ReportingService]
})
export class ReportingModule {}
