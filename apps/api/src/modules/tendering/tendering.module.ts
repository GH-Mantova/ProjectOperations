import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { TenderingController } from "./tendering.controller";
import { TenderingService } from "./tendering.service";
import { TenderClientNotesController } from "./tender-client-notes.controller";
import { TenderClientNotesService } from "./tender-client-notes.service";
import { TenderScopeDraftingController } from "./tender-scope-drafting.controller";
import { TenderScopeDraftingService } from "./tender-scope-drafting.service";

@Module({
  imports: [AuditModule],
  controllers: [TenderingController, TenderClientNotesController, TenderScopeDraftingController],
  providers: [TenderingService, TenderClientNotesService, TenderScopeDraftingService],
  exports: [TenderingService]
})
export class TenderingModule {}
