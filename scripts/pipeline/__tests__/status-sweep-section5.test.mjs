/**
 * SECTION_5_PR_VIEW_CACHE_V1 + -SkipSection5 regression guard for
 *   scripts/pipeline/status-sweep.ps1
 *
 * Runs with:
 *   node --test scripts/pipeline/__tests__/status-sweep-section5.test.mjs
 *
 * ---------------------------------------------------------------------------
 * WHY NOTHING HERE SKIPS
 *
 * ci.yml's `pipeline-tests-windows` job asserts `skipped == 0` on this glob,
 * because a suite that silently skips is how arm-prompt.ps1 shipped a
 * PowerShell 5.1 parse bug behind a green CI. So every test in this file runs
 * on both Ubuntu and Windows.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS *NOT* COVERED HERE, AND WHY
 *
 * The script is PowerShell. The Ubuntu runner has no pwsh available, so the
 * script is NOT executed. Executing it would require a Windows-only skip,
 * which `skipped == 0` forbids. These tests are SOURCE-LEVEL: they assert the
 * invariants the prompt names (dedupe, -SkipSection5, closing verdict in both
 * modes) at the file-content level. They are a regression guard against the
 * three changes being partially reverted or short-circuited by a later edit;
 * they are NOT a proof that the script's runtime behaviour matches. The
 * prompt's VERIFY step runs the script both ways on Windows.
 *
 * The three invariants the prompt names, and how each is asserted below:
 *
 *   (1) "a repeated PR number produces exactly ONE lookup (the cache works)"
 *       --> the only `gh pr view` call site must sit inside a cache-check
 *       branch, and the cache must be seeded on first miss.
 *
 *   (2) "-SkipSection5 suppresses the crawl AND still emits the skipped-section line"
 *       --> the `[switch]$SkipSection5` parameter exists; a SKIP line is emitted
 *       when it is set; the needs-marco foreach initializer is guarded by it.
 *
 *   (3) "the closing verdict line is still produced in both modes"
 *       --> section 7 (VERDICT) and the SWEEP COMPLETE line sit after the
 *       section-5 skip branch, so neither path can short-circuit past them.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..", "..");
const SWEEP = join(REPO_ROOT, "scripts", "pipeline", "status-sweep.ps1");
const SRC = readFileSync(SWEEP, "utf8");

// ---------------------------------------------------------------------------
// (1) Cache: one lookup per distinct PR number per run.
// ---------------------------------------------------------------------------

test("section 5 declares a PR-view cache hashtable before the needs-marco foreach", () => {
  // The cache MUST be declared before the per-file foreach begins -- otherwise
  // each file re-initialises an empty cache and the dedupe collapses to within-
  // file only (which `Select-Object -Unique` on $prNums already did).
  const cacheIdx = SRC.indexOf("$prViewCache = @{}");
  assert.ok(cacheIdx > -1, "status-sweep.ps1 must declare $prViewCache = @{}");

  const foreachIdx = SRC.indexOf("foreach ($f in $nm)");
  assert.ok(foreachIdx > -1, "status-sweep.ps1 must iterate needs-marco files via foreach ($f in $nm)");
  assert.ok(
    cacheIdx < foreachIdx,
    "the $prViewCache hashtable must be declared BEFORE the needs-marco foreach so it spans every file"
  );
});

test("the only gh pr view call is guarded by a cache miss", () => {
  // There must be exactly ONE `gh pr view ... --json` call site, and it must
  // sit after an $prViewCache.ContainsKey check -- otherwise the cache is
  // declared but a later edit reintroduced an uncached lookup.
  const ghViewMatches = SRC.match(/gh pr view \$n --json/g) || [];
  assert.equal(
    ghViewMatches.length,
    1,
    "exactly one `gh pr view $n --json` call site is expected; found " + ghViewMatches.length
  );

  const containsKeyIdx = SRC.indexOf("$prViewCache.ContainsKey($n)");
  const ghViewIdx = SRC.indexOf("gh pr view $n --json");
  assert.ok(
    containsKeyIdx > -1 && containsKeyIdx < ghViewIdx,
    "`$prViewCache.ContainsKey($n)` must gate the `gh pr view $n --json` call site"
  );

  // On a miss the cache MUST be populated, or every subsequent reference re-queries.
  assert.ok(
    /\$prViewCache\[\$n\]\s*=\s*\$st/.test(SRC),
    "a cache miss must assign $prViewCache[$n] = $st so later references read the cache"
  );
});

// ---------------------------------------------------------------------------
// (2) -SkipSection5: switch exists, emits a skip line, suppresses the crawl.
// ---------------------------------------------------------------------------

test("the -SkipSection5 switch parameter is declared on the param block", () => {
  assert.ok(
    /\[switch\]\$SkipSection5/.test(SRC),
    "status-sweep.ps1 must declare `[switch]$SkipSection5` on its param block"
  );
});

test("-SkipSection5 emits a SKIP line naming the section and why", () => {
  // DOCTRINE 9.6: a skipped section must not read as an empty / clean one.
  // The line must be gated by $SkipSection5, use the SKIP tag, and name the
  // section it skipped so a reader can never confuse it with an empty crawl.
  const skipGuardIdx = SRC.indexOf("if ($SkipSection5)");
  assert.ok(skipGuardIdx > -1, "the SKIP line must be gated by `if ($SkipSection5)`");

  const skipTagIdx = SRC.indexOf('Line "SKIP"');
  assert.ok(skipTagIdx > -1, "the skipped section must emit a line with the SKIP tag");
  assert.ok(
    skipTagIdx > skipGuardIdx,
    "the `Line \"SKIP\"` call must sit inside the `if ($SkipSection5)` branch"
  );

  const skipLineChunk = SRC.slice(skipTagIdx, skipTagIdx + 300);
  assert.ok(
    /section 5/i.test(skipLineChunk),
    "the SKIP line must name section 5 (the section it is skipping)"
  );
  assert.ok(
    /SkipSection5/.test(skipLineChunk),
    "the SKIP line must say WHY it was skipped (-SkipSection5 was passed)"
  );
});

test("-SkipSection5 suppresses the needs-marco crawl (empties $nm so the foreach is a no-op)", () => {
  // The needs-marco enumeration MUST be inside `if (-not $SkipSection5)` so
  // $nm stays empty and the foreach below iterates nothing. A later edit that
  // moves `Get-ChildItem ... needs-marco` out of this guard would re-enable
  // the crawl and defeat the fast-exit switch.
  const guardIdx = SRC.indexOf("if (-not $SkipSection5)");
  assert.ok(guardIdx > -1, "the needs-marco enumeration must be guarded by `if (-not $SkipSection5)`");

  const chunk = SRC.slice(guardIdx, guardIdx + 1200);
  assert.ok(
    /Join-Path\s+\$Queue\s+"needs-marco"/.test(chunk) ||
      /Get-ChildItem\s+\(Join-Path\s+\$nmDir/.test(chunk),
    "the `if (-not $SkipSection5)` branch must contain the needs-marco Test-Path + Get-ChildItem block"
  );
});

// ---------------------------------------------------------------------------
// (3) Closing verdict is reachable in both modes.
// ---------------------------------------------------------------------------

test("section 7 VERDICT and SWEEP COMPLETE sit after section 5's skip guard", () => {
  // If section 7 moved above the skip guard, this prompt's premise -- that the
  // verdict is unreachable -- would come back.
  const skipGuardIdx = SRC.indexOf("if ($SkipSection5)");
  const verdictHeaderIdx = SRC.indexOf('Section "7. VERDICT"');
  const sweepCompleteIdx = SRC.indexOf('Write-Host ("SWEEP COMPLETE ');
  assert.ok(verdictHeaderIdx > -1, "`Section \"7. VERDICT\"` must still be present");
  assert.ok(sweepCompleteIdx > -1, "the `Write-Host (\"SWEEP COMPLETE \"` closing line must still be present");
  assert.ok(
    skipGuardIdx < verdictHeaderIdx,
    "the SkipSection5 branch must sit BEFORE Section 7 so the verdict stays reachable"
  );
  assert.ok(
    verdictHeaderIdx < sweepCompleteIdx,
    "Section 7 must sit BEFORE the SWEEP COMPLETE line"
  );
});

test("there is no `exit`/`return`/`throw` between the SkipSection5 branch and SWEEP COMPLETE", () => {
  // If a later edit put `exit`/`return`/`throw` in the SkipSection5 path, the
  // verdict and SWEEP COMPLETE would be unreachable in skip mode -- exactly
  // the shape this prompt exists to prevent.
  const skipGuardIdx = SRC.indexOf("if ($SkipSection5)");
  const sweepCompleteIdx = SRC.indexOf('Write-Host ("SWEEP COMPLETE ');
  const between = SRC.slice(skipGuardIdx, sweepCompleteIdx);

  // A top-level `exit` / `return` / `throw` with no leading char would bail out.
  // Match them as whole PowerShell statements (start of line + optional whitespace).
  assert.ok(
    !/^\s*(exit|return|throw)\b/m.test(between),
    "no bare `exit`/`return`/`throw` statement may sit between the SkipSection5 branch and SWEEP COMPLETE"
  );
});

// ---------------------------------------------------------------------------
// Bonus: per-section elapsed printing (SECTION_TIMING_V1).
// ---------------------------------------------------------------------------

test("Section() prints a [TIMING] elapsed= line per section", () => {
  // The prompt asks for one line per section so a reader can see where the
  // time actually goes. The timing is emitted by Section() closing the prior
  // section, plus one final emission after Section 7 before SWEEP COMPLETE.
  assert.ok(
    /\[TIMING\] section/.test(SRC),
    "Section() must emit a [TIMING] elapsed line per section"
  );
  assert.ok(
    /elapsed=/.test(SRC),
    "the timing line must carry `elapsed=` so the number is parseable"
  );
});
