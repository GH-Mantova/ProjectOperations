import { Module } from "@nestjs/common";
import { WinLikelihoodModule } from "../win-likelihood/win-likelihood.module";
import { BidPrioritisationService } from "./bid-prioritisation.service";

/**
 * BP-1 — Bid-prioritisation module.
 *
 * Provides BidPrioritisationService, which computes an expected-value ranking
 * of open tenders by calling WinLikelihoodService.
 *
 * ADVISORY ONLY — the ranking MUST NOT feed pricing, auto-accept, or auto-reject.
 * It is a decision-support surface only.
 */
@Module({
  imports: [WinLikelihoodModule],
  providers: [BidPrioritisationService],
  exports: [BidPrioritisationService]
})
export class BidPrioritisationModule {}
