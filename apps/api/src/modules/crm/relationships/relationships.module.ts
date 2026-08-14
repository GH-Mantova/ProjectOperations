import { Module } from "@nestjs/common";
import { PrismaModule } from "../../../prisma/prisma.module";
import { RelationshipsController } from "./relationships.controller";
import { RelationshipsService } from "./relationships.service";

/**
 * CRM-2: RelationshipsModule — RelationshipNote CRUD + derived intelligence:
 * - "going cold" nudge (accounts/contacts not recently contacted)
 * - "repeat business" surfacing (clients with >1 won tender)
 *
 * Registered inside CrmModule alongside AccountsModule.
 */
@Module({
  imports: [PrismaModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
  exports: [RelationshipsService]
})
export class RelationshipsModule {}
