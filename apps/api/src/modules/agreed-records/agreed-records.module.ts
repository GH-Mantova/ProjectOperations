import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesModule } from "../schedule-of-rates/schedule-of-rates.module";
import { AgreedRecordsController } from "./agreed-records.controller";
import { AgreedRecordsService } from "./agreed-records.service";

/**
 * Agreed Records module (SoR S7).
 *
 * AR = dayworks captured by field crews against a job's locked SoR snapshot.
 * No rate or dollar value is surfaced here — pricing happens in S8 (office
 * review lane). The first AR submission against a job triggers the S4
 * snapshot attach ("first VC/AR locks it" rule from S4/S6).
 *
 * Permission: `field.view` (same as dockets, pre-starts, timesheets).
 *
 * Imports ScheduleOfRatesModule for JobSorSnapshotService (first-use snapshot
 * attach on submit).
 */
@Module({
  imports: [PrismaModule, ScheduleOfRatesModule],
  controllers: [AgreedRecordsController],
  providers: [AgreedRecordsService],
  exports: [AgreedRecordsService],
})
export class AgreedRecordsModule {}
