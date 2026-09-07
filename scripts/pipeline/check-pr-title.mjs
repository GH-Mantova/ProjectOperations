#!/usr/bin/env node
// check-pr-title.mjs — a PR title must NAME THE MODULE IT CHANGES.
//
// WHY THIS EXISTS
//   MODULE_PROVENANCE slice 1 (#1753) gave every prompt a validated `module`. That value never
//   reached GitHub: nothing in scripts/pr-watcher/ runs `gh pr create`, so the build agent invents
//   its own title, PROMPT-SCHEMA.md said nothing about titles, and .github/ carried no commitlint,
//   no semantic-pull-request action and no title job. Three independent gaps, one result — the
//   board cannot be read by module because the titles do not agree on what a module is called.
//   [MEASURED 2026-09-01, origin/main b30e166a] 24 distinct scopes across 40 merged PRs, six of
//   which mean "crm".
//
// WHY IT IS NOT A NAIVE MODULE-NAME MATCH
//   [MEASURED 2026-09-01] a gate accepting only exact module folder names rejects 25 of the last
//   40 merged titles — 62%. A gate that fails 62% of legitimate work is not a gate, it is an
//   outage. Three families of failure, three different remedies, all three implemented here:
//     1. module + slice suffix (`crm-s11`, `rates-s5`)   -> NORMALISE (strip the suffix, once)
//     2. real repo areas the naive list never had        -> WIDEN     (see the vocabulary below)
//     3. genuinely unresolvable cluster codenames        -> RATCHET   (title-scope-baseline.json)
//
// TWO CHECKS, IN ORDER
//   (a) STRUCTURE      — `<type>(<scope>): <summary>`, always binding.
//   (b) SCOPE RESOLVES — the normalised scope is a name this repo can point at.
//
// EXIT CODES
//   0  the title passes (or --self-test's controls all behaved)
//   1  the title violates (a) or (b)
//   2  [CANNOT MEASURE] — no PR_TITLE, or the checker failed its own controls.
//      NEVER 0 when the title could not be read. A title check that silently passes when it
//      cannot see the title is worse than no check: it reports green forever.
//
// DOCTRINE section 7 — an instrument that cannot fail is not evidence. Five positive and two
// negative controls run and PRINT on every invocation, before any verdict is reported. Three of
// the positives are built from run-time probe names unique to ONE vocabulary layer, so deleting
// any layer turns exactly one control red — see runControls() for why that had to be measured
// rather than assumed.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { moduleVocabulary } from "./lint-prompt.mjs";

const RED = "\x1b[31m", GREEN = "\x1b[32m", YELLOW = "\x1b[33m";
const DIM = "\x1b[2m", RESET = "\x1b[0m";

// ---------------------------------------------------------------------------
// (a) STRUCTURE
// ---------------------------------------------------------------------------

/**
 * `<type>(<scope>)[!]: <summary>`.
 *
 * The type set is the Conventional Commits / commitlint default. `!` is the spec's
 * breaking-change marker: it is OPTIONAL but MUST be tolerated, because
 * `feat(scope)!: retire the legacy plant-days path` (#1662) is a real merged title and rejecting
 * it would be this gate mis-transcribing the spec rather than enforcing it. The scope itself
 * stays REQUIRED — an omitted scope is precisely the thing this file exists to stop.
 */
const TYPES = ["feat", "fix", "docs", "test", "chore", "refactor", "perf", "build", "ci", "style", "revert"];
const STRUCTURE = new RegExp("^(" + TYPES.join("|") + ")\\(([^)]+)\\)!?:\\s+\\S");

// ---------------------------------------------------------------------------
// (b) SCOPE RESOLVES — vocabulary, normalisation, ratchet
// ---------------------------------------------------------------------------

