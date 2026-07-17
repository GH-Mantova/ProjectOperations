import { Module } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { WorkerAvailabilityController } from "./availability.controller";
import { WorkerAvailabilityService } from "./availability.service";
import { LeaveRequestController } from "./leave-request.controller";
import { LeaveRequestService } from "./leave-request.service";
import { WorkersController } from "./workers.controller";
import { WorkersService } from "./workers.service";
import { AuthorizationModule } from "../authorization/authorization.module";

/**
 * Workers module — HR/compliance roster (WorkerProfile) plus worker leave,
 * unavailability, and the scheduler's availability overlay. Exports both
 * services so other modules (scheduler, resources) can reuse them.
 *
 * LeaveRequestService is wired here alongside AuthorizationModule so that
 * authority checks (leave.approve via AuthorityService) work without a
 * circular dependency.
 */
@Module({
  imports: [AuthorizationModule],
  // Order matters: WorkerAvailabilityController's static /workers/leaves,
  // /workers/unavailability, /workers/availability/overlay routes must register
  // BEFORE WorkersController's @Get(":id") param route, otherwise the wildcard
  // swallows the single-segment paths and returns 404 "Worker not found."
  // LeaveRequestController is at /workers/leave-requests so it is unambiguous.
  // See apps/api/src/common/__tests__/route-shadowing.guard.spec.ts.
  controllers: [WorkerAvailabilityController, LeaveRequestController, WorkersController],
  providers: [WorkersService, WorkerAvailabilityService, LeaveRequestService, PasswordService],
  exports: [WorkersService, WorkerAvailabilityService, LeaveRequestService]
})
export class WorkersModule {}
