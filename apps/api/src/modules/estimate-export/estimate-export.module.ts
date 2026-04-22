import { Module } from "@nestjs/common";
import { TenderingModule } from "../tendering/tendering.module";
import { EstimateExportController } from "./estimate-export.controller";
import { EstimateExportService } from "./estimate-export.service";

@Module({
  imports: [TenderingModule],
  controllers: [EstimateExportController],
  providers: [EstimateExportService]
})
export class EstimateExportModule {}
