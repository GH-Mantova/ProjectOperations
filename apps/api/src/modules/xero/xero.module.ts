import { Module } from "@nestjs/common";
import { XeroController } from "./xero.controller";
import { XeroContactExportService } from "./xero-contact-export.service";
import { XeroService } from "./xero.service";

@Module({
  controllers: [XeroController],
  providers: [XeroService, XeroContactExportService],
  exports: [XeroService]
})
export class XeroModule {}
