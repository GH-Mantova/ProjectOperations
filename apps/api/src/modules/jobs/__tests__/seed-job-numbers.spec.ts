// Sanity-check F1E-01 — guards against the seed regressing to legacy
// JOB-YYYY-NNN job numbers. The seed runs as a plain script (no Nest
// DI), so this is a static source assertion rather than a DB round-trip.
// Acts as a tripwire if anyone re-introduces a hardcoded legacy ID.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SEED_PATH = resolve(__dirname, "../../../../prisma/seed.ts");

describe("seed.ts — job number format (F1E-01)", () => {
  const source = readFileSync(SEED_PATH, "utf8");

  it("contains no legacy JOB-YYYY-NNN literals", () => {
    const matches = source.match(/JOB-\d{4}-\d{3}/g) ?? [];
    expect(matches).toEqual([]);
  });

  it("contains no legacy JOB-COMP-* literals", () => {
    const matches = source.match(/JOB-COMP-/g) ?? [];
    expect(matches).toEqual([]);
  });

  it("routes seed job numbers through the canonical allocator", () => {
    expect(source).toMatch(/allocateSeedJobNumber\s*\(/);
  });
});
