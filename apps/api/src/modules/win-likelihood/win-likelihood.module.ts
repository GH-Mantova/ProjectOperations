import { Module } from "@nestjs/common";
import { WinLikelihoodFeaturesService } from "./win-likelihood-features.service";
import { WinLikelihoodService } from "./win-likelihood.service";

/**
 * WL3-S1 — Bid-time feature extraction + baseline win-likelihood computation.
 *
 * Read-only, no schema change, no controller of its own. The two routes
 * (GET /tenders/:id/win-likelihood and GET /tenders/win-likelihood/capture-gaps)
 * are wired onto TenderingController, which imports this module.
 */
@Module({
  providers: [WinLikelihoodFeaturesService, WinLikelihoodService],
  exports: [WinLikelihoodService]
})
export class WinLikelihoodModule {}
