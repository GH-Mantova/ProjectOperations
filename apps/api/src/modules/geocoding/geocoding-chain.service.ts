import { Inject, Injectable, Logger, Optional, type OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ApiKeysService } from "../api-keys/api-keys.service";
import {
  ApiKeyMutationEvents,
  GeocodingAdapterRegistry
} from "../api-keys/api-key-mutation-events";
import { GeoapifyAdapter } from "./adapters/geoapify.adapter";
import { GeocodifyAdapter } from "./adapters/geocodify.adapter";
import { GoogleAdapter } from "./adapters/google.adapter";
import { MapTilerAdapter } from "./adapters/maptiler.adapter";
import { NominatimAdapter } from "./adapters/nominatim.adapter";
import { GeoapifySuggestion, GeocodingAdapter } from "./geocoding-adapter";

// Ordered provider-failover chain for AUTOCOMPLETE, FORWARD, and REVERSE
// geocode (plan §4e / §4f).
//
// The chain query: enabled ApiCredential rows whose ApiKeyType.systemKind is
// "geocoding", ordered by `order` ASC with NULLS LAST (plan §2c). We iterate
// in that order, resolve the key via ApiKeysService.resolve for each row, and
// invoke the matching adapter's autocomplete(). A row is skipped and the next
// row tried on: no key, adapter timeout, network error, non-2xx, or zero
// results. If the chain is exhausted -> empty results (still "configured");
// if no geocoding provider is configured at all -> "not configured".
//
// The chain list is memoised for 30 s to avoid a DB hit per keystroke. Any
// mutation of ApiCredential can call invalidate() to force a refresh — the
// short TTL is the belt-and-braces path.

interface ChainRow {
  id: string;
  adapter: string;
  order: number | null;
  config: unknown;
}

const CHAIN_TTL_MS = 30_000;

@Injectable()
export class GeocodingChainService implements OnModuleInit {
  private readonly logger = new Logger(GeocodingChainService.name);

  private readonly adaptersByKey = new Map<string, GeocodingAdapter>();

