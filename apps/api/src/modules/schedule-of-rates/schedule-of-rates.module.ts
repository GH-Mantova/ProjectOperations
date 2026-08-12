import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { ScheduleOfRatesController } from "./schedule-of-rates.controller";
import { ScheduleOfRatesService } from "./schedule-of-rates.service";
import { SorClientRateCardController } from "./sor-client-rate-card.controller";
import { SorClientRateCardService } from "./sor-client-rate-card.service";
import { SorSourceMarkupController } from "./sor-source-markup.controller";
import { SorSourceMarkupService } from "./sor-source-markup.service";

/**
 * Schedule of Rates module (SoR S1 + S3 + S5) — master rate-book for live jobs.
 *
 * S1: SorPeriod (H1/H2 year buckets), SorRate (labour/plant/waste/subbie
 *     line items), SorChangeLogEntry (append-only audit trail).
 * S3: SorClientRateCard + SorClientRateEntry (per-client override/add/remove
 *     on top of master; snapshot-override-reset pattern).
 *
 * S5 adds: POST /schedule-of-rates/client-pdf — generates a client-facing PDF
 * from selected applicable rate lines. Internal margin / BMI columns are never
 * included in the output (enforced in the builder layer).
 *
 * Permissions: `rates.manage` (existing Rates R0 permission, PR-487).
 *
 * Separate from the tender estimate engine (TenderRateSet / EstimatePlantRate /
 * EstimateWasteRate). Later slices add job-attach, VC/AR pricing, and approval chain.
 */
@Module({
  imports: [PrismaModule, PdfRenderingModule],
  controllers: [
    ScheduleOfRatesController,
    SorClientRateCardController,
    SorSourceMarkupController
  ],
  providers: [ScheduleOfRatesService, SorClientRateCardService, SorSourceMarkupService],
  exports: [ScheduleOfRatesService, SorClientRateCardService, SorSourceMarkupService]
})
export class ScheduleOfRatesModule {}