/**
 * Additional DERIVED roots, read off disk at run time exactly as slice 1 reads
 * `apps/api/src/modules/` and `apps/web/src/pages/`. Same rule, more roots: the immediate child
 * DIRECTORY names of the repo's area roots are area names a PR may legitimately be titled after.
 *
 * DERIVED, not hand-listed, for slice 1's reason: a hand-maintained list goes stale the day
 * someone adds the next directory, and it fails OPEN — the new area's PRs silently stop being
 * recognised. Reading the directory names costs four readdirSync calls and never goes stale.
 *
 * This is what makes `pr-watcher` (3 of the last 120 merged titles), `pr-gates`, `plans`,
 * `design`, `qa`, `api` and `web` resolve without a single line of maintenance.
 */
const AREA_ROOTS = ["apps", "packages", "docs", "scripts"];

/**
 * NAMED AREAS — surfaces this repo really ships work against that have NO directory to read.
 * Every entry is here because a merged title used it, or because this gate's contract names it.
 * Kept as ONE array, grouped by family, because a scope with no folder cannot be derived and an
 * undocumented magic string is how the next person deletes the wrong one.
 *
 * FAMILY 1 — pipeline machinery that is a PROCESS, not a folder.
 *   `watcher`/`pr-watcher` are one thing spelled two ways (the folder is scripts/pr-watcher;
 *   slice 1's prefix rule calls it `watcher`). `watchdog` is the supervisor that restarts it.
 *   `sweep`/`status-sweep`/`hygiene` are recurring pipeline duties. `board` is the prompt queue.
 *
 * FAMILY 2 — named after the SCRIPT the PR changes. scripts/pipeline/*.mjs and *.ps1 are FILES,
 *   so no directory rule can reach them, and titling a fix after the script it fixes is the
 *   clearest thing an author can do.
 *
 * FAMILY 3 — documents and registers with no folder of their own. `doctrine` is
 *   docs/pipeline/DOCTRINE.md; `agents` is .claude/agents/; `station` is a station instruction
 *   doc; `merge-approvals` is docs/decisions/merge-approvals/ — two levels down, so the
 *   AREA_ROOTS rule cannot see it; `register` is the approved-design register.
 *
 * FAMILY 4 — repo-wide destinations with no module. `deps` is the universal dependency-bump
 *   idiom (`chore(deps): bump fast-uri ...`, #1680). `sot`, `ci`, `e2e`, `prisma`, `pipeline`,
 *   `docs` and `pr-prompts` are slice 1's incidental destinations, named here because this
 *   gate's contract lists them and a reader should not have to open another file to confirm it.
 */
const NAMED_AREAS = [
  // family 1 — processes
  "pipeline", "watcher", "pr-watcher", "watchdog", "sweep", "status-sweep", "hygiene", "board",
  // family 2 — script names
  "lint-prompt", "lint", "arm-prompt", "triage-holds",
  // family 3 — documents and registers
  "doctrine", "agents", "station", "merge-approvals", "register",
  // family 4 — repo-wide destinations
  "docs", "sot", "ci", "e2e", "prisma", "pr-prompts", "deps",
];

/** Strip ONE trailing slice suffix. `crm-s11` -> `crm`, `rates-slice5` -> `rates`. */
const SLICE_SUFFIX = /-(s\d+|slice\d+)$/;

/**
 * Applied ONCE, deliberately. `crm-s1-s2` is a MALFORMED scope, not `crm`: repeating the strip
 * would launder a typo into a pass and the author would never learn the title was wrong.
 */
export function normaliseScope(raw) {
  return String(raw == null ? "" : raw).trim().replace(SLICE_SUFFIX, "");
}

/**
 * Immediate child directory names of `<repoRoot>/<dir>`.
 * Fail-SAFE: an unreadable root contributes nothing rather than throwing. One missing directory
 * must not bin the queue.
 */
