import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { EstimatesController } from "./estimates.controller";
import { EstimatesService } from "./estimates.service";

/**
 * Nest module for the estimating surface (§5 Tendering & Estimating).
 *
 * Wires the rate-library and per-tender estimate REST endpoints
 * ({@link EstimatesController}) on top of {@link EstimatesService}.
 * Imports {@link AuditModule} because every estimate write is audited.
 * `EstimatesService` is re-exported so downstream modules (e.g. job
 * conversion) can read estimate state without re-importing the
 * controller.
 */
@Module({
  imports: [AuditModule],
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService]
})
export class EstimatesModule {}
