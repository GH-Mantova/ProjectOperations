import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { AuthorizationModule } from "../authorization/authorization.module";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";

/**
 * D365-parity Tier 1 — expense capture + approval spine.
 * Slice 2 (field/PWA capture), slice 3 (receipt OCR), and Xero push
 * (Xero-deepening) are separate future slices — do NOT add them here.
 *
 * Approval routing uses the existing AuthorityService seam so the Director
 * can configure spend ceilings at runtime without touching code.
 */
@Module({
  imports: [PrismaModule, AuditModule, AuthorizationModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService]
})
export class ExpensesModule {}
