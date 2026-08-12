import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { PipelineDashboardController } from "./pipeline-dashboard.controller";
import { PipelineDashboardService } from "./pipeline-dashboard.service";

/**
 * CRM-6: PipelineDashboardModule — read-only aggregation over the existing
 * win/loss capture (TenderOutcome) and Opportunity/Account roll-ups. No
 * schema change. Registered inside CrmModule alongside AccountsModule.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PipelineDashboardController],
  providers: [PipelineDashboardService],
  exports: [PipelineDashboardService]
})
export class PipelineDashboardModule {}
