import { Module } from "@nestjs/common";
import { PasswordService } from "../../common/security/password.service";
import { WorkerAvailabilityController } from "./availability.controller";
import { WorkerAvailabilityService } from "./availability.service";
import { WorkersController } from "./workers.controller";
import { WorkersService } from "./workers.service";

/**
 * Workers module — HR/compliance roster (WorkerProfile) plus worker leave,
 * unavailability, and the scheduler's availability overlay. Exports both
 * services so other modules (scheduler, resources) can reuse them.
 */
@Module({
  // Order matters: WorkerAvailabilityController's static /workers/leaves,
  // /workers/unavailability, /workers/availability/overlay routes must register
  // BEFORE WorkersController's @Get(":id") param route, otherwise the wildcard
  // swallows the single-segment paths and returns 404 "Worker not found."
  // See apps/api/src/common/__tests__/route-shadowing.guard.spec.ts.
  controllers: [WorkerAvailabilityController, WorkersController],
  providers: [WorkersService, WorkerAvailabilityService, PasswordService],
  exports: [WorkersService, WorkerAvailabilityService]
})
export class WorkersModule {}
