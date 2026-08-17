import { Module } from "@nestjs/common";
import { HandoversController } from "./handovers.controller";
import { HandoversService } from "./handovers.service";
import { HandoverSubcontractorsService } from "./handover-subcontractors.service";
import { HandoverComplianceService } from "./handover-compliance.service";

@Module({
  controllers: [HandoversController],
  providers: [HandoversService, HandoverSubcontractorsService, HandoverComplianceService],
  exports: [HandoversService, HandoverSubcontractorsService, HandoverComplianceService]
})
export class HandoversModule {}
