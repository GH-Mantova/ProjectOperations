import { Module, forwardRef } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { BidPrioritisationModule } from "../bid-prioritisation/bid-prioritisation.module";
import { ContractsModule } from "../contracts/contracts.module";
import { MasterDataModule } from "../master-data/master-data.module";
import { PlatformModule } from "../platform/platform.module";
import { ProjectsModule } from "../projects/projects.module";
import { RatesModule } from "../rates/rates.module";
import { WinLikelihoodModule } from "../win-likelihood/win-likelihood.module";
import { TenderRateSetController } from "./tender-rate-set.controller";
import { TenderRateSetService } from "./tender-rate-set.service";
import { TenderingController } from "./tendering.controller";
import { TenderNumberService } from "./tender-number.service";
import { TenderOutcomeCaptureService } from "./tender-outcome-capture.service";
import { TenderingService } from "./tendering.service";
import { WithdrawalReviewController } from "./withdrawal-review.controller";
import { WithdrawalReviewService } from "./withdrawal-review.service";
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
import { ScopeCostsController } from "./scope-costs.controller";
import { ScopeCostsService } from "./scope-costs.service";
import { ProposalsController } from "./scope/proposals.controller";
import { ProposalsService } from "./scope/proposals.service";
import { EstimateProposalsController } from "./scope/estimate-proposals.controller";
import { EstimateProposalsService } from "./scope/estimate-proposals.service";
import { QuoteProposalsController } from "./scope/quote-proposals.controller";
import { QuoteProposalsService } from "./scope/quote-proposals.service";
import { ClarificationProposalsController } from "./scope/clarification-proposals.controller";
import { ClarificationProposalsService } from "./scope/clarification-proposals.service";
import { ScopeSubLinkedItemController } from "./scope/scope-cards.controller";
import { AllocationService } from "./allocation.service";
import { CapacityService } from "./capacity.service";

@Module({
  imports: [AuditModule, BidPrioritisationModule, ContractsModule, MasterDataModule, PlatformModule, RatesModule, WinLikelihoodModule, forwardRef(() => ProjectsModule)],
  controllers: [
    // TenderLabelsController must be registered BEFORE TenderingController so
    // GET /tenders/labels hits the static-path handler here, not the greedy
    // GET /tenders/:id inside TenderingController.
    TenderLabelsController,
    TenderingController,
    // Withdrawn-review routes live on /tenders/:id/withdraw + /withdrawal/*.
    // Registered after TenderingController so its :id-scoped POSTs don't
    // shadow anything; static-path routes are still handled here first.
    WithdrawalReviewController,
    TenderEntriesController,
    TenderConvertController,
    TenderRateSetController,
    ScopeOfWorksController,
    ScopeRedesignController,
    ScopeCardCuttingController,
    ScopeWasteController,
    ScopeCardWasteController,
    ScopeCostsController,
    ProposalsController,
    EstimateProposalsController,
    QuoteProposalsController,
    ClarificationProposalsController,
    ScopeSubLinkedItemController
  ],
  providers: [
    TenderingService,
    TenderNumberService,
    TenderOutcomeCaptureService,
    WithdrawalReviewService,
    TenderLabelsService,
    TenderEntriesService,
    TenderRateSetService,
    ScopeOfWorksService,
    ScopeRedesignService,
    ScopeWasteService,
    ScopeCostsService,
    ProposalsService,
    EstimateProposalsService,
    QuoteProposalsService,
    ClarificationProposalsService,
    CapacityService,
    AllocationService
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
