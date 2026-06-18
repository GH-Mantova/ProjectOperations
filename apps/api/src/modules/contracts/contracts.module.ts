import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { ContractsController } from "./contracts.controller";
import { ContractsService } from "./contracts.service";

/**
 * Module 7 — Award / Contract / Job Conversion.
 *
 * Wires the contracts REST surface (contracts, variations, progress
 * claims) and its service together. Imports PlatformModule for the
 * notifications + email services used by claim submission and the daily
 * claim cut-off reminder cron. ContractsService is exported so other
 * modules can reach contract aggregates without re-querying.
 */
@Module({
  imports: [PlatformModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService]
})
export class ContractsModule {}
