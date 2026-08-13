import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { ScheduleOfRatesModule } from "../schedule-of-rates/schedule-of-rates.module";
import { VariationSorController } from "./variation-sor.controller";
import { VariationSorService } from "./variation-sor.service";

/**
 * Variations module.
 *
 * S6 -- VC (Variation Contract) desktop pricing endpoints:
 *   POST/GET/PATCH/DELETE /variations/:id/sor-lines
 *
 * The base Variation CRUD still lives on ContractsController
 * (/contracts/:id/variations). This module is dedicated to pricing lines
 * so the SoR concern is isolated from contract lifecycle.
 *
 * Imports ScheduleOfRatesModule for JobSorSnapshotService (locked rate
 * lookup + first-use snapshot attach).
 */
@Module({
  imports: [PrismaModule, ScheduleOfRatesModule],
  controllers: [VariationSorController],
  providers: [VariationSorService],
  exports: [VariationSorService],
})
export class VariationsModule {}
