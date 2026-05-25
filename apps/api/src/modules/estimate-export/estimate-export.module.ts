import { Module } from "@nestjs/common";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { TenderingModule } from "../tendering/tendering.module";
import { EstimateExportController } from "./estimate-export.controller";
import { EstimateExportService } from "./estimate-export.service";

@Module({
  imports: [TenderingModule, PdfRenderingModule],
  controllers: [EstimateExportController],
  providers: [EstimateExportService],
  exports: [EstimateExportService]
})
export class EstimateExportModule {}
