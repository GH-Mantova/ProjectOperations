import { Module } from "@nestjs/common";
import { XeroController } from "./xero.controller";
import { XeroContactExportService } from "./xero-contact-export.service";
import { XeroContactImportService } from "./xero-contact-import.service";
import { XeroService } from "./xero.service";

@Module({
  controllers: [XeroController],
  providers: [XeroService, XeroContactExportService, XeroContactImportService],
  exports: [XeroService]
})
export class XeroModule {}
