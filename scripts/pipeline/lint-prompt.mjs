#!/usr/bin/env node
/**
 * STATION 0 - INTAKE LINT.  A jig, not a worker. Costs zero tokens.
 *
 * Kills 39 of 194 historical failures BEFORE an agent is ever spawned:
 *   - 34 "stale prompt" runs  (work already on main; agent boots, greps, exits, no PR)
 *   -  5 "false premise" runs (prompt describes a repo that does not exist)
 *
 * Also refuses oversized prompts. pr-replace-native-browser-dialogs tried 48 call sites,
 * burned 240 turns (DOUBLE the normal budget), left 33 files in the shared tree, and killed
 * the queue for 13 hours. Raising the turn cap does not help. Splitting does.
 *
 * Exit 0 = admit.  1 = reject.  3 = stale (binned).
 */

import { readFileSync, readdirSync, renameSync, existsSync } from "node:fs";
import { execSync, execFileSync } from "node:child_process";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_SIZE = 10;
const REQUIRED = ["premise", "premise_means", "scope", "done_when", "size"];

// ---------------------------------------------------------------------------
// Cluster-chaining SLICE 1: dependency key recognition and validation
// ---------------------------------------------------------------------------

/** The three legal dependency keys the watcher honours (or will honour). */
const LEGAL_DEP_KEYS = ["requires_merged", "requires_file_on_main", "requires_on_main"];

/**
 * Levenshtein edit distance — small helper so we can suggest the nearest legal
 * key instead of giving a bare UNKNOWN_KEY rejection.  No new deps; pure JS.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/** Nearest legal dep key by edit distance. */
function nearestDepKey(bad) {
  let best = LEGAL_DEP_KEYS[0];
  let bestDist = levenshtein(bad, best);
  for (const k of LEGAL_DEP_KEYS.slice(1)) {
    const d = levenshtein(bad, k);
    if (d < bestDist) { best = k; bestDist = d; }
  }
  return best;
}

/**
 * Extract the raw front-matter block (between first and second ---).
 * Returns null when there is no front-matter.
 */
