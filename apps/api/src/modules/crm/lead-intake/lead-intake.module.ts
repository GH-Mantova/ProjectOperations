import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { CrmModule } from "../crm.module";
import { LeadIntakeController } from "./lead-intake.controller";
import { LeadIntakeService } from "./lead-intake.service";

/**
 * CRM-3: LeadIntakeModule — multi-source lead capture + triage + Account linkage.
 *
 * Dependencies:
 *   - PrismaModule  (DB access for Opportunity / Account / DropReason)
 *   - CrmModule     (exports CrmService + AccountsModule; provides createLead,
 *                    generateDraftTender, and AccountsService)
 *
 * Registered in AppModule alongside CrmModule. No circular dependency:
 *   AppModule -> CrmModule (existing) + LeadIntakeModule -> CrmModule (re-imported).
 *   NestJS deduplicates module imports automatically.
 */
@Module({
  imports: [PrismaModule, CrmModule],
  controllers: [LeadIntakeController],
  providers: [LeadIntakeService],
  exports: [LeadIntakeService]
})
export class LeadIntakeModule {}
