import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EstimatesController } from "./estimates.controller";
import { EstimatesService } from "./estimates.service";

@Module({
  imports: [AuditModule],
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService]
})
export class EstimatesModule {}
