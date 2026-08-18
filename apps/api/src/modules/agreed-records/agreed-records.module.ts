import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesModule } from "../schedule-of-rates/schedule-of-rates.module";
import { EmailModule } from "../email/email.module";
import { AgreedRecordsController } from "./agreed-records.controller";
import { AgreedRecordsService } from "./agreed-records.service";
import { AgreedRecordReviewController } from "./agreed-record-review.controller";
import { AgreedRecordReviewService } from "./agreed-record-review.service";

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
 * The first AR submission against a job triggers the S4 snapshot attach
 * ("first VC/AR locks it" rule from S4/S6).
 *
 * Permissions:
 *   Field surface (S7): `field.view`
 *   Office review (S8): `rates.manage`
 *
 * Imports:
 *   ScheduleOfRatesModule — JobSorSnapshotService (snapshot attach + rate reads)
 *   EmailModule           — notification dispatch via NotificationTriggerConfig
 */
@Module({
  imports: [PrismaModule, ScheduleOfRatesModule, EmailModule],
  controllers: [AgreedRecordsController, AgreedRecordReviewController],
  providers: [AgreedRecordsService, AgreedRecordReviewService],
  exports: [AgreedRecordsService, AgreedRecordReviewService],
})
export class AgreedRecordsModule {}