function rawFrontMatterBlock(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

/**
 * Scan the raw front-matter text for any key that looks like a `requires*`
 * variant (including hyphenated forms that parseFrontMatter never sees because
 * its key regex only allows underscores).  Returns an array of bad key strings.
 *
 * Strategy: flag any key that (a) matches /^requires?[-_]/i and (b) does NOT
 * exactly match one of the three legal keys (case-insensitively, after lowering).
 * Hyphen vs. underscore is intentionally NOT normalised here — `requires-merged`
 * is a distinct bad key even though it is "close" to `requires_merged`.
 */
function findUnknownDepKeys(rawFm) {
  const bad = [];
  for (const line of rawFm.split(/\r?\n/)) {
    // Match any line where the key starts with "require" + optional "s" + separator.
    // Accepts both hyphen and underscore separators to catch the common typos.
    const m = line.match(/^(requires?[-_]\S*?):\s*/i);
    if (!m) continue;
    const rawKey = m[1];
    const keyLower = rawKey.toLowerCase();
    if (!LEGAL_DEP_KEYS.includes(keyLower)) {
      bad.push(rawKey);  // report original casing/punctuation
    }
  }
  return bad;
}

/**
 * Given an unknown dep key (already lowered), suggest the nearest legal key
 * by Levenshtein distance.  Normalise hyphens → underscores first so that
 * `requires-merged` is close to `requires_merged` (distance 1), not far.
 */
function suggestDepKey(badKeyLower) {
  const normalised = badKeyLower.replace(/-/g, "_");
  return nearestDepKey(normalised);
}

/**
 * Validate the values of the three legal dependency keys.
 * Returns { ok: true } or { ok: false, code, msg }.
 *
 * Mirror the watcher's exact contract (scripts/pr-watcher/index.mjs ~line 860):
 *   requires_merged  -> positive integer (list or scalar)
 *   requires_file_on_main -> non-empty path (list or scalar)
 *   requires_on_main -> non-empty path or "path :: fixed-string" (list or scalar)
 *                       WARN only — watcher does not honour it until SLICE 2.
 */
function validateDepKeyValues(fm, file) {
  // requires_merged: must be a positive integer (or list of positive integers)
  if (fm.requires_merged !== undefined) {
    const vals = Array.isArray(fm.requires_merged) ? fm.requires_merged : [fm.requires_merged];
    // An empty list means the key was present but had no values — silently drops the gate.
    if (vals.length === 0) {
      return {
        ok: false, code: "REQUIRES_MERGED_INVALID",
        msg: "requires_merged is empty. Provide at least one positive integer PR number.",
      };
    }
    for (const raw of vals) {
      const str = String(raw).trim();
      if (str === "" || str === "[]") {
        return {
          ok: false, code: "REQUIRES_MERGED_INVALID",
          msg: "requires_merged value is empty. Provide a positive integer PR number.",
        };
      }
      const n = Number(str);
      if (!Number.isInteger(n) || n <= 0) {
        return {
          ok: false, code: "REQUIRES_MERGED_INVALID",
          msg:
            "requires_merged value must be a positive integer PR number (got " +
            JSON.stringify(str) + "). " +
            "Reject: 0, negatives, #123, abc, empty.",
        };
      }
    }
  }

  // requires_file_on_main: must be non-empty path (list or scalar)
  if (fm.requires_file_on_main !== undefined) {
    const vals = Array.isArray(fm.requires_file_on_main)
      ? fm.requires_file_on_main
      : [fm.requires_file_on_main];
    // An empty list means the key was present but had no values — silently drops the gate.
    if (vals.length === 0) {
      return {
        ok: false, code: "REQUIRES_PATH_EMPTY",
        msg: "requires_file_on_main is empty. Provide at least one file path.",
      };
    }
    for (const raw of vals) {
      const str = String(raw).trim();
      if (str === "" || str === "[]") {
        return {
          ok: false, code: "REQUIRES_PATH_EMPTY",
          msg: "requires_file_on_main has an empty value. Provide a non-empty file path.",
        };
      }
    }
  }

  // requires_on_main: must be non-empty path or "path :: fixed-string" (list or scalar)
  // WARN only — watcher does not honour this key until SLICE 2 lands.
  // TODO: remove this warning when SLICE 2 is on main.
  if (fm.requires_on_main !== undefined) {
    const vals = Array.isArray(fm.requires_on_main)
      ? fm.requires_on_main
      : [fm.requires_on_main];
    // An empty list means the key was present but had no values — silently drops the gate.
    if (vals.length === 0) {
      return {
        ok: false, code: "REQUIRES_PATH_EMPTY",
        msg: "requires_on_main is empty. Provide at least one path (or 'path :: fixed-string').",
      };
    }
    for (const raw of vals) {
      const str = String(raw).trim();
      if (str === "" || str === "[]") {
        return {
          ok: false, code: "REQUIRES_PATH_EMPTY",
          msg: "requires_on_main has an empty value. Provide a non-empty path (or 'path :: fixed-string').",
        };
      }
    }
    // Emit warning but do NOT change exit code or return failure.
    const fname = file ? basename(file) : "<file>";
    process.stderr.write(
      "WARN  " + fname + "  requires_on_main is accepted by the linter but not yet honoured by the watcher" +
      " (cluster-chaining SLICE 2). Until SLICE 2 is on main, a prompt relying on it will run UNGATED.\n"
    );
  }

  return { ok: true };
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

/** Minimal YAML front-matter parser. Deliberately dumb: no dependency, no surprises. */
export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let key = null;

  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim() || line.trim().startsWith("#")) continue;

    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && key) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(listItem[1].trim());
      continue;
    }

    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (kv) {
      key = kv[1];
      let v = kv[2].trim();
      // Strip surrounding quotes. WITHOUT THIS, a premise written as
      //     premise: '! grep -q "X" file'
      // executes WITH its quotes, the shell cannot find that "file", it fails, and the
      // prompt is silently binned as STALE.
      // A linter that bins VALID work is worse than no linter. This bug bit on first test.
      const q = v.slice(0, 1);
      if ((q === "'" || q === '"') && v.slice(-1) === q && v.length > 1) v = v.slice(1, -1);
      out[key] = v === "" ? [] : v;
    }
  }
  return out;
}

