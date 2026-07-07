import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { EmailModule } from "../email/email.module";
import { InventoryModule } from "../inventory/inventory.module";
import { ProcurementController } from "./procurement.controller";
import { ProcurementService } from "./procurement.service";

/**
 * PR-488 slice 1 — procurement request → approval → PO / receipt spine.
 * Extends existing modules (supplier records live in DirectoryModule;
 * approval routing consults the AuthorityService seam; supplier email uses
 * the shared EmailService; receipt movements flow through InventoryService).
 * Nothing existing is modified.
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, EmailModule, InventoryModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService]
})
export class ProcurementModule {}
