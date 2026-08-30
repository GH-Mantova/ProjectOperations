import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AccountsModule } from "../crm/accounts/accounts.module";
import { ClientStatsService } from "./client-stats.service";
import { MasterDataController } from "./master-data.controller";
import { MasterDataService } from "./master-data.service";

/**
 * NestJS module that wires up the master-data REST surface
 * ({@link MasterDataController}) and re-exports {@link MasterDataService} so
 * other modules (e.g. tendering, jobs, scheduler) can read and upsert master
 * data without going through HTTP.
 *
 * CRM-S3: AccountsModule is imported so AccountsService can be injected into
 * MasterDataService to call ensureAccountForClient on every client create.
 */
@Module({
  imports: [AuditModule, AccountsModule],
  controllers: [MasterDataController],
  providers: [MasterDataService, ClientStatsService],
  exports: [MasterDataService, ClientStatsService]
})
export class MasterDataModule {}
