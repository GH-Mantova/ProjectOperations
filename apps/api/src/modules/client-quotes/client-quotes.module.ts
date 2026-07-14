import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EmailModule } from "../email/email.module";
import { EstimateExportModule } from "../estimate-export/estimate-export.module";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { TenderingModule } from "../tendering/tendering.module";
import { ClientQuotesController } from "./client-quotes.controller";
import { ClientQuotesDashboardController } from "./client-quotes-dashboard.controller";
import { ClientQuotesService } from "./client-quotes.service";
import { QuotePdfService } from "./quote-pdf.service";
import { QuoteScopeItemsController } from "./quote-scope-items.controller";
import { QuoteScopeItemsService } from "./quote-scope-items.service";
import { QuoteSendService } from "./quote-send.service";

@Module({
  imports: [AuditModule, TenderingModule, EstimateExportModule, EmailModule, PdfRenderingModule],
  controllers: [ClientQuotesController, ClientQuotesDashboardController, QuoteScopeItemsController],
  providers: [ClientQuotesService, QuotePdfService, QuoteSendService, QuoteScopeItemsService],
  exports: [ClientQuotesService, QuoteScopeItemsService]
})
export class ClientQuotesModule {}
