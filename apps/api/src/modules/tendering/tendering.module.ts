import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ContractsModule } from "../contracts/contracts.module";
import { MasterDataModule } from "../master-data/master-data.module";
import { PlatformModule } from "../platform/platform.module";
import { ProjectsModule } from "../projects/projects.module";
import { RatesModule } from "../rates/rates.module";
import { TenderRateSetController } from "./tender-rate-set.controller";
import { TenderRateSetService } from "./tender-rate-set.service";
import { TenderingController } from "./tendering.controller";
import { TenderNumberService } from "./tender-number.service";
import { TenderingService } from "./tendering.service";
import { TenderClientNotesController } from "./tender-client-notes.controller";
import { TenderClientNotesService } from "./tender-client-notes.service";
import { TenderLabelsController } from "./tender-labels.controller";
import { TenderLabelsService } from "./tender-labels.service";
import { TenderEntriesController } from "./tender-entries.controller";
import { TenderEntriesService } from "./tender-entries.service";
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
import { QuoteProposalsController } from "./scope/quote-proposals.controller";
import { QuoteProposalsService } from "./scope/quote-proposals.service";
import { ClarificationProposalsController } from "./scope/clarification-proposals.controller";
import { ClarificationProposalsService } from "./scope/clarification-proposals.service";

@Module({
  imports: [AuditModule, ContractsModule, MasterDataModule, PlatformModule, RatesModule, forwardRef(() => ProjectsModule)],
  controllers: [
    // TenderLabelsController must be registered BEFORE TenderingController so
    // GET /tenders/labels hits the static-path handler here, not the greedy
    // GET /tenders/:id inside TenderingController.
    TenderLabelsController,
    TenderingController,
    TenderClientNotesController,
    TenderEntriesController,
    TenderConvertController,
    TenderRateSetController,
    ScopeOfWorksController,
    ScopeRedesignController,
    ScopeCardCuttingController,
    ScopeWasteController,
    ScopeCardWasteController,
    ProposalsController,
    EstimateProposalsController,
    QuoteProposalsController,
    ClarificationProposalsController
  ],
  providers: [
    TenderingService,
    TenderNumberService,
    TenderLabelsService,
    TenderClientNotesService,
    TenderEntriesService,
    TenderRateSetService,
    ScopeOfWorksService,
    ScopeRedesignService,
    ScopeWasteService,
    ProposalsService,
    EstimateProposalsService,
    QuoteProposalsService,
    ClarificationProposalsService
  ],
  exports: [
    TenderingService,
    ScopeRedesignService,
    ScopeWasteService,
    ProposalsService,
    EstimateProposalsService,
    QuoteProposalsService,
    ClarificationProposalsService
  ]
})
/** NestJS module wiring tendering controllers, services, and submodules. */
export class TenderingModule {}
