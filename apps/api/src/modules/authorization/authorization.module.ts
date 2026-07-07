import { Module } from "@nestjs/common";
import { AuthorityController } from "./authority.controller";
import { AuthorityService } from "./authority.service";

/**
 * Authorization module — configurable authority seam layered on top of
 * static RBAC. AuthorityService.check is the single decision point future
 * approval / spend-limit consumers route through. RBAC (PermissionsGuard +
 * permission-registry) is untouched.
 *
 * Default posture is open ceiling: absence of an AuthorityRule means the
 * seam returns `allowed: true`. Rules are Director-configurable data; this
 * PR ships the seam and its CRUD, no feature consumes it yet.
 */
@Module({
  controllers: [AuthorityController],
  providers: [AuthorityService],
  exports: [AuthorityService]
})
export class AuthorizationModule {}
