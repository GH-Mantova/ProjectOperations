import { Module } from "@nestjs/common";
import { EmailModule } from "../email/email.module";
import { PlatformModule } from "../platform/platform.module";
import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { PrequalController } from "./prequal.controller";
import { PrequalService } from "./prequal.service";

/**
 * Compliance module — §13 Forms & Compliance, the WHS / qualification expiry
 * surface. Wires the {@link ComplianceController} HTTP surface to the
 * {@link ComplianceService} business logic, and re-exports the service so
 * sibling modules (allocations, scheduler) can consult it for competency
 * checks. Imports {@link PlatformModule} for notification fan-out and
 * {@link EmailModule} for the daily expiry-alert digest.
 *
 * Also hosts the structured subcontractor prequalification workflow
 * ({@link PrequalController} + {@link PrequalService}) — a per-review-cycle
 * ledger that keeps history and drives the summary column on
 * `SubcontractorSupplier`.
 */
@Module({
  imports: [PlatformModule, EmailModule],
  controllers: [ComplianceController, PrequalController],
  providers: [ComplianceService, PrequalService],
  exports: [ComplianceService, PrequalService]
})
export class ComplianceModule {}
