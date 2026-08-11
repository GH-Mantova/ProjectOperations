import { Module } from "@nestjs/common";
import { SubcontractorRatesController } from "./subcontractor-rates.controller";
import { SubcontractorRatesService } from "./subcontractor-rates.service";

@Module({
  controllers: [SubcontractorRatesController],
  providers: [SubcontractorRatesService],
  exports: [SubcontractorRatesService]
})
export class SubcontractorRatesModule {}
