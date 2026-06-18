import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

/**
 * Roles module — role administration and role-permission linking.
 *
 * A role is a named bundle of permissions; a permission is an atomic
 * capability key (for example `roles.view`) checked by PermissionsGuard.
 * Users hold roles, and the union of their roles' permissions determines
 * what they may do.
 *
 * Exports RolesService so other modules (notably Users) can resolve and
 * assign roles. Depends on AuditModule for `roles.create` / `roles.update`
 * audit entries.
 */
@Module({
  imports: [AuditModule],
  controllers: [RolesController],
  providers: [RolesService],
  exports: [RolesService]
})
export class RolesModule {}
