/**
 * Tests for scripts/pipeline/check-d-register.mjs
 *
 * Uses Node's built-in test runner: node --test
 *
 * All tests run the checker over synthetic fixture strings or temp directories —
 * no shelling out to the whole repo — so they are fast and hermetic.
 *
 * Each test has a positive control in BOTH directions:
 *   - the bad case produces a finding (proves the check CAN fire)
 *   - the good case produces no finding (proves it is not over-broad)
 * If only one direction is tested it is not a real check.
 */

import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runChecker, D_REGISTER_MODE } from "../check-d-register.mjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal fake repo directory with:
 *   sot/05-decisions-and-lessons.md  — contains a register table with given IDs
 *   <extra files>                    — supplied as { relPath: content }
 *
 * Returns the temp dir path; caller must clean up.
 */
function makeFakeRepo(registeredIds, extraFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), "d-reg-test-"));

  // sot/05 with a minimal register table
  mkdirSync(join(dir, "sot"), { recursive: true });
  const tableRows = registeredIds
    .map((id) => `| ${id} | brief | Decision text | REGISTERED | anchor |`)
    .join("\n");
  writeFileSync(
    join(dir, "sot", "05-decisions-and-lessons.md"),
    [
      "# Incident Ledger",
      "",
      "### Decision register",
      "",
      "| # | Brief | Decision | Status | Anchor |",
      "|---|---|---|---|---|",
      tableRows,
    ].join("\n"),
    "utf8"
  );

  // Extra files
  for (const [relPath, content] of Object.entries(extraFiles)) {
    const full = join(dir, relPath);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content, "utf8");
  }

  return dir;
}

