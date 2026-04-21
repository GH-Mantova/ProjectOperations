import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { ProjectsModule } from "../projects/projects.module";
import { UserAiProvidersModule } from "../user-ai-providers/user-ai-providers.module";
import { TenderingController } from "./tendering.controller";
import { TenderingService } from "./tendering.service";
import { TenderClientNotesController } from "./tender-client-notes.controller";
import { TenderClientNotesService } from "./tender-client-notes.service";
import { TenderScopeDraftingController } from "./tender-scope-drafting.controller";
import { TenderScopeDraftingService } from "./tender-scope-drafting.service";
import { TenderConvertController } from "./tender-convert.controller";
import { ScopeOfWorksController } from "./scope-of-works.controller";
import { ScopeOfWorksService } from "./scope-of-works.service";
import { ScopeRedesignController } from "./scope-redesign.controller";
import { ScopeRedesignService } from "./scope-redesign.service";

@Module({
  imports: [AuditModule, PlatformModule, UserAiProvidersModule, forwardRef(() => ProjectsModule)],
  controllers: [
    TenderingController,
    TenderClientNotesController,
    TenderScopeDraftingController,
    TenderConvertController,
    ScopeOfWorksController,
    ScopeRedesignController
  ],
  providers: [
    TenderingService,
    TenderClientNotesService,
    TenderScopeDraftingService,
    ScopeOfWorksService,
    ScopeRedesignService
  ],
  exports: [TenderingService]
})
export class TenderingModule {}
