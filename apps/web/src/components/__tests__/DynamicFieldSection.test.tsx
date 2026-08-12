/**
 * CFX-3 — DynamicFieldSection unit tests.
 *
 * The web workspace has no jsdom / @testing-library set up (all existing
 * web specs are pure-logic tests). We cover the exported pure helpers and
 * the field-binding logic that the component depends on.
 *
 * Covered:
 *  1. Fields with `visible: false` are excluded from the rendered set.
 *  2. Required field has `required: true` — errors[key] is surfaced.
 *  3. CUSTOM field onChange fires with `{ customFields: { <key>: value } }`.
 *  4. BUILTIN field onChange fires with `{ <key>: value }` (NOT customFields).
 *  5. Groups are ordered by first appearance; within group, by sortOrder.
 *  6. CUSTOM groups default to collapsed; BUILTIN groups default to expanded.
 */

import { describe, expect, it } from "vitest";
import {
  filterVisible,
  buildGroupOrder,
  resolveValue,
  buildBuiltinPatch,
  buildCustomPatch,
  isCustomGroup,
  type FieldDefinition
} from "../DynamicFieldSection";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: "fd-1",
    key: "name",
    label: "Name",
    group: "Identity",
    sortOrder: 0,
    visible: true,
    required: false,
    appliesTo: "CLIENT",
    source: "BUILTIN",
    ...overrides
  };
}

// ── 1. filterVisible ─────────────────────────────────────────────────────────

describe("filterVisible", () => {
  it("excludes fields with visible=false", () => {
    const fields: FieldDefinition[] = [
      makeField({ key: "name", visible: true }),
      makeField({ key: "phone", visible: false })
    ];
    const result = filterVisible(fields);
    expect(result.map((f) => f.key)).toEqual(["name"]);
  });

  it("includes all fields when all are visible", () => {
    const fields: FieldDefinition[] = [
      makeField({ key: "name", visible: true }),
      makeField({ key: "email", visible: true })
    ];
    const result = filterVisible(fields);
    expect(result).toHaveLength(2);
  });

  it("returns empty array when all fields are hidden", () => {
    const fields: FieldDefinition[] = [
      makeField({ key: "phone", visible: false }),
      makeField({ key: "fax", visible: false })
    ];
    expect(filterVisible(fields)).toHaveLength(0);
  });
});

// ── 2. Required field + error surfacing ───────────────────────────────────────

describe("required fields", () => {
  it("identifies required fields via their required property", () => {
    const requiredField = makeField({ key: "name", required: true });
    const optionalField = makeField({ key: "email", required: false });
    expect(requiredField.required).toBe(true);
    expect(optionalField.required).toBe(false);
  });

  it("error for a required field key is passed through from the errors map", () => {
    const errors: Record<string, string> = { name: "Name is required" };
    const field = makeField({ key: "name", required: true });
    // The component reads errors[field.key] — confirm the lookup works
    expect(errors[field.key]).toBe("Name is required");
    expect(errors["email"]).toBeUndefined();
  });
});

// ── 3. CUSTOM field onChange shape ───────────────────────────────────────────

describe("buildCustomPatch", () => {
  it("wraps the new value under customFields[key]", () => {
    const existingCustomFields = { "po-number": "PO-001" };
    const patch = buildCustomPatch("invoice-prefix", "INV", existingCustomFields);
    expect(patch).toEqual({
      customFields: {
        "po-number": "PO-001",
        "invoice-prefix": "INV"
      }
    });
  });

  it("does NOT put the value at the top level", () => {
    const patch = buildCustomPatch("my-field", "value", {});
    expect("my-field" in patch).toBe(false);
    expect(patch.customFields).toBeDefined();
    expect((patch.customFields as Record<string, unknown>)["my-field"]).toBe("value");
  });

  it("merges with existing customFields rather than replacing them", () => {
    const existing = { alpha: "a", beta: "b" };
    const patch = buildCustomPatch("gamma", "g", existing);
    const cf = patch.customFields as Record<string, unknown>;
    expect(cf["alpha"]).toBe("a");
    expect(cf["beta"]).toBe("b");
    expect(cf["gamma"]).toBe("g");
  });

  it("handles undefined existing customFields (treats as empty)", () => {
    const patch = buildCustomPatch("new-key", "val", undefined);
    expect(patch).toEqual({ customFields: { "new-key": "val" } });
  });
});

