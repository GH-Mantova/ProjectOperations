import { Module } from "@nestjs/common";
import { ResourcesController } from "./resources.controller";
import { ResourcesService } from "./resources.service";

/**
 * Module 10 — Resources and Competencies.
 *
 * Wires the scheduler-facing resources REST surface
 * ({@link ResourcesController}) — workers, availability windows, role
 * suitabilities, and shift role requirements — together with
 * {@link ResourcesService}. The service is exported so other modules
 * (scheduler, jobs) can read worker availability and suitability
 * without going through HTTP.
 */
@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService]
})
export class ResourcesModule {}
