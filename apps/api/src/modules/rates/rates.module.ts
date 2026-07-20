import { Module } from "@nestjs/common";
import { RatesController } from "./rates.controller";
import { RateTablesService } from "./rate-tables.service";
import { RateResolverService } from "./rate-resolver.service";
import { RateValidationService } from "./rate-validation.service";
import { RatesExportService } from "./rates-export.service";
import { RatesImportService } from "./rates-import.service";

@Module({
  controllers: [RatesController],
  providers: [
    RateTablesService,
    RateResolverService,
    RateValidationService,
    RatesExportService,
    RatesImportService
  ],
  exports: [
    RateTablesService,
    RateResolverService,
    RateValidationService,
    RatesExportService,
    RatesImportService
  ]
})
export class RatesModule {}
