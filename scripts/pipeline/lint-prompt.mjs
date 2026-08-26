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
    if (contents.absent) continue; // path missing on main = gate legitimately unmet
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
 * CLUSTER_DEAD_GATE vs GATE_RELEASED — same probe, two verdicts by prompt state.
 *
 * A `requires_on_main` content needle (`path :: fixed-string`) found on
 * origin/main means one of two very different things, depending on whether
 * the prompt is still parked (a `-HOLD.md`) or has been armed:
 *
 *   - non-HOLD  → CLUSTER_DEAD_GATE (REJECT).  Needle present at author time,
 *     before the slice was ever armed.  The arming PR would dispatch this
 *     slice with no ordering gate at all.  Genuine authoring hole.
 *
 *   - HOLD      → GATE_RELEASED (ADMIT + promotion signal).  The prompt was
 *     parked *waiting* for exactly this needle to appear; its arrival IS the
 *     success condition, not a defect.  Emit a distinct message so the reader
 *     sees a HOLD is ready to promote.
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
      if (isHold) {
        released.push({
          code: "GATE_RELEASED",
          gate: "requires_on_main",
          path,
          needle,
          msg: "requires_on_main: \"" + path + " :: " + needle + "\" is now on origin/main — HOLD is ready to promote.",
        });
        continue;
      }
      return {
        ok: false, code: "CLUSTER_DEAD_GATE",
        msg:
          "requires_on_main: \"" + path + " :: " + needle + "\" is on origin/main at author-time (non-HOLD prompt).\n" +
          "        CLUSTER_DEAD_GATE - the needle is present before the slice is even armed,\n" +
          "        so the arming PR would dispatch this slice with no ordering gate at all.\n" +
          "        (For a -HOLD.md whose gate has RELEASED, this same probe emits GATE_RELEASED\n" +
          "        and admits - the HOLD is ready to promote.)\n" +
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
// GATE_NOT_RELEASED: requires_on_main needle absent from origin/main (Defect 3)
// ---------------------------------------------------------------------------

/**
 * When a HOLD declares a requires_on_main needle and that needle is ABSENT from
 * origin/main, emit GATE_NOT_RELEASED. This is the inverse of GATE_RELEASED.
 *
 * Design choice: REJECT (exit 1).
 * Rationale: the post-condition demands that a bare ADMIT means all declared
 * gates are satisfied. A HOLD with an unmet requires_on_main content needle
 * should NOT return a bare ADMIT — it should return a distinct signal. REJECT
 * is the clearest distinct signal: it cannot be confused with a plain ADMIT.
 * The cost (the HOLD appears as a REJECT until its needle lands) is the
 * intended behavior — it was never ready to arm.
 *
 * Fail-safe: if the probe itself cannot run (no origin/main, shallow clone, git
 * unavailable) → warn-and-skip (return { ok: true }). A broken instrument must
 * NEVER report "gate absent" — that would bin real work.
 *
 * This check ONLY applies to HOLD prompts (isHold=true) and ONLY to content
 * gates (path :: needle). Existence-only gates (no ::) are legitimate "wait for
 * the file to appear" gates — they are covered by checkFileGateDead / checkDeadGate
 * which already handle them correctly.
 *
 * Returns { ok: true } (skip / gate met or existence-only) or
 *         { ok: false, code: "GATE_NOT_RELEASED", msg }
 */
function checkGateNotReleased(fm, repoRoot, name, isHold) {
  if (!isHold) return { ok: true }; // only meaningful for HOLDs

  const entries = parseRequiresOnMainEntries(fm);
  for (const { path, needle } of entries) {
    if (!needle) continue; // existence-only gate — not our check

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
          "        This HOLD is parked waiting for its predecessor slice to land.\n" +
          "        A bare ADMIT would be indistinguishable from a HOLD whose gate IS satisfied.\n" +
          "        This is not an error — it means the HOLD is correctly waiting.",
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
          "        This HOLD is parked waiting for its predecessor slice to land.\n" +
          "        A bare ADMIT would be indistinguishable from a HOLD whose gate IS satisfied.\n" +
          "        This is not an error — it means the HOLD is correctly waiting.",
      };
    }
    // Needle IS present: gate is satisfied. checkDeadGate will emit GATE_RELEASED.
    // Nothing to do here.
  }
  return { ok: true };
}

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

  // MISSING_STANDING_AUTHORITY — WARN-ONLY diagnostic (does not affect exit code).
  //
  // On 2026-08-20 three armed prompts exited 0 without opening a PR; none granted the agent
  // authority to push. A survey of 75 top-level prompts split the corpus three ways:
  //   A — grant present in body                                       (37)
  //   B — heading `## STANDING AUTHORITY` present but grant absent    (17 imposters)
  //   C — no standing-authority text at all                           (21)
  // Populations B and C both produce silent exit-0 runs. This warning surfaces both classes so
  // Marco can see them without touching the exit code. Flipping to REJECT would MALFORM 38 of
  // 75 live prompts at once and stall queue arming; that is a later slice, on Marco's call.
  {
    const bodyMatch = fileText.match(/^---[\s\S]*?^---\r?\n([\s\S]*)$/m);
    const body = bodyMatch ? bodyMatch[1] : "";
    const GRANT = "STANDING AUTHORITY to finish the work, commit, push";
    if (!body.includes(GRANT)) {
      const hasHeading = /^##\s+STANDING\s+AUTHORITY\b/im.test(body);
      const detail = hasHeading ? "(heading present, grant absent)" : "(no standing-authority text)";
      process.stderr.write(
        "WARN  " + name + "  MISSING_STANDING_AUTHORITY " + detail +
        " — body grants no authority to push; this run may exit 0 without opening a PR.\n"
      );
    }
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

  // GATE_NOT_RELEASED — for HOLDs with a requires_on_main content needle that is
  // ABSENT from origin/main. REJECT with a distinct code so a bare ADMIT unambiguously
  // means the gate IS satisfied. Fail-safe: probe failure → warn-and-skip.
  // NOTE: This runs AFTER checkDeadGate, which handles the "needle IS present" case
  // (emitting GATE_RELEASED). So if we reach here, the needle is either absent or
  // the file is absent — both mean GATE_NOT_RELEASED.
  if (isHold) {
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
  // Include both -ready.md (armed) and -HOLD.md (parked) so a HOLD whose gate
  // has just RELEASED surfaces as a PROMOTE line in the same sweep. Without
  // -HOLD.md coverage here, GATE_RELEASED events would never be visible from
  // --all and the guardrail count comparison could not be executed.
  files = readdirSync(args[1])
    .filter((f) => f.endsWith("-ready.md") || f.endsWith("-HOLD.md"))
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
    " | rejected " + RED + rejected + RESET
  );
}

process.exit(stale > 0 && files.length === 1 ? 3 : rejected > 0 ? 1 : 0);
}