function cleanup(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// 1. Module contract: D_REGISTER_MODE must be "WARN_ONLY"
// ---------------------------------------------------------------------------

describe("module contract", () => {
  test("D_REGISTER_MODE is exported and equals WARN_ONLY", () => {
    assert.equal(D_REGISTER_MODE, "WARN_ONLY");
  });
});

// ---------------------------------------------------------------------------
// 2. Register parsing — positive control both directions
// ---------------------------------------------------------------------------

describe("register parsing", () => {
  test("registered D48 does NOT produce a finding (positive control: known-good)", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/web/src/example.ts": "// D48 decision anchored here",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D48");
      assert.equal(hits.length, 0, "D48 is registered — must not warn");
    } finally {
      cleanup(dir);
    }
  });

  test("unregistered D99 DOES produce a finding (positive control: checker fires)", () => {
    const dir = makeFakeRepo(["D48"], {
      // D99 is NOT in the register; it appears in a source file
      "apps/api/src/example.ts": "// D99 cites an unregistered decision",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D99");
      assert.ok(hits.length > 0, "D99 is unregistered — must warn");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Exclusion: docs/pr-prompts/superseded/**
// ---------------------------------------------------------------------------

describe("exclusion: superseded prompts", () => {
  test("D99 inside superseded dir is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "docs/pr-prompts/superseded/old-prompt.md":
        "This old prompt mentioned D99 which is not registered",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.file.includes("superseded") && f.token === "D99"
      );
      assert.equal(hits.length, 0, "superseded/ must be fully excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: D99 outside superseded IS flagged (exclusion is not over-broad)", () => {
    const dir = makeFakeRepo(["D48"], {
      "docs/pr-prompts/live-prompt.md":
        "This live prompt mentions D99 which is not registered",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.file === "docs/pr-prompts/live-prompt.md" && f.token === "D99"
      );
      assert.ok(hits.length > 0, "D99 outside superseded/ must still be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Exclusion: sot/05 register rows themselves
// ---------------------------------------------------------------------------

describe("exclusion: sot/05 register file", () => {
  test("D99 inside sot/05 is not warned about", () => {
    const dir = makeFakeRepo(["D48"], {});
    // Append D99 directly into the sot/05 file (as if it were a row)
    const sot05 = join(dir, "sot", "05-decisions-and-lessons.md");
    const existing = readFileSync(sot05, "utf8");
    writeFileSync(
      sot05,
      existing + "\n| D99 | example | text | REGISTERED | — |\n",
      "utf8"
    );
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.file.includes("05-decisions") && f.token === "D99");
      assert.equal(hits.length, 0, "sot/05 must be fully excluded");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Exclusion: TFM-D* prefixed series
// ---------------------------------------------------------------------------

describe("exclusion: TFM-D* prefixed series", () => {
  test("TFM-D3 is excluded (prefixed, not Marco's series)", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/service.ts":
        "// TFM-D3: T-number is the idempotency key",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      // Should not produce a finding for D3 because it's TFM-D3
      const hits = findings.filter(
        (f) => f.token === "D3" && f.text.includes("TFM-D3")
      );
      assert.equal(hits.length, 0, "TFM-D3 must be excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: bare D3 (not registered) IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/service.ts": "// D3 idempotency key (no TFM prefix)",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D3");
      assert.ok(hits.length > 0, "bare unregistered D3 must be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Exclusion: EA-D* prefixed series
// ---------------------------------------------------------------------------

describe("exclusion: EA-D* prefixed series", () => {
  test("EA-D5 is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/reporting.ts":
        "// EA-D5 role-gating: estimators see their own performance",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D5" && f.text.includes("EA-D5")
      );
      assert.equal(hits.length, 0, "EA-D5 must be excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: bare D5 (not registered) IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/reporting.ts": "// D5 colour density themes",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D5");
      assert.ok(hits.length > 0, "bare unregistered D5 must be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Exclusion: "PR D<n>" work-breakdown chain labels
// ---------------------------------------------------------------------------

describe("exclusion: PR D<n> work-breakdown chain", () => {
  test("'PR D1' chain label is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "sot/06-active-specs.md":
        "full arrangement screen (PRs C1 through PR D1) ships post-demo.",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D1" && f.text.includes("PR D1")
      );
      assert.equal(hits.length, 0, "PR D<n> must be excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: bare D1 (not registered) IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "sot/06-active-specs.md": "Decision D1 says decisions first.",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D1");
      assert.ok(hits.length > 0, "bare unregistered D1 must be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Exclusion: mergeCells("A1:D1") context
// ---------------------------------------------------------------------------

describe("exclusion: mergeCells spreadsheet range", () => {
  test("mergeCells('A1:D1') is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/estimate-excel.builder.ts":
        '  summary.mergeCells("A1:D1");',
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D1" && f.text.includes("mergeCells")
      );
      assert.equal(hits.length, 0, "D1 inside mergeCells() must be excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: D1 outside mergeCells context IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/estimate-excel.builder.ts":
        "// D1 says decisions come first",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D1" && !f.text.includes("mergeCells")
      );
      assert.ok(hits.length > 0, "bare D1 outside mergeCells must be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Exclusion: ZZTEST-BP0A3-D* test fixtures
// ---------------------------------------------------------------------------

describe("exclusion: ZZTEST-BP0A3 fixtures", () => {
  test("ZZTEST-BP0A3-D1 fixture is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/modules/projects/__tests__/bp0a3.spec.ts": [
        'await tx.project.create({ data: projectData("ZZTEST-BP0A3-D1", tenderId) });',
        'await tx.project.create({ data: projectData("ZZTEST-BP0A3-D2", tenderId) });',
        'where: { projectNumber: { in: ["ZZTEST-BP0A3-D1", "ZZTEST-BP0A3-D2"] } }',
      ].join("\n"),
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.text.includes("ZZTEST-BP0A3-D")
      );
      assert.equal(hits.length, 0, "ZZTEST-BP0A3-D* fixtures must be excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: D1 in a non-ZZTEST context IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/modules/projects/__tests__/other.spec.ts":
        'await tx.project.create({ data: projectData("OTHER-D1", tenderId) });',
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D1" && !f.text.includes("ZZTEST-BP0A3")
      );
      assert.ok(hits.length > 0, "D1 in non-ZZTEST context must still be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Exclusion: scripts/workflows/vendor/**
// ---------------------------------------------------------------------------

describe("exclusion: vendored third-party files", () => {
  test("D0 inside scripts/workflows/vendor/ is excluded", () => {
    const dir = makeFakeRepo(["D48"], {
      "scripts/workflows/vendor/mermaid.min.js":
        "var dD={}; if(d(i,s))return u; // minified code with D0",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.file.startsWith("scripts/workflows/vendor/")
      );
      assert.equal(hits.length, 0, "vendor/ files must be fully excluded");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: D0 outside vendor IS flagged (exclusion is path-specific)", () => {
    // D0 is not in the 1-55 range so it would normally be excluded by the
    // num >= 100 guard... but we use a higher number for this near-miss.
    // D56 is not in the register.
    const dir = makeFakeRepo(["D48"], {
      "scripts/pipeline/some-script.mjs": "// D56 — a decision not yet registered",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter(
        (f) => f.token === "D56"
      );
      assert.ok(hits.length > 0, "D56 outside vendor/ must be flagged");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 11. Numbers >= 100 are not in register range (D365, D97706, etc.)
// ---------------------------------------------------------------------------

describe("exclusion: D<n> with n >= 100", () => {
  test("D365 (Dynamics 365) is NOT flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/module.ts":
        "// D365-parity global relevance search, no RequirePermissions",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      // D365 is excluded by num >= 100 guard; but the word-char-after check
      // catches the '-' suffix, so it's doubly excluded.
      const hits = findings.filter((f) => f.token === "D365");
      assert.equal(hits.length, 0, "D365 must never be flagged");
    } finally {
      cleanup(dir);
    }
  });

  test("near-miss: D56 (unregistered, in-range) IS flagged", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/api/src/module.ts": "// D56 — a hypothetical future decision",
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const hits = findings.filter((f) => f.token === "D56");
      assert.ok(hits.length > 0, "D56 is in register range (1-99) and unregistered — must warn");
    } finally {
      cleanup(dir);
    }
  });
});

// ---------------------------------------------------------------------------
// 12. Combined: D48 registered, D99 unregistered, both in same file
// ---------------------------------------------------------------------------

describe("mixed registered and unregistered in same file", () => {
  test("D48 passes, D99 warns, in same file", () => {
    const dir = makeFakeRepo(["D48"], {
      "apps/web/src/page.tsx": [
        "// D48 — explicit owner + explicit share grants",
        "// D99 — hypothetical unregistered decision",
      ].join("\n"),
    });
    try {
      const { findings } = runChecker({ repoRoot: dir });
      const d48Hits = findings.filter((f) => f.token === "D48");
      const d99Hits = findings.filter((f) => f.token === "D99");
      assert.equal(d48Hits.length, 0, "D48 must not appear in findings");
      assert.ok(d99Hits.length > 0, "D99 must appear in findings");
    } finally {
      cleanup(dir);
    }
  });
});