  private cachedChain: ChainRow[] | null = null;
  private cachedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeys: ApiKeysService,
    @Inject(GeoapifyAdapter) geoapify: GeoapifyAdapter,
    @Inject(GoogleAdapter) google: GoogleAdapter,
    @Inject(GeocodifyAdapter) geocodify: GeocodifyAdapter,
    @Inject(MapTilerAdapter) maptiler: MapTilerAdapter,
    @Inject(NominatimAdapter) nominatim: NominatimAdapter,
    @Optional() private readonly mutationEvents?: ApiKeyMutationEvents,
    @Optional() private readonly adapterRegistry?: GeocodingAdapterRegistry
  ) {
    this.register(geoapify);
    this.register(google);
    this.register(geocodify);
    this.register(maptiler);
    this.register(nominatim);
  }

  onModuleInit(): void {
    // Subscribe the 30s memoiser invalidator to the vault's write bus so an
    // ApiCredential change is reflected in the next autocomplete without
    // waiting for the TTL. The TTL is the belt-and-braces path if the bus is
    // absent (e.g. in a stripped unit-test wiring).
    this.mutationEvents?.onWrite(() => this.invalidate());
    // Publish adapter instances to the shared registry so ApiKeysService can
    // run the "Test now" probe without importing GeocodingModule.
    if (this.adapterRegistry) {
      for (const adapter of this.adaptersByKey.values()) {
        this.adapterRegistry.register(adapter.key, adapter);
      }
    }
  }

  register(adapter: GeocodingAdapter): void {
    this.adaptersByKey.set(adapter.key, adapter);
  }

  getAdapter(key: string): GeocodingAdapter | null {
    return this.adaptersByKey.get(key) ?? null;
  }

  // Callers on the ApiCredential write path invoke this to invalidate the
  // memoised chain so the next autocomplete rebuilds it from the DB.
  invalidate(): void {
    this.cachedChain = null;
    this.cachedAt = 0;
  }

  async autocomplete(query: string): Promise<{
    configured: boolean;
    results: GeoapifySuggestion[];
    reason?: string;
  }> {
    const chain = await this.loadChain();
    if (chain.length === 0) {
      return {
        configured: false,
        results: [],
        reason:
          "No geocoding provider is configured. An admin can add one in Admin → Settings → Integrations."
      };
    }

    let lastReason: string | undefined;
    for (const row of chain) {
      const adapter = this.adaptersByKey.get(row.adapter);
      if (!adapter) {
        // Row references an adapter this build doesn't ship (e.g. a SLICE-6
        // provider still to arrive). Skip and try the next.
        this.logger.debug(`Chain row ${row.id} references unknown adapter '${row.adapter}'; skipping.`);
        continue;
      }
      const apiKey = await this.apiKeys.resolve(row.adapter, "company");
      if (!apiKey) {
        // No key resolvable for this row (vault + legacy both empty). Skip.
        continue;
      }

      try {
        const results = await adapter.autocomplete(query, apiKey, row.config);
        if (results.length > 0) return { configured: true, results };
        // Zero results is treated as a fall-through signal per plan §4e.
        lastReason = `${row.adapter}: no results`;
      } catch (err) {
        // Timeout, network error, or non-2xx surfaced by the adapter.
        lastReason = `${row.adapter}: ${(err as Error).message}`;
        this.logger.warn(`Autocomplete via ${row.adapter} failed: ${lastReason}`);
      }
    }

    return {
      configured: true,
      results: [],
      reason: lastReason ? `Address lookup unavailable (${lastReason}).` : "Address lookup unavailable."
    };
  }

  // Forward geocode: iterates the same chain with the same fall-through
  // semantics as autocomplete. Not wired to any route in SLICE-6 — callers
  // that already exist on main will consume it directly.
  async forward(query: string): Promise<{
    configured: boolean;
    results: GeoapifySuggestion[];
    reason?: string;
  }> {
    return this.runChainOp(
      async (adapter, apiKey, config) => adapter.forward(query, apiKey, config),
      "forward"
    );
  }

  // Reverse geocode: iterates the same chain with the same fall-through
  // semantics as autocomplete.
  async reverse(lat: number, lon: number): Promise<{
    configured: boolean;
    results: GeoapifySuggestion[];
    reason?: string;
  }> {
    return this.runChainOp(
      async (adapter, apiKey, config) => adapter.reverse(lat, lon, apiKey, config),
      "reverse"
    );
  }

  // Shared iteration logic for forward + reverse (same as autocomplete but
  // extracted to avoid repetition).
  private async runChainOp(
    invoke: (adapter: GeocodingAdapter, apiKey: string, config: unknown) => Promise<GeoapifySuggestion[]>,
    opLabel: string
  ): Promise<{ configured: boolean; results: GeoapifySuggestion[]; reason?: string }> {
    const chain = await this.loadChain();
    if (chain.length === 0) {
      return {
        configured: false,
        results: [],
        reason:
          "No geocoding provider is configured. An admin can add one in Admin → Settings → Integrations."
      };
    }

    let lastReason: string | undefined;
    for (const row of chain) {
      const adapter = this.adaptersByKey.get(row.adapter);
      if (!adapter) {
        this.logger.debug(`Chain row ${row.id} references unknown adapter '${row.adapter}'; skipping.`);
        continue;
      }
      const apiKey = await this.apiKeys.resolve(row.adapter, "company");
      if (!apiKey) {
        continue;
      }

      try {
        const results = await invoke(adapter, apiKey, row.config);
        if (results.length > 0) return { configured: true, results };
        lastReason = `${row.adapter}: no results`;
      } catch (err) {
        lastReason = `${row.adapter}: ${(err as Error).message}`;
        this.logger.warn(`${opLabel} via ${row.adapter} failed: ${lastReason}`);
      }
    }

    return {
      configured: true,
      results: [],
      reason: lastReason
        ? `Address lookup unavailable (${lastReason}).`
        : "Address lookup unavailable."
    };
  }

  private async loadChain(): Promise<ChainRow[]> {
    const now = Date.now();
    if (this.cachedChain && now - this.cachedAt < CHAIN_TTL_MS) {
      return this.cachedChain;
    }
    const rows = await this.prisma.apiCredential.findMany({
      where: {
        enabled: true,
        type: { systemKind: "geocoding" }
      },
      select: {
        id: true,
        adapter: true,
        order: true,
        config: true,
        type: { select: { systemKind: true } }
      }
    });

    // Prisma cannot express "ORDER BY order ASC NULLS LAST" cleanly for a
    // nullable Int on all providers, so we sort in-process. Any row with a
    // null order runs after every ordered row (plan §2c).
    const sorted = [...rows].sort((a, b) => {
      if (a.order === null && b.order === null) return 0;
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      return a.order - b.order;
    });

    // Rows without an `adapter` string cannot be dispatched; log once and drop.
    const chain: ChainRow[] = [];
    for (const row of sorted) {
      if (!row.adapter) {
        this.logger.warn(`Enabled geocoding credential ${row.id} has no adapter; excluded from chain.`);
        continue;
      }
      chain.push({
        id: row.id,
        adapter: row.adapter,
        order: row.order,
        config: row.config
      });
    }

    this.cachedChain = chain;
    this.cachedAt = now;
    return chain;
  }
}
