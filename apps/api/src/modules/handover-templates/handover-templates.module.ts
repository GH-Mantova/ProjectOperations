import { Module } from "@nestjs/common";
import { HandoverTemplatesController } from "./handover-templates.controller";
import { HandoverTemplatesService } from "./handover-templates.service";

@Module({
  controllers: [HandoverTemplatesController],
  providers: [HandoverTemplatesService],
  exports: [HandoverTemplatesService]
})
export class HandoverTemplatesModule {}
