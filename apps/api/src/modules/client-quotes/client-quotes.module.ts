import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { EstimateExportModule } from "../estimate-export/estimate-export.module";
import { TenderingModule } from "../tendering/tendering.module";
import { ClientQuotesController } from "./client-quotes.controller";
import { ClientQuotesService } from "./client-quotes.service";
import { QuotePdfService } from "./quote-pdf.service";
import { QuoteSendService } from "./quote-send.service";

@Module({
  imports: [TenderingModule, EstimateExportModule, EmailModule],
  controllers: [ClientQuotesController],
  providers: [ClientQuotesService, QuotePdfService, QuoteSendService],
  exports: [ClientQuotesService]
})
export class ClientQuotesModule {}
