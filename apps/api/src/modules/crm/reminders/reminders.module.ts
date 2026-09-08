import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { ReminderPolicyController } from "./reminder-policy.controller";
import { ReminderPolicyService } from "./reminder-policy.service";

/**
 * TR-1: RemindersModule — the CRM reminder sub-module.
 *
 * Sits alongside `crm/comms/` (TR_SCOPE_CRM, docs/plans/tender-reminders-plan.md
 * §0). Reminders cron over `CommTask` and `Tender`; they do NOT create threads,
 * so they do not belong inside CommsModule.
 *
 * TR-1 registers only the policy read/write surface. TR-2 adds the cron
 * service and TR-3 the escalation pass into this same module.
 *
 * `AuditService` is injected without an import here because `AuditModule` is
 * `@Global()`.
 *
 * Permissions: `crm.manage` (see the note at the top of
 * reminder-policy.controller.ts for why, and why not `tenders.manage`).
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReminderPolicyController],
  providers: [ReminderPolicyService],
  exports: [ReminderPolicyService]
})
export class RemindersModule {}
