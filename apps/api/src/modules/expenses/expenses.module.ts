import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { XeroModule } from "../xero/xero.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

/**
 * D365-parity Tier 1 — expense capture + approval spine.
 * Xero-deepening (feat/xero-deepening-bills-payments): on approval of a
 * reimbursable expense, pushBill fires async to Xero (graceful failure —
 * the expense approval succeeds regardless of Xero availability).
 *
 * Approval routing uses the existing AuthorityService seam so the Director
 * can configure spend ceilings at runtime without touching code.
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule, XeroModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService]
})
export class ExpensesModule {}
