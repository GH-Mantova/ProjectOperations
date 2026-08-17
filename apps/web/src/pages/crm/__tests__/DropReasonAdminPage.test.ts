// CRM SLICE 6 — DropReasonAdminPage pure-logic unit tests.
//
// The web workspace has no @testing-library / jsdom setup (all existing
// web tests are pure logic). We test the helpers exported from
// DropReasonAdminPage that are safe to call outside React.
//
// Three functions:
//   fmtSortOrder  — converts a number to a string (display helper)
//   buildToggleBody — flips isActive for a PATCH body
//   validateAddForm — validates the add-reason form label field

import { describe, expect, it } from "vitest";
import {
  buildToggleBody,
  fmtSortOrder,
  validateAddForm
} from "../DropReasonAdminPage";

describe("fmtSortOrder (CRM S6 DropReasonAdminPage)", () => {
  it("formats a positive integer", () => {
    expect(fmtSortOrder(5)).toBe("5");
  });

  it("formats zero", () => {
    expect(fmtSortOrder(0)).toBe("0");
  });

  it("formats a large number", () => {
    expect(fmtSortOrder(999)).toBe("999");
  });
});

describe("buildToggleBody (CRM S6 DropReasonAdminPage)", () => {
  it("returns { isActive: false } when current is true", () => {
    expect(buildToggleBody(true)).toEqual({ isActive: false });
  });

  it("returns { isActive: true } when current is false", () => {
    expect(buildToggleBody(false)).toEqual({ isActive: true });
  });
});

describe("validateAddForm (CRM S6 DropReasonAdminPage)", () => {
  it("returns null for a valid label", () => {
    expect(validateAddForm("Price / budget")).toBeNull();
  });

  it("returns an error message for an empty string", () => {
    const result = validateAddForm("");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("returns an error message for a whitespace-only string", () => {
    const result = validateAddForm("   ");
    expect(result).not.toBeNull();
  });

  it("returns an error message for a label exceeding 200 characters", () => {
    const longLabel = "a".repeat(201);
    const result = validateAddForm(longLabel);
    expect(result).not.toBeNull();
  });

  it("returns null for a label exactly 200 characters long", () => {
    const label = "a".repeat(200);
    expect(validateAddForm(label)).toBeNull();
  });
});
