import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenderingModule } from "../tendering/tendering.module";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { AccountsModule } from "./accounts/accounts.module";

/**
 * CRM module — Lead + Opportunity pipeline + Account spine (CRM-1).
 *
 * The existing Lead/Opportunity sub-system sits BEFORE a Tender and converts
 * opportunities via TenderingService.
 *
 * CRM-1 adds the AccountsModule (Account spine + Client-360 view). Subsequent
 * CRM slices (CRM-2 relationships, CRM-3 lead intake, etc.) import
 * AccountsModule as their dependency.
 *
 * Permissions: `crm.view` / `crm.manage` (registered in permission-registry).
 */
@Module({
  imports: [PrismaModule, TenderingModule, AccountsModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService, AccountsModule]
})
export class CrmModule {}
