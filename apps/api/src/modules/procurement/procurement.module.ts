import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { EmailModule } from "../email/email.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CommitmentController } from "./commitment.controller";
import { CommitmentService } from "./commitment.service";
import { ProcurementController } from "./procurement.controller";
import { ProcurementService } from "./procurement.service";

/**
 * PR-488 slice 1 — procurement request → approval → PO / receipt spine.
 * ERP gap A (this PR) — CommitmentService / CommitmentController: budget-facing
 * commitment (subcontract / PO) tracking against Job.
 *
 * Extends existing modules (supplier records live in DirectoryModule;
 * approval routing consults the AuthorityService seam; supplier email uses
 * the shared EmailService; receipt movements flow through InventoryService).
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, EmailModule, InventoryModule],
  controllers: [ProcurementController, CommitmentController],
  providers: [ProcurementService, CommitmentService],
  exports: [ProcurementService, CommitmentService]
})
export class ProcurementModule {}
