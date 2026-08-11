import { Injectable } from "@nestjs/common";

// Tiny in-process pub/sub the vault write path uses to notify listeners that
// an ApiCredential row was created, updated, reordered, or deleted. The
// GeocodingChainService subscribes in onModuleInit and invalidates its 30s
// memoiser so the next autocomplete rebuilds the chain from the DB.
//
// Kept as a standalone provider (rather than a direct method call on
// GeocodingChainService) so ApiKeysModule stays free of a hard dependency on
// GeocodingModule — GeocodingChainService already depends on ApiKeysService,
// and the reverse import would create a cycle.
@Injectable()
export class ApiKeyMutationEvents {
  private readonly listeners = new Set<() => void>();

  onWrite(listener: () => void): void {
    this.listeners.add(listener);
  }

  emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

// Minimal adapter surface the vault "Test now" flow needs. Kept structural
// so GeocodingModule can register its concrete adapters without ApiKeysModule
// importing anything from GeocodingModule (avoids the same DI cycle as above).
export interface GeocodingProbeAdapter {
  autocomplete(text: string, apiKey: string, config?: unknown): Promise<unknown[]>;
}

// Registry the geocoding module populates at boot. ApiKeysService reads from
// it during per-type validation. Empty on any process that doesn't include
// GeocodingModule; validation falls back to "unknown adapter" in that case.
@Injectable()
export class GeocodingAdapterRegistry {
  private readonly adapters = new Map<string, GeocodingProbeAdapter>();

  register(key: string, adapter: GeocodingProbeAdapter): void {
    this.adapters.set(key, adapter);
  }

  get(key: string): GeocodingProbeAdapter | null {
    return this.adapters.get(key) ?? null;
  }
}
