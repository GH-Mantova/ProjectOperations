import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenderingModule } from "../tendering/tendering.module";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";
import { AccountsModule } from "./accounts/accounts.module";
import { PipelineDashboardModule } from "./pipeline/pipeline-dashboard.module";

/**
 * CRM module — Lead + Opportunity pipeline + Account spine (CRM-1) +
 * pipeline dashboard (CRM-6).
 *
 * The existing Lead/Opportunity sub-system sits BEFORE a Tender and converts
 * opportunities via TenderingService.
 *
 * CRM-1 added AccountsModule (Account spine + Client-360 view). CRM-6 adds
 * PipelineDashboardModule — read-only aggregation over the existing win/loss
 * capture (TenderOutcome) and Opportunity/Account roll-ups.
 *
 * Permissions: `crm.view` / `crm.manage` (registered in permission-registry).
 */
@Module({
  imports: [PrismaModule, TenderingModule, AccountsModule, PipelineDashboardModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService, AccountsModule, PipelineDashboardModule]
})
export class CrmModule {}
