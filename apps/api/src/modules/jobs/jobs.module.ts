import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { JobNumberService } from "./job-number.service";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { TenderConversionController } from "./tender-conversion.controller";

/**
 * NestJS module that wires the jobs REST surface — both
 * {@link JobsController} (jobs CRUD, stages, activities, issues,
 * variations, progress, closeout) and {@link TenderConversionController}
 * (award → contract → convert → reuse → rollback). Depends on
 * {@link PlatformModule} for {@link SharePointService} (folder
 * provisioning on conversion) and {@link NotificationsService}
 * (live follow-up refresh). {@link JobsService} and
 * {@link JobNumberService} are re-exported so other modules (tendering,
 * dashboards, scheduler) can read jobs and resolve canonical job
 * numbers without going through HTTP.
 */
@Module({
  imports: [PlatformModule],
  controllers: [JobsController, TenderConversionController],
  providers: [JobsService, JobNumberService],
  exports: [JobsService, JobNumberService]
})
export class JobsModule {}
