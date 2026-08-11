import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { ScheduleOfRatesController } from "./schedule-of-rates.controller";
import { ScheduleOfRatesService } from "./schedule-of-rates.service";

/**
 * Schedule of Rates module (SoR S1 + S5) — master rate-book for live jobs.
 *
 * Manages SorPeriod (H1/H2 year buckets), SorRate (labour/plant/waste/subbie
 * line items), and SorChangeLogEntry (append-only audit trail).
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
  controllers: [ScheduleOfRatesController],
  providers: [ScheduleOfRatesService],
  exports: [ScheduleOfRatesService]
})
export class ScheduleOfRatesModule {}
