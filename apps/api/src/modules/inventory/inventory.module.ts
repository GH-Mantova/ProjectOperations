import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

/**
 * PR-486 — Native inventory / stock layer (slice 1).
 *
 * Wires the InventoryController + InventoryService. Depends on Prisma for
 * persistence and Audit for write-side logging. Kept intentionally isolated
 * from the Assets / Maintenance modules so consumable-stock semantics never
 * bleed into the serialised-plant register.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService]
})
export class InventoryModule {}
