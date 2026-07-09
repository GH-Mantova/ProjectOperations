/**
 * Logic specs for WidgetSettingsPopover's dynamic option resolution.
 *
 * The web workspace has no jsdom / @testing-library set up (same pattern as
 * teamEstimatorActions.test.ts), so we cover the testable seam — the pure
 * resolver that both the select/period and multiselect branches now consult —
 * directly. Regression guard for the Site weather widget picker: a select-type
 * field with `dynamicOptions: "sites"` was rendering an empty dropdown because
 * the select branch inlined `field.options?.map(...)` and never consulted the
 * dynamic sources.
 */
import { describe, expect, it, vi } from "vitest";
import type { TenderForDashboard } from "../hooks";
import type { ConfigField } from "../types";
import {
  SITES_OPTIONS_URL,
  fetchSiteOptions,
  resolveDynamicOptions,
  type DynamicOptionSources
} from "../WidgetSettingsPopover";

const emptySources: DynamicOptionSources = {
  tenders: undefined,
  formTemplates: [],
  sites: []
};

describe("resolveDynamicOptions", () => {
  it("returns fetched site options for a select field with dynamicOptions:'sites'", () => {
    const field: ConfigField = {
      key: "siteId",
      label: "Site",
      type: "select",
      dynamicOptions: "sites"
    };
    const sources: DynamicOptionSources = {
      ...emptySources,
      sites: [
        { value: "site-1", label: "Alpha" },
        { value: "site-2", label: "Bravo" }
      ]
    };

    expect(resolveDynamicOptions(field, sources)).toEqual([
      { value: "site-1", label: "Alpha" },
      { value: "site-2", label: "Bravo" }
    ]);
  });

  it("returns static options for a select field that provides its own options (regression guard)", () => {
    const field: ConfigField = {
      key: "period",
      label: "Period",
      type: "period",
      options: [
        { value: "30d", label: "30 days" },
        { value: "90d", label: "90 days" }
      ]
    };

    expect(resolveDynamicOptions(field, emptySources)).toEqual([
      { value: "30d", label: "30 days" },
      { value: "90d", label: "90 days" }
    ]);
  });

  it("also resolves dynamicOptions for a multiselect field (both branches share this seam)", () => {
    const field: ConfigField = {
      key: "siteIds",
      label: "Sites",
      type: "multiselect",
      dynamicOptions: "sites"
    };
    const sources: DynamicOptionSources = {
      ...emptySources,
      sites: [{ value: "s", label: "Only" }]
    };

    expect(resolveDynamicOptions(field, sources)).toEqual([{ value: "s", label: "Only" }]);
  });

  it("deduplicates and sorts estimators pulled from tenders", () => {
    const field: ConfigField = {
      key: "estimatorId",
      label: "Estimator",
      type: "select",
      dynamicOptions: "estimators"
    };
    const t = (id: string, first: string, last: string): TenderForDashboard =>
      ({
        id: `t-${id}`,
        tenderNumber: `T-${id}`,
        title: "",
        status: "open",
        estimator: { id, firstName: first, lastName: last },
        tenderClients: [],
        tenderNotes: []
      }) as TenderForDashboard;

    const sources: DynamicOptionSources = {
      ...emptySources,
      tenders: [t("u1", "Rita", "Park"), t("u2", "Amir", "Khan"), t("u1", "Rita", "Park")]
    };

    expect(resolveDynamicOptions(field, sources)).toEqual([
      { value: "u2", label: "Amir Khan" },
      { value: "u1", label: "Rita Park" }
    ]);
  });

  it("returns [] when a field has neither static options nor a known dynamic source", () => {
    const field: ConfigField = { key: "x", label: "X", type: "select" };
    expect(resolveDynamicOptions(field, emptySources)).toEqual([]);
  });
});

/**
 * Regression guard for rev-527-fix2 — the site picker was rendering an empty
 * <select> because useSites() requested pageSize=200 and PaginationQueryDto
 * (shared API validator) caps it at 100, returning HTTP 400 that the loader
 * swallowed. Assert against the URL passed to the mocked authFetch so any
 * future reintroduction of a >100 pageSize fails in CI.
 */
describe("fetchSiteOptions (rev-527-fix2)", () => {
  it("requests the sites endpoint with pageSize <= 100", async () => {
    const authFetch = vi.fn(async (_input: string) =>
      new Response(JSON.stringify({ items: [] }), { status: 200 })
    );

    await fetchSiteOptions(authFetch);

    expect(authFetch).toHaveBeenCalledTimes(1);
    const url = authFetch.mock.calls[0]![0]!;
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    const pageSize = Number(params.get("pageSize"));
    expect(pageSize).toBeGreaterThan(0);
    expect(pageSize).toBeLessThanOrEqual(100);
  });

  it("SITES_OPTIONS_URL matches the shared PaginationQueryDto @Max(100) cap", () => {
    const params = new URLSearchParams(SITES_OPTIONS_URL.split("?")[1] ?? "");
    expect(Number(params.get("pageSize"))).toBeLessThanOrEqual(100);
  });

  it("returns ok:false when the API responds non-2xx (regression: no more silent empty dropdown)", async () => {
    const authFetch = vi.fn(async () => new Response("Bad Request", { status: 400 }));
    const result = await fetchSiteOptions(authFetch);
    expect(result).toEqual({ ok: false });
  });

  it("maps and sorts returned rows into { value, label } option pairs", async () => {
    const authFetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            items: [
              { id: "b", name: "Bravo" },
              { id: "a", name: "Alpha" }
            ]
          }),
          { status: 200 }
        )
    );
    const result = await fetchSiteOptions(authFetch);
    expect(result).toEqual({
      ok: true,
      options: [
        { value: "a", label: "Alpha" },
        { value: "b", label: "Bravo" }
      ]
    });
  });
});
