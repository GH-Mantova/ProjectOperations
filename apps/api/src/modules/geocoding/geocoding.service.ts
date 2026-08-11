import { Injectable } from "@nestjs/common";
import type { GeoAutocompleteResult } from "./geocoding-adapter";
import { GeocodingChainService } from "./geocoding-chain.service";

// Server-side proxy over the ordered geocoding-provider failover chain
// (plan §4e). Autocomplete now delegates to GeocodingChainService — Geoapify
// is registered as the only adapter in SLICE-5, so a single-provider setup
// returns byte-identical suggestions to the pre-chain implementation.
//
// The public { configured, results, reason } shape is preserved (§1b) so the
// browser is unchanged. Provider API keys stay server-side; the chain resolves
// them via ApiKeysService.

export type { GeoapifySuggestion, GeoAutocompleteResult } from "./geocoding-adapter";

@Injectable()
export class GeocodingService {
  constructor(private readonly chain: GeocodingChainService) {}

  async autocomplete(text: string): Promise<GeoAutocompleteResult> {
    const query = (text ?? "").trim();
    if (query.length < 3) return { configured: true, results: [] };
    return this.chain.autocomplete(query);
  }
}
