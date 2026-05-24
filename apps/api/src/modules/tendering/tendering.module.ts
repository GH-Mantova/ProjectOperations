import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { ProjectsModule } from "../projects/projects.module";
import { TenderingController } from "./tendering.controller";
import { TenderingService } from "./tendering.service";
import { TenderClientNotesController } from "./tender-client-notes.controller";
import { TenderClientNotesService } from "./tender-client-notes.service";
import { TenderConvertController } from "./tender-convert.controller";
import { ScopeOfWorksController } from "./scope-of-works.controller";
import { ScopeOfWorksService } from "./scope-of-works.service";
import { ScopeRedesignController, ScopeCardCuttingController } from "./scope-redesign.controller";
import { ScopeRedesignService } from "./scope-redesign.service";
import { ScopeWasteController, ScopeCardWasteController } from "./scope-waste.controller";
import { ScopeWasteService } from "./scope-waste.service";
import { ProposalsController } from "./scope/proposals.controller";
import { ProposalsService } from "./scope/proposals.service";
import { EstimateProposalsController } from "./scope/estimate-proposals.controller";
import { EstimateProposalsService } from "./scope/estimate-proposals.service";

@Module({
  imports: [AuditModule, PlatformModule, forwardRef(() => ProjectsModule)],
  controllers: [
    TenderingController,
    TenderClientNotesController,
    TenderConvertController,
    ScopeOfWorksController,
    ScopeRedesignController,
    ScopeCardCuttingController,
    ScopeWasteController,
    ScopeCardWasteController,
    ProposalsController,
    EstimateProposalsController
  ],
  providers: [
    TenderingService,
    TenderClientNotesService,
    ScopeOfWorksService,
    ScopeRedesignService,
    ScopeWasteService,
    ProposalsService,
    EstimateProposalsService
  ],
  exports: [
    TenderingService,
    ScopeRedesignService,
    ScopeWasteService,
    ProposalsService,
    EstimateProposalsService
  ]
})
export class TenderingModule {}