/**
 * Run the premise. EXIT 0 => the work is STILL NEEDED.
 *
 * Telling "premise legitimately false" from "premise is BROKEN" is the whole game:
 *   grep finds nothing  -> exit 1   -> already satisfied  -> BIN     (correct)
 *   command not found   -> exit 127 -> the PROMPT is wrong -> REJECT (do NOT bin)
 *   file missing        -> exit 2   -> the PROMPT is wrong -> REJECT (do NOT bin)
 * Getting this backwards silently discards real work.
 */
/**
 * Find a real bash. Premises are written in bash (`!`, `grep -q`, pipes) and Windows has neither
 * /bin/bash nor grep.
 *
 * THIS BUG SHIPPED AND WAS CAUGHT ON FIRST USE: with a hardcoded shell:"/bin/bash", every premise
 * on Windows failed to SPAWN. err.status came back undefined -> -1, which was not in the broken
 * list, so the linter concluded "premise not satisfied => work already done" and BINNED THE PROMPT.
 * It would have silently discarded the entire backlog while printing a cheerful green message.
 */
function findBash() {
  if (process.platform !== "win32") return "/bin/bash";
  const candidates = [
    "C:\\Program Files\\Git\\bin\\bash.exe",
    "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    process.env.ProgramFiles ? process.env.ProgramFiles + "\\Git\\bin\\bash.exe" : null,
  ].filter(Boolean);
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return null;
}

const BASH = findBash();

/**
 * fixes_pr live-check. A fix-lane prompt is authored against an OPEN PR (the
 * one it fix-forwards). If that PR has since MERGED (the fix landed) or
 * CLOSED (the target was abandoned), the fix prompt is stale — the linter
 * REJECTs it with FIX_TARGET_SETTLED. This is a REJECT, not a stale-bin: the
 * work may still be needed, but the diagnosis and pointer are wrong.
 *
 * Pure over an injected `fetchState` so it can be unit-tested without gh.
 */
export function checkFixesPrTargetOpen({ fixesPr, fetchState }) {
  if (fixesPr == null) return { ok: true };
  let state;
  try {
    state = fetchState(fixesPr);
  } catch (err) {
    return {
      ok: false,
      code: "FIX_TARGET_UNKNOWN",
      msg:
        "fixes_pr=" + fixesPr + ": could not read PR state (" + err.message + ").\n" +
        "        A fix-lane prompt must reference a live OPEN PR. Check the number.",
    };
  }
  if (state === "OPEN") return { ok: true };
  return {
    ok: false,
    code: "FIX_TARGET_SETTLED",
    msg:
      "fixes_pr=" + fixesPr + " is " + state + " (needs OPEN). The fix target has settled;\n" +
      "        this prompt's diagnosis is stale. Re-author against the current head or drop it.",
  };
}

function ghFetchPrState(prNumber) {
  // Guard against shell injection: with shell:true on Windows (needed so
  // `gh` resolves without .exe), Node interpolates argv back into a command
  // string. Refuse anything that isn't a bare positive integer.
  const n = Number(prNumber);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("invalid PR number: " + JSON.stringify(prNumber));
  }
  const gh = process.env.LINT_GH_BIN || "gh";
  const out = execFileSync(gh, ["pr", "view", String(n), "--json", "state"], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
    timeout: 30000,
    shell: process.platform === "win32",
  });
  return JSON.parse(out).state;
}

