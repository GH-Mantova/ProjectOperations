import { Module } from "@nestjs/common";
import { ComplianceModule } from "../compliance/compliance.module";
import { PlatformModule } from "../platform/platform.module";
import { AllocationsController } from "./allocations.controller";
import { AllocationsService } from "./allocations.service";

/**
 * §9 Scheduler — worker and asset allocations on projects.
 *
 * Imports {@link PlatformModule} for {@link NotificationsService} (in-app
 * notifications fired on WORKER allocation) and {@link EmailService} (the
 * fire-and-forget notification email) and {@link ComplianceModule} for the
 * soft-warn competency gate evaluated on every WORKER allocation.
 *
 * Exposes only the HTTP controller — {@link AllocationsService} is not
 * re-exported because allocation writes carry side effects (activity log,
 * audit log, notifications) that should always go through the HTTP surface
 * rather than being invoked directly from sibling modules.
 */
@Module({
  imports: [PlatformModule, ComplianceModule],
  controllers: [AllocationsController],
  providers: [AllocationsService]
})
export class AllocationsModule {}
