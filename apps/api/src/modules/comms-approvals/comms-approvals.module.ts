import { Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";
import { InternalMessagesController } from "./internal-messages.controller";
import { InternalMessagesService } from "./internal-messages.service";

/**
 * Comms + Approvals Phase 2 slice 1 (foundation).
 *
 * Delivers the record-anchored primitives the later slices will build on:
 * an approval-decision audit routed through the AuthorityService seam,
 * managerId-chain overrule, and internal DM/message store. No Outlook
 * mirroring and no mailbox UI in this slice.
 *
 * ApprovalsService reuses AuthorityService (from AuthorizationModule) and
 * writes fan-out via the existing `Notification` model directly, so
 * NotificationsService is not a dependency here.
 */
@Module({
  imports: [AuthorizationModule],
  controllers: [ApprovalsController, InternalMessagesController],
  providers: [ApprovalsService, InternalMessagesService],
  exports: [ApprovalsService, InternalMessagesService]
})
export class CommsApprovalsModule {}
