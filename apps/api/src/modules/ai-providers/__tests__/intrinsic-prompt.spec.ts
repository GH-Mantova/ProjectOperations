import { intrinsicPrompt } from "../ai-providers.service";
import { tenderingPersona } from "../../personas/definitions/tendering.persona";

// PR #152 — verify GLOBAL_RATE_FABRICATION_PROHIBITION reaches every
// runtime system-prompt assembly site. One site today:
//   1. intrinsicPrompt() in ai-providers.service.ts (persona chat path)
// The legacy second site (SYSTEM_PROMPT in tender-scope-drafting.service.ts,
// the document-extraction draftScope path) was deleted alongside the rest
// of that path in §5A.1 PR B — scope drafting now flows through the
// Tendering Assistant persona's propose_scope_items tool, which assembles
// its system prompt via intrinsicPrompt.

describe("intrinsicPrompt global prefix (PR #152)", () => {
  it("includes the rate-fabrication baseline rule for every tendering sub-mode", () => {
    for (const subMode of tenderingPersona.subModes) {
      const prompt = intrinsicPrompt(tenderingPersona, subMode);
      expect(prompt).toContain("Rate handling — baseline rule");
      expect(prompt).toContain("MUST NOT");
      expect(prompt).toContain("Quote rate ranges");
    }
  });

  it("includes the global prefix when no sub-mode is active", () => {
    const prompt = intrinsicPrompt(tenderingPersona, null);
    expect(prompt).toContain("Rate handling — baseline rule");
  });

  it("places the global prefix BEFORE the persona description", () => {
    const subMode = tenderingPersona.subModes[0]!;
    const prompt = intrinsicPrompt(tenderingPersona, subMode);
    const globalIdx = prompt.indexOf("Rate handling — baseline rule");
    const personaIdx = prompt.indexOf(tenderingPersona.description);
    expect(globalIdx).toBeGreaterThanOrEqual(0);
    expect(personaIdx).toBeGreaterThan(globalIdx);
  });

  it("places stronger tendering RATE_LOOKUP_CONVENTIONS AFTER the global prefix on tender-scoped sub-modes", () => {
    // Tendering's tender-scoped sub-modes have RATE_LOOKUP_CONVENTIONS
    // appended to their description. The global prefix appears first;
    // the more specific tool-call instruction appears later and wins.
    const scope = tenderingPersona.subModes.find((s) => s.name === "scope")!;
    const prompt = intrinsicPrompt(tenderingPersona, scope);
    const globalIdx = prompt.indexOf("Rate handling — baseline rule");
    const policyIdx = prompt.indexOf("RATE LOOKUP — MANDATORY POLICY");
    expect(globalIdx).toBeGreaterThanOrEqual(0);
    expect(policyIdx).toBeGreaterThan(globalIdx);
  });
});

describe("global prefix names known fabrication failure modes (PR #152)", () => {
  it("explicitly forbids the SEQ region stamp from the smoke leak", () => {
    // Smoke caught fabrication of "$1,200-$2,500/day in SEQ" on the
    // tender register screen. Naming the failure mode in the prompt
    // is a regression guard: if someone softens the block, these
    // specifics get cut and this test fails.
    const register = tenderingPersona.subModes.find((s) => s.name === "register")!;
    const prompt = intrinsicPrompt(tenderingPersona, register);
    expect(prompt).toContain("in SEQ");
    expect(prompt).toContain("ballpark");
    expect(prompt).toContain("indicative");
    expect(prompt).toContain("$1,200-$2,500/day");
  });

  it("register sub-mode receives the global prefix even though it has no RATE_LOOKUP_CONVENTIONS", () => {
    const register = tenderingPersona.subModes.find((s) => s.name === "register")!;
    const prompt = intrinsicPrompt(tenderingPersona, register);
    expect(prompt).toContain("Rate handling — baseline rule");
    // Negative: register sub-mode does NOT get the stronger tool-call block
    expect(prompt).not.toContain("RATE LOOKUP — MANDATORY POLICY");
  });
});

describe("global prefix override precedence language (PR #161)", () => {
  it("declares the override precedence section", () => {
    const subMode = tenderingPersona.subModes[0]!;
    const prompt = intrinsicPrompt(tenderingPersona, subMode);
    expect(prompt).toContain("Override precedence");
  });

  it("forbids loosening via company or user instructions", () => {
    const subMode = tenderingPersona.subModes[0]!;
    const prompt = intrinsicPrompt(tenderingPersona, subMode);
    expect(prompt).toContain("Company instructions");
    expect(prompt).toContain("User instructions");
    expect(prompt).toContain("CANNOT be LOOSENED");
  });

  it("preserves the legitimate extension path for tool-call mandates", () => {
    const subMode = tenderingPersona.subModes[0]!;
    const prompt = intrinsicPrompt(tenderingPersona, subMode);
    expect(prompt).toContain("EXTENDED");
    expect(prompt).toContain("call lookup_rate before quoting");
  });

  it("instructs the model to surface conflicts to the user", () => {
    const subMode = tenderingPersona.subModes[0]!;
    const prompt = intrinsicPrompt(tenderingPersona, subMode);
    expect(prompt).toContain("surface the conflict to the user");
  });
});
