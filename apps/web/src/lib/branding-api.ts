/**
 * branding-api.ts — typed client for all /admin/branding endpoints.
 *
 * Every branding write goes through this module. No component calls authFetch
 * for branding directly.
 *
 * TRAP 4 (hex ratchet): this file contains ZERO #RRGGBB literals. Any colour
 * values are received from callers and passed through opaquely; they are not
 * defined here.
 */
import { readApiErrorMessage } from "./api-errors";
import type { BrandScheme } from "./brand-scheme";

// ── Shared types ──────────────────────────────────────────────────────────────

export type BrandAssetKind = "LOGO_LIGHT" | "LOGO_DARK" | "FAVICON" | "PDF_LETTERHEAD";

export interface ColorSchemeRow {
  id: string;
  name: string;
  isCompanyDefault?: boolean;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  sidebarBgHex?: string | null;
  sidebarTextHex?: string | null;
  sidebarTextActiveHex?: string | null;
  surfacePageHex?: string | null;
  surfaceCardHex?: string | null;
  textPrimaryHex?: string | null;
  textSecondaryHex?: string | null;
  textMutedHex?: string | null;
  statusActiveHex?: string | null;
  statusWarningHex?: string | null;
  statusDangerHex?: string | null;
  statusInfoHex?: string | null;
  statusNeutralHex?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandingData {
  activeColorSchemeId: string | null;
  activeColorScheme: ColorSchemeRow | null;
  schemes: ColorSchemeRow[];
  assets: Record<BrandAssetKind, string | null>;
  legacy: {
    primaryColorHex: string;
    secondaryColorHex: string;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
    pdfLetterheadUrl: string | null;
  };
}

export type UpsertColorSchemePayload = {
  name: string;
  primaryColorHex: string;
  secondaryColorHex: string;
} & Partial<
  Pick<
    BrandScheme,
    | "sidebarBgHex"
    | "sidebarTextHex"
    | "sidebarTextActiveHex"
    | "surfacePageHex"
    | "surfaceCardHex"
    | "textPrimaryHex"
    | "textSecondaryHex"
    | "textMutedHex"
    | "statusActiveHex"
    | "statusWarningHex"
    | "statusDangerHex"
    | "statusInfoHex"
    | "statusNeutralHex"
  >
>;

// ── Fetch helper ──────────────────────────────────────────────────────────────

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const msg = await readApiErrorMessage(res);
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * GET /admin/branding
 * Returns aggregate branding: active scheme, all schemes, assets, legacy cols.
 */
export async function getBranding(authFetch: AuthFetch): Promise<BrandingData> {
  const res = await authFetch("/admin/branding");
  return parseOrThrow<BrandingData>(res);
}

/**
 * GET /admin/branding/color-schemes
 * Returns all saved color schemes ordered by name.
 */
export async function listColorSchemes(authFetch: AuthFetch): Promise<ColorSchemeRow[]> {
  const res = await authFetch("/admin/branding/color-schemes");
  return parseOrThrow<ColorSchemeRow[]>(res);
}

/**
 * POST /admin/branding/color-schemes
 * Create-or-update a named color scheme. Super-user only.
 * Send the complete edited scheme — omitting an optional field leaves the
 * stored value unchanged; explicit null means fall back to tokens.css.
 */
export async function upsertColorScheme(
  authFetch: AuthFetch,
  payload: UpsertColorSchemePayload
): Promise<ColorSchemeRow> {
  const res = await authFetch("/admin/branding/color-schemes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseOrThrow<ColorSchemeRow>(res);
}

/**
 * DELETE /admin/branding/color-schemes/:id
 * Delete a color scheme. Super-user only.
 */
export async function deleteColorScheme(
  authFetch: AuthFetch,
  id: string
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/admin/branding/color-schemes/${id}`, { method: "DELETE" });
  return parseOrThrow<{ ok: boolean }>(res);
}

/**
 * PUT /admin/branding/active-color-scheme
 * Set the active color scheme (or clear it with null). Super-user only.
 */
export async function setActiveColorScheme(
  authFetch: AuthFetch,
  schemeId: string | null
): Promise<BrandingData> {
  const res = await authFetch("/admin/branding/active-color-scheme", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schemeId })
  });
  return parseOrThrow<BrandingData>(res);
}

/**
 * PUT /admin/branding/assets
 * Create-or-update a per-kind brand asset URL. Super-user only.
 * Also mirrors the URL into the matching legacy string column.
 */
export async function upsertAsset(
  authFetch: AuthFetch,
  kind: BrandAssetKind,
  url: string
): Promise<unknown> {
  const res = await authFetch("/admin/branding/assets", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, url })
  });
  return parseOrThrow<unknown>(res);
}

/**
 * DELETE /admin/branding/assets/:kind
 * Delete a per-kind brand asset. Super-user only.
 */
export async function deleteAsset(
  authFetch: AuthFetch,
  kind: BrandAssetKind
): Promise<{ ok: boolean }> {
  const res = await authFetch(`/admin/branding/assets/${kind}`, { method: "DELETE" });
  return parseOrThrow<{ ok: boolean }>(res);
}
