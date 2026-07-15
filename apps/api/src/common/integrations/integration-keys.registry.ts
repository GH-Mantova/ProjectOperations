// Catalogue of known third-party integrations that keep their API key in
// the ERP (encrypted, editable from Admin settings) instead of Azure App
// Service config.
//
// - slug: primary key of IntegrationCredential; also used by
//   resolveIntegrationKey(slug) callers.
// - label: what the UI shows.
// - envVar: legacy env var name. resolveIntegrationKey falls back to
//   process.env[envVar] when the DB row has no value, so keys already set
//   in Azure keep working during the transition.
// - description (optional): shown under the label in the admin UI.
//
// Add a new integration by appending a row here and referencing the slug
// from the integration client. The seeder (seedIntegrationCredentials)
// upserts every registry row into the DB as an empty row so the UI shows
// it even before it's configured.

export type IntegrationSlug = "geoapify" | "fuelpricesqld";

export interface IntegrationDefinition {
  slug: IntegrationSlug;
  label: string;
  envVar: string;
  description?: string;
}

export const INTEGRATION_REGISTRY: readonly IntegrationDefinition[] = [
  {
    slug: "geoapify",
    label: "Geoapify",
    envVar: "GEOAPIFY_API_KEY",
    description: "Address autocomplete + geocoding used by the sites/addresses forms."
  },
  {
    slug: "fuelpricesqld",
    label: "fuelpricesqld",
    envVar: "FUELPRICESQLD_API_KEY",
    description: "Queensland fuel price feed used by fuel-cost calculations."
  }
] as const;

export function findIntegrationDefinition(slug: string): IntegrationDefinition | null {
  return INTEGRATION_REGISTRY.find((entry) => entry.slug === slug) ?? null;
}
