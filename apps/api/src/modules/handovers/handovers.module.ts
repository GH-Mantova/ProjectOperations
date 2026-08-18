import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { PlatformModule } from "../platform/platform.module";
import { HandoversController } from "./handovers.controller";
import { HandoversService } from "./handovers.service";
import { HandoverSubcontractorsService } from "./handover-subcontractors.service";
import { HandoverComplianceService } from "./handover-compliance.service";
import { HandoverFinaliseService } from "./handover-finalise.service";

@Module({
  // JobsModule: provides JobsService (convertTenderToJob) for B-HW-11 finalise.
  // PlatformModule: provides SharePointService for subcontractor folder scaffold.
  imports: [JobsModule, PlatformModule],
  controllers: [HandoversController],
  providers: [
    HandoversService,
    HandoverSubcontractorsService,
    HandoverComplianceService,
    HandoverFinaliseService
  ],
  exports: [
    HandoversService,
    HandoverSubcontractorsService,
    HandoverComplianceService,
    HandoverFinaliseService
  ]
})
export class HandoversModule {}
