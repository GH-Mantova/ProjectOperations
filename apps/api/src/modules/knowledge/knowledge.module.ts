import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { KnowledgeController } from "./knowledge.controller";
import { KnowledgeService } from "./knowledge.service";

/**
 * Internal Knowledge Base / SOP library (case management slice 2).
 *
 * Stores asbestos procedures, safe work methods, common defect fixes,
 * and how-tos for internal staff. Not public-facing / portal.
 *
 * Permissions: `knowledge.view` / `knowledge.manage`
 * (registered in permission-registry).
 *
 * Routes: GET|POST /kb/articles, GET|PATCH|DELETE /kb/articles/:id,
 *         POST /kb/articles/:id/publish
 */
@Module({
  imports: [PrismaModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService]
})
export class KnowledgeModule {}