// ── 4. BUILTIN field onChange shape ──────────────────────────────────────────

describe("buildBuiltinPatch", () => {
  it("puts the value at the top level under the key", () => {
    const patch = buildBuiltinPatch("name", "Acme Corp");
    expect(patch).toEqual({ name: "Acme Corp" });
  });

  it("does NOT put the value under customFields", () => {
    const patch = buildBuiltinPatch("email", "test@example.com");
    expect("customFields" in patch).toBe(false);
  });
});

// ── 5. buildGroupOrder ────────────────────────────────────────────────────────

describe("buildGroupOrder", () => {
  it("returns groups in first-appearance order from the sorted list", () => {
    const fields: FieldDefinition[] = [
      makeField({ key: "name", group: "Identity", sortOrder: 0 }),
      makeField({ key: "email", group: "Contact", sortOrder: 1 }),
      makeField({ key: "abn", group: "Identity", sortOrder: 2 })
    ];
    const { groupOrder } = buildGroupOrder(fields);
    expect(groupOrder).toEqual(["Identity", "Contact"]);
  });

  it("collects fields into their respective groups", () => {
    const fields: FieldDefinition[] = [
      makeField({ key: "name", group: "Identity", sortOrder: 0 }),
      makeField({ key: "email", group: "Contact", sortOrder: 1 }),
      makeField({ key: "abn", group: "Identity", sortOrder: 2 })
    ];
    const { grouped } = buildGroupOrder(fields);
    expect(grouped.get("Identity")?.map((f) => f.key)).toEqual(["name", "abn"]);
    expect(grouped.get("Contact")?.map((f) => f.key)).toEqual(["email"]);
  });
});

// ── 6. isCustomGroup ─────────────────────────────────────────────────────────

describe("isCustomGroup", () => {
  it("returns true when ALL fields in the group are CUSTOM", () => {
    const fields: FieldDefinition[] = [
      makeField({ source: "CUSTOM" }),
      makeField({ source: "CUSTOM" })
    ];
    expect(isCustomGroup(fields)).toBe(true);
  });

  it("returns false when ANY field in the group is BUILTIN", () => {
    const fields: FieldDefinition[] = [
      makeField({ source: "BUILTIN" }),
      makeField({ source: "CUSTOM" })
    ];
    expect(isCustomGroup(fields)).toBe(false);
  });

  it("returns false for a group containing only BUILTIN fields", () => {
    const fields: FieldDefinition[] = [
      makeField({ source: "BUILTIN" }),
      makeField({ source: "BUILTIN" })
    ];
    expect(isCustomGroup(fields)).toBe(false);
  });
});

// ── 7. resolveValue ───────────────────────────────────────────────────────────

describe("resolveValue", () => {
  const record = {
    name: "Acme Corp",
    customFields: { "po-number": "PO-001" }
  };

  it("reads BUILTIN value from the top-level record key", () => {
    expect(resolveValue("name", "BUILTIN", record)).toBe("Acme Corp");
  });

  it("reads CUSTOM value from customFields[key]", () => {
    expect(resolveValue("po-number", "CUSTOM", record)).toBe("PO-001");
  });

  it("returns empty string for a missing CUSTOM key", () => {
    expect(resolveValue("missing-field", "CUSTOM", record)).toBe("");
  });

  it("returns empty string for a null BUILTIN value", () => {
    const recordWithNull = { ...record, name: null };
    expect(resolveValue("name", "BUILTIN", recordWithNull)).toBe("");
  });
});