function runPremise(cmd, cwd) {
  if (!BASH) {
    // FAIL SAFE. Never bin work because the TOOL is broken.
    return { needed: false, broken: true, status: -1, stderr: "no bash found (install Git for Windows)" };
  }
  try {
    execSync(cmd, { cwd, stdio: ["ignore", "ignore", "pipe"], shell: BASH, timeout: 60000 });
    return { needed: true };
  } catch (err) {
    const status = typeof err.status === "number" ? err.status : -1;
    const stderr = String(err.stderr || "").trim();

    // A premise is "legitimately false" ONLY on a clean non-zero exit from a command that RAN.
    // Anything else - could not spawn, could not find the command, could not read the file - means
    // the PROMPT (or the tool) is wrong, not that the work is done. Those REJECT; they never BIN.
    // Getting this backwards silently discards real work, which is strictly worse than no linter.
    const broken =
      status === -1 ||          // spawn failure: no shell, ENOENT, killed
      status === 127 ||         // command not found
      status === 126 ||         // not executable
      status === 2 ||           // grep: file missing / usage error
      /command not found|No such file or directory|is not recognized|cannot access/i.test(stderr);

    return { needed: false, broken, status, stderr: stderr.slice(0, 200) };
  }
}

export function lint(file, opts) {
  const dequeue = opts && opts.dequeue;
  const repoRoot = (opts && opts.repoRoot) || process.cwd();
  const name = basename(file);
  const fileText = readFileSync(file, "utf8");
  const fm = parseFrontMatter(fileText);
  const fail = (code, msg) => ({ ok: false, code, msg, name });

  if (!fm) {
    return fail("NO_FRONT_MATTER",
      "No YAML front-matter. See docs/pr-prompts/PROMPT-SCHEMA.md.\n" +
      "        Every prompt needs an EXECUTABLE premise, or nothing can tell whether it is stale.");
  }

  // CLUSTER-CHAINING SLICE 1: validate dependency keys.
  // (a) Reject any unrecognised requires* key — catches hyphen vs. underscore, plural vs.
  //     singular, and other near-misses that parseFrontMatter silently ignores.
  {
    const rawFm = rawFrontMatterBlock(fileText);
    if (rawFm) {
      const badKeys = findUnknownDepKeys(rawFm);
      if (badKeys.length > 0) {
        const bad = badKeys[0];
        const suggestion = suggestDepKey(bad.toLowerCase());
        return fail("UNKNOWN_KEY",
          "Unknown dependency key: " + JSON.stringify(bad) + ".\n" +
          "        Did you mean " + JSON.stringify(suggestion) + "?\n" +
          "        Legal keys: " + LEGAL_DEP_KEYS.join(", ") + ".\n" +
          "        A mistyped key silently loses its gate — the prompt runs UNGATED.");
      }
    }
  }
  // (b) Validate the values of recognised dependency keys.
  {
    const depResult = validateDepKeyValues(fm, file);
    if (!depResult.ok) return fail(depResult.code, depResult.msg);
  }

  const missing = REQUIRED.filter((k) => !fm[k] || (Array.isArray(fm[k]) && fm[k].length === 0));
  if (missing.length) return fail("MISSING_FIELD", "Missing required field(s): " + missing.join(", "));

  const size = Number(fm.size);
  if (!Number.isFinite(size)) {
    return fail("MISSING_FIELD", "`size` must be a number (files this prompt expects to touch).");
  }
  if (size > MAX_SIZE) {
    return fail("SIZE_TOO_LARGE",
      "size=" + size + " exceeds the limit of " + MAX_SIZE + " files. SPLIT IT.\n" +
      "        pr-replace-native-browser-dialogs tried 48 call sites, burned 240 turns (DOUBLE the\n" +
      "        normal budget), left 33 files in the shared tree, killed the queue for 13 hours.\n" +
      "        Raising the turn cap does NOT help. Splitting does.");
  }

  // GATE-ALLOW coherence. 10 PRs failed CP-11 on a mis-declared or mis-formatted marker.
  const scope = (Array.isArray(fm.scope) ? fm.scope : [fm.scope]).join(" ");
  const scopeHasMigration = /migrations/.test(scope);
  const declaresMigration = String(fm.gate_allow || "none").indexOf("migrations") !== -1;

  if (scopeHasMigration && !declaresMigration) {
    return fail("GATE_ALLOW_MISMATCH",
      "scope touches migrations/ but gate_allow does not declare `migrations`. CP-11 will fail this PR.");
  }
  if (declaresMigration && !scopeHasMigration) {
    return fail("GATE_ALLOW_MISMATCH", "gate_allow declares `migrations` but scope has no migrations/ path.");
  }

  // LL-29 (2026-07-23): a turn-capped agent left a migration applied on main with all the consuming
  // code uncommitted, and nothing told the recovery path whether to drop the migration or press on.
  // For migration-scoped prompts, demand a one-line rollback_strategy authored at prompt-write time
  // when the "why" is still fresh. OPTIONAL for every other prompt; a missing field on a
  // non-migration prompt must NOT reject.
  if (scopeHasMigration) {
    const rb = fm.rollback_strategy;
    const empty = rb == null || (typeof rb === "string" && rb.trim() === "") || (Array.isArray(rb) && rb.length === 0);
    if (empty) {
      return fail("MISSING_FIELD",
        "scope touches prisma/migrations but `rollback_strategy` is missing/empty.\n" +
        "        One or two lines on how to revert or fix-forward if the run dies mid-flight\n" +
        "        (e.g. \"additive; safe to leave, re-run drops nothing\" or \"revert migration X, then re-apply\").\n" +
        "        See docs/pr-prompts/PROMPT-SCHEMA.md#rollback_strategy.");
    }
  }

  // OPS-6 (2026-08-12): a destructive/backfill/NOT-NULL/DROP/DELETE/TRUNCATE slice MUST have
  // escalates: true so a human reviews before the merge queue processes it. Without this guard,
  // a green prompt build auto-merges a destructive migration with no human in the loop —
  // exactly what happened with siteid-notnull-backfill, caught only by hand review.
  //
  // Corpus split: scope file-paths are intentionally EXCLUDED for intent-words ("backfill",
  // "destructive") because a test file named "backfill.spec.ts" is a name, not an instruction.
  // Unambiguous SQL operations (DROP TABLE, DELETE FROM, etc.) also check scope descriptions.
  // Body = Markdown text after the closing --- of the front-matter (not the raw YAML).
  // Two tiers (see below): literal SQL fires always; INTENT words fire only when `scope` can reach
  // apps/api/prisma. The old "prefer a false positive, a human clears it" stance was retired on
  // 2026-08-17 — the remedy it assumed (set escalates:true) turns a harmless prompt into one that
  // waits for a manual merge, so every false positive became an idle PR.
  {
    // TIER 1 — literal SQL statements. A prompt whose text contains one of these is describing an
    // operation, not a topic, so it fires regardless of scope.
    const DESTRUCTIVE_PATTERNS_ALL = [
      { re: /\bSET\s+NOT\s+NULL\b/i, label: "SET NOT NULL" },
      { re: /\bDROP\s+(TABLE|COLUMN|CONSTRAINT|TYPE)\b/i, label: "DROP TABLE/COLUMN/CONSTRAINT/TYPE" },
      { re: /\bDELETE\s+FROM\b/i, label: "DELETE FROM" },
      { re: /\bTRUNCATE\b/i, label: "TRUNCATE" },
      { re: /\bdrop[-_]legacy\b/i, label: "drop-legacy / drop_legacy" },
    ];
    // TIER 2 — INTENT words. These are topic words, not operations: they appear in prompt file
    // NAMES, in prose describing OTHER prompts, and in text that merely explains this very rule.
    // They only mean anything if the prompt can actually reach the database, so they fire ONLY when
    // `scope` touches apps/api/prisma/** (migrations, schema, seeds). A docs-only or scripts-only
    // prompt cannot run a migration no matter which words it contains.
    //
    // WHY THIS IS NARROWER THAN IT WAS (2026-08-17): the original comment reasoned "prefer a
    // false-positive that a human clears by setting the flag over a false-negative". But the
    // remedy is wrong for a false positive — setting `escalates: true` on a harmless prompt makes
    // it wait for a human merge for no reason, so every false positive became an idle PR. Three
    // real prompts were rejected on the same day, all harmless: two sat armed in the queue where
    // nobody noticed they could never dequeue, and the third was rejected for QUOTING this rule's
    // own wording. Scope-gating keeps every genuine case (the OPS-6 prompt that caused this rule,
    // siteid-notnull-backfill, is migration-scoped and is still caught) while removing the class of
    // false positive that was quietly rotting the queue.
    const DESTRUCTIVE_PATTERNS_PROSE = [
      { re: /\bbackfill\b/i, label: "backfill" },
      { re: /\bdestructive\b/i, label: "destructive" },
      { re: /\bNOT[\s-]NULL\b/i, label: "NOT NULL" },
    ];

    // Extract the Markdown body (text after the second ---).
    const bodyMatch = fileText.match(/^---[\s\S]*?^---\r?\n([\s\S]*)$/m);
    const body = bodyMatch ? bodyMatch[1] : "";

    const scopeList = Array.isArray(fm.scope) ? fm.scope : [String(fm.scope || "")];
    const corpusAll = [
      String(fm.premise || ""),
      String(fm.premise_means || ""),
      ...scopeList,
      String(fm.done_when || ""),
      body,
    ].join("\n");

    const corpusProse = [
      String(fm.premise || ""),
      String(fm.premise_means || ""),
      String(fm.done_when || ""),
      body,
    ].join("\n");

    // Can this prompt reach the database at all? Only a scope entry under apps/api/prisma/**
    // (migrations, schema.prisma, seeds) can apply a migration or rewrite rows.
    const scopeTouchesDb = scopeList.some((s) => /apps[\\/]api[\\/]prisma/i.test(String(s)));

    const matched =
      DESTRUCTIVE_PATTERNS_ALL.find(({ re }) => re.test(corpusAll)) ||
      (scopeTouchesDb
        ? DESTRUCTIVE_PATTERNS_PROSE.find(({ re }) => re.test(corpusProse))
        : undefined);

    if (matched) {
      const escalatesTrue = String(fm.escalates || "").trim().toLowerCase() === "true";
      if (!escalatesTrue) {
        return fail("DESTRUCTIVE_MUST_ESCALATE",
          "Destructive signal detected (\"" + matched.label + "\") but `escalates` is not `true`.\n" +
          "        A backfill / NOT-NULL / DROP / DELETE / TRUNCATE / destructive slice auto-merges if\n" +
          "        escalates is false — a human MUST review before the merge queue processes it.\n" +
          "        Set `escalates: true` in front-matter, OR narrow the scope/wording to remove the\n" +
          "        destructive signal if the term matched in a non-destructive context. (OPS-6 2026-08-12)");
      }
    }
  }

  // Gate A / pipeline-correctness-gates §2 (closes the #923 class): a migration-scoped prompt must
  // EITHER also name a test file in `scope`, OR declare `backfill: false` to assert the migration
  // does no data backfill. #923 was a backfill migration whose SQL wrote invalid enum tokens; CI
  // stayed green because nothing ran the backfill against a seeded row.
  //
  // The linter runs at INTAKE — the migration file does not exist yet, so we cannot inspect its
  // body for `UPDATE … SET`. Instead we force the AUTHOR to make the choice up front: bring a test,
  // or consciously assert "no backfill." This is the standalone general layer; SLICE 2 (#957) adds
  // the FormRule-specific CI test. The rule is additive — existing migration prompts that already
  // name a test (or add `backfill: false`) still pass. See docs/plans/pipeline-correctness-gates-plan.md §2 Gate A.
  if (scopeHasMigration) {
    const scopeItems = Array.isArray(fm.scope) ? fm.scope : [fm.scope];
    const namesTest = scopeItems.some((s) => /\.(spec|test)\.[tj]s$/.test(String(s)));
    const backfillDeclared = fm.backfill != null && String(fm.backfill).trim() !== "";
    const backfillFalse = backfillDeclared && /^false$/i.test(String(fm.backfill).trim());
    if (!namesTest && !backfillFalse) {
      return fail("BACKFILL_TEST_REQUIRED",
        "scope touches prisma/migrations but names no test file (*.spec.ts / *.test.ts) and does not declare `backfill: false`.\n" +
        "        Gate A (docs/plans/pipeline-correctness-gates-plan.md §2) requires EITHER a test file in `scope`\n" +
        "        that exercises the migration, OR the explicit assertion `backfill: false` for pure additive\n" +
        "        migrations (ADD COLUMN / CREATE with no UPDATE ... SET). Closes the #923 class where a\n" +
        "        backfill migration shipped without a test and wrote invalid enum tokens to prod-shaped data.");
    }
  }

  // fixes_pr — a fix-lane prompt is only valid while its target PR is OPEN.
  // Cheaper than the premise (single gh call, no shell subprocess), so run
  // it first: a stale fix pointer is a hard reject regardless of premise.
  if (fm.fixes_pr !== undefined && fm.fixes_pr !== "" && !(Array.isArray(fm.fixes_pr) && fm.fixes_pr.length === 0)) {
    const fixesPr = Number(fm.fixes_pr);
    if (!Number.isInteger(fixesPr) || fixesPr <= 0) {
      return fail("FIX_TARGET_INVALID",
        "fixes_pr must be a positive integer PR number (got " + JSON.stringify(fm.fixes_pr) + ").");
    }
    const fetch = (opts && opts.fetchPrState) || ghFetchPrState;
    const res = checkFixesPrTargetOpen({ fixesPr, fetchState: fetch });
    if (!res.ok) return fail(res.code, res.msg);
  }

  // THE CHECK THAT PAYS FOR THIS WHOLE FILE.
  const res = runPremise(String(fm.premise), repoRoot);

  if (res.broken) {
    return fail("PREMISE_INVALID",
      "The premise command ERRORED (exit " + res.status + ") - your assumption about the repo is wrong.\n" +
      "        " + DIM + (res.stderr || "(no stderr)") + RESET + "\n" +
      "        5 historical runs died on prompts whose premise was simply FALSE (pr-23 mirrored a spec\n" +
      "        file that does not exist; pr-ops-map-m1 was told to read a doc that does not exist).");
  }

  if (!res.needed) {
    if (dequeue) {
      renameSync(file, file.replace(/-ready\.md$/, ".md") + ".stale-premise-already-satisfied");
    }
    return {
      ok: false, stale: true, code: "PREMISE_ALREADY_SATISFIED", name,
      msg: 'Premise no longer holds: "' + fm.premise_means + '"\n' +
           "        The work is ALREADY DONE. Binned before spawning an agent.\n" +
           "        " + GREEN + "This is the lint working." + RESET + " 34 historical runs were burned on exactly this.",
    };
  }

  return { ok: true, name, size, premise: String(fm.premise) };
}

