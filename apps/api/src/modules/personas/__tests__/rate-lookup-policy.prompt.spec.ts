import { tenderingPersona } from "../definitions/tendering.persona";

// PR #149 — assert that the strengthened RATE_LOOKUP_CONVENTIONS
// policy block reaches the model in every tender-scoped Tendering
// sub-mode. Mirrors the system prompt assembly shape used by
// AiProvidersService.intrinsicPrompt() in
// apps/api/src/modules/ai-providers/ai-providers.service.ts: the
// active sub-mode's `description` is concatenated onto the persona
// description as the runtime system prompt. If a sub-mode's
// description doesn't carry the policy block, the model in that
// sub-mode is unprotected from rate fabrication.
//
// Fabrication risk discovered via PR #148 smoke testing: from the
// tender-detail tab (where lookup_rate was unbound and the policy
// block absent) the model invented "$35-$65 per linear metre" with
// a fake "SEQ 2024-25" citation twice in two consecutive runs.

const TENDERING_RATE_SUB_MODES = [
  "tender-detail",
  "scope",
  "quote"
] as const;

describe("RATE_LOOKUP_CONVENTIONS distribution (PR #149)", () => {
  it.each(TENDERING_RATE_SUB_MODES)(
    "tendering.%s sub-mode description carries the MANDATORY POLICY block",
    (subModeName) => {
      const subMode = tenderingPersona.subModes.find((s) => s.name === subModeName);
      expect(subMode).toBeDefined();
      const description = subMode!.description;
      expect(description).toContain("RATE LOOKUP — MANDATORY POLICY");
      expect(description).toContain("MUST NOT");
      expect(description).toContain("Quote rate ranges");
      expect(description).toContain("the IS rate schedule");
    }
  );

  it("tendering.register sub-mode description does NOT carry the policy block (no tender context)", () => {
    const subMode = tenderingPersona.subModes.find((s) => s.name === "register");
    expect(subMode).toBeDefined();
    expect(subMode!.description).not.toContain("RATE LOOKUP — MANDATORY POLICY");
  });

  it("policy block forbids range quoting and year-stamped market references", () => {
    const scope = tenderingPersona.subModes.find((s) => s.name === "scope")!;
    const text = scope.description;
    expect(text).toContain("$35-$65");
    expect(text).toContain("SEQ 2024-25");
    expect(text).toContain("market knowledge");
  });
});
