import { Module } from "@nestjs/common";
import { SubcontractorHubController } from "./subcontractor-hub.controller";
import { SubcontractorRatesController } from "./subcontractor-rates.controller";
import { SubcontractorRatesService } from "./subcontractor-rates.service";

@Module({
  controllers: [SubcontractorHubController, SubcontractorRatesController],
  providers: [SubcontractorRatesService],
  exports: [SubcontractorRatesService]
})
export class SubcontractorRatesModule {}
