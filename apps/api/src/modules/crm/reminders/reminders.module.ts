import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { PlatformModule } from "../../platform/platform.module";
import { CommsReminderService } from "./comms-reminder.service";
import { ReminderPolicyController } from "./reminder-policy.controller";
import { ReminderPolicyService } from "./reminder-policy.service";

/**
 * TR-1: RemindersModule — the CRM reminder sub-module.
 *
 * Sits alongside `crm/comms/` (TR_SCOPE_CRM, docs/plans/tender-reminders-plan.md
 * §0). Reminders cron over `CommTask` and `Tender`; they do NOT create threads,
 * so they do not belong inside CommsModule.
 *
 * TR-1 registered the policy read/write surface. TR-2 adds
 * `CommsReminderService` — the nightly cron that reads that policy and sweeps
 * the PRE-DUE / POST-SUBMISSION / TASK tracks. TR-3 adds the escalation pass
 * into this same module.
 *
 * `PlatformModule` is imported for `NotificationsService`, the single delivery
 * seam the cron writes through (the TR-2 prompt said `crm.module.ts` already
 * imported it — measured against origin/main, it does not; the import belongs
 * here anyway, next to the only consumer).
 *
 * `@nestjs/schedule` needs no import here: `ScheduleModule.forRoot()` is
 * registered once in `app.module.ts`, which is what discovers the `@Cron`
 * decorator on any provider in the graph. `forFeature()` would be redundant.
 *
 * `AuditService` is injected without an import here because `AuditModule` is
 * `@Global()`.
 *
 * Permissions: `crm.manage` (see the note at the top of
 * reminder-policy.controller.ts for why, and why not `tenders.manage`).
 */
@Module({
  imports: [PrismaModule, PlatformModule],
  controllers: [ReminderPolicyController],
  providers: [ReminderPolicyService, CommsReminderService],
  exports: [ReminderPolicyService, CommsReminderService]
})
export class RemindersModule {}
