import { Module } from "@nestjs/common";
import { HealthController, VersionController } from "./health.controller";
import { HealthService } from "./health.service";

@Module({
  controllers: [HealthController, VersionController],
  providers: [HealthService]
})
export class HealthModule {}
