/**
 * appearance-api.ts — thin fetch wrappers for the S7c-1 appearance-preferences
 * and branding/schemes endpoints.
 *
 * All three functions require an authenticated `authFetch` (from useAuth).
 * On a non-ok response each function reads the API error envelope with
 * `readApiErrorMessage` and throws an Error with that message, so callers
 * only need to handle `Error.message`.
 */
import { readApiErrorMessage } from "./api-errors";
import type { BrandScheme } from "./brand-scheme";

// ── Shape returned by GET /appearance-preferences/me ─────────────────────────

export type AppearancePreference = {
  density: "comfortable" | "compact";
  colourSchemeId: string | null;
  colourScheme: ColourSchemeDetail | null;
};

export type ColourSchemeDetail = {
  id: string;
  name: string;
  isCompanyDefault: boolean;
  primaryColorHex: string;
  secondaryColorHex: string;
  sidebarBgHex: string | null;
  sidebarTextHex: string | null;
  sidebarTextActiveHex: string | null;
  surfacePageHex: string | null;
  surfaceCardHex: string | null;
  textPrimaryHex: string | null;
  textSecondaryHex: string | null;
  textMutedHex: string | null;
  statusActiveHex: string | null;
  statusWarningHex: string | null;
  statusDangerHex: string | null;
  statusInfoHex: string | null;
  statusNeutralHex: string | null;
};

// ── Shape returned by GET /branding/schemes ───────────────────────────────────

export type SchemeListItem = {
  id: string;
  name: string;
  isCompanyDefault: boolean;
  primaryColorHex: string;
  secondaryColorHex: string;
  sidebarBgHex: string | null;
  sidebarTextHex: string | null;
  sidebarTextActiveHex: string | null;
  surfacePageHex: string | null;
  surfaceCardHex: string | null;
  textPrimaryHex: string | null;
  textSecondaryHex: string | null;
  textMutedHex: string | null;
  statusActiveHex: string | null;
  statusWarningHex: string | null;
  statusDangerHex: string | null;
  statusInfoHex: string | null;
  statusNeutralHex: string | null;
};

// ── Conversion helpers ────────────────────────────────────────────────────────

/**
 * Convert a ColourSchemeDetail or SchemeListItem to the BrandScheme shape
 * that setUserBrandOverride / applyBrandScheme accept.
 */
export function schemeToBrandScheme(s: SchemeListItem | ColourSchemeDetail): BrandScheme {
  return {
    primaryColorHex: s.primaryColorHex,
    secondaryColorHex: s.secondaryColorHex,
    sidebarBgHex: s.sidebarBgHex,
    sidebarTextHex: s.sidebarTextHex,
    sidebarTextActiveHex: s.sidebarTextActiveHex,
    surfacePageHex: s.surfacePageHex,
    surfaceCardHex: s.surfaceCardHex,
    textPrimaryHex: s.textPrimaryHex,
    textSecondaryHex: s.textSecondaryHex,
    textMutedHex: s.textMutedHex,
    statusActiveHex: s.statusActiveHex,
    statusWarningHex: s.statusWarningHex,
    statusDangerHex: s.statusDangerHex,
    statusInfoHex: s.statusInfoHex,
    statusNeutralHex: s.statusNeutralHex
  };
}

// ── authFetch type alias ──────────────────────────────────────────────────────

type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch the current user's appearance preferences.
 * Returns { density, colourSchemeId, colourScheme }.
 * Throws with the API's error message on failure.
 */
export async function getMyAppearance(authFetch: AuthFetch): Promise<AppearancePreference> {
  const response = await authFetch("/appearance-preferences/me");
  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message);
  }
  return response.json() as Promise<AppearancePreference>;
}

/**
 * Save the current user's appearance preferences.
 * Pass `{ density? }` and/or `{ colourSchemeId? }` — omit whichever you are
 * not changing.  colourSchemeId: null clears the personal choice.
 * Throws with the API's error message on failure.
 */
export async function saveMyAppearance(
  authFetch: AuthFetch,
  update: { density?: "comfortable" | "compact"; colourSchemeId?: string | null }
): Promise<AppearancePreference> {
  const response = await authFetch("/appearance-preferences/me", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update)
  });
  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message);
  }
  return response.json() as Promise<AppearancePreference>;
}

/**
 * Fetch the full list of colour schemes available to any signed-in user.
 * Throws with the API's error message on failure.
 */
export async function listSchemes(authFetch: AuthFetch): Promise<SchemeListItem[]> {
  const response = await authFetch("/branding/schemes");
  if (!response.ok) {
    const message = await readApiErrorMessage(response);
    throw new Error(message);
  }
  return response.json() as Promise<SchemeListItem[]>;
}
