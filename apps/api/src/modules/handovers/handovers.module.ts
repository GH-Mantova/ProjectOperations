import { Module } from "@nestjs/common";
import { HandoversController } from "./handovers.controller";
import { HandoversService } from "./handovers.service";
import { HandoverSubcontractorsService } from "./handover-subcontractors.service";

@Module({
  controllers: [HandoversController],
  providers: [HandoversService, HandoverSubcontractorsService],
  exports: [HandoversService, HandoverSubcontractorsService]
})
export class HandoversModule {}
