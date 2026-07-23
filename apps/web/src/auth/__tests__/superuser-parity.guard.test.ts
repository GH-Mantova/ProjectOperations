/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoWebSrc = resolve(__dirname, "..", "..");

const GUARDED_FILES = [
  "pages/directory/SubcontractorsPage.tsx",
  "pages/projects/ProjectDetailPage.tsx"
];

// Backend guards (permissions.guard.ts, persona-permission.guard.ts) short-circuit
// on isSuperUser. Any UI flag that reads user.permissions directly without the
// same short-circuit produces a one-sided lockout: the API allows the action
// while the UI hides the control. The auth/permissions.ts `can()` helper is the
// only sanctioned way to derive a capability flag in this codebase.
describe("super-user parity guard: bare user.permissions?.includes() must not return", () => {
  const bareFlagRe = /permissions\?\.includes\(/g;
  const canHelperRe = /\bcan\(/g;

  for (const rel of GUARDED_FILES) {
    const abs = resolve(repoWebSrc, rel);
    const source = readFileSync(abs, "utf-8");

    it(`${rel} has no bare permissions?.includes() flag`, () => {
      const hits = source.match(bareFlagRe) ?? [];
      expect(hits.length).toBe(0);
    });

    // Positive control — an extractor that silently matches nothing is not a
    // guard. Assert the file still contains the sanctioned helper so a rename
    // that also hides the bad pattern (e.g. moving the code out) fails loudly.
    it(`${rel} still uses the can() helper (positive control)`, () => {
      const hits = source.match(canHelperRe) ?? [];
      expect(hits.length).toBeGreaterThan(0);
    });
  }
});
