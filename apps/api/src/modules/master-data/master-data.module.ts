import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { MasterDataController } from "./master-data.controller";
import { MasterDataService } from "./master-data.service";

/**
 * NestJS module that wires up the master-data REST surface
 * ({@link MasterDataController}) and re-exports {@link MasterDataService} so
 * other modules (e.g. tendering, jobs, scheduler) can read and upsert master
 * data without going through HTTP.
 */
@Module({
  imports: [AuditModule],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService]
})
export class MasterDataModule {}
