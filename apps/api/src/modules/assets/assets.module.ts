import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

/**
 * Module 11 — Assets and Equipment.
 *
 * Wires the assets controller and service, depends on Prisma for persistence
 * and the Audit module for write-side audit logging. Exports AssetsService so
 * other modules (scheduler, maintenance) can read asset state.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService]
})
export class AssetsModule {}
