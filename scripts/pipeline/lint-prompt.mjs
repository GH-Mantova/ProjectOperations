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
import { join, basename, dirname } from "node:path";
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
 * Mirror the watcher's exact contract (scripts/pr-watcher/index.mjs):
 *   requires_merged  -> positive integer (list or scalar)
 *   requires_file_on_main -> non-empty path (list or scalar)
 *   requires_on_main -> non-empty path or "path :: fixed-string" (list or scalar)
 *                       honoured by the watcher since cluster-chaining SLICE 2.
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
  // Honoured by the watcher since cluster-chaining SLICE 2.
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
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// VS-S3: design_ref — a UI prompt must name the design it came from
// ---------------------------------------------------------------------------

/**
 * Marco designs a screen in an artifact or mock-up, has Station 06 turn it into a
 * PR, then checks the result against that same artifact. Until this rule shipped,
 * that link lived only in his head — a reviewer could not find the design, and the
 * vision review (VS-S1) had to judge against whatever prose the PR body carried.
 *
 * Two accepted shapes for the value (single-line string):
 *   - artifact URL:  https://claude.ai/code/artifact/<uuid>
 *   - repo-relative: Claude Design/<path>  (gitignored — do NOT check existence)
 *
 * The check is INTENTIONALLY shape-only. An artifact URL is not reachable from CI,
 * and a Claude Design/ path is gitignored so `git cat-file` would fail on a file
 * that is genuinely there. Existence-checking here would turn every correct prompt
 * into a false-positive REJECT.
 *
 * Two rejection codes:
 *   DESIGN_REF_MALFORMED       — key is set but neither shape matches
 *   UI_PROMPT_NEEDS_DESIGN_REF — scope touches apps/web/ AND design_ref is missing/
 *                                empty AND no fixes_pr is set (fix-forward exception)
 */
const DESIGN_REF_URL_RE = /^https:\/\/claude\.ai\/code\/artifact\/[A-Za-z0-9_-]+/;
const DESIGN_REF_PATH_RE = /^Claude Design\/\S/;

