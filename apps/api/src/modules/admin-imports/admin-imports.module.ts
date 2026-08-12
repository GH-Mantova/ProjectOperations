import { Module } from "@nestjs/common";
import { TenderTrackerImportController } from "./tender-tracker-import.controller";
import { TenderTrackerImportService } from "./tender-tracker-import.service";

@Module({
  controllers: [TenderTrackerImportController],
  providers: [TenderTrackerImportService],
  exports: [TenderTrackerImportService],
})
export class AdminImportsModule {}
