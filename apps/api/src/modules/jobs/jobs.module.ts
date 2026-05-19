import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { JobNumberService } from "./job-number.service";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { TenderConversionController } from "./tender-conversion.controller";

@Module({
  imports: [PlatformModule],
  controllers: [JobsController, TenderConversionController],
  providers: [JobsService, JobNumberService],
  exports: [JobsService, JobNumberService]
})
export class JobsModule {}
