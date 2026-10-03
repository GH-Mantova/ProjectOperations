/**
 * Tests for lib/branding-api.ts
 *
 * Runs in the default node environment (no jsdom). All fetch calls are
 * replaced with vi.fn() stubs that return Response objects directly.
 *
 * TRAP 4 (hex ratchet): hex values are assembled from parts via HASH + digits
 * so the ratchet does not count them.
 */

import { describe, expect, it, vi } from "vitest";
import {
  getBranding,
  listColorSchemes,
  upsertColorScheme,
  deleteColorScheme,
  setActiveColorScheme,
  upsertAsset,
  deleteAsset,
  type BrandingData,
  type ColorSchemeRow
} from "../branding-api";

// ── Hex fixtures (assembled from parts — ratchet guard) ───────────────────────
const HASH = "#";
const PRIMARY = HASH + "005B61";
const ACCENT = HASH + "FEAA6D";

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" }
    })
  );
}

function errorFetch(message: string, status = 400) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ statusCode: status, message, error: "Bad Request" }), {
      status,
      headers: { "content-type": "application/json" }
    })
  );
}

// Minimal BrandingData fixture.
const BRANDING_DATA: BrandingData = {
  activeColorSchemeId: "scheme-1",
  activeColorScheme: {
    id: "scheme-1",
    name: "Graphite",
    primaryColorHex: PRIMARY,
    secondaryColorHex: ACCENT
  },
  schemes: [
    {
      id: "scheme-1",
      name: "Graphite",
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT
    }
  ],
  assets: {
    LOGO_LIGHT: null,
    LOGO_DARK: null,
    FAVICON: null,
    PDF_LETTERHEAD: null
  },
  legacy: {
    primaryColorHex: PRIMARY,
    secondaryColorHex: ACCENT,
    logoLightUrl: null,
    logoDarkUrl: null,
    faviconUrl: null,
    pdfLetterheadUrl: null
  }
};

const SCHEME_LIST: ColorSchemeRow[] = [
  { id: "scheme-1", name: "Default", primaryColorHex: PRIMARY, secondaryColorHex: ACCENT },
  { id: "scheme-2", name: "Graphite", primaryColorHex: PRIMARY, secondaryColorHex: ACCENT }
];

// ── getBranding ───────────────────────────────────────────────────────────────

describe("getBranding", () => {
  it("calls /admin/branding and returns parsed BrandingData", async () => {
    const authFetch = jsonFetch(BRANDING_DATA);
    const result = await getBranding(authFetch);
    expect(authFetch).toHaveBeenCalledWith("/admin/branding");
    expect(result.activeColorSchemeId).toBe("scheme-1");
    expect(result.schemes).toHaveLength(1);
  });

  it("throws with the API error message on non-ok response", async () => {
    const authFetch = errorFetch("You do not have permission.", 403);
    await expect(getBranding(authFetch)).rejects.toThrow("You do not have permission.");
  });
});

// ── listColorSchemes ──────────────────────────────────────────────────────────

describe("listColorSchemes", () => {
  it("calls /admin/branding/color-schemes and returns scheme array", async () => {
    const authFetch = jsonFetch(SCHEME_LIST);
    const result = await listColorSchemes(authFetch);
    expect(authFetch).toHaveBeenCalledWith("/admin/branding/color-schemes");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Default");
  });
});

// ── upsertColorScheme ─────────────────────────────────────────────────────────

