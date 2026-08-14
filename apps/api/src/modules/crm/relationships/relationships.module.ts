import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

/**
 * CRM-2: RelationshipsModule — relationship notes, going-cold nudge, and
 * repeat-business signal.
 *
 * Registered inside CrmModule alongside AccountsModule. Exports
 * RelationshipsService so future sibling CRM sub-modules can depend on it.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService]
})
export class RelationshipsModule {}
