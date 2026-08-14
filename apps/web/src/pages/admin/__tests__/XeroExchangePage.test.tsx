/**
 * CFX-4 — XeroExchangePage unit tests.
 *
 * The web workspace has no jsdom / @testing-library set up; existing web
 * specs cover pure helpers and API-call shapes. We assert:
 *   1. buildDownloadHref emits includeBankDetails=false by default and
 *      flips to true when the checkbox is on.
 *   2. Both clients + vendors hrefs point at /api/v1/xero/export/*.csv.
 *   3. The PII warning + custom-fields note copy match the spec.
 */

import { describe, expect, it } from "vitest";
import {
  buildDownloadHref,
  BANK_DETAIL_WARNING,
  CUSTOM_FIELDS_NOTE
} from "../XeroExchangePage";

describe("buildDownloadHref — includeBankDetails query param", () => {
  it("emits includeBankDetails=false when checkbox is off", () => {
    expect(buildDownloadHref("clients", false)).toBe(
      "/api/v1/xero/export/clients.csv?includeBankDetails=false"
    );
    expect(buildDownloadHref("vendors", false)).toBe(
      "/api/v1/xero/export/vendors.csv?includeBankDetails=false"
    );
  });

  it("flips to includeBankDetails=true when the checkbox is on", () => {
    expect(buildDownloadHref("clients", true)).toBe(
      "/api/v1/xero/export/clients.csv?includeBankDetails=true"
    );
    expect(buildDownloadHref("vendors", true)).toBe(
      "/api/v1/xero/export/vendors.csv?includeBankDetails=true"
    );
  });

  it("points both download kinds at the CFX-4 export routes", () => {
    expect(buildDownloadHref("clients", false)).toMatch(/^\/api\/v1\/xero\/export\/clients\.csv/);
    expect(buildDownloadHref("vendors", false)).toMatch(/^\/api\/v1\/xero\/export\/vendors\.csv/);
  });
});

describe("static copy", () => {
  it("PII warning names the two sensitive fields and mentions the audit trail", () => {
    expect(BANK_DETAIL_WARNING).toContain("Bank details");
    expect(BANK_DETAIL_WARNING).toContain("audited");
  });

  it("custom-fields note explains why the file matches Xero's format", () => {
    expect(CUSTOM_FIELDS_NOTE).toContain("Xero");
    expect(CUSTOM_FIELDS_NOTE).toContain("Custom fields are not included");
  });
});
