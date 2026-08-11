import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { ContractArchiveService } from "./contract-archive.service";
import { ClaimDraftReminderService } from "./claim-draft-reminder.service";
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
 *
 * ClaimDraftReminderService runs a monthly cron (28th of each month at
 * 8am AEST) that notifies the responsible user when no progress claim has
 * been generated yet for the current month on an ACTIVE contract.
 *
 * ContractArchiveService (S1) handles soft-archive, unarchive, and
 * super-user hard-delete of contracts.
 */
@Module({
  imports: [PlatformModule],
  controllers: [ContractsController],
  providers: [ContractsService, ClaimDraftReminderService, ContractArchiveService],
  exports: [ContractsService]
})
export class ContractsModule {}
