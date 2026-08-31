// CRM S9 — AnchorPicker body-builder + type-list unit tests.
//
// Before S9, /crm/comms was a closed loop on an empty system:
//   - createThread in CommsHubPage exits early unless `anchored`.
//   - `anchored` is `Boolean(entityType && entityId)`, and `entityId` comes
//     only from the query string (default "").
//   - The nav points at unanchored mode; the only code that built an
//     anchored URL was the hub itself navigating from an existing thread.
//
// AnchorPicker breaks the loop by giving the user a way to pick a record
// from the unanchored inbox. These tests pin the pure body-builder and the
// list of six offered types, which the picker relies on.

import { describe, expect, it } from "vitest";
import {
  buildCreateThreadBody,
  mapTypeToServer,
  PICKER_TYPES,
  type PickerSelection
} from "../AnchorPicker";

describe("buildCreateThreadBody (CRM S9)", () => {
  it("Test 1: a two-step entity selection produces a valid entityType/entityId pair", () => {
    const sel: PickerSelection = { kind: "entity", type: "ACCOUNT", entityId: "acc-123", label: "Test Ltd" };
    const body = buildCreateThreadBody(sel, "Hello");
    if (!("entityType" in body)) throw new Error("expected entity body");
    expect(body.entityType).toBe("ACCOUNT");
    expect(body.entityId).toBe("acc-123");
    expect(body.subject).toBe("Hello");
  });

  it("maps Lead → OPPORTUNITY (unified entries surface, isLead filter)", () => {
    const sel: PickerSelection = { kind: "entity", type: "LEAD", entityId: "opp-1", label: "New Lead" };
    const body = buildCreateThreadBody(sel);
    if (!("entityType" in body)) throw new Error("expected entity body");
    expect(body.entityType).toBe("OPPORTUNITY");
    expect(body.entityId).toBe("opp-1");
  });

  it("Tender/Job/Contract map straight through to their server entity types", () => {
    for (const t of ["TENDER", "JOB", "CONTRACT"] as const) {
      const sel: PickerSelection = { kind: "entity", type: t, entityId: `${t}-1`, label: t };
      const body = buildCreateThreadBody(sel);
      if (!("entityType" in body)) throw new Error("expected entity body");
      expect(body.entityType).toBe(t);
      expect(body.entityId).toBe(`${t}-1`);
    }
  });

  it("Test 2: 'Other' produces a thread body with a label and no entity id, and does not throw", () => {
    const sel: PickerSelection = { kind: "other", label: "Supplier meeting notes" };
    const body = buildCreateThreadBody(sel, "Cost review");
    expect(() => buildCreateThreadBody(sel)).not.toThrow();
    if ("entityType" in body) throw new Error("Other body must not carry an entityType");
    expect(body.otherLabel).toBe("Supplier meeting notes");
    expect(body.subject).toBe("Cost review");
  });

  it("Test 3 (negative control): the builder throws for an entity selection with an empty entityId", () => {
    // This is exactly the state that made /crm/comms a closed loop on an empty
    // system before S9 — anchored required entityId to be truthy, and nothing
    // in the UI could produce one.
    const sel: PickerSelection = { kind: "entity", type: "ACCOUNT", entityId: "", label: "?" };
    expect(() => buildCreateThreadBody(sel)).toThrow(/entityId/i);
  });

  it("subject defaults to null when not supplied", () => {
    const sel: PickerSelection = { kind: "entity", type: "TENDER", entityId: "t-1", label: "T" };
    const body = buildCreateThreadBody(sel);
    expect(body.subject).toBeNull();
  });
});

describe("PICKER_TYPES (CRM S9)", () => {
  it("Test 4: all six types are offered in the expected order", () => {
    // Explicit assertion — dropping any one is caught.
    const values = PICKER_TYPES.map((t) => t.value);
    expect(values).toEqual([
      "LEAD",
      "TENDER",
      "JOB",
      "ACCOUNT",
      "CONTRACT",
      "OTHER"
    ]);
  });

  it("every entry has a non-empty display label", () => {
    for (const t of PICKER_TYPES) {
      expect(t.label.length).toBeGreaterThan(0);
    }
  });
});

describe("mapTypeToServer (CRM S9)", () => {
  it("covers every non-Other picker type", () => {
    const nonOther = PICKER_TYPES.filter((t) => t.value !== "OTHER");
    for (const t of nonOther) {
      // Should not throw for any of the five non-Other picker types.
      const server = mapTypeToServer(t.value as Exclude<typeof t.value, "OTHER">);
      expect(server).toBeTruthy();
    }
  });
});