function validateDesignRef(fm) {
  const raw = fm.design_ref;
  const isSet =
    raw !== undefined &&
    raw !== "" &&
    !(Array.isArray(raw) && raw.length === 0);

  const scopeList = Array.isArray(fm.scope)
    ? fm.scope
    : (fm.scope != null && fm.scope !== "" ? [fm.scope] : []);
  const scopeTouchesWeb = scopeList.some((s) =>
    /^apps[\\/]web[\\/]/.test(String(s).trim()),
  );
  const hasFixesPr =
    fm.fixes_pr !== undefined &&
    fm.fixes_pr !== "" &&
    !(Array.isArray(fm.fixes_pr) && fm.fixes_pr.length === 0);

  if (isSet) {
    if (Array.isArray(raw)) {
      return {
        ok: false, code: "DESIGN_REF_MALFORMED",
        msg:
          "design_ref must be a single-line string, not a list.\n" +
          "        Expected one of:\n" +
          "          design_ref: https://claude.ai/code/artifact/<uuid>\n" +
          "          design_ref: Claude Design/<path>",
      };
    }
    const val = String(raw).trim();
    if (!DESIGN_REF_URL_RE.test(val) && !DESIGN_REF_PATH_RE.test(val)) {
      return {
        ok: false, code: "DESIGN_REF_MALFORMED",
        msg:
          "design_ref=" + JSON.stringify(val) + " does not match either accepted shape.\n" +
          "        Expected one of:\n" +
          "          design_ref: https://claude.ai/code/artifact/<uuid>\n" +
          "          design_ref: Claude Design/<path>\n" +
          "        Existence is deliberately NOT checked — the artifact URL is unreachable\n" +
          "        from CI and the Claude Design/ path is gitignored. Shape only.",
      };
    }
    return { ok: true };
  }

  if (scopeTouchesWeb && !hasFixesPr) {
    return {
      ok: false, code: "UI_PROMPT_NEEDS_DESIGN_REF",
      msg:
        "scope touches apps/web/ but no design_ref is set.\n" +
        "        A UI prompt must name the design it was built from so the vision review\n" +
        "        (VS-S1) and any human reviewer can compare the PR against the mock-up.\n" +
        "        Cite one of:\n" +
        "          design_ref: https://claude.ai/code/artifact/<uuid>\n" +
        "          design_ref: Claude Design/<path>\n" +
        "        Exception: a fix-forward prompt (fixes_pr: N) is exempt — a red-board fix\n" +
        "        must never be blocked for want of a design citation.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Cluster-chaining SLICE 3: cluster metadata and the rules that police it
// ---------------------------------------------------------------------------

/**
 * A cluster slug is a short kebab-case identifier that groups a set of prompts
 * into an ORDERED chain. `cluster_order` is a positive integer position within
 * the chain. Both keys are OPTIONAL - a prompt with neither is unchanged.
 *
 * Rule matrix:
 *   cluster only                       -> legal (one-slice cluster)
 *   cluster + cluster_order (>= 1)     -> legal
 *   cluster_order without cluster      -> REJECT (order without a chain)
 *   cluster_order <= 0 / non-integer   -> REJECT
 *   bad slug shape                     -> REJECT (CLUSTER_BAD_SLUG)
 *   cluster_order > 1 with no dep key  -> REJECT (CLUSTER_NO_DEP)
 *   cycle across sibling prompts       -> REJECT (CLUSTER_CYCLE)
 *   requires_on_main needle already
 *     on origin/main at intake         -> REJECT (CLUSTER_DEAD_GATE)
 */
const CLUSTER_SLUG_RE = /^[a-z][a-z0-9-]{2,40}$/;

/**
 * Validate the shape of the cluster / cluster_order pair, in isolation.
 * The relational rules (NO_DEP, CYCLE, DEAD_GATE) live in separate helpers.
 */
function validateClusterShape(fm) {
  const hasCluster = fm.cluster !== undefined && fm.cluster !== "" && !(Array.isArray(fm.cluster) && fm.cluster.length === 0);
  const hasOrder = fm.cluster_order !== undefined && fm.cluster_order !== "" && !(Array.isArray(fm.cluster_order) && fm.cluster_order.length === 0);

  if (!hasCluster && !hasOrder) return { ok: true, hasCluster: false, hasOrder: false };

  if (!hasCluster && hasOrder) {
    return {
      ok: false, code: "CLUSTER_ORDER_NO_CLUSTER",
      msg: "cluster_order is set but cluster is not. A position without a chain has no meaning; declare both or neither.",
    };
  }

  const slug = String(fm.cluster).trim();
  if (!CLUSTER_SLUG_RE.test(slug)) {
    return {
      ok: false, code: "CLUSTER_BAD_SLUG",
      msg:
        "cluster=" + JSON.stringify(slug) + " does not match ^[a-z][a-z0-9-]{2,40}$.\n" +
        "        Slugs are lowercase-kebab, 3-41 chars, must start with a letter. Example: cluster-chaining.",
    };
  }

  let order = null;
  if (hasOrder) {
    const raw = String(fm.cluster_order).trim();
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      return {
        ok: false, code: "CLUSTER_ORDER_INVALID",
        msg:
          "cluster_order must be a positive integer (got " + JSON.stringify(raw) + "). Reject: 0, negatives, non-numerics.",
      };
    }
    order = n;
  }

  return { ok: true, hasCluster: true, hasOrder, slug, order };
}

/**
 * A prompt has a declared dependency key if any of the three watcher-honoured
 * keys is present and non-empty. This is what CLUSTER_NO_DEP checks against.
 */
function hasAnyDepKey(fm) {
  for (const k of LEGAL_DEP_KEYS) {
    const v = fm[k];
    if (v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    return true;
  }
  return false;
}

/**
 * Parse the `requires_on_main` values from a front-matter object into an
 * array of { path, needle } pairs. Accepts scalar or list form; a value with
 * no `::` has needle=null (existence gate only).
 */
function parseRequiresOnMainEntries(fm) {
  const raw = fm.requires_on_main;
  if (raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) return [];
  const vals = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of vals) {
    const s = String(v).trim();
    if (!s) continue;
    const idx = s.indexOf("::");
    if (idx === -1) {
      out.push({ path: s, needle: null });
    } else {
      out.push({ path: s.slice(0, idx).trim(), needle: s.slice(idx + 2).trim() });
    }
  }
  return out;
}

/**
 * Read every *-ready.md and *-HOLD.md front-matter in the same directory and
 * build a graph { slug -> { name -> Set<prereqName> } }.
 *
 * Fail SAFE: if the directory cannot be read, or an individual sibling is
 * malformed, WARN to stderr and SKIP that sibling. Never reject a well-formed
 * prompt because an unrelated sibling is broken - one bad prompt must not
 * block the whole queue.
 *
 * Prereq resolution is intentionally limited to the two forms whose names
 * can be resolved from front-matter alone:
 *   - `requires_file_on_main: <path>`  when <path> is another prompt's file
 *   - `requires_on_main: <path>[ :: X]` same rule
 * `requires_merged: N` is a PR-number gate, not a name gate, so it is IGNORED
 * for cycle detection - the cycle rule only catches file-based back-edges.
 */
function buildClusterGraph(promptDir, self) {
  const graph = new Map();
  let entries;
  try {
    entries = readdirSync(promptDir);
  } catch (err) {
    process.stderr.write("WARN  cluster-graph: cannot read " + promptDir + " (" + err.message + "); skipping cycle check.\n");
    return null;
  }

  const nameByPath = new Map();
  const parsed = [];
  for (const entry of entries) {
    if (!/-ready\.md$|-HOLD\.md$/.test(entry)) continue;
    const full = join(promptDir, entry);
    let text;
    try {
      text = readFileSync(full, "utf8");
    } catch (err) {
      process.stderr.write("WARN  cluster-graph: cannot read " + entry + "; skipping.\n");
      continue;
    }
    let fm;
    try {
      fm = parseFrontMatter(text);
    } catch (err) {
      process.stderr.write("WARN  cluster-graph: malformed front-matter in " + entry + "; skipping.\n");
      continue;
    }
    if (!fm || !fm.cluster) continue;
    parsed.push({ name: entry, fm });
    nameByPath.set(entry, entry);
  }

  // If we are validating a prompt not yet on disk (e.g. a synthetic test file),
  // splice in the caller's own front-matter under its intended name.
  if (self && self.fm && self.fm.cluster) {
    const idx = parsed.findIndex((p) => p.name === self.name);
    if (idx >= 0) parsed[idx] = { name: self.name, fm: self.fm };
    else parsed.push({ name: self.name, fm: self.fm });
  }

  for (const { name, fm } of parsed) {
    const slug = String(fm.cluster).trim();
    if (!graph.has(slug)) graph.set(slug, new Map());
    const bucket = graph.get(slug);
    if (!bucket.has(name)) bucket.set(name, new Set());
    const prereqNames = bucket.get(name);

    const pathGates = [];
    if (fm.requires_file_on_main !== undefined) {
      const vals = Array.isArray(fm.requires_file_on_main) ? fm.requires_file_on_main : [fm.requires_file_on_main];
      for (const v of vals) {
        const s = String(v).trim();
        if (s) pathGates.push(s);
      }
    }
    for (const { path } of parseRequiresOnMainEntries(fm)) {
      if (path) pathGates.push(path);
    }
    for (const p of pathGates) {
      const base = basename(p);
      if (nameByPath.has(base) && base !== name) prereqNames.add(base);
    }
  }
  return graph;
}

/**
 * DFS cycle detector. Returns the FIRST cycle found as an array of names, or
 * null if the graph is acyclic. Only walks the bucket for the given slug.
 */
function findCycleInCluster(graph, slug) {
  const bucket = graph.get(slug);
  if (!bucket) return null;
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const name of bucket.keys()) color.set(name, WHITE);

  const stack = [];
  function visit(name) {
    color.set(name, GRAY);
    stack.push(name);
    const prereqs = bucket.get(name) || new Set();
    for (const next of prereqs) {
      if (!bucket.has(next)) continue;
      const c = color.get(next);
      if (c === GRAY) {
        const cycleStart = stack.indexOf(next);
        return stack.slice(cycleStart).concat([next]);
      }
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(name, BLACK);
    return null;
  }

  for (const name of bucket.keys()) {
    if (color.get(name) === WHITE) {
      const cycle = visit(name);
      if (cycle) return cycle;
    }
  }
  return null;
}

/**
 * Fetch a file's contents from origin/main. Returns null when the file is
 * absent OR when git itself is unavailable / errors. Callers MUST treat null
 * as "cannot decide, skip the check" - never as "gate is satisfied".
 */
function readFromOriginMain(path, repoRoot) {
  const gitBin = process.env.LINT_GIT_BIN || "git";
  try {
    return execFileSync(gitBin, ["show", "origin/main:" + path], {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
      timeout: 10000,
      shell: process.platform === "win32",
    });
  } catch (err) {
    // Distinguish "file not on main" (path-doesnotexist error) from "git broken".
    // git returns 128 for both, so peek at stderr - "does not exist" / "unknown
    // revision" / "exists on disk, but not in" are the file-absent shapes.
    const stderr = String(err.stderr || "");
    if (/does not exist|unknown revision|exists on disk|bad revision/i.test(stderr)) {
      return { absent: true };
    }
    return null; // git broken - skip check, fail SAFE
  }
}

/**
 * FILE_GATE_DEAD vs GATE_RELEASED — same probe, two verdicts by prompt state.
 *
 * A `requires_file_on_main` path that is present on origin/main means one of
 * two very different things, depending on whether the prompt is still parked
 * (a `-HOLD.md`) or has been armed (`-ready.md` / other):
 *
 *   - non-HOLD  → FILE_GATE_DEAD (REJECT).  The path is present at *author
 *     time*, before the slice was ever armed.  A gate that can never be
 *     absent can never fail, so the slice would dispatch alongside its
 *     predecessor with no ordering at all.  Genuine authoring hole.
 *
 *   - HOLD      → GATE_RELEASED (ADMIT + promotion signal).  The prompt was
 *     parked *waiting* for exactly this path to land; its arrival IS the
 *     success condition, not a defect.  Emit a distinct message so the reader
 *     sees a HOLD is ready to promote — collapsing this into a plain ADMIT
 *     would hide the event in `--all` output.
 *
 * Fail SAFE on git errors: emit a warning, admit the prompt. One broken
 * `git` binary must not bin the whole queue.
 */
function checkFileGateDead(fm, repoRoot, name, isHold) {
  const raw = fm.requires_file_on_main;
  if (raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
    return { ok: true };
  }
  const released = [];
  const vals = Array.isArray(raw) ? raw : [raw];
  for (const v of vals) {
    const path = String(v).trim();
    if (!path) continue;
    const contents = readFromOriginMain(path, repoRoot);
    if (contents === null) {
      process.stderr.write(
        "WARN  " + (name || "<file>") + "  could not probe origin/main:" + path + " for file-gate probe; skipping.\n"
      );
      continue;
    }
    if (contents.absent) continue; // path missing on main = gate legitimately unmet — checkGateNotReleased catches the unmet-HOLD case
    if (isHold) {
      released.push({
        code: "GATE_RELEASED",
        gate: "requires_file_on_main",
        path,
        msg: "requires_file_on_main: \"" + path + "\" is now on origin/main — HOLD is ready to promote.",
      });
      continue;
    }
    return {
      ok: false, code: "FILE_GATE_DEAD",
      msg:
        "requires_file_on_main: \"" + path + "\" is on origin/main at author-time (non-HOLD prompt).\n" +
        "        FILE_GATE_DEAD — the path is present before the slice is even armed, so the gate\n" +
        "        can never fail and the slice would dispatch alongside its predecessor with no\n" +
        "        ordering at all. (For a -HOLD.md whose gate has RELEASED, this same probe emits\n" +
        "        GATE_RELEASED and admits — the HOLD is ready to promote.)\n" +
        "        Two legal fixes:\n" +
        "          - re-point at a content gate the predecessor actually introduces:\n" +
        "                requires_on_main: " + path + " :: <fixed string from the predecessor>\n" +
        "          - drop the key entirely if the dependency is genuinely satisfied.",
    };
  }
  if (released.length > 0) return { ok: true, released };
  return { ok: true };
}

/**
 * CLUSTER_DEAD_GATE vs GATE_RELEASED — same probe, two verdicts by prompt state
 * AND cluster position.
 *
 * A `requires_on_main` content needle (`path :: fixed-string`) found on
 * origin/main means different things depending on whether the prompt is a
 * chain successor and whether it is armed:
 *
 *   - HOLD (any cluster_order)  → GATE_RELEASED (ADMIT + promotion signal).
 *     The prompt was parked *waiting* for exactly this needle to appear; its
 *     arrival IS the success condition, not a defect.
 *
 *   - non-HOLD, cluster_order > 1 → GATE_RELEASED (ADMIT). A chain successor
 *     depends on its predecessor landing. A satisfied gate here means the
 *     predecessor SHIPPED — that is the precondition for arming, not a
 *     defect. Without this carve-out, every merge in a chain manufactures a
 *     dead-gate rejection on the next slice.
 *
 *   - non-HOLD, cluster_order == 1 (or unclustered)  → CLUSTER_DEAD_GATE
 *     (REJECT). No predecessor exists, so a needle present at author time is
 *     a decorative gate that can never fail — the slice would dispatch with
 *     no ordering at all. Genuine authoring hole.
 *
 * Existence-only gates (no `::`) are NOT checked here — that would be a
 * legitimate "wait for the file to appear" gate; only content gates can be
 * dead-on-arrival or freshly released.
 *
 * Fail SAFE on git errors: emit a warning, admit the prompt.
 */
function checkDeadGate(fm, repoRoot, name, isHold) {
  const entries = parseRequiresOnMainEntries(fm);
  const released = [];
  const orderNum = Number(fm.cluster_order);
  const isChainSuccessor = Number.isInteger(orderNum) && orderNum > 1;
  for (const { path, needle } of entries) {
    if (!needle) continue; // existence gate, not a content gate
    const contents = readFromOriginMain(path, repoRoot);
    if (contents === null) {
      process.stderr.write(
        "WARN  " + (name || "<file>") + "  cluster: could not probe origin/main:" + path + " for content-gate probe; skipping.\n"
      );
      continue;
    }
    if (contents.absent) continue; // file missing = gate legitimately unmet
    if (typeof contents === "string" && contents.indexOf(needle) !== -1) {
      if (isHold || isChainSuccessor) {
        released.push({
          code: "GATE_RELEASED",
          gate: "requires_on_main",
          path,
          needle,
          msg: isHold
            ? "requires_on_main: \"" + path + " :: " + needle + "\" is now on origin/main — HOLD is ready to promote."
            : "requires_on_main: \"" + path + " :: " + needle + "\" is now on origin/main — chain successor's predecessor has landed.",
        });
        continue;
      }
      return {
        ok: false, code: "CLUSTER_DEAD_GATE",
        msg:
          "requires_on_main: \"" + path + " :: " + needle + "\" is on origin/main at author-time (non-HOLD prompt, cluster_order 1).\n" +
          "        CLUSTER_DEAD_GATE - the needle is present before the slice is even armed,\n" +
          "        so the arming PR would dispatch this slice with no ordering gate at all.\n" +
          "        (For a -HOLD.md OR a chain successor (cluster_order > 1), this same probe\n" +
          "        emits GATE_RELEASED and admits.)\n" +
          "        Change the needle to something the predecessor slice actually introduces,\n" +
          "        or drop the gate if the predecessor is already merged.",
      };
    }
  }
  if (released.length > 0) return { ok: true, released };
  return { ok: true };
}

/**
 * ORPHANED_DISCHARGE guard.
 *
 * `docs/pr-prompts/BACKLOG.yaml` operates a rule: when an item IS staged into a
 * prompt, delete it from the register — one place, never two. Separately, this
 * linter bins a prompt whose premise no longer holds. Both rules are right; the
 * seam between them is not. On 2026-07-23 twelve slices of the B-P0a/B-P0b
 * workstream were lost when their SLICE-0 plan prompts were binned as STALE
 * moments after `BACKLOG.yaml` had discharged the register entries into them.
 *
 * The general rule: a prompt dying is NOT the same as the work being done. A
 * SLICE-0 plan prompt dies at the exact moment its plan ships — which is when
 * the real work begins.
 *
 * When the premise is dead AND `BACKLOG.yaml` still names this prompt basename,
 * this prompt is the register's only pointer to the work. Escalate STALE →
 * REJECT (exit 1) so a human chooses either to re-open the register item or to
 * stage the successor prompt in the same PR that bins this one.
 *
 * Read the register as UTF-8 (basenames are ASCII, so mojibake elsewhere in the
 * file does not affect the search). Match on the full basename with a boundary
 * check — a bare substring would confuse `pr-foo-HOLD.md` with any longer name
 * that ends in the same suffix.
 *
 * Fail SAFE: if the register cannot be read, return null and let the ordinary
 * STALE path proceed. A missing or unreadable register must not itself bin the
 * queue.
 *
 * Test seam: `LINT_BACKLOG_PATH` overrides the default location so the unit
 * tests can point at a synthetic register without a whole fake repo.
 */
function checkOrphanedDischarge(promptName, repoRoot) {
  const override = process.env.LINT_BACKLOG_PATH;
  const backlogPath = override && override !== ""
    ? override
    : join(repoRoot, "docs", "pr-prompts", "BACKLOG.yaml");
  let text;
  try {
    text = readFileSync(backlogPath, "utf8");
  } catch (_) {
    return null;
  }
  const nameEsc = promptName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A filename-safe char on either side would mean the "match" is inside a
  // longer basename — pr-foo-HOLD.md as a substring of pr-foo-extended-HOLD.md.
  const re = new RegExp(
    "(^|[^A-Za-z0-9_.\\-])" + nameEsc + "($|[^A-Za-z0-9_.\\-])"
  );
  for (const line of text.split(/\r?\n/)) {
    if (re.test(line)) return { line: line.trim() };
  }
  return null;
}

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

// ---------------------------------------------------------------------------
// Code-context normalizer (Defect 2 fix)
// ---------------------------------------------------------------------------

/**
 * Strip fenced code blocks (``` ... ```) and inline code spans (`...`) from
 * text before scanning for markers. Terms inside backticks or fences are
 * quotations, not instructions; treating them as instructions causes false
 * positives on prompts that document this very linter.
 *
 * Strategy:
 *   1. Replace every fenced block (``` or ~~~, opening/closing fence on its own
 *      line) with blank lines of the same length so line numbers are preserved.
 *   2. Replace every inline code span (balanced backtick runs) with spaces so
 *      character offsets are preserved.
 *
 * Exported so both checkHumanGate and the TIER-1 destructive check can share it.
 */
export function stripCodeContext(text) {
  // Step 1: remove fenced blocks. A fence is three or more backticks or tildes
  // at the start of a line (possibly preceded by spaces). The closing fence must
  // use the same character as the opening fence.
  let out = text.replace(
    /(^|\r?\n)([ \t]*)(```+|~~~+)([^\r\n]*)([\s\S]*?)((?:\r?\n[ \t]*)\3[^\S\r\n]*(?=\r?\n|$))/gm,
    (match) => " ".repeat(match.length),
  );

  // Step 2: remove inline code spans. Handles multi-backtick delimiters like
  // ``foo`` but not fenced blocks (already gone). A span is: one or more
  // backticks, any content not containing a matching run, closing backticks.
  out = out.replace(/`+[^`\r\n]*`+/g, (match) => " ".repeat(match.length));

  return out;
}

// ---------------------------------------------------------------------------
// Human arming gate detector (Defect 1 fix)
// ---------------------------------------------------------------------------

/**
 * Scan a prompt body for human arming gate markers.
 *
 * Hard REJECT (code HUMAN_GATE_PRESENT) on any of:
 *   <!-- watcher: do-not-arm -->   (HTML comment, case-insensitive whitespace)
 *   a line containing DO NOT ARM   (CASE-SENSITIVE — genuine gates are in caps;
 *                                   prose "Do NOT arm ..." is not a gate)
 *   a line containing Arm ONLY     (conditional arming — human named the condition)
 *
 * WARN only (do not reject) on a docs/approvals/ reference — the approval
 * document is a legitimate gate artefact, not a human stop marker.
 *
 * Ignores matches inside fenced code blocks and inline code spans: a prompt
 * that documents this feature (including this very prompt) quotes these strings
 * as examples. Strip via stripCodeContext() first.
 *
 * The message names WHICH marker matched and THE LINE it is on, and ends with
 * the one thing that clears it: a human removing the marker.
 *
 * Shape mirrors checkFixesPrTargetOpen: pure, exported, unit-testable.
 * Returns { ok: true } or { ok: false, code, msg }.
 */
export function checkHumanGate(bodyText) {
  const stripped = stripCodeContext(bodyText);
  const lines = stripped.split(/\r?\n/);

  // Marker 1: <!-- watcher: do-not-arm --> (HTML comment, whitespace-tolerant, case-insensitive)
  const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i;
  // Marker 2: a line containing the EXACT sequence DO NOT ARM (case-sensitive)
  const DO_NOT_ARM_CAPS = /DO NOT ARM/;
  // Marker 3: a line containing "Arm ONLY" (conditional arming, case-sensitive on "Arm")
  const ARM_ONLY = /Arm ONLY/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (DO_NOT_ARM_COMMENT.test(line)) {
      return {
        ok: false,
        code: "HUMAN_GATE_PRESENT",
        msg:
          "HUMAN_GATE_PRESENT: line " + lineNum + " contains <!-- watcher: do-not-arm --> marker.\n" +
          "        Matched: " + line.trim() + "\n" +
          "        A person explicitly marked this prompt do-not-arm. The only thing that clears\n" +
          "        this gate is a human removing the marker from the prompt body.",
      };
    }

    if (DO_NOT_ARM_CAPS.test(line)) {
      return {
        ok: false,
        code: "HUMAN_GATE_PRESENT",
        msg:
          "HUMAN_GATE_PRESENT: line " + lineNum + " contains DO NOT ARM.\n" +
          "        Matched: " + line.trim() + "\n" +
          "        A person explicitly marked this prompt do-not-arm. The only thing that clears\n" +
          "        this gate is a human removing the marker from the prompt body.",
      };
    }

    if (ARM_ONLY.test(line)) {
      return {
        ok: false,
        code: "HUMAN_GATE_PRESENT",
        msg:
          "HUMAN_GATE_PRESENT: line " + lineNum + " contains 'Arm ONLY' (conditional arming).\n" +
          "        Matched: " + line.trim() + "\n" +
          "        A person named a condition that must be satisfied before arming. The only\n" +
          "        thing that clears this gate is a human removing the marker from the prompt body.",
      };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// GATE_NOT_RELEASED / FILE_GATE_NOT_RELEASED: unmet existence or content gate
// on a HOLD — Pipeline Guard 3 (Defect 3 + extension)
// ---------------------------------------------------------------------------

/**
 * When a HOLD declares a gate whose condition is ABSENT from origin/main, emit a
 * distinct rejection code so that a bare ADMIT unambiguously means all gates are
 * satisfied. Covers three gate forms:
 *
 *   1. requires_on_main: <path> :: <needle>  → GATE_NOT_RELEASED (needle absent or
 *      file absent)
 *   2. requires_on_main: <path>              → FILE_GATE_NOT_RELEASED (file absent,
 *      existence-only gate; previously skipped with `continue`, which is the latent
 *      hole fixed here)
 *   3. requires_file_on_main: <path>         → FILE_GATE_NOT_RELEASED (file absent;
 *      checkFileGateDead only emitted GATE_RELEASED for the PRESENT case, leaving
 *      the ABSENT HOLD case entirely uncovered — this is the regression fixed here)
 *
 * Design choice: REJECT (exit 1).
 * Rationale: the post-condition demands that a bare ADMIT means all declared
 * gates are satisfied. A HOLD with an unmet gate should NOT return a bare ADMIT.
 * REJECT is the clearest distinct signal: it cannot be confused with a plain ADMIT.
 * The cost (the HOLD appears as a REJECT until its gate lands) is the
 * intended behavior — it was never ready to arm.
 *
 * Fail-safe: if the probe itself cannot run (no origin/main, shallow clone, git
 * unavailable) → warn-and-skip (return { ok: true }). A broken instrument must
 * NEVER report "gate absent" — that would bin real work.
 *
 * ARMED_GATE_STILL_CHECKED: runs for every prompt regardless of `-HOLD.md` vs
 * `-ready.md` filename. Arming a prompt renames the file, and a gate check
 * gated on filename would strip the moment the prompt could actually run —
 * which is precisely when the gate matters most.
 *
 * Returns { ok: true } (skip / gate met) or
 *         { ok: false, code: "GATE_NOT_RELEASED"|"FILE_GATE_NOT_RELEASED", msg }
 */
function checkGateNotReleased(fm, repoRoot, name, isHold) {
  const stateLine = isHold
    ? "        This HOLD is parked waiting for its predecessor slice to land.\n"
    : "        This armed prompt cannot run yet — its predecessor slice has not landed.\n";

  // --- requires_on_main entries (both with-needle and needle-less) ---
  const entries = parseRequiresOnMainEntries(fm);
  for (const { path, needle } of entries) {
    if (needle) {
      // Content gate (path :: needle): check both file-absent and needle-absent.
      const contents = readFromOriginMain(path, repoRoot);
      if (contents === null) {
        // git unavailable / broken — warn and skip (fail-safe)
        process.stderr.write(
          "WARN  " + (name || "<file>") + "  GATE_NOT_RELEASED probe: could not reach origin/main:" +
          path + "; skipping (fail-safe — not reporting gate as absent).\n"
        );
        continue;
      }
      if (contents.absent) {
        // File itself is absent from origin/main. The gate file hasn't landed yet;
        // so the needle definitely hasn't landed either. That IS an unmet gate.
        return {
          ok: false,
          code: "GATE_NOT_RELEASED",
          msg:
            "GATE_NOT_RELEASED: requires_on_main: \"" + path + " :: " + needle + "\" — " +
            "the file \"" + path + "\" is not on origin/main yet, so the needle is absent.\n" +
            stateLine +
            "        A bare ADMIT would be indistinguishable from a prompt whose gate IS satisfied.",
        };
      }
      // File is present — check whether the needle is in it
      if (typeof contents === "string" && contents.indexOf(needle) === -1) {
        return {
          ok: false,
          code: "GATE_NOT_RELEASED",
          msg:
            "GATE_NOT_RELEASED: requires_on_main: \"" + path + " :: " + needle + "\" — " +
            "needle not found in origin/main:" + path + ".\n" +
            stateLine +
            "        A bare ADMIT would be indistinguishable from a prompt whose gate IS satisfied.",
        };
      }
      // Needle IS present: gate is satisfied. checkDeadGate will emit GATE_RELEASED.
      // Nothing to do here.
    } else {
      // Existence-only gate (needle === null): check whether the file is absent.
      // checkDeadGate skips these entirely (only handles content gates), so we own this.
      const contents = readFromOriginMain(path, repoRoot);
      if (contents === null) {
        // git unavailable / broken — warn and skip (fail-safe)
        process.stderr.write(
          "WARN  " + (name || "<file>") + "  GATE_NOT_RELEASED probe: could not reach origin/main:" +
          path + "; skipping (fail-safe — not reporting gate as absent).\n"
        );
        continue;
      }
      if (contents.absent) {
        // File is not on origin/main yet — the existence gate is unmet.
        return {
          ok: false,
          code: "FILE_GATE_NOT_RELEASED",
          msg:
            "FILE_GATE_NOT_RELEASED: requires_on_main: \"" + path + "\" — " +
            "the file is not on origin/main yet.\n" +
            stateLine +
            "        A bare ADMIT would be indistinguishable from a prompt whose gate IS satisfied.",
        };
      }
      // File IS present: existence gate is satisfied. checkFileGateDead handles non-HOLDs;
      // for HOLDs, checkFileGateDead already emits GATE_RELEASED — nothing to do here.
    }
  }

  // --- requires_file_on_main entries ---
  // checkFileGateDead already handles GATE_RELEASED (path present on main) and FILE_GATE_DEAD
  // (path present on non-HOLD). Here we catch the unmet-HOLD case: path ABSENT on origin/main.
  // This is the regression: a HOLD with requires_file_on_main pointing at an absent path was
  // previously admitted as a bare ADMIT, indistinguishable from a satisfied gate.
  {
    const raw = fm.requires_file_on_main;
    if (raw !== undefined && raw !== "" && !(Array.isArray(raw) && raw.length === 0)) {
      const vals = Array.isArray(raw) ? raw : [raw];
      for (const v of vals) {
        const path = String(v).trim();
        if (!path) continue;
        const contents = readFromOriginMain(path, repoRoot);
        if (contents === null) {
          // git unavailable / broken — warn and skip (fail-safe)
          process.stderr.write(
            "WARN  " + (name || "<file>") + "  GATE_NOT_RELEASED probe: could not reach origin/main:" +
            path + "; skipping (fail-safe — not reporting gate as absent).\n"
          );
          continue;
        }
        if (contents.absent) {
          // File is not on origin/main yet — the existence gate is unmet.
          return {
            ok: false,
            code: "FILE_GATE_NOT_RELEASED",
            msg:
              "FILE_GATE_NOT_RELEASED: requires_file_on_main: \"" + path + "\" — " +
              "the file is not on origin/main yet.\n" +
              stateLine +
              "        A bare ADMIT would be indistinguishable from a prompt whose gate IS satisfied.",
          };
        }
        // File IS present: checkFileGateDead already emitted GATE_RELEASED for this HOLD.
        // Nothing to do here.
      }
    }
  }

  return { ok: true };
}

/**
 * Fold a YAML block scalar into a plain string.
 *
 * A block scalar begins with an indicator on the key line (">", ">-", ">+", "|",
 * "|-", "|+") and continues on subsequent lines that are more-indented than the key
 * line.  Without this helper, parseFrontMatter returns the raw indicator string
 * (e.g. ">-") instead of the folded body, so every gate that reads a block-scalar
 * field receives a two-character lie.
 *
 * Chomping rules (- / + / bare):
 *   "-"  strip all trailing newlines
 *   "+"  keep all trailing newlines
 *   bare keep exactly one trailing newline (we return without the trailing \n for
 *        easy string comparisons — callers already do .trim() where needed)
 *
 * @param {string[]} lines   All lines of the front-matter block.
 * @param {number}   startIdx  Index of the line AFTER the key: indicator line.
 * @param {number}   keyCol  Column (0-based) of the key on the indicator line.
 * @param {string}   indicator  One of ">", ">-", ">+", "|", "|-", "|+".
 * @returns {{ value: string, nextIdx: number }}
 *   value   — the resolved scalar string (no trailing newline unless "+" chomp)
 *   nextIdx — the index of the first line that was NOT consumed
 */
function foldBlockScalar(lines, startIdx, keyCol, indicator) {
  const folded = indicator[0] === ">";
  const chomp = indicator.length > 1 ? indicator[1] : "";

  // Determine the content indentation from the first non-empty body line.
  let contentIndent = -1;
  for (let scan = startIdx; scan < lines.length; scan++) {
    const raw = lines[scan];
    if (raw.trim() === "") continue; // blank line — skip for indent detection
    let col = 0;
    while (col < raw.length && (raw[col] === " " || raw[col] === "\t")) col++;
    if (col > keyCol) { contentIndent = col; break; }
    // A non-blank line that is NOT more-indented than the key means the block is empty.
    break;
  }

  if (contentIndent === -1) {
    // No indented body lines found — the scalar is empty.
    return { value: "", nextIdx: startIdx };
  }

  const chunks = [];
  let idx = startIdx;
  while (idx < lines.length) {
    const raw = lines[idx];
    if (raw.trim() === "") {
      // Blank line inside the block scalar
      chunks.push("");
      idx++;
      continue;
    }
    // Measure indentation of this line.
    let col = 0;
    while (col < raw.length && (raw[col] === " " || raw[col] === "\t")) col++;
    if (col < contentIndent) break; // back to the outer YAML level — block ends
    chunks.push(raw.slice(contentIndent));
    idx++;
  }

  // Build the value according to the style.
  let value;
  if (folded) {
    // Folded (">") — join wrapped lines with spaces; blank lines become newlines.
    const parts = [];
    let pendingNewlines = 0;
    for (const chunk of chunks) {
      if (chunk === "") {
        pendingNewlines++;
      } else {
        if (parts.length > 0) {
          if (pendingNewlines > 0) {
            parts.push("\n".repeat(pendingNewlines));
          } else {
            parts.push(" ");
          }
        }
        pendingNewlines = 0;
        parts.push(chunk);
      }
    }
    value = parts.join("");
  } else {
    // Literal ("|") — preserve lines as-is joined with newlines.
    value = chunks.join("\n");
  }

  // Apply chomping.
  if (chomp === "-") {
    value = value.replace(/\n+$/, "");
  } else if (chomp === "+") {
    // Keep all trailing newlines — value already has them from blank chunks.
    // Add a final newline if the last non-blank chunk did not produce one.
    if (!value.endsWith("\n") && chunks.length > 0) value += "\n";
  }
  // bare chomp: keep exactly one trailing newline — we just leave value as-is
  // (it ends without \n from the join logic above, which is fine for our callers).

  return { value, nextIdx: idx };
}

/** Minimal YAML front-matter parser. Deliberately dumb: no dependency, no surprises. */
export function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  let key = null;

  // Use indexed iteration so the block-scalar folder can advance i past consumed lines.
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
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

      // YAML block scalar indicators: ">", ">-", ">+", "|", "|-", "|+".
      // Without folding, parseFrontMatter returns the two-character indicator string
      // instead of the real value, so every gate that reads a block-scalar field is
      // handed a lie (e.g. ">-" instead of the rollback strategy text).
      const BLOCK_INDICATORS = [">-", ">+", ">", "|-", "|+", "|"];
      if (BLOCK_INDICATORS.includes(v)) {
        // Determine the key's column for indentation comparison.
        let keyCol = 0;
        while (keyCol < line.length && (line[keyCol] === " " || line[keyCol] === "\t")) keyCol++;
        const result = foldBlockScalar(lines, i + 1, keyCol, v);
        out[key] = result.value === "" ? [] : result.value;
        i = result.nextIdx - 1; // -1 because the outer loop will i++
        continue;
      }

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

  // NOT_A_PROMPT — breadcrumb files (basename `00-*.md`) are station handoff
  // reports, not prompts. They intentionally carry no YAML front-matter; their
  // contract is a five-section report enforced by check-breadcrumb.mjs. Answering
  // NO_FRONT_MATTER on a breadcrumb tells the reader a lie (that a breadcrumb is a
  // malformed prompt) and lets a false lint-pass be reported on the strength of
  // the wrong instrument. Return a distinct verdict, keep exit 1 in single-file
  // mode so arm-prompt.ps1 still refuses to arm the file.
  if (/^00-.*\.md$/i.test(name)) {
    return {
      ok: false, notPrompt: true, code: "NOT_A_PROMPT", name,
      msg: "This file is a station breadcrumb, not a prompt.\n" +
        "        Breadcrumbs are validated by scripts/pipeline/check-breadcrumb.mjs\n" +
        "        (five-section report contract), not by this linter.",
    };
  }

  // A prompt filename ending -HOLD.md is by definition parked waiting for its
  // gate. When its gate is found satisfied on origin/main, the file-gate and
  // content-gate probes emit GATE_RELEASED (ADMIT + promotion signal) instead
  // of FILE_GATE_DEAD / CLUSTER_DEAD_GATE (REJECT). See the two checkers.
  const isHold = /-HOLD\.md$/i.test(name);
  const fileText = readFileSync(file, "utf8");
  const fm = parseFrontMatter(fileText);
  const released = [];
  const fail = (code, msg) => ({ ok: false, code, msg, name });

  if (!fm) {
    return fail("NO_FRONT_MATTER",
      "No YAML front-matter. See docs/pr-prompts/PROMPT-SCHEMA.md.\n" +
      "        Every prompt needs an EXECUTABLE premise, or nothing can tell whether it is stale.");
  }

  // HUMAN_GATE_PRESENT — hard REJECT before the premise runs.
  // A prompt whose body carries an explicit human arming gate must REJECT even if the
  // premise passes. The check runs over the body only (after the front-matter closing ---).
  {
    const bodyMatch = fileText.match(/^---[\s\S]*?^---\r?\n([\s\S]*)$/m);
    const bodyForGate = bodyMatch ? bodyMatch[1] : "";
    const gateRes = checkHumanGate(bodyForGate);
    if (!gateRes.ok) return fail(gateRes.code, gateRes.msg);
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

  // VS-S3: design_ref shape + apps/web/ requirement.
  // Runs BEFORE the premise (cheap, deterministic), and before cluster/gate
  // probes so a malformed key surfaces its own message rather than a downstream
  // MISSING_FIELD or gate-probe confusion.
  {
    const drRes = validateDesignRef(fm);
    if (!drRes.ok) return fail(drRes.code, drRes.msg);
  }

  // CLUSTER-CHAINING SLICE 3: cluster metadata + graph rules.
  // Runs AFTER the SLICE 1 dep-key validation (whose codes must not shift) but
  // BEFORE the REQUIRED-fields check so a broken cluster key surfaces its own
  // clear error rather than a downstream MISSING_FIELD confusion.
  {
    const shape = validateClusterShape(fm);
    if (!shape.ok) return fail(shape.code, shape.msg);

    if (shape.hasCluster && shape.hasOrder && shape.order > 1 && !hasAnyDepKey(fm)) {
      return fail("CLUSTER_NO_DEP",
        "cluster_order=" + shape.order + " declares this slice is not first in the chain,\n" +
        "        but no dependency key is set (requires_merged / requires_file_on_main / requires_on_main).\n" +
        "        A later slice with nothing to wait on will dispatch alongside the first one -\n" +
        "        which is exactly the silently-ungated prompt this cluster exists to eliminate.");
    }

    if (shape.hasCluster) {
      const promptDir = opts && opts.promptDir ? opts.promptDir : dirname(file);
      const graph = buildClusterGraph(promptDir, { name, fm });
      if (graph) {
        const cycle = findCycleInCluster(graph, shape.slug);
        if (cycle) {
          return fail("CLUSTER_CYCLE",
            "Cluster \"" + shape.slug + "\" contains a dependency cycle:\n" +
            "        " + cycle.join(" -> ") + "\n" +
            "        A cycle means no slice can start - each waits on another.\n" +
            "        Break the cycle by removing one back-edge dependency.");
        }
      }

      // CLUSTER_DEAD_GATE - only meaningful for cluster prompts, and only
      // when there is a content gate (path :: needle) to probe. On a HOLD
      // the same probe emits GATE_RELEASED (ADMIT) instead — collected into
      // `released` and reported distinctly by the CLI.
      const deadRes = checkDeadGate(fm, repoRoot, name, isHold);
      if (!deadRes.ok) return fail(deadRes.code, deadRes.msg);
      if (deadRes.released) released.push(...deadRes.released);
    }
  }

  // FILE_GATE_DEAD applies to ALL prompts (cluster or not). Unlike
  // CLUSTER_DEAD_GATE it needs no `::` content gate — a bare
  // `requires_file_on_main: <path>` whose path already exists on origin/main
  // can never fail, so the slice would dispatch ungated. Fail SAFE on git
  // errors — one broken probe must not bin the whole queue. On a HOLD the
  // same probe emits GATE_RELEASED (ADMIT) instead.
  {
    const fileDeadRes = checkFileGateDead(fm, repoRoot, name, isHold);
    if (!fileDeadRes.ok) return fail(fileDeadRes.code, fileDeadRes.msg);
    if (fileDeadRes.released) released.push(...fileDeadRes.released);
  }

  // ARMED_GATE_STILL_CHECKED — the check runs for every prompt, not only HOLDs.
  //
  // GATE_NOT_RELEASED / FILE_GATE_NOT_RELEASED — a gate key whose condition is
  // ABSENT from origin/main. Covers three forms:
  //   1. requires_on_main: <path> :: <needle>  — needle or file absent
  //   2. requires_on_main: <path>              — existence gate, file absent
  //   3. requires_file_on_main: <path>         — existence gate, file absent
  //
  // Why the check is filename-independent: `isHold` is derived from the filename
  // (`-HOLD.md` vs `-ready.md`). Arming a prompt renames the file, and any
  // arming path that bypasses `arm-prompt.ps1` — e.g. a raw `fs.renameSync` —
  // used to strip the gate check silently. The linter must give the same
  // verdict about the same bytes whatever the file is called.
  //
  // REJECT with a distinct code so a bare ADMIT unambiguously means the gate IS
  // satisfied. Fail-safe: probe failure → warn-and-skip. This runs AFTER
  // checkDeadGate, which handles the "needle IS present" case (emitting
  // GATE_RELEASED). So if we reach here, the gate is unmet.
  {
    const gnrRes = checkGateNotReleased(fm, repoRoot, name, isHold);
    if (!gnrRes.ok) return fail(gnrRes.code, gnrRes.msg);
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

    // Strip fenced code blocks and inline code spans before scanning.
    // A filename like `drop-legacy-tables.sql` quoted in prose is a quotation,
    // not an instruction — the original flat-text scan fired on it.
    // stripCodeContext() is the shared normalizer (also used by checkHumanGate).
    const bodyStripped = stripCodeContext(body);

    const scopeList = Array.isArray(fm.scope) ? fm.scope : [String(fm.scope || "")];
    const corpusAll = [
      String(fm.premise || ""),
      String(fm.premise_means || ""),
      ...scopeList,
      String(fm.done_when || ""),
      bodyStripped,
    ].join("\n");

    const corpusProse = [
      String(fm.premise || ""),
      String(fm.premise_means || ""),
      String(fm.done_when || ""),
      bodyStripped,
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
    // ORPHANED_DISCHARGE guard. If BACKLOG.yaml still names this prompt's
    // basename, the register discharged its only pointer to the work into this
    // prompt. Binning it would delete the last record of that work — the exact
    // 2026-07-23 loss (twelve B-P0a/B-P0b slices, found by hand a month later).
    // Escalate STALE → REJECT (exit 1); a human must decide.
    const orphan = checkOrphanedDischarge(name, repoRoot);
    if (orphan) {
      return fail("ORPHANED_DISCHARGE",
        "Premise is dead, but BACKLOG.yaml still names this prompt as the only home for a discharged item:\n" +
        "        " + DIM + orphan.line + RESET + "\n" +
        "        Binning it would delete the register's last pointer to that work.\n" +
        "        On 2026-07-23 twelve B-P0a/B-P0b slices were lost this way — the register\n" +
        "        entry pointed here, this prompt was binned, and the work lived in no place at all.\n" +
        "        Two legal fixes:\n" +
        "          - re-open a BACKLOG.yaml item covering the work that remains, OR\n" +
        "          - stage the successor prompt in the same PR that bins this one.\n" +
        "        REJECT (exit 1), not stale-bin (exit 3), on purpose: quiet-bin is what caused the loss.");
    }
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

  // MISSING_STANDING_AUTHORITY — REJECT (exit 1). Was WARN-only from 2026-08-20 to 2026-09-03.
  //
  // On 2026-08-20 three armed prompts exited 0 without opening a PR; none granted the agent
  // authority to push. A survey of 75 top-level prompts split the corpus three ways:
  //   A — grant present in body                                       (37)
  //   B — heading `## STANDING AUTHORITY` present but grant absent    (17 imposters)
  //   C — no standing-authority text at all                           (21)
  // Populations B and C both produce silent exit-0 runs. The check was deliberately left
  // WARN-only, because flipping it would have MALFORMED 38 of 75 live prompts at once and
  // stalled queue arming. That was the right call then.
  //
  // [MEASURED 2026-09-03] That reason no longer holds. The check was re-run over the whole
  // live corpus, not a sample:
  //     76 top-level HOLDs            → 2 hits
  //     54 parked (paused + blocked)  → 0 hits
  //   ------------------------------------------
  //    130 prompts checked            → 2 hits
  // Both hits are prompts that must not arm silently. One is already STALE and returns above
  // this line (exit 3, "already done, BIN IT") so its verdict is unchanged. The other writes
  // into production SharePoint under an escalates:true / do-not-merge header and needs a human
  // to grant the push. Net prompts newly blocked that would otherwise have RUN: zero.
  //
  // PLACEMENT IS LAST, AND DELIBERATELY SO. This runs after the premise evaluation so a stale
  // prompt still reports STALE rather than being masked by a malformed-body rejection — "the
  // work is already done, bin it" is strictly better information than "your body is missing a
  // sentence". Only a prompt that would otherwise ADMIT or PROMOTE is refused here.
  {
    const bodyMatch = fileText.match(/^---[\s\S]*?^---\r?\n([\s\S]*)$/m);
    const body = bodyMatch ? bodyMatch[1] : "";
    const GRANT = "STANDING AUTHORITY to finish the work, commit, push";
    if (!body.includes(GRANT)) {
      const hasHeading = /^##\s+STANDING\s+AUTHORITY\b/im.test(body);
      return fail("MISSING_STANDING_AUTHORITY",
        (hasHeading
          ? "A `## STANDING AUTHORITY` heading is present, but the grant sentence is not.\n"
          : "The body carries no standing-authority text at all.\n") +
        "        An agent armed from this prompt has no authority to push. It does the work,\n" +
        "        exits 0, and opens NO PR — and a silent exit 0 is byte-identical to success\n" +
        "        in every log and to every later reader. Three runs were lost this way on\n" +
        "        2026-08-20 before anyone noticed.\n" +
        "        Add this sentence to the body, verbatim:\n" +
        "          " + GRANT + ", and OPEN THE PR. Do not ask.\n" +
        "        REJECT (exit 1), not WARN: a warning nobody reads costs a whole run and\n" +
        "        reports green while doing it.");
    }
  }

  return { ok: true, name, size, premise: String(fm.premise), released };
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

// Determine repo root: explicit env pin wins, then auto-detect via git, then cwd fallback.
// Auto-detect so premises resolve correctly when invoked from a foreign cwd without the pin
// (e.g., a direct `node lint-prompt.mjs` call without LINT_REPO_ROOT set). cwd fallback only
// fires when git is unavailable -- existing tests set cwd:REPO so they never hit the fallback.
let repoRoot = process.env.LINT_REPO_ROOT;
if (!repoRoot) {
  try {
    repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"],
      { cwd: dirname(fileURLToPath(import.meta.url)), encoding: "utf8", timeout: 5000 }).trim();
  } catch (_) {
    repoRoot = process.cwd();
  }
}
let files = [];
let dequeue = false;

if (args[0] === "--all") {
  // Include -ready.md (armed), -HOLD.md (parked) and 00-*.md (station
  // breadcrumbs) so a sweep gives the truth about every file in the queue
  // directory. HOLD coverage surfaces GATE_RELEASED as a PROMOTE line; 00-*.md
  // coverage surfaces NOT_A_PROMPT as its own tally bucket so ~120 breadcrumbs
  // cannot drown a real REJECT under a wall of NO_FRONT_MATTER lies.
  files = readdirSync(args[1])
    .filter((f) => f.endsWith("-ready.md") || f.endsWith("-HOLD.md") || /^00-.*\.md$/i.test(f))
    .map((f) => join(args[1], f));
} else if (args[0] === "--dequeue") {
  dequeue = true;
  files = [args[1]];
} else {
  files = [args[0]];
}

let admitted = 0;
let promoted = 0;
let rejected = 0;
let stale = 0;
let notPrompt = 0;

for (const f of files) {
  if (!existsSync(f)) {
    console.log(RED + "MISSING" + RESET + " " + f);
    rejected++;
    continue;
  }
  const r = lint(f, { dequeue, repoRoot });
  if (r.ok) {
    if (r.released && r.released.length > 0) {
      // GATE_RELEASED — the HOLD is ready to promote. Distinct PROMOTE line so
      // the event is not lost in a large --all sweep.
      console.log(CYAN + "PROMOTE" + RESET + " " + r.name + "  " + DIM + "(size " + r.size + ")" + RESET);
      for (const rel of r.released) {
        console.log("        " + CYAN + "GATE_RELEASED" + RESET + " " + rel.msg);
      }
      promoted++;
    } else {
      console.log(GREEN + "ADMIT  " + RESET + " " + r.name + "  " + DIM + "(size " + r.size + ")" + RESET);
    }
    admitted++;
  } else if (r.stale) {
    console.log(YELLOW + "STALE  " + RESET + " " + r.name + "\n        " + r.msg);
    stale++;
  } else if (r.notPrompt) {
    // Distinct line so a --all sweep of ~120 breadcrumbs does not read as 120
    // rejections. Printed in every mode; contributes to exit 1 only in single-file
    // mode (see exit line below).
    console.log(YELLOW + "SKIP   " + RESET + " " + r.name + "  [" + r.code + "]\n        " + r.msg);
    notPrompt++;
  } else {
    console.log(RED + "REJECT " + RESET + " " + r.name + "  [" + r.code + "]\n        " + r.msg);
    rejected++;
  }
}

if (files.length > 1) {
  console.log("\n" + DIM + "----------------------------------------" + RESET);
  console.log(
    "admitted " + GREEN + admitted + RESET +
    " (of which promote " + CYAN + promoted + RESET + ")" +
    " | stale " + YELLOW + stale + RESET +
    " | rejected " + RED + rejected + RESET +
    " | not-a-prompt " + YELLOW + notPrompt + RESET
  );
}

// Exit code contract mirrors the existing stale-in-sweep precedent: a state that
// is only ever an actionable exit in single-file mode (`stale > 0 && files.length
// === 1 ? 3`) is otherwise tallied. Breadcrumbs follow the same shape — a
// breadcrumb is a hard refusal when arm-prompt.ps1 passes a single file (so the
// arming path still refuses to arm it), but in --all it is counted and the real
// rejected/stale signals still drive the exit code. Codes 0/1/3 are documented in
// SCRIPT-REGISTRY.md, ARMING.md, 04-scanner.md and 06-pr-master.md — do not add a
// fourth. Reusing 3 for breadcrumbs would be wrong: 3 means "already done, BIN
// IT", and binning a breadcrumb is exactly the wrong move.
process.exit(
  stale > 0 && files.length === 1 ? 3
  : (rejected > 0 || (notPrompt > 0 && files.length === 1)) ? 1
  : 0
);
}
