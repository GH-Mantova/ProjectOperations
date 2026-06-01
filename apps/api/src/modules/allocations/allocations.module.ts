import { Module } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { PlatformModule } from "../platform/platform.module";
import { AllocationsController } from "./allocations.controller";
import { AllocationsService } from "./allocations.service";

@Module({
  imports: [PlatformModule, ComplianceModule],
  controllers: [AllocationsController],
  providers: [AllocationsService]
})
export class AllocationsModule {}
