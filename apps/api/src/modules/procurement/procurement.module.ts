import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { EmailModule } from "../email/email.module";
import { InventoryModule } from "../inventory/inventory.module";
import { XeroModule } from "../xero/xero.module";
import { CommitmentController } from "./commitment.controller";
import { CommitmentService } from "./commitment.service";
import { ProcurementController } from "./procurement.controller";
import { ProcurementService } from "./procurement.service";
import { VendorInvoiceController } from "./vendor-invoice.controller";
import { VendorInvoiceService } from "./vendor-invoice.service";

/**
 * PR-488 slice 1 — procurement request → approval → PO / receipt spine.
 * PR-629 slice 3 — three-way match: VendorInvoice + variance approval +
 *   PoReconcileAudit for project-close audit.
 * ERP gap A (this PR) — CommitmentService / CommitmentController: budget-facing
 * commitment (subcontract / PO) tracking against Job.
 * Xero-deepening — VendorInvoiceService pushes an ACCPAY bill after
 *   3-way match completes (MATCHED) or variance is approved (APPROVED).
 *
 * Extends existing modules (supplier records live in DirectoryModule;
 * approval routing consults the AuthorityService seam; supplier email uses
 * the shared EmailService; receipt movements flow through InventoryService).
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, EmailModule, InventoryModule, XeroModule],
  controllers: [ProcurementController, CommitmentController, VendorInvoiceController],
  providers: [ProcurementService, CommitmentService, VendorInvoiceService],
  exports: [ProcurementService, CommitmentService, VendorInvoiceService]
})
export class ProcurementModule {}
