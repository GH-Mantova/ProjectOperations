import { Module } from "@nestjs/common";
import { EstimateExportController } from "./estimate-export.controller";
import { EstimateExportService } from "./estimate-export.service";

@Module({
  controllers: [EstimateExportController],
  providers: [EstimateExportService]
})
export class EstimateExportModule {}