function childDirs(repoRoot, dir) {
  try {
    return readdirSync(join(repoRoot, dir), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch (_) {
    return [];
  }
}

/**
 * The three LAYERS the accept-set is built from, kept separate so each can be probed on its own.
 *
 * Keeping them separate is not tidiness, it is what makes the controls able to fail. The first
 * version of this file merged the layers immediately and controlled the result with
 * `feat(crm): x`. That control passed even with slice 1's import deleted, because `crm` is ALSO
 * a directory under `scripts/` and arrived via layer 2 — the control could not distinguish
 * "vocabulary imported" from "vocabulary silently gone". Measured by reverting the import and
 * watching the checker report a clean bill of health (139 -> 51 entries, exit 0). DOCTRINE
 * section 7: an instrument that cannot fail is not evidence.
 *
 *   s1    — slice 1's `moduleVocabulary()`, IMPORTED and never re-implemented. Two copies of a
 *           module list is the exact drift this whole chain exists to stop.
 *   areas — immediate child directories of AREA_ROOTS.
 *   named — NAMED_AREAS.
 */
export function vocabularyLayers(repoRoot) {
  const s1 = moduleVocabulary(repoRoot);
  const areas = new Set();
  for (const root of AREA_ROOTS) for (const name of childDirs(repoRoot, root)) areas.add(name);
  return { s1, areas, named: new Set(NAMED_AREAS) };
}

/** The full accept-set: the union of the three layers. */
export function titleScopeVocabulary(repoRoot, layers) {
  const { s1, areas, named } = layers || vocabularyLayers(repoRoot);
  const vocab = new Set(s1);
  for (const n of areas) vocab.add(n);
  for (const n of named) vocab.add(n);
  return vocab;
}

/**
 * One name supplied by `layer` and by NO other layer, or null when the layer contributes nothing
 * unique. This is what lets each layer be controlled INDEPENDENTLY: a positive control built on
 * such a name can only pass while that layer is actually live.
 *
 * Chosen at run time and sorted for determinism, never hard-coded. A hard-coded probe name is a
 * hand-maintained list of one, and it breaks the day that module is renamed — the same failure
 * mode slice 1 refuses for the module vocabulary itself.
 */
export function uniqueTo(layer, ...others) {
  const out = [...layer].filter((n) => !others.some((o) => o.has(n))).sort();
  return out.length ? out[0] : null;
}

/**
 * THE RATCHET. Same shape and spirit as docs/qa/sot-refs-baseline.json and slice 1's
 * scripts/pipeline/module-baseline.json, so there is ONE baseline pattern in this repo, not three.
 *
 * Fail-SAFE in the STRICT direction: an unreadable or malformed baseline yields an EMPTY set, not
 * a crash and not a free pass. A baseline that failed open could be disabled by corrupting one
 * byte of JSON.
 */
export function loadScopeBaseline(repoRoot) {
  const override = process.env.TITLE_SCOPE_BASELINE;
  const path = override && override !== ""
    ? override
    : join(repoRoot, "scripts", "pipeline", "title-scope-baseline.json");
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch (_) {
    return new Set();
  }
  if (!parsed || !Array.isArray(parsed.entries)) return new Set();
  const out = new Set();
  for (const e of parsed.entries) {
    const s = typeof e === "string" ? e : e && e.scope;
    if (typeof s === "string" && s.trim() !== "") out.add(s.trim());
  }
  return out;
}

/** Levenshtein — the same helper slice 1 uses to suggest the nearest legal dependency key. */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) dp[i] = [i];
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * The 5 vocabulary entries closest to `scope`. A gate that says only "invalid" gets worked around
 * rather than obeyed; a gate that says "did you mean `rates`?" gets obeyed.
 */
export function nearest(scope, vocab, k = 5) {
  return [...vocab]
    .map((v) => [v, levenshtein(scope.toLowerCase(), v.toLowerCase())])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .slice(0, k)
    .map(([v]) => v);
}

/**
 * THE DECISION. Pure: takes a title and a resolved accept-set, returns a verdict. Exported so the
 * controls below judge the SAME function CI judges — a control that exercises a different code
 * path is decoration.
 *
 * Returns { ok, code?, scope?, normalised?, source? }.
 *   source "vocabulary" — the normalised scope is a name the repo can point at.
 *   source "baselined"  — it is not, but it is ratcheted in title-scope-baseline.json.
 */
export function checkTitle(title, vocab, baseline) {
  const t = String(title == null ? "" : title).trim();
  const m = STRUCTURE.exec(t);
  if (!m) return { ok: false, code: "TITLE_STRUCTURE" };

  const scope = m[2].trim();
  const normalised = normaliseScope(scope);
  if (vocab.has(normalised)) return { ok: true, scope, normalised, source: "vocabulary" };
  // The baseline is consulted on BOTH forms. Keyed on the raw form alone, a ratchet protecting
  // the `scopesub` cluster would need a fresh entry for every slice — `scopesub-s5`, `-s6`,
  // `-s7` — which is a baseline DESIGNED to grow, in a file whose first rule is that it may only
  // shrink.
  if (baseline.has(scope) || baseline.has(normalised)) {
    return { ok: true, scope, normalised, source: "baselined" };
  }
  return { ok: false, code: "TITLE_SCOPE_UNRESOLVED", scope, normalised };
}

// ---------------------------------------------------------------------------
// CONTROLS — DOCTRINE section 7. Printed on EVERY run, before any verdict.
// ---------------------------------------------------------------------------

/**
 * SEVEN controls: one per vocabulary layer, one for normalisation, one for each of the two
 * rejections, plus the contract's plain-module positive.
 *
 * Controls 1-3 are built from run-time probe names UNIQUE to one layer, so deleting any single
 * layer turns exactly one control red. A probe that comes back null (the layer contributes
 * nothing at all — wrong repoRoot, deleted import, emptied array) fails its control too, which is
 * what makes "did I find the repo?" a measured question rather than an assumption.
 *
 * Controls 4-7 are the four this gate's contract specifies, verbatim.
 */
export function runControls(repoRoot, vocab, baseline, layers) {
  const { s1, areas, named } = layers || vocabularyLayers(repoRoot);
  const s1Only = uniqueTo(s1, areas, named);
  const areaOnly = uniqueTo(areas, s1, named);
  const namedOnly = uniqueTo(named, s1, areas);

  const cases = [
    ["positive(slice-1 module vocabulary live)", s1Only && `feat(${s1Only}): x`, true],
    ["positive(area-directory derivation live)", areaOnly && `feat(${areaOnly}): x`, true],
    ["positive(named areas live)", namedOnly && `feat(${namedOnly}): x`, true],
    ["positive(plain module)", "feat(crm): x", true],
    ["positive(slice suffix normalises)", "feat(crm-s11): x", true],
    ["negative(unknown scope)", "feat(zzznotamodule): x", false],
    ["negative(no scope at all)", "no scope here", false],
  ];

  const results = cases.map(([label, title, want]) => {
    // A null title means the layer this control probes contributed no unique name — the layer is
    // gone. That is a control FAILURE, never a skip: a control that opts out when the thing it
    // measures disappears is the silence this whole file exists to refuse.
    const got = title == null ? null : checkTitle(title, vocab, baseline).ok;
    return { label, title, want, got, pass: got === want };
  });

  console.log("controls: " + results.map((r) => r.label + "=" + r.pass).join("  "));
  for (const r of results) {
    if (!r.pass) {
      console.error("  control MISBEHAVED: " +
        (r.title == null
          ? "the layer this control probes contributed NO unique name — it is empty or gone"
          : JSON.stringify(r.title) + " wanted " + (r.want ? "PASS" : "FAIL") +
            ", got " + (r.got ? "PASS" : "FAIL")));
    }
  }
  return results.every((r) => r.pass);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const args = process.argv.slice(2);
  const selfTest = args.includes("--self-test");
  const repoRoot = args.find((a) => !a.startsWith("--")) ?? process.cwd();

  const layers = vocabularyLayers(repoRoot);
  const vocab = titleScopeVocabulary(repoRoot, layers);
  const baseline = loadScopeBaseline(repoRoot);

  if (!runControls(repoRoot, vocab, baseline, layers)) {
    console.error("[CANNOT MEASURE] check-pr-title failed its own controls — not reporting on the real title.");
    console.error("                 repoRoot=" + repoRoot + "  vocabulary=" + vocab.size + " entries");
    console.error("                 layers: slice-1 modules=" + layers.s1.size +
      "  area directories=" + layers.areas.size + "  named areas=" + layers.named.size);
    console.error("                 A zero or near-zero layer above names the cause: a wrong repo root,");
    console.error("                 a moved module directory, or a deleted vocabulary source.");
    process.exit(2);
  }

  if (selfTest) {
    console.log(GREEN + "OK" + RESET + "      controls behaved. vocabulary=" + vocab.size +
      " entries, baseline=" + baseline.size + " ratcheted scope(s).");
    process.exit(0);
  }

  // The PR title is NOT in the checkout. The workflow supplies it.
  const title = process.env.PR_TITLE;
  if (title == null || String(title).trim() === "") {
    console.error("[CANNOT MEASURE] PR_TITLE not set.");
    console.error("                 This check reads the title from the environment because it is not in");
    console.error("                 the checkout. In .github/workflows/ci.yml the step must carry:");
    console.error("                     env:");
    console.error("                       PR_TITLE: ${{ github.event.pull_request.title }}");
    console.error("                 Exiting 2, never 0: a title check that passes when it cannot see the");
    console.error("                 title reports green forever and measures nothing.");
    process.exit(2);
  }

  const r = checkTitle(title, vocab, baseline);

  if (r.ok) {
    // Verdict line FIRST, warning under it — slice 1's ordering. Anything reading this output
    // reads the first line to learn the verdict.
    console.log(GREEN + "PASS" + RESET + "    " + JSON.stringify(title));
    console.log("        " + DIM + "scope=" + r.scope + "  normalised=" + r.normalised +
      "  via=" + r.source + RESET);
    if (r.source === "baselined") {
      console.log("        " + YELLOW + "WARN" + RESET + " scope \"" + r.scope +
        "\" resolves to no module, area or directory in this repo.");
      console.log("             It passes only because it is ratcheted in");
      console.log("             scripts/pipeline/title-scope-baseline.json. That file may only SHRINK.");
      console.log("             Retitle to the module this PR really changes and delete the entry in the");
      console.log("             same PR.");
    }
    process.exit(0);
  }

  if (r.code === "TITLE_STRUCTURE") {
    console.log(RED + "FAIL" + RESET + "    " + JSON.stringify(title));
    console.error("        [TITLE_STRUCTURE] a PR title must be  <type>(<module>): <summary>");
    console.error("        Legal types: " + TYPES.join(", "));
    console.error("        A `!` before the colon is allowed (breaking change). The scope is NOT optional:");
    console.error("        `docs: ...` is rejected, `docs(pipeline): ...` passes.");
    console.error("");
    console.error("        Rename the PR:  gh pr edit <number> --title \"feat(<module>): <summary>\"");
    console.error("        <module> is your prompt's `module:` value — see");
    console.error("        docs/pr-prompts/PROMPT-SCHEMA.md#the-pr-title.");
    process.exit(1);
  }

  console.log(RED + "FAIL" + RESET + "    " + JSON.stringify(title));
  console.error("        [TITLE_SCOPE_UNRESOLVED] scope \"" + r.scope + "\" names nothing this repo can point at.");
  console.error("        seen:       " + r.scope);
  console.error("        normalised: " + r.normalised + "   " +
    (r.scope === r.normalised ? "(no slice suffix to strip)" : "(slice suffix stripped)"));
  console.error("        nearest 5:  " + nearest(r.normalised, vocab).join(", "));
  console.error("");
  console.error("        The scope must be a module directory under apps/api/src/modules/ or");
  console.error("        apps/web/src/pages/, an area directory under apps/ packages/ docs/ scripts/,");
  console.error("        or one of the NAMED_AREAS in scripts/pipeline/check-pr-title.mjs.");
  console.error("        A `-s<N>` / `-slice<N>` suffix is stripped for you, so `crm-s11` is fine.");
  console.error("");
  console.error("        Rename the PR:  gh pr edit <number> --title \"<type>(<module>): <summary>\"");
  console.error("        Use your prompt's `module:` value — it is validated against the same vocabulary");
  console.error("        (docs/pr-prompts/PROMPT-SCHEMA.md#the-pr-title).");
  console.error("");
  console.error("        Do NOT add this scope to scripts/pipeline/title-scope-baseline.json. That file");
  console.error("        may only SHRINK; adding to it is the gate failing open.");
  process.exit(1);
}
