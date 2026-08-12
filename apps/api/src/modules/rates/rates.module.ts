import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RateArchiveService } from "./rate-archive.service";
import { RatesController } from "./rates.controller";
import { RateTablesService } from "./rate-tables.service";
import { RateResolverService } from "./rate-resolver.service";
import { RateValidationService } from "./rate-validation.service";
import { RatesExportService } from "./rates-export.service";
import { RatesImportService } from "./rates-import.service";
import { SubcontractorArchiveController } from "./subcontractor-archive.controller";

@Module({
  imports: [AuditModule],
  controllers: [RatesController, SubcontractorArchiveController],
  providers: [
    RateTablesService,
    RateResolverService,
    RateValidationService,
    RatesExportService,
    RatesImportService,
    RateArchiveService
  ],
  exports: [
    RateTablesService,
    RateResolverService,
    RateValidationService,
    RatesExportService,
    RatesImportService,
    RateArchiveService
  ]
})
export class RatesModule {}
