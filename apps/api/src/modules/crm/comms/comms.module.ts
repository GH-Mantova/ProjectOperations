import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { EmailModule } from "../../email/email.module";
import { CommsController } from "./comms.controller";
import { CommsService } from "./comms.service";
import { EmailLogService } from "./email-log.service";

/**
 * CRM-4: CommsModule — decoupled sub-module for internal threads + To-Do.
 *
 * Registered in AppModule directly (NOT nested inside CrmModule) to keep the
 * sub-module's boundary clean. The polymorphic (entityType, entityId) link
 * means comms doesn't import Account/Tender/Job/Contract modules, so this
 * whole tree can later be lifted out into its own product without a schema
 * divorce.
 *
 * CRM-5: EmailLogService is registered here so the email integration lives
 * inside the same sub-module boundary. It imports EmailModule to reuse the
 * existing M365 / Graph seam without re-implementing the provider.
 */
@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [CommsController],
  providers: [CommsService, EmailLogService],
  exports: [CommsService, EmailLogService]
})
export class CommsModule {}
