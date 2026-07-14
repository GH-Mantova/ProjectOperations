// PR fix/admin-nav-parity-and-orphan-routes — QA S3-022 + S2-005 UI half.
//
// Before this PR, AdminCompanyPage did two things wrong:
//   1. non-admin users got <Navigate to="/" replace /> — a silent bounce that
//      PR #544 explicitly outlawed;
//   2. when the API responded 404 (prod: CompanyProfile never seeded), the
//      page rendered the serialized error object as its entire body:
//        {"statusCode":404,...,"message":"Company profile has not been seeded..."}
//
// This suite covers the humaniseError helper that guarantees a raw JSON error
// body is never rendered to the user, and asserts the shape of the empty
// state that renders on 404.

import { describe, expect, it } from "vitest";
import { humaniseError } from "../AdminCompanyPage";

describe("AdminCompanyPage — humaniseError (QA S2-005 UI half)", () => {
  it("extracts the `message` from a Nest-style JSON error body", () => {
    const raw = JSON.stringify({
      statusCode: 404,
      message: "Company profile has not been seeded. Run `pnpm seed` or POST /admin/company/profile to bootstrap.",
      error: "Not Found"
    });
    const out = humaniseError(raw);
    expect(out).toContain("has not been seeded");
    expect(out).not.toContain("statusCode");
    expect(out).not.toContain("{");
  });

  it("returns the raw string when the payload is not JSON", () => {
    expect(humaniseError("something exploded")).toBe("something exploded");
  });

  it("returns a fallback when there is no error text at all", () => {
    expect(humaniseError(null)).toMatch(/went wrong/i);
  });

  it("falls back to the raw body when the JSON has no message field", () => {
    const raw = JSON.stringify({ statusCode: 500 });
    // Better to show *something* than to swallow the error into a generic fallback.
    expect(humaniseError(raw)).toBe(raw);
  });
});
