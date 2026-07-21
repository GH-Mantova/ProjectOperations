import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { TenderingModule } from "../tendering/tendering.module";
import { CrmController } from "./crm.controller";
import { CrmService } from "./crm.service";

/**
 * CRM module (Tier 4, slice 1) — Lead + Opportunity pipeline that sits
 * BEFORE a Tender. Reuses the existing Client / Contact / Tender models;
 * converts a firm opportunity into a Tender via TenderingService (no
 * data re-keying).
 *
 * Permissions: `crm.view` / `crm.manage` (registered in permission-registry).
 */
@Module({
  imports: [PrismaModule, TenderingModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService]
})
export class CrmModule {}
