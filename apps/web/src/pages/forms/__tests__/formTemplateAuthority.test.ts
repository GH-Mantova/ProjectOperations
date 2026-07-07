import { describe, expect, it } from "vitest";
import { formTemplateAuthority } from "../formTemplateAuthority";

describe("formTemplateAuthority", () => {
  it("allows all actions on a custom active template", () => {
    expect(formTemplateAuthority({ isSystemTemplate: false, status: "ACTIVE" })).toEqual({
      canEdit: true,
      canDuplicate: true,
      canArchive: true,
      canUnarchive: false,
      canDelete: true
    });
  });

  it("protects the 7 seeded system templates — only duplicate is allowed", () => {
    const auth = formTemplateAuthority({ isSystemTemplate: true, status: "ACTIVE" });
    expect(auth.canEdit).toBe(false);
    expect(auth.canArchive).toBe(false);
    expect(auth.canDelete).toBe(false);
    expect(auth.canDuplicate).toBe(true);
  });

  it("swaps archive → unarchive when the template is already archived", () => {
    const auth = formTemplateAuthority({ isSystemTemplate: false, status: "ARCHIVED" });
    expect(auth.canArchive).toBe(false);
    expect(auth.canUnarchive).toBe(true);
  });

  it("system templates cannot be unarchived either (they should never be archived to begin with)", () => {
    const auth = formTemplateAuthority({ isSystemTemplate: true, status: "ARCHIVED" });
    expect(auth.canUnarchive).toBe(false);
  });
});
