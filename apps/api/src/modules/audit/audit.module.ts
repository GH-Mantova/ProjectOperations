import { Global, Module } from "@nestjs/common";
import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";

/**
 * Global module exposing the platform audit trail.
 *
 * Registered as `@Global()` so any feature module can inject `AuditService`
 * without re-importing — every protected write across the platform funnels
 * through it. Mounts the read-only `AuditController` for browsing entries.
 *
 * Audit rows are append-only: callers `write(...)` after mutating state,
 * and the records are never updated or deleted in-band.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService]
})
export class AuditModule {}
