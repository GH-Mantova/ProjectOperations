import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { ProjectsModule } from "../projects/projects.module";
import { TenderingController } from "./tendering.controller";
import { TenderingService } from "./tendering.service";
import { TenderClientNotesController } from "./tender-client-notes.controller";
import { TenderClientNotesService } from "./tender-client-notes.service";
import { TenderScopeDraftingController } from "./tender-scope-drafting.controller";
import { TenderScopeDraftingService } from "./tender-scope-drafting.service";
import { TenderConvertController } from "./tender-convert.controller";

@Module({
  imports: [AuditModule, PlatformModule, forwardRef(() => ProjectsModule)],
  controllers: [
    TenderingController,
    TenderClientNotesController,
    TenderScopeDraftingController,
    TenderConvertController
  ],
  providers: [TenderingService, TenderClientNotesService, TenderScopeDraftingService],
  exports: [TenderingService]
})
export class TenderingModule {}
