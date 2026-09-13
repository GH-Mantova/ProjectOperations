import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { MaintenanceController } from "./maintenance.controller";
import { MaintenanceService } from "./maintenance.service";

/**
 * Nest module for §12 Maintenance — wires {@link MaintenanceController} to
 * {@link MaintenanceService} with Prisma and audit support. Exports
 * {@link MaintenanceService} so the scheduler module can consume the derived
 * maintenance summary when evaluating WARN / BLOCK signals on assets.
 *
 * PlatformModule is imported to provide NotificationsService for the F-8
 * usage-interval warning notifications.
 */
@Module({
  imports: [PrismaModule, AuditModule, PlatformModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService]
})
export class MaintenanceModule {}
