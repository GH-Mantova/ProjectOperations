import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";

/**
 * Case management module (slice 1) — D365 Customer Service parity for
 * construction. Tracks defects, warranty items, RFIs, and complaints as
 * cases from raise through to resolution. Includes a comment thread on
 * each case.
 *
 * Permissions: `cases.view` / `cases.manage` (registered in permission-registry).
 */
@Module({
  imports: [PrismaModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService]
})
export class CasesModule {}
