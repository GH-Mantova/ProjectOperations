import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TenderingController } from "./tendering.controller";
import { TenderingService } from "./tendering.service";

@Module({
  imports: [AuditModule],
  controllers: [TenderingController],
  providers: [TenderingService],
  exports: [TenderingService]
})
export class TenderingModule {}
