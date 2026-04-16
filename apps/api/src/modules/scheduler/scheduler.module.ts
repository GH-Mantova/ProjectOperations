import { Module } from "@nestjs/common";
import { PlatformModule } from "../platform/platform.module";
import { SchedulerController } from "./scheduler.controller";
import { SchedulerService } from "./scheduler.service";

@Module({
  imports: [PlatformModule],
  controllers: [SchedulerController],
  providers: [SchedulerService]
})
export class SchedulerModule {}