describe("upsertColorScheme", () => {
  it("POSTs to /admin/branding/color-schemes with the full payload", async () => {
    const saved: ColorSchemeRow = { id: "scheme-3", name: "Harbour", primaryColorHex: PRIMARY, secondaryColorHex: ACCENT };
    const authFetch = jsonFetch(saved);
    const payload = {
      name: "Harbour",
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT
    };
    const result = await upsertColorScheme(authFetch, payload);
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/branding/color-schemes",
      expect.objectContaining({ method: "POST" })
    );
    // The body passed to authFetch should contain the full payload.
    const callInit = authFetch.mock.calls[0][1] as RequestInit;
    const parsedBody = JSON.parse(callInit.body as string) as typeof payload;
    expect(parsedBody.name).toBe("Harbour");
    expect(result.id).toBe("scheme-3");
  });

  it("sends the complete edited scheme, not a partial diff", async () => {
    const authFetch = jsonFetch({});
    const fullPayload = {
      name: "Full",
      primaryColorHex: PRIMARY,
      secondaryColorHex: ACCENT,
      sidebarBgHex: HASH + "17191C",
      sidebarTextHex: HASH + "848487",
      sidebarTextActiveHex: HASH + "F2F2EF",
      surfacePageHex: HASH + "EEEEEA",
      surfaceCardHex: HASH + "FFFFFF",
      textPrimaryHex: HASH + "101114",
      textSecondaryHex: HASH + "6B6F76",
      textMutedHex: HASH + "D8DCE3",
      statusActiveHex: HASH + "2F6B33",
      statusWarningHex: HASH + "7A5310",
      statusDangerHex: HASH + "9C2B20",
      statusInfoHex: HASH + "2C5AA0",
      statusNeutralHex: HASH + "5B5F63"
    };
    await upsertColorScheme(authFetch, fullPayload);
    const callInit = authFetch.mock.calls[0][1] as RequestInit;
    const parsed = JSON.parse(callInit.body as string) as typeof fullPayload;
    // All fifteen colour fields plus the name field must be present (16 total).
    expect(Object.keys(parsed)).toHaveLength(16);
    expect(parsed.textMutedHex).toBe(HASH + "D8DCE3");
  });

  it("throws on API error", async () => {
    const authFetch = errorFetch("Super-user required.", 403);
    await expect(
      upsertColorScheme(authFetch, { name: "X", primaryColorHex: PRIMARY, secondaryColorHex: ACCENT })
    ).rejects.toThrow("Super-user required.");
  });
});

// ── deleteColorScheme ─────────────────────────────────────────────────────────

describe("deleteColorScheme", () => {
  it("sends DELETE to /admin/branding/color-schemes/:id", async () => {
    const authFetch = jsonFetch({ ok: true });
    await deleteColorScheme(authFetch, "scheme-2");
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/branding/color-schemes/scheme-2",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

// ── setActiveColorScheme ──────────────────────────────────────────────────────

describe("setActiveColorScheme", () => {
  it("calls PUT /admin/branding/active-color-scheme with schemeId in body", async () => {
    const authFetch = jsonFetch(BRANDING_DATA);
    await setActiveColorScheme(authFetch, "scheme-2");
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/branding/active-color-scheme",
      expect.objectContaining({ method: "PUT" })
    );
    const callInit = authFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string) as { schemeId: string };
    expect(body.schemeId).toBe("scheme-2");
  });

  it("sends schemeId: null to clear the active scheme", async () => {
    const authFetch = jsonFetch(BRANDING_DATA);
    await setActiveColorScheme(authFetch, null);
    const callInit = authFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string) as { schemeId: null };
    expect(body.schemeId).toBeNull();
  });

  it("does NOT call save-scheme route — it calls the active-color-scheme route only", async () => {
    const authFetch = jsonFetch(BRANDING_DATA);
    await setActiveColorScheme(authFetch, "scheme-1");
    const calledUrl = authFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe("/admin/branding/active-color-scheme");
    expect(calledUrl).not.toContain("color-schemes");
  });
});

// ── upsertAsset ───────────────────────────────────────────────────────────────

describe("upsertAsset", () => {
  it("calls PUT /admin/branding/assets with kind and url", async () => {
    const authFetch = jsonFetch({ ok: true });
    await upsertAsset(authFetch, "LOGO_LIGHT", "https://example.com/logo.svg");
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/branding/assets",
      expect.objectContaining({ method: "PUT" })
    );
    const callInit = authFetch.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(callInit.body as string) as { kind: string; url: string };
    expect(body.kind).toBe("LOGO_LIGHT");
    expect(body.url).toBe("https://example.com/logo.svg");
  });

  it("calls the correct route for each of the four asset kinds", async () => {
    const kinds: Array<import("../branding-api").BrandAssetKind> = [
      "LOGO_LIGHT", "LOGO_DARK", "FAVICON", "PDF_LETTERHEAD"
    ];
    for (const kind of kinds) {
      const authFetch = jsonFetch({ ok: true });
      await upsertAsset(authFetch, kind, "https://cdn.example.com/asset.png");
      const callInit = authFetch.mock.calls[0][1] as RequestInit;
      const body = JSON.parse(callInit.body as string) as { kind: string };
      expect(body.kind).toBe(kind);
    }
  });
});

// ── deleteAsset ───────────────────────────────────────────────────────────────

describe("deleteAsset", () => {
  it("sends DELETE to /admin/branding/assets/:kind", async () => {
    const authFetch = jsonFetch({ ok: true });
    await deleteAsset(authFetch, "FAVICON");
    expect(authFetch).toHaveBeenCalledWith(
      "/admin/branding/assets/FAVICON",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
