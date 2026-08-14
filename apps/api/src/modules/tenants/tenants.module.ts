import { Module } from "@nestjs/common";
import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

/**
 * TenantsModule — MT-5 company admin UI.
 *
 * Exposes CRUD endpoints for Tenant rows under /tenants.
 * All endpoints are super-user only (JwtAuthGuard + SuperUserGuard on the controller).
 */
@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService]
})
export class TenantsModule {}