// ---------------------------------------------------------------------------

// Skip the CLI section when imported as a module (unit tests do this).
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: lint-prompt.mjs <file.md> | --all <dir> | --dequeue <file.md>");
  process.exit(64);
}

const repoRoot = process.env.LINT_REPO_ROOT || process.cwd();
let files = [];
let dequeue = false;

if (args[0] === "--all") {
  files = readdirSync(args[1]).filter((f) => f.endsWith("-ready.md")).map((f) => join(args[1], f));
} else if (args[0] === "--dequeue") {
  dequeue = true;
  files = [args[1]];
} else {
  files = [args[0]];
}

let admitted = 0;
let rejected = 0;
let stale = 0;

for (const f of files) {
  if (!existsSync(f)) {
    console.log(RED + "MISSING" + RESET + " " + f);
    rejected++;
    continue;
  }
  const r = lint(f, { dequeue, repoRoot });
  if (r.ok) {
    console.log(GREEN + "ADMIT  " + RESET + " " + r.name + "  " + DIM + "(size " + r.size + ")" + RESET);
    admitted++;
  } else if (r.stale) {
    console.log(YELLOW + "STALE  " + RESET + " " + r.name + "\n        " + r.msg);
    stale++;
  } else {
    console.log(RED + "REJECT " + RESET + " " + r.name + "  [" + r.code + "]\n        " + r.msg);
    rejected++;
  }
}

if (files.length > 1) {
  console.log("\n" + DIM + "----------------------------------------" + RESET);
  console.log("admitted " + GREEN + admitted + RESET + " | stale " + YELLOW + stale + RESET + " | rejected " + RED + rejected + RESET);
}

process.exit(stale > 0 && files.length === 1 ? 3 : rejected > 0 ? 1 : 0);
}
