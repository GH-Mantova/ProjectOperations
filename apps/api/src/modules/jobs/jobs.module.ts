import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { JobsController } from "./jobs.controller";
import { JobsService } from "./jobs.service";
import { TenderConversionController } from "./tender-conversion.controller";

@Module({
  imports: [PlatformModule],
  controllers: [JobsController, TenderConversionController],
  providers: [JobsService],
  exports: [JobsService]
})
export class JobsModule {}
