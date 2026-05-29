import { describe, expect, it } from "vitest";
import { quoteVersionRowActions } from "../quoteVersionRowActions";

describe("quoteVersionRowActions (fix: restore Save/Cancel on Quote edit)", () => {
  it("view mode: shows Edit, hides Save/Cancel", () => {
    const actions = quoteVersionRowActions(false, true);
    expect(actions).toContain("edit");
    expect(actions).not.toContain("save");
    expect(actions).not.toContain("cancel");
  });

  it("edit mode: shows Save+Cancel, hides Edit", () => {
    const actions = quoteVersionRowActions(true, true);
    expect(actions).toContain("save");
    expect(actions).toContain("cancel");
    expect(actions).not.toContain("edit");
  });

  it("keeps the other version-row actions visible in edit mode", () => {
    const actions = quoteVersionRowActions(true, true);
    expect(actions).toEqual(expect.arrayContaining(["newRevision", "pdf", "send", "delete"]));
  });

  it("non-manager view mode: only Edit + PDF", () => {
    expect(quoteVersionRowActions(false, false)).toEqual(["edit", "pdf"]);
  });
});
