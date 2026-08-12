import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { CommsController } from "./comms.controller";
import { CommsService } from "./comms.service";

/**
 * CRM-4: CommsModule — decoupled sub-module for internal threads + To-Do.
 *
 * Registered in AppModule directly (NOT nested inside CrmModule) to keep the
 * sub-module's boundary clean. The polymorphic (entityType, entityId) link
 * means comms doesn't import Account/Tender/Job/Contract modules, so this
 * whole tree can later be lifted out into its own product without a schema
 * divorce.
 *
 * CRM-5 (email-log.service.ts) will extend this module with the Outlook /
 * Graph email logging seam.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CommsController],
  providers: [CommsService],
  exports: [CommsService]
})
export class CommsModule {}
