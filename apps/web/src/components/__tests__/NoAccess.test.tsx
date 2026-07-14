// PR fix/no-access-page-instead-of-redirect — NoAccess specs.
// The web workspace has no @testing-library / jsdom set up (all existing
// web tests are pure logic), so we exercise the component function directly
// and walk the returned React element tree to assert the permission codes
// are surfaced in the DOM. If a future refactor stops rendering the codes,
// this test fires — which is the whole point.

import { describe, expect, it } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { NoAccess } from "../NoAccess";

function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: unknown }>;
    return collectText(element.props?.children);
  }
  return "";
}

describe("NoAccess (PR fix/no-access-page-instead-of-redirect)", () => {
  it("renders the required permission code in the DOM", () => {
    const tree = NoAccess({ required: "rates.manage" });
    const text = collectText(tree);
    expect(text).toContain("rates.manage");
    expect(text).toContain("You don't have access to this page");
    expect(text).toMatch(/administrator/i);
  });

  it("renders every code when multiple permissions are required", () => {
    const tree = NoAccess({ required: ["rates.manage", "lists.manage"] });
    const text = collectText(tree);
    expect(text).toContain("rates.manage");
    expect(text).toContain("lists.manage");
    // Pluralised copy when there are multiple codes.
    expect(text).toContain("permissions");
  });

  it("uses the custom title when provided", () => {
    const tree = NoAccess({ required: "role:Admin", title: "Admin settings requires the Admin role" });
    const text = collectText(tree);
    expect(text).toContain("Admin settings requires the Admin role");
    expect(text).toContain("role:Admin");
  });

  it("carries the no-access testid on the root", () => {
    const tree = NoAccess({ required: "rates.manage" }) as ReactElement<{
      "data-testid"?: string;
    }>;
    expect(tree.props["data-testid"]).toBe("no-access");
  });
});
