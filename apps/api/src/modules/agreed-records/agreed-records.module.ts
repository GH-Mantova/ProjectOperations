import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesModule } from "../schedule-of-rates/schedule-of-rates.module";
import { EmailModule } from "../email/email.module";
import { ContractsModule } from "../contracts/contracts.module";
import { AgreedRecordsController } from "./agreed-records.controller";
import { AgreedRecordsService } from "./agreed-records.service";
import { AgreedRecordReviewController } from "./agreed-record-review.controller";
import { AgreedRecordReviewService } from "./agreed-record-review.service";
import { AgreedRecordRegisterController } from "./agreed-record-register.controller";
import { AgreedRecordRegisterService } from "./agreed-record-register.service";

/**
 * Agreed Records module (SoR S7 + S8).
 *
 * S7 — AR = dayworks captured by field crews against a job's locked SoR
 * snapshot. No rate or dollar value is surfaced in the S7 layer — pricing
 * happens in S8.
 *
 * S8 — Office review lane: WHS&CC and Ops Manager pick up SUBMITTED ARs,
 * correct lines, price from the frozen snapshot, and either approve or
 * send back to the worker. Reuses the EmailService notification seam
 * (NotificationTriggerConfig) so the admin controls recipients without
 * a code deploy.
 *
 * S9a — per-JOB register (VC + AR) and the one-way feed of APPROVED items
 * into the EXISTING ProgressClaim via ClaimLineItem. Adds no claim model of
 * its own: it calls ContractsService.createClaim and appends line items.
 * Director is notified via the NotificationTriggerConfig seam AFTER the
 * claim is written. The register UI is S9b, not this slice.
 *
 * The first AR submission against a job triggers the S4 snapshot attach
 * ("first VC/AR locks it" rule from S4/S6).
 *
 * Permissions:
 *   Field surface (S7): `field.view`
 *   Office review (S8): `rates.manage`
 *   Register + claim feed (S9a): `finance.view` / `finance.manage`
 *                                (the existing progress-claim codes — reused)
 *
 * Imports:
 *   ScheduleOfRatesModule — JobSorSnapshotService (snapshot attach + rate reads)
 *   EmailModule           — notification dispatch via NotificationTriggerConfig
 *   ContractsModule       — ContractsService.createClaim (S9a; exported by
 *                           ContractsModule, which imports only PlatformModule,
 *                           so there is no import cycle)
 */
@Module({
  imports: [PrismaModule, ScheduleOfRatesModule, EmailModule, ContractsModule],
  controllers: [
    AgreedRecordsController,
    AgreedRecordReviewController,
    AgreedRecordRegisterController,
  ],
  providers: [AgreedRecordsService, AgreedRecordReviewService, AgreedRecordRegisterService],
  exports: [AgreedRecordsService, AgreedRecordReviewService, AgreedRecordRegisterService],
})
export class AgreedRecordsModule {}
