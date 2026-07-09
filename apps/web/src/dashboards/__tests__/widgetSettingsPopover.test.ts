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
import { describe, expect, it } from "vitest";
import type { TenderForDashboard } from "../hooks";
import type { ConfigField } from "../types";
import {
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
