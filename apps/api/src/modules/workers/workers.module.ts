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
  controllers: [WorkersController, WorkerAvailabilityController],
  providers: [WorkersService, WorkerAvailabilityService, PasswordService],
  exports: [WorkersService, WorkerAvailabilityService]
})
export class WorkersModule {}
