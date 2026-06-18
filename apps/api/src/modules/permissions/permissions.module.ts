import { Module } from "@nestjs/common";
import { PermissionsController } from "./permissions.controller";
import { PermissionsService } from "./permissions.service";

/**
 * Permissions module — exposes the code-defined permission catalogue.
 *
 * The catalogue itself lives in `permission-registry` (code-as-truth) and is
 * synced into the database via `PermissionsService.syncRegistry` at boot;
 * this module only owns the read API. Role → permission mapping and the
 * `permissions.module.action` naming convention live alongside the registry
 * and the `@RequirePermissions` guard, which are intentionally outside this
 * module's surface.
 *
 * `PermissionsService` is re-exported so role/auth modules can list or
 * resync the catalogue without depending on the controller.
 */
@Module({
  controllers: [PermissionsController],
  providers: [PermissionsService],
  exports: [PermissionsService]
})
export class PermissionsModule {}
