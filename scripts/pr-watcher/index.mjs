#!/usr/bin/env node
// PR-prompt watcher daemon — zero external dependencies.
//
// Watches docs/pr-prompts/*-ready.md and feeds each one to a headless Claude
// Code session. Single-threaded queue. On completion, moves the prompt to
// processed/ (success) or failed/ (non-zero exit) with a sibling .log file.
//
// NEW (unattended mode): after the agent opens a PR, the watcher polls GitHub
// until the PR is merged (auto-merge via `gh pr merge --auto`) or times out.
// On CI failure or timeout, the watcher pauses ALL remaining queued prompts
// by moving them to paused/ so they don't run on a broken state.
//
// NEW (auto-review mode): polls GitHub for newly-opened PRs and writes a
// review prompt file for each. The queue's existing serialization runs the
// review like any other prompt — reviews never race with authoring jobs.
//
// NEW (v2 — all opt-in via env, defaults preserve v1 behaviour):
//   - Dependency gating via prompt front-matter (requires-merged /
//     requires-file-on-main) — unmet deps defer the prompt, re-checked
//     on the periodic rescan.
//   - Auto-update-branch (PR_WATCHER_AUTO_UPDATE) for BEHIND PRs.
//   - Policy auto-merge (PR_WATCHER_AUTO_MERGE_POLICY=tests-docs|all|off).
//   - Failure quarantine with .report.md + one transient-signature retry.
//   - Heartbeat log while an agent runs (heartbeat.log, 60s cadence).
//   - Deterministic queue order: rev-* first, then lexicographic.
//   - Dry-run mode (PR_WATCHER_DRY_RUN) — decisions logged, nothing executed.
//
// Usage:
//   node scripts/pr-watcher/index.mjs
//
// Convention:
//   - Cowork writes drafts as docs/pr-prompts/pr-NN-{slug}.md
//   - You opt in by renaming to docs/pr-prompts/pr-NN-{slug}-ready.md
//   - The watcher fires, runs the prompt, then moves the file out

import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, watch as fsWatch } from "node:fs";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rmdir,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateVerdict } from "./verdict-guard.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Isolation: the watcher can run against a dedicated clone (its own .git)
// so automation never churns the interactive working tree's HEAD/index.
// Unset -> unchanged (repo root two levels up from this script).
const REPO_ROOT = process.env.PR_WATCHER_REPO_ROOT
  ? path.resolve(process.env.PR_WATCHER_REPO_ROOT)
  : path.resolve(__dirname, "..", "..");
// Orphaned-worktree sweep runs ONLY in isolated-clone mode. When
// PR_WATCHER_REPO_ROOT is unset, REPO_ROOT is the interactive tree, which may
// hold the user's own legitimate feature-branch worktrees — never sweep those.
const WORKTREE_SWEEP = !!process.env.PR_WATCHER_REPO_ROOT;
// The prompt QUEUE can live outside the git clone: scheduled agents
// (pr-shepherd / watcher-triage / night-qa) and Marco only see the interactive
// tree, so a queue nested inside PR_WATCHER_REPO_ROOT strands staged prompts.
// PR_WATCHER_PROMPT_DIR moves the queue anywhere; git/build stay on REPO_ROOT.
export function resolvePromptDir(env, repoRoot) {
  return env.PR_WATCHER_PROMPT_DIR
    ? path.resolve(env.PR_WATCHER_PROMPT_DIR)
    : path.join(repoRoot, "docs", "pr-prompts");
}
const PROMPT_DIR = resolvePromptDir(process.env, REPO_ROOT);
const PROCESSED_DIR = path.join(PROMPT_DIR, "processed");
const FAILED_DIR = path.join(PROMPT_DIR, "failed");
const BLOCKED_DIR = path.join(PROMPT_DIR, "blocked");
const PAUSED_DIR = path.join(PROMPT_DIR, "paused");
const NO_PR_DIR = path.join(PROMPT_DIR, "no-pr-opened");

// --- Multi-lane routing (additive; DEFAULT-OFF) --------------------------
// When PR_WATCHER_LANE is set (0-based), this watcher only enqueues prompts
// that laneFor() assigns to its lane, so a second clone can run a parallel
// build lane without ever picking the same prompt. Fix/review jobs and any
// prompt whose build touches the SHARED test Postgres (:5432) or the fixed
// e2e ports pin to lane 0, so DB/e2e builds never run concurrently. Unset =>
// no filtering (legacy single-lane behaviour, byte-for-byte unchanged).
const _paneEnv = process.env.PR_WATCHER_LANE;
const WATCHER_LANE =
  _paneEnv != null && _paneEnv !== "" && Number.isInteger(Number(_paneEnv))
    ? Number(_paneEnv)
    : null;
const WATCHER_LANES = (() => {
  const n = Number(process.env.PR_WATCHER_LANES);
  return Number.isInteger(n) && n >= 1 ? n : 2;
})();

const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i;
const DEBOUNCE_MS = 800;

// Periodic rescan interval. fs.watch can silently drop events on Windows
// (especially over network shares or after long idle periods), so we walk
// the directory every N minutes as a belt-and-braces fallback. Rescan-
// sourced enqueues are tagged in the log so they're distinguishable from
// fs.watch events.
const RESCAN_INTERVAL_MS = 5 * 60 * 1000;

// Safety caps — tweak via env
const MAX_TURNS = Number(process.env.PR_WATCHER_MAX_TURNS ?? 120);
const CLAUDE_BIN = process.env.PR_WATCHER_CLAUDE_BIN ?? "claude";
const GH_BIN = process.env.PR_WATCHER_GH_BIN ?? "gh";

// Auto-merge policy — opt-in only. The review-gated workflow runs with this
// OFF. Values:
//   off        — never auto-merge (default)
//   all        — auto-merge every PR the agent opens (legacy blanket mode)
//   tests-docs — auto-merge ONLY tests/** + docs/**-touching PRs with green
//                checks and a MERGE verdict file; everything else waits for Marco
// Back-compat: PR_WATCHER_AUTO_MERGE=true (old blanket flag) maps to "all"
// when no explicit policy is set.
const AUTO_MERGE_POLICY = (() => {
  const raw = (process.env.PR_WATCHER_AUTO_MERGE_POLICY ?? "").trim().toLowerCase();
  if (raw === "all" || raw === "tests-docs" || raw === "off") return raw;
  if (raw) {
    console.log(`[startup] [WARN] unknown PR_WATCHER_AUTO_MERGE_POLICY "${raw}" — using "off"`);
    return "off";
  }
  return process.env.PR_WATCHER_AUTO_MERGE === "true" ? "all" : "off";
})();
const AUTO_MERGE = AUTO_MERGE_POLICY !== "off";
const MERGE_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_MERGE_TIMEOUT_MIN ?? 90) * 60 * 1000;
// Per-run wall-clock ceiling. --max-turns caps TURNS only; a child that
// hangs without consuming turns (stalled MCP call, wedged tool) sits until
// the next watcher restart reaps it. This backstops that: on trip, kill the
// spawned tree, quarantine the prompt to blocked/, and continue draining
// the queue (per-prompt quarantine — this does NOT global-pause). Set 0 to
// disable. Default is deliberately generous (LL-25: silence ≠ hang).
const RUN_TIMEOUT_MS =
  Number(process.env.PR_WATCHER_RUN_TIMEOUT_MIN ?? 75) * 60 * 1000;
const POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_POLL_INTERVAL_SEC ?? 60) * 1000;

// Auto-review: poll GitHub for newly-opened PRs and enqueue a review
// prompt for each. The poller only WRITES prompt files — execution goes
// through the normal queue, so reviews serialize with authoring jobs.
const AUTO_REVIEW = process.env.PR_WATCHER_AUTO_REVIEW === "true"; // default OFF
const REVIEW_POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_REVIEW_POLL_SEC ?? 90) * 1000;
const REVIEW_MIN_AGE_MS =
  Number(process.env.PR_WATCHER_REVIEW_MIN_AGE_MIN ?? 2) * 60 * 1000;
const REVIEWED_STATE_FILE = path.join(__dirname, ".reviewed-prs.json");

// Auto-update-branch: each poll, bring the watcher account's open PRs that
// are BEHIND main up to date via `gh pr update-branch`. Conflicting PRs are
// skipped (update-branch can't resolve conflicts). Opt-in.
const AUTO_UPDATE = process.env.PR_WATCHER_AUTO_UPDATE === "true"; // default OFF
const UPDATE_POLL_INTERVAL_MS =
  Number(process.env.PR_WATCHER_UPDATE_POLL_SEC ?? 120) * 1000;

// Dry-run: log every decision (queue, deps, policy, update-branch, merge)
// but never spawn claude and never run a MUTATING gh/git command. Read-only
// gh calls (pr list/view/checks) still run so decisions reflect live state.
// Prompt files are never consumed in dry-run.
const DRY_RUN = process.env.PR_WATCHER_DRY_RUN === "true"; // default OFF

// Heartbeat — while an agent runs, append a line to heartbeat.log every
// 60s (LL-25: silence ≠ hang — give Marco evidence the agent is alive).
const HEARTBEAT_FILE = path.join(__dirname, "heartbeat.log");
const HEARTBEAT_INTERVAL_MS = 60 * 1000;
const HEARTBEAT_MAX_LINES = 500;

// Marker used in heartbeat `name` field while a merge-wait loop is in
// progress. Greppable constant so tests and the watchdog can assert its
// presence without hard-coding a string literal.
export const MERGE_WAIT_HEARTBEAT = "merge-wait-heartbeat";
const QUEUE_STATE_FILE = path.join(__dirname, ".queue-state.json");

// NO-PR bounded auto-restage (slice 2) — feature flag + greppable marker.
// When true, a [NO-PR] run that said "NO-OP:" is filed to processed/; any
// other [NO-PR] run is given up to two more attempts (b, c suffixes) before
// hard-failing to failed/. When false, the legacy behaviour (file to
// no-pr-opened/ always) is preserved.
export const NO_PR_RESTAGE = true;

// Transient-failure signatures — a failed run whose output matches one of
// these gets ONE automatic retry before quarantine. Override the defaults
// with PR_WATCHER_TRANSIENT_PATTERNS (comma-separated regex bodies, applied
// case-insensitive).
const TRANSIENT_PATTERNS = (() => {
  const raw = (process.env.PR_WATCHER_TRANSIENT_PATTERNS ?? "").trim();
  const sources = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : ["cache.{0,40}\\b400\\b", "ECONNRESET", "Workspace still starting", "runner.{0,5}lost"];
  const compiled = [];
  for (const src of sources) {
    try {
      compiled.push(new RegExp(src, "i"));
    } catch (err) {
      console.log(`[startup] [WARN] bad transient pattern "${src}" skipped: ${err.message}`);
    }
  }
  return compiled;
})();

// Pure trip decision for the per-run wall-clock watchdog. Exported so the
// rule is unit-testable in isolation. capMs <= 0 disables the ceiling.
export function isRunTimedOut(elapsedMs, capMs) {
  return capMs > 0 && elapsedMs >= capMs;
}

// Filter `git ls-files --others --exclude-standard` output down to the ready-
// or HOLD-form prompt filenames sitting at the top of the queue dir.
//
// Why this exists: a *-ready.md prompt that is untracked in origin/main is
// invisible to worktree stations (04-scanner, 01-code-writer, 05-sot-keeper —
// they all start from a fresh clone of main), can be wiped by `git clean`,
// and — worst of all — start-watcher.ps1 stashes untracked files via
// `git stash push --include-untracked` whenever the tracked tree is dirty at
// startup, which has SILENTLY MOVED staged prompts out of the queue.
// PROMPT-SCHEMA.md now says "a prompt is not real until committed to
// origin/main"; this parser is the machine half of that rule.
//
// Pure + exported so the log-tag emission is unit-testable without spawning
// git. Callers run `git -C PROMPT_DIR ls-files ...`, so paths are relative to
// PROMPT_DIR — a path with a separator lives in a subdir (paused/, processed/,
// failed/, ...) and is NOT a top-level queue entry.
export function parseUntrackedReadyPrompts(porcelain) {
  const out = [];
  if (!porcelain) return out;
  for (const raw of String(porcelain).split(/\r?\n/)) {
    const name = raw.trim();
    if (!name) continue;
    if (name.includes("/") || name.includes("\\")) continue;
    if (/-ready\.md$/i.test(name) || /-HOLD\.md$/i.test(name)) {
      out.push(name);
    }
  }
  return out;
}

// Extract worktree paths from `git worktree list --porcelain`, excluding the
// main working tree. Pure + exported for unit testing.
export function parseWorktreePaths(porcelain, mainPath) {
  const main = path.resolve(mainPath);
  const out = [];
  for (const line of (porcelain ?? "").split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      const p = line.slice("worktree ".length).trim();
      if (p && path.resolve(p) !== main) out.push(p);
    }
  }
  return out;
}

// Reclaim every worktree except the watcher's own REPO_ROOT. Only ever called
// when no child is running (startup, or between jobs). Best-effort — never throws.
async function sweepOrphanWorktrees() {
  if (!WORKTREE_SWEEP) return;
  let listing;
  try {
    await runGit(["worktree", "prune"]);
    listing = await runGit(["worktree", "list", "--porcelain"]);
  } catch (err) {
    log("worktree", `sweep skipped: ${err.message}`);
    return;
  }
  const paths = parseWorktreePaths(listing, REPO_ROOT);
  for (const p of paths) {
    try {
      // Double --force overrides a STALE worktree lock. This sweep runs only
      // when no watcher child is running (startup / between jobs), so any lock
      // present belongs to a dead/crashed agent and is safe to override. Single
      // --force leaves stale-locked worktrees behind: they accumulate and
      // re-wedge the lane (they loop-restarted the watcher twice on 2026-08-14 —
      // a single stale lock was enough). Removal failure is still caught below.
      await runGit(["worktree", "remove", "--force", "--force", p]);
      log("worktree", `reclaimed orphan worktree ${p}`);
    } catch (err) {
      log("worktree", `could not remove ${p}: ${err.message}`);
    }
  }
  if (paths.length > 0) {
    try { await runGit(["worktree", "prune"]); } catch { /* best-effort */ }
  }
}

export function isTransientFailure(text) {
  if (!text) return false;
  const tail = text.length > 16384 ? text.slice(-16384) : text;
  return TRANSIENT_PATTERNS.some((re) => re.test(tail));
}

// --- NO-PR bounded auto-restage helpers -------------------------------------

// Convention: the restage ladder uses filename suffixes immediately before
// `-ready.md`.  Only `-b-ready.md` and `-c-ready.md` (i.e. a single letter
// preceded by a hyphen, at the very end of the stem) count as attempt markers.
// This means `pr-slice-b-ready.md` IS treated as attempt 2 when the previous
// rung `pr-slice-ready.md` is implied by the naming ladder — because the token
// `-b-` immediately precedes `-ready.md`.  Authors whose genuine base stem ends
// with the letter b or c MUST add a disambiguating suffix, e.g.
// `pr-slice-b-alpha-ready.md`, to avoid the collision.  In practice this is
// extremely rare because prompt stems are descriptive phrases.
//
// Rung mapping:
//   pr-foo-ready.md   (attempt 1)  →  pr-foo-b-ready.md   (attempt 2)
//   pr-foo-b-ready.md (attempt 2)  →  pr-foo-c-ready.md   (attempt 3)
//   pr-foo-c-ready.md (attempt 3)  →  null (bound exhausted)
// Same transitions apply to the rev- prefix.
export function nextRestageName(name) {
  // Match: <prefix>-b-ready.md  →  attempt 3
  const attemptBMatch = name.match(/^(.*)-b(-ready\.md)$/i);
  if (attemptBMatch) {
    return `${attemptBMatch[1]}-c${attemptBMatch[2]}`;
  }

  // Match: <prefix>-c-ready.md  →  bound exhausted
  const attemptCMatch = name.match(/^(.*)-c(-ready\.md)$/i);
  if (attemptCMatch) {
    return null;
  }

  // Match: <prefix>-ready.md  →  attempt 2
  const baseMatch = name.match(/^(.*?)(-ready\.md)$/i);
  if (baseMatch) {
    return `${baseMatch[1]}-b${baseMatch[2]}`;
  }

  // Not a recognised pattern — cannot restage
  return null;
}

// One retry per prompt name, tracked in memory. A watcher restart resets
// counts — acceptable: the restart itself is the manual intervention.
const retryCounts = new Map();

// Lockfile — prevents two watcher instances from fighting over the queue.
const LOCK_FILE = path.join(__dirname, ".watcher.lock");

// Child-process sidecar — tracks PIDs of `claude` children the watcher
// SPAWNED ITSELF, so we can kill exactly those (and only those) on shutdown
// and never touch interactive Claude Code / Cowork sessions started outside
// the watcher. Single-threaded queue means this normally holds 0 or 1 PIDs;
// we use a list anyway to stay forward-compatible.
const CHILDREN_FILE = path.join(__dirname, ".watcher-children.json");

// Nightly cutoff (HH:MM, 24-hour, local). Past this, the watcher refuses to
// start a NEW prompt and exits cleanly. The in-flight prompt (if any)
// finishes normally. Unset = no cutoff. Example: "06:00" stops new prompts
// at 6 AM.
const STOP_AT = (process.env.PR_WATCHER_STOP_AT ?? "").trim() || null;

// Compute the absolute cutoff timestamp ONCE at startup so the cutoff
// doesn't shift if the watcher runs unusually long. The cutoff is the next
// occurrence of HH:MM after startup. A 6pm start with STOP_AT=06:00 sets
// the cutoff to 6am tomorrow.
const STOP_AT_TIMESTAMP = (() => {
  if (!STOP_AT) return null;
  const m = STOP_AT.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const cutoffH = Number(m[1]);
  const cutoffM = Number(m[2]);
  if (cutoffH > 23 || cutoffM > 59) return null;
  const now = new Date();
  const stop = new Date(now);
  stop.setHours(cutoffH, cutoffM, 0, 0);
  if (stop.getTime() <= now.getTime()) {
    stop.setDate(stop.getDate() + 1);
  }
  return stop.getTime();
})();

function isPastStopTime() {
  if (STOP_AT_TIMESTAMP === null) return false;
  return Date.now() >= STOP_AT_TIMESTAMP;
}

// Usage / rate-limit detection. When `claude --print` exits non-zero with
// any of these patterns in its output, the watcher treats it as a soft
// halt (keep the prompt queued, exit cleanly) instead of a real failure
// (move to failed/, cascade-flush the rest of the queue). Prevents a
// single usage cap from poisoning every queued prompt in seconds.
const USAGE_LIMIT_PATTERNS = [
  /usage\s*limit/i,
  /rate\s*limit/i,
  /rate[-\s]*limited/i,
  /too\s*many\s*requests/i,
  /credit\s*balance/i,
  /insufficient\s*credits/i,
  /monthly\s*usage/i,
  /hit your limit/i, // LL-28: "You've hit your limit" misfiled ~47 prompts as hard failures

  /max(?:imum)?\s*requests?/i,
  /quota\s*(?:exceeded|exhausted)/i,
  /\b429\b/,
];

function isUsageLimitError(text) {
  if (!text) return false;
  const tail = text.length > 16384 ? text.slice(-16384) : text;
  return USAGE_LIMIT_PATTERNS.some((re) => re.test(tail));
}

const queue = [];
const seen = new Set();
const debouncers = new Map();
let running = false;
let queuePaused = false;

function ts() {
  return new Date().toISOString();
}
function log(level, msg) {
  console.log(`[${ts()}] [${level}] ${msg}`);
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureDirs() {
  await mkdir(PROCESSED_DIR, { recursive: true });
  await mkdir(FAILED_DIR, { recursive: true });
  await mkdir(BLOCKED_DIR, { recursive: true });
  await mkdir(PAUSED_DIR, { recursive: true });
  await mkdir(NO_PR_DIR, { recursive: true });
}

function isReady(name) {
  return READY_PATTERN.test(name);
}

function isReviewJob(name) {
  // rev-NNN-ready.md (new convention) or legacy pr-NNN-auto-review-ready.md
  return /^rev-/i.test(name) || /-auto-review-ready\.md$/i.test(name);
}

// Fix-lane paths (indexed by absolute file path) — tracked in-memory so
// computeQueueInsertIndex can classify queued entries without re-reading
// front-matter. Reset only when the process restarts; a fix prompt that
// completes and leaves the queue is dropped from this set on shift.
const fixLanePaths = new Set();

// Read `fixes_pr` from the prompt file. Sync so it fits the sync enqueue path.
// Returns a positive integer or null. Any read/parse failure returns null —
// the file may have been renamed out from under us (fs.watch races) and a
// null answer just means "not a fix prompt", which is safe.
export function readFixesPr(filePath, { readFileSyncImpl = readFileSync } = {}) {
  let body;
  try {
    body = readFileSyncImpl(filePath, "utf-8");
  } catch {
    return null;
  }
  const deps = parseWatcherFrontMatter(body);
  return deps.fixesPr ?? null;
}

// Pure — compute the insertion index for a prompt joining the queue.
// Priority: fix jobs jump to the front (behind any currently-running job,
// which the caller has already shifted out); rev/review jobs stack behind
// existing fix + review jobs; ordinary jobs run in lexicographic name order
// behind fix + review jobs. Multiple fix jobs stack in arrival order.
export function computeQueueInsertIndex(queueMeta, incoming) {
  const { isFix, isReview, name } = incoming;
  let i = 0;
  while (i < queueMeta.length && queueMeta[i].isFix) i++;
  if (isFix) return i;
  while (i < queueMeta.length && queueMeta[i].isReview) i++;
  if (isReview) return i;
  while (i < queueMeta.length && queueMeta[i].name <= name) i++;
  return i;
}

// --- Lane routing helpers (pure, exported for unit tests) ----------------
// Stable non-negative hash of a prompt name (djb2). Deterministic across
// processes so every lane computes identical ownership for a given name.
export function laneHash(name) {
  let h = 5381;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) + h + name.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

// True when a build would touch a SHARED fixed resource: the test Postgres on
// :5432 (any prisma migrate / psql / serial DB test) or a fixed e2e server
// port. Such builds must never run concurrently, so they pin to lane 0.
// Conservative by design ??? a mere mention pins to lane 0 (costs parallelism,
// never risks a collision). Empty/unreadable body => pin to lane 0.
export function bodyNeedsSerialLane(text) {
  if (!text) return true; // no readable done_when => fail safe (pin lane 0)
  return /prisma\s+migrate|migrate\s+(deploy|dev|reset)|prisma:migrate|:migrate\b|\bpnpm\b[^&|]*\bmigrate\b|\bpsql\b|\bpg_dump\b|\bpg_restore\b|test:serial|test:api\b|\bapitest\b|\bjest\b|\bvitest\b|\bpnpm\b[^&|]*?\btest\b(?!\s*-)|\bnpm\s+test\b|\byarn\s+test\b|\bplaywright\b|\be2e\b|:5432|:4173|:5173|:3000|docker\s*compose/i.test(
    text,
  );
}

// Extract the done_when contract from a prompt's YAML front matter. Handles
// inline scalars (`done_when: pnpm build && ...`), folded/literal block
// scalars (`done_when: >-` / `|`), and simple list forms. Returns "" when no
// done_when is found ??? which bodyNeedsSerialLane treats as pin-to-lane-0.
export function extractDoneWhen(body) {
  if (!body) return "";
  // Linear frontmatter split (no backtracking regex — avoids ReDoS on
  // input like '---' + newline + many '<nl><space>' repetitions; CodeQL js/polynomial-redos).
  let fm = body;
  if (body.startsWith("---")) {
    const nl = body.indexOf("\n");
    const end = nl === -1 ? -1 : body.indexOf("\n---", nl);
    if (nl !== -1 && end !== -1) fm = body.slice(nl + 1, end);
  }
  const lines = fm.split(/\r?\n/);
  const i = lines.findIndex((l) => /^done_when\s*:/.test(l));
  if (i === -1) return "";
  const first = lines[i].replace(/^done_when\s*:/, "").trim();
  const isKey = (l) => /^[A-Za-z0-9_]+\s*:/.test(l);
  if (first && !/^[|>]/.test(first)) {
    let out = first;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s+\S/.test(lines[j]) && !isKey(lines[j].trim())) out += " " + lines[j].trim();
      else break;
    }
    return out;
  }
  const out = [];
  for (let j = i + 1; j < lines.length; j++) {
    if (lines[j].trim() === "") continue;
    if (/^\s+\S/.test(lines[j]) && !isKey(lines[j].trim())) out.push(lines[j].trim());
    else break;
  }
  return out.join(" ").trim();
}

// Assign a prompt to a lane. Coordination-sensitive jobs (fix/review) and
// shared-resource builds pin to lane 0; everything else shards by name hash.
export function laneFor(
  name,
  { isFix = false, isReview = false, body = "", lanes = 2 } = {},
) {
  if (isFix || isReview) return 0;
  if (bodyNeedsSerialLane(body)) return 0;
  return laneHash(name) % lanes;
}

// Pure function: compute the runnable count from sets of prompt names.
// The node is the only authority on what it can dequeue (lane routing +
// dependency gates both live here). This function is exported so unit tests
// can exercise it without touching the filesystem or starting the daemon.
//
// Inputs are arrays of basename strings ("pr-foo-ready.md").
// Returns { armed, owned, deferred, runnable } as counts.
//   armed    - every *-ready.md on disk
//   owned    - the subset this lane owns
//   deferred - owned prompts whose dep gate is currently unmet
//   runnable - owned prompts not in deferred (never negative, never > owned)
//
// Rules:
//   - Names compared as plain strings; duplicates counted once.
//   - A name in deferred but not in owned does not reduce runnable.
//   - Missing / undefined inputs behave as empty arrays.
export function computeRunnable({ armed = [], owned = [], deferred = [] } = {}) {
  const armedSet = new Set(armed);
  const ownedSet = new Set(owned);
  const deferredSet = new Set(deferred);
  // runnable = owned names NOT in deferred
  let runnableCount = 0;
  for (const name of ownedSet) {
    if (!deferredSet.has(name)) runnableCount++;
  }
  return {
    armed: armedSet.size,
    owned: ownedSet.size,
    deferred: deferredSet.size,
    runnable: runnableCount,
  };
}

// Track prompts whose dependency gates are currently unmet. Written to
// .queue-state.json so the watchdog knows not to treat idle-but-blocked
// nodes as hung. A prompt is removed when its gate opens or when it is
// consumed / removed from the queue.
const deferredNames = new Set();

// Read a prompt file's full body for lane classification. Sync to fit the
// sync enqueue path; any failure returns "" (treated as pin-to-lane-0).
export function readPromptBody(filePath, { readFileSyncImpl = readFileSync } = {}) {
  try {
    return readFileSyncImpl(filePath, "utf-8");
  } catch {
    return "";
  }
}

// Pull the PR number out of a review-job filename. Supports both the
// rev-NNN-ready.md convention and the legacy pr-NNN-auto-review-ready.md.
function reviewJobPrNumber(name) {
  const m =
    name.match(/^rev-(\d+)-ready\.md$/i) ??
    name.match(/^pr-(\d+)-auto-review-ready\.md$/i);
  return m ? Number(m[1]) : null;
}

// Mirror a finished review verdict into a PR comment so it's readable from
// the GitHub mobile app (the verdict file in docs/pr-reviews/ is local-only).
// Best-effort: any failure logs and returns — the verdict FILE remains the
// source of truth and the review job never fails over the mirror step.
//
// Gates safety: PR comments are NOT scanned by the gates — pr-gates.mjs
// reads only the PR body (`gh pr view --json body`). Verdict content can
// safely contain checklist text or GATE-ALLOW mentions without tripping
// CP-22/CP-09 on re-runs.
async function mirrorVerdictToPr(name) {
  const prNumber = reviewJobPrNumber(name);
  if (prNumber == null) {
    log("review", `verdict mirror skipped: no PR number in job name "${name}"`);
    return;
  }
  const verdictRel = `docs/pr-reviews/pr-${prNumber}-review.md`;
  const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${prNumber}-review.md`);
  let verdict;
  try {
    verdict = await readFile(verdictPath, "utf-8");
  } catch {
    log("review", `verdict mirror skipped: ${verdictRel} not found`);
    return;
  }
  // ASCII-only header — the comment passes through a shell-spawned gh on
  // Windows (spawn shell:true), where non-ASCII can mangle.
  const header = `[watcher verdict] mirrored from ${verdictRel}\n\n`;
  // --body-file with a temp file avoids quoting hell entirely.
  const tmpFile = path.join(__dirname, `.verdict-comment-${prNumber}.tmp.md`);
  try {
    await writeFile(tmpFile, header + verdict, "utf-8");
    await runGh(["pr", "comment", String(prNumber), "--body-file", tmpFile]);
    log("review", `verdict mirrored to PR #${prNumber} as a comment`);
  } catch (err) {
    const stderrTail = err.stderr ? ` | gh stderr: ${err.stderr.trim()}` : "";
    log(
      "review",
      `verdict mirror failed for PR #${prNumber}: ${err.message}${stderrTail}`,
    );
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  }
}

// Move settled review verdicts (docs/pr-reviews/pr-N-review.md for PRs that
// are MERGED or CLOSED) out of the live watcher clone into a sibling
// verdicts-archive directory. Pure over injected deps so the whole thing is
// unit-testable without spawning gh or writing into REPO_ROOT.
//
// Contract:
//   - reviewsDir missing → no-op, returns zeroed stats.
//   - state query throws → file is LEFT IN PLACE and logged. A failed call is
//     NOT a "verdict is stale" signal; we would rather leak a verdict than
//     silently delete one on a transient gh outage.
//   - Files whose name doesn't match pr-N-review.md are ignored entirely.
//   - Archival is always a MOVE, never a delete.
//   - listTrackedVerdicts is REQUIRED. Files it returns are skipped entirely —
//     before the fetchPrState call — so tracked files cost no gh quota and are
//     never moved. A default of "nothing is tracked" is the present bug spelled
//     as a default: any future caller that forgets the argument would silently
//     restore the startup-autostash loop.
export async function archiveSettledVerdicts({
  reviewsDir,
  archiveDir,
  fetchPrState,
  listTrackedVerdicts,
  logger = () => {},
  fsOps,
} = {}) {
  if (typeof listTrackedVerdicts !== "function") {
    throw new TypeError(
      "archiveSettledVerdicts: listTrackedVerdicts is required (async () => string[]). " +
        "Omitting it would silently treat every file as untracked — restoring the startup-autostash loop.",
    );
  }
  const ops = fsOps ?? { readdir, mkdir, rename };
  const stats = { archived: 0, kept: 0, skipped: 0, tracked: 0 };

  // Resolve the tracked set once per sweep — one process, no network quota.
  let trackedSet;
  try {
    const trackedBasenames = await listTrackedVerdicts();
    trackedSet = new Set(trackedBasenames);
  } catch (err) {
    // Failing closed: treat every file as tracked so we never move a git-tracked
    // file on a transient failure.
    logger(
      "review",
      `verdict-archive: listTrackedVerdicts failed, treating all files as tracked this sweep: ${err.message}`,
    );
    trackedSet = null; // null sentinel — skip all files below
  }

  let entries;
  try {
    entries = await ops.readdir(reviewsDir);
  } catch (err) {
    if (err.code === "ENOENT") return stats;
    logger("review", `verdict-archive sweep: cannot read ${reviewsDir}: ${err.message}`);
    return stats;
  }
  for (const name of entries) {
    const m = name.match(/^pr-(\d+)-review\.md$/);
    if (!m) continue;

    // Skip tracked files before any gh call — no quota cost, no move.
    if (trackedSet === null || trackedSet.has(name)) {
      stats.tracked++;
      continue;
    }

    const prNumber = Number(m[1]);
    let state;
    try {
      state = await fetchPrState(prNumber);
    } catch (err) {
      logger(
        "review",
        `verdict-archive: state query failed for PR #${prNumber}, leaving ${name} in place: ${err.message}`,
      );
      stats.skipped++;
      continue;
    }
    if (state === "MERGED" || state === "CLOSED") {
      try {
        await ops.mkdir(archiveDir, { recursive: true });
        const src = path.join(reviewsDir, name);
        const dest = path.join(archiveDir, name);
        await ops.rename(src, dest);
        logger("review", `verdict-archive: moved ${name} (state=${state}) → ${archiveDir}`);
        stats.archived++;
      } catch (err) {
        logger(
          "review",
          `verdict-archive: move failed for ${name}: ${err.message}`,
        );
        stats.skipped++;
      }
    } else {
      stats.kept++;
    }
  }
  return stats;
}

// Wire archiveSettledVerdicts to the watcher's real REPO_ROOT and gh. Never
// throws into the caller — the sweep is best-effort housekeeping and must
// not stall startup or the rescan loop.
async function runArchiveSettledVerdicts() {
  const reviewsDir = path.join(REPO_ROOT, "docs", "pr-reviews");
  // Sibling of REPO_ROOT so git never sees it — no gitignore needed, no
  // status noise, no risk of an accidental `git clean` sweeping verdicts.
  const archiveDir = path.join(REPO_ROOT, "..", "verdicts-archive");
  try {
    const stats = await archiveSettledVerdicts({
      reviewsDir,
      archiveDir,
      fetchPrState: async (prNumber) => {
        const json = await runGh(
          ["pr", "view", String(prNumber), "--json", "state"],
          { json: true },
        );
        return json.state;
      },
      // One `git ls-files` process per sweep — no network, no gh quota.
      // Returns basenames only (the filenames inside docs/pr-reviews/).
      // On failure the function throws, and archiveSettledVerdicts treats
      // every file as tracked for that sweep (fail-closed).
      listTrackedVerdicts: async () => {
        const { execFile } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execFileAsync = promisify(execFile);
        const { stdout } = await execFileAsync("git", [
          "-C",
          REPO_ROOT,
          "ls-files",
          "docs/pr-reviews",
        ]);
        return stdout
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((rel) => path.basename(rel));
      },
      logger: log,
    });
    if (stats.archived + stats.kept + stats.skipped + stats.tracked > 0) {
      log(
        "review",
        `verdict-archive sweep: archived=${stats.archived} kept=${stats.kept} skipped=${stats.skipped} tracked=${stats.tracked}`,
      );
    }
  } catch (err) {
    log("review", `verdict-archive sweep crashed (swallowed): ${err.message}`);
  }
}

function debouncedEnqueue(name) {
  if (!isReady(name)) return;
  if (queuePaused) return; // ignore new files while paused
  if (debouncers.has(name)) clearTimeout(debouncers.get(name));
  const timer = setTimeout(() => {
    debouncers.delete(name);
    enqueue(name);
  }, DEBOUNCE_MS);
  debouncers.set(name, timer);
}

function enqueue(name, { source = "watch" } = {}) {
  const filePath = path.join(PROMPT_DIR, name);
  if (!existsSync(filePath)) return;
  if (seen.has(name)) return;
  const isReview = isReviewJob(name);
  const fixesPr = isReview ? null : readFixesPr(filePath);
  const isFix = fixesPr !== null;
  // Multi-lane routing (default-off): if this watcher runs a specific lane,
  // skip prompts another lane owns ??? WITHOUT marking them seen, so the owning
  // lane still picks them up. Unset PR_WATCHER_LANE => WATCHER_LANE null => no
  // filtering, identical to legacy behaviour.
  if (WATCHER_LANE !== null) {
    const doneWhen = isFix || isReview ? "" : extractDoneWhen(readPromptBody(filePath));
    const owner = laneFor(name, { isFix, isReview, body: doneWhen, lanes: WATCHER_LANES });
    if (owner !== WATCHER_LANE) return;
  }
  seen.add(name);
  if (isFix) fixLanePaths.add(filePath);
  const queueMeta = queue.map((p) => ({
    name: path.basename(p),
    isFix: fixLanePaths.has(p),
    isReview: isReviewJob(path.basename(p)),
  }));
  const insertAt = computeQueueInsertIndex(queueMeta, { isFix, isReview, name });
  queue.splice(insertAt, 0, filePath);
  if (isFix) {
    log("fix-lane", `${name} jumped to front (fixes PR #${fixesPr})`);
  }
  const tail = `depth: ${queue.length}${running ? ", busy" : ""}, source: ${source}`;
  log("queue", `${name} (${tail})`);
  drain();
}

// Run `gh` and return parsed JSON or raw stdout. With allowNonZero, a
// non-zero exit still resolves stdout (gh pr checks exits 8 when any check
// is failing — exactly the case where we want its output for a report).
function runGh(args, { json = false, allowNonZero = false } = {}) {
  return new Promise((resolve, reject) => {
    const out = [];
    const err = [];
    const child = spawn(GH_BIN, args, {
      cwd: REPO_ROOT,
      shell: true,
    });
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      const stdout = Buffer.concat(out).toString("utf-8");
      const stderr = Buffer.concat(err).toString("utf-8");
      if (code !== 0 && !allowNonZero) {
        const e = new Error(`gh ${args.join(" ")} exited ${code}: ${stderr.trim()}`);
        e.code = code;
        e.stderr = stderr;
        return reject(e);
      }
      if (json) {
        try {
          resolve(JSON.parse(stdout));
        } catch (parseErr) {
          reject(new Error(`gh JSON parse failed: ${parseErr.message}\nOutput: ${stdout}`));
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

// Run `git` and resolve stdout, reject on non-zero exit.
function runGit(args) {
  return new Promise((resolve, reject) => {
    const out = [];
    const err = [];
    const child = spawn("git", args, { cwd: REPO_ROOT, shell: true });
    child.stdout.on("data", (c) => out.push(c));
    child.stderr.on("data", (c) => err.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(`git ${args.join(" ")} exited ${code}: ${Buffer.concat(err).toString("utf-8").trim()}`),
        );
      }
      resolve(Buffer.concat(out).toString("utf-8"));
    });
  });
}

// --- Dependency gating (front-matter) ---
//
// Prompts declare dependencies in one of two forms. The front-matter form is
// the one to use, because it is the only form that passes intake lint
// (lint-prompt.mjs REJECTs NO_FRONT_MATTER unless `---` starts at line 1).
//
//   YAML front-matter (preferred):
//     ---
//     requires_merged:
//       - 380
//       - 379
//     requires_file_on_main:
//       - apps/web/src/hooks/useConfirm.tsx
//     ---
//
//   Legacy HTML comment (still honoured for back-compat):
//     <!-- watcher: requires-merged: 380, 379 -->
//     <!-- watcher: requires-file-on-main: tests/e2e/pr-acceptance/helpers.ts -->
//
// Effective dep set is the UNION of both forms, de-duplicated. Parsing avoids
// regex quantifiers (CodeQL js/polynomial-redos).

// Parses one trimmed line as a watcher directive using plain string ops.
// Returns { key, value } or null.
function parseWatcherDirective(t) {
  if (!t.startsWith("<!--") || !t.endsWith("-->")) return null;
  const inner = t.slice(4, -3).trim();
  if (!inner.toLowerCase().startsWith("watcher:")) return null;
  const rest = inner.slice("watcher:".length);
  const colon = rest.indexOf(":");
  if (colon === -1) return null;
  const key = rest.slice(0, colon).trim().toLowerCase();
  if (key === "" || ![...key].every((c) => (c >= "a" && c <= "z") || c === "-")) return null;
  const value = rest.slice(colon + 1).trim();
  if (value === "") return null;
  return { key, value };
}

// Strip a single pair of matching surrounding quotes ('...' or "...").
function stripQuotes(v) {
  if (v.length < 2) return v;
  const q = v[0];
  if ((q === "'" || q === '"') && v[v.length - 1] === q) return v.slice(1, -1);
  return v;
}

// True iff the string is a non-empty identifier of [a-zA-Z0-9_].
function isBareIdentifier(s) {
  if (s.length === 0) return false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const ok =
      (c >= "a" && c <= "z") ||
      (c >= "A" && c <= "Z") ||
      (c >= "0" && c <= "9") ||
      c === "_";
    if (!ok) return false;
  }
  return true;
}

// True iff line begins with whitespace, followed by "-", followed by ws or EOL.
// Column-0 dashes are NOT list items (matches lint-prompt.mjs behaviour).
function indentedListValue(line) {
  if (line.length === 0) return null;
  if (line[0] !== " " && line[0] !== "\t") return null;
  let j = 0;
  while (j < line.length && (line[j] === " " || line[j] === "\t")) j++;
  if (line[j] !== "-") return null;
  if (j + 1 < line.length && line[j + 1] !== " " && line[j + 1] !== "\t") return null;
  return line.slice(j + 1).trim();
}

// Hand-parses the YAML front-matter block for dependency keys. Uses only
// plain string operations (no regex with quantifiers). Returns entries
// merged into `deps` in-place.
function readYamlFrontMatterDeps(body, deps) {
  const lines = body.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "---") {
      start = i;
      break;
    }
    if (t === "") continue;
    // Skip leading legacy watcher HTML comments so the two forms can co-exist.
    if (parseWatcherDirective(t)) continue;
    return;
  }
  if (start === -1) return;
  let end = -1;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) return;

  let currentKey = null;
  for (let i = start + 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === "" || line.trim().startsWith("#")) continue;

    const listVal = indentedListValue(line);
    if (listVal !== null) {
      if (currentKey === "requires_merged") {
        const n = Number(listVal);
        if (Number.isInteger(n) && n > 0) deps.requiresMerged.push(n);
      } else if (currentKey === "requires_file_on_main") {
        if (listVal !== "") deps.requiresFilesOnMain.push(listVal);
      } else if (currentKey === "requires_on_main") {
        if (listVal !== "") deps.requiresOnMain.push(listVal);
      }
      continue;
    }

    if (line[0] === " " || line[0] === "\t") continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    const key = line.slice(0, colon);
    if (!isBareIdentifier(key)) continue;
    currentKey = key.toLowerCase();
    const inline = stripQuotes(line.slice(colon + 1).trim());
    if (inline === "") continue;
    if (currentKey === "requires_merged") {
      const n = Number(inline);
      if (Number.isInteger(n) && n > 0) deps.requiresMerged.push(n);
    } else if (currentKey === "requires_file_on_main") {
      deps.requiresFilesOnMain.push(inline);
    } else if (currentKey === "requires_on_main") {
      deps.requiresOnMain.push(inline);
    } else if (currentKey === "fixes_pr") {
      const n = Number(inline);
      if (Number.isInteger(n) && n > 0) deps.fixesPr = n;
    } else if (currentKey === "escalates") {
      // escalates:true means a human decides the merge. Until 2026-08-17 the watcher did not
      // know this word existed and enabled auto-merge on every PR it opened.
      deps.escalates = /^true$/i.test(inline);
    }
    currentKey = null;
  }
}

export function parseWatcherFrontMatter(body) {
  const deps = { requiresMerged: [], requiresFilesOnMain: [], requiresOnMain: [], fixesPr: null, escalates: false };
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t === "") continue;
    const directive = parseWatcherDirective(t);
    if (!directive) break;
    const { key, value } = directive;
    if (key === "requires-merged") {
      for (const part of value.split(",")) {
        const n = Number(part.trim());
        if (Number.isInteger(n) && n > 0) deps.requiresMerged.push(n);
      }
    } else if (key === "requires-file-on-main") {
      deps.requiresFilesOnMain.push(value.trim());
    }
    // Unknown watcher keys are ignored (forward-compat).
  }
  readYamlFrontMatterDeps(body, deps);
  deps.requiresMerged = [...new Set(deps.requiresMerged)];
  deps.requiresFilesOnMain = [...new Set(deps.requiresFilesOnMain)];
  deps.requiresOnMain = [...new Set(deps.requiresOnMain)];
  return deps;
}

// ---------------------------------------------------------------------------
// requires_on_main helpers — pure, unit-testable, no git calls.
// ---------------------------------------------------------------------------

/**
 * Split a `requires_on_main` value into { path, needle }.
 *
 * Accepted forms:
 *   "<path>"               → { path, needle: null }
 *   "<path> :: <needle>"   → { path, needle } (needle may contain interior spaces or colons)
 *
 * Fails closed: an empty path OR (with separator) an empty needle → { malformed: true, reason }.
 * Splits on the FIRST occurrence of " :: " so a needle that contains "::" is supported verbatim.
 */
export function splitRequiresOnMainValue(raw) {
  const SEP = " :: ";
  const sepIdx = raw.indexOf(SEP);
  if (sepIdx === -1) {
    // Path-only form.
    const filePath = raw.trim();
    if (filePath === "") return { malformed: true, reason: "empty path" };
    return { filePath, needle: null };
  }
  // Content-gate form.
  const filePath = raw.slice(0, sepIdx).trim();
  const needle = raw.slice(sepIdx + SEP.length); // do NOT trim — needles may have leading spaces
  if (filePath === "") return { malformed: true, reason: "empty path before ' :: '" };
  if (needle === "") return { malformed: true, reason: "empty needle after ' :: '" };
  return { filePath, needle };
}

/**
 * Check a single `requires_on_main` value against the content of a file on origin/main.
 *
 * Returns { met: true } or { met: false, reason }.
 * Never throws — any error is returned as { met: false, reason }.
 *
 * `fileContent` is either a string (the file's content from git show) or null (file absent).
 * This is a pure function; the caller supplies fileContent so git is kept at the edge.
 *
 * FIXED-STRING only — uses String.prototype.includes, never new RegExp(needle).
 */
export function checkRequiresOnMain(raw, fileContent) {
  const parsed = splitRequiresOnMainValue(raw);
  if (parsed.malformed) {
    return { met: false, reason: "malformed requires_on_main value (" + parsed.reason + "): " + JSON.stringify(raw) };
  }
  if (fileContent === null) {
    return { met: false, reason: "file \"" + parsed.filePath + "\" not on origin/main" };
  }
  if (parsed.needle === null) {
    // Path-only form: file exists → MET.
    return { met: true };
  }
  // Content-gate: fixed-string containment. No RegExp.
  if (fileContent.includes(parsed.needle)) {
    return { met: true };
  }
  return { met: false, reason: "string " + JSON.stringify(parsed.needle) + " not found in \"" + parsed.filePath + "\" on origin/main" };
}

// hasDeclaredDependencies — dispatch-time predicate: does this prompt declare
// ANY watcher dependency gate that must be evaluated before it fires?
//
// This exists because the dispatch loop used to inline the condition and it
// omitted `requiresOnMain`. Every other layer of requires_on_main support was
// correct and tested (parser, unmetDependencies, checkRequiresOnMain, lint),
// but the dispatch site never called into any of them for a requires_on_main-
// only prompt, so such a prompt was dispatched ungated. If a future fourth
// dependency key is added, add it HERE too or the same silent hole reopens.
//
// The predicate must tolerate null / undefined / partial objects: it is called
// on the hot dispatch path and a throw here takes the watcher down.
export function hasDeclaredDependencies(deps) {
  if (!deps) return false;
  return (
    (deps.requiresMerged?.length ?? 0) > 0 ||
    (deps.requiresFilesOnMain?.length ?? 0) > 0 ||
    (deps.requiresOnMain?.length ?? 0) > 0
  );
}

// Returns a list of human-readable unmet-dependency reasons (empty = go).
// A gh/git error counts as unmet — fail closed, re-check next rescan.
async function unmetDependencies(deps) {
  const unmet = [];
  for (const n of deps.requiresMerged) {
    try {
      const data = await runGh(["pr", "view", String(n), "--json", "state"], { json: true });
      if (data.state !== "MERGED") unmet.push(`PR #${n} is ${data.state} (needs MERGED)`);
    } catch (err) {
      unmet.push(`PR #${n} state check failed: ${err.message}`);
    }
  }
  if (deps.requiresFilesOnMain.length > 0 || deps.requiresOnMain.length > 0) {
    try {
      await runGit(["fetch", "origin", "main"]);
    } catch (err) {
      log("deps", `git fetch failed (${err.message}) — checking against last-fetched origin/main`);
    }
    for (const file of deps.requiresFilesOnMain) {
      try {
        await runGit(["cat-file", "-e", `origin/main:${file}`]);
      } catch {
        unmet.push(`file "${file}" not on origin/main`);
      }
    }
    for (const raw of deps.requiresOnMain) {
      const parsed = splitRequiresOnMainValue(raw);
      if (parsed.malformed) {
        // Fail closed. Warn so the author sees it in watcher logs.
        log("deps", `[WARN] malformed requires_on_main value (${parsed.reason}): ${JSON.stringify(raw)}`);
        unmet.push(`malformed requires_on_main value (${parsed.reason}): ${JSON.stringify(raw)}`);
        continue;
      }
      let fileContent = null;
      try {
        fileContent = await runGit(["show", `origin/main:${parsed.filePath}`]);
      } catch {
        // File absent or git error — UNMET, fail closed.
      }
      const result = checkRequiresOnMain(raw, fileContent);
      if (!result.met) {
        unmet.push(result.reason);
      }
    }
  }
  return unmet;
}

// --- Heartbeat ---

let heartbeatTimer = null;

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

async function appendHeartbeatLine(line) {
  try {
    let lines = [];
    try {
      lines = (await readFile(HEARTBEAT_FILE, "utf-8")).split(/\r?\n/).filter(Boolean);
    } catch {
      // no heartbeat file yet
    }
    lines.push(line);
    if (lines.length > HEARTBEAT_MAX_LINES) lines = lines.slice(-HEARTBEAT_MAX_LINES);
    await writeFile(HEARTBEAT_FILE, lines.join("\n") + "\n", "utf-8");
  } catch (err) {
    log("heartbeat", `write failed: ${err.message}`);
  }
}

// Write a machine-readable snapshot of what this node can dequeue.
// Used by the watchdog so it does not flag a correctly-idle node as hung.
// Best-effort: never throws; a write failure only logs.
// Mirrors the .reviewed-prs.json.tmp-then-rename pattern for atomicity.
async function writeQueueState() {
  try {
    // Collect every *-ready.md currently on disk.
    let allArmed = [];
    try {
      const entries = await readdir(PROMPT_DIR);
      allArmed = entries.filter((n) => READY_PATTERN.test(n));
    } catch {
      // if we cannot read the dir, armed stays empty — still write the file
    }

    // Which of those does this lane own?
    let ownedNames;
    if (WATCHER_LANE === null) {
      // No lane filtering: node owns everything.
      ownedNames = allArmed;
    } else {
      ownedNames = allArmed.filter((name) => {
        const body = readPromptBody(path.join(PROMPT_DIR, name));
        const isReview = isReviewJob(name);
        const fixesPr = isReview ? null : readFixesPr(path.join(PROMPT_DIR, name));
        const isFix = fixesPr !== null;
        return laneFor(name, { isFix, isReview, body, lanes: WATCHER_LANES }) === WATCHER_LANE;
      });
    }

    const result = computeRunnable({
      armed: allArmed,
      owned: ownedNames,
      deferred: [...deferredNames],
    });

    const payload = {
      ts: new Date().toISOString(),
      lane: WATCHER_LANE,
      lanes: WATCHER_LANES,
      armed: result.armed,
      owned: result.owned,
      deferred: [...deferredNames],
      runnable: result.runnable,
    };

    const tmp = QUEUE_STATE_FILE + ".tmp";
    await writeFile(tmp, JSON.stringify(payload, null, 2) + "\n", "utf-8");
    await rename(tmp, QUEUE_STATE_FILE);
  } catch (err) {
    log("queue-state", `write failed: ${err.message}`);
  }
}

// _opts is intentionally undocumented in the public API — it exists only so
// unit tests can inject a synchronous `appendLine` without writing to disk.
export function startHeartbeat(name, getLastLine, onRunTimeout, _opts = {}) {
  stopHeartbeat();
  const appendLine = _opts._appendLine ?? appendHeartbeatLine;
  const intervalMs = _opts._intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const startedMs = Date.now();
  let tripped = false;
  heartbeatTimer = setInterval(async () => {
    const elapsedMs = Date.now() - startedMs;
    const elapsedSec = Math.round(elapsedMs / 1000);
    const snippet = (getLastLine() ?? "").slice(0, 160);
    await appendLine(`[${ts()}] ${name} elapsed=${elapsedSec}s last: ${snippet}`);
    if (!tripped && isRunTimedOut(elapsedMs, RUN_TIMEOUT_MS)) {
      tripped = true;
      const capMin = RUN_TIMEOUT_MS / 60000;
      const msg = `[run-timeout] ${name} exceeded ${capMin} min (elapsed=${elapsedSec}s) — killing child + quarantining`;
      log("run-timeout", `${name} exceeded ${capMin} min (elapsed=${elapsedSec}s) — killing child + quarantining`);
      await appendLine(`[${ts()}] ${msg}`);
      if (onRunTimeout) {
        try {
          onRunTimeout();
        } catch (err) {
          log("run-timeout", `handler error: ${err.message}`);
        }
      }
    }
  }, intervalMs);
}

// --- Policy auto-merge helpers ---

// tests-docs policy: the diff must touch ONLY tests/** and/or docs/**, and
// must not contain migration files.
export function classifyPolicyFiles(files) {
  const paths = (files ?? []).map((f) => (typeof f === "string" ? f : f.path));
  if (paths.length === 0) return { ok: false, reason: "empty diff" };
  const migration = paths.find((p) => /(^|\/)migrations\//.test(p));
  if (migration) return { ok: false, reason: `migration file: ${migration}` };
  const outside = paths.find((p) => !/^(tests|docs)\//.test(p));
  if (outside) return { ok: false, reason: `outside tests/ or docs/: ${outside}` };
  return { ok: true };
}

// Fetch the list of file paths touched by a PR using `gh pr view --json files`.
// Returns a string[] of normalized path strings. Throws on gh failure.
async function prFileList(prNumber) {
  const data = await runGh(["pr", "view", String(prNumber), "--json", "files"], { json: true });
  const files = data.files ?? [];
  return files.map((f) => (typeof f === "string" ? f : (f.path ?? "")));
}

// The reviewer writes docs/pr-reviews/pr-{N}-review.md with the verdict on
// the first line: "VERDICT: MERGE" (or FIX / BLOCK). Only MERGE approves.
// When prFiles is provided (string[]), the guard also runs: a MERGE verdict
// that names files not in the PR is rejected even if the text says MERGE.
async function verdictApproves(prNumber, prFiles) {
  const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${prNumber}-review.md`);
  try {
    const content = await readFile(verdictPath, "utf-8");
    if (!/^VERDICT:\s*MERGE\b/m.test(content)) return false;
    if (prFiles != null) {
      const guardResult = validateVerdict({ verdictText: content, prFiles });
      if (!guardResult.ok) {
        log("verdict-guard", `PR #${prNumber}: MERGE verdict blocked — cites files not in PR: ${guardResult.unmatched.join(", ")}`);
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// --- Failure quarantine ---

// Write docs/pr-prompts/failed/{name}.report.md: last 50 lines of agent
// output, PR number (if one opened), and `gh pr checks` output.
async function writeQuarantineReport(name, agentOutput, prNumber) {
  const tailLines = agentOutput.split(/\r?\n/).filter((l) => l.trim()).slice(-50);
  let checksSection = "(no PR number detected — no checks to report)";
  if (prNumber != null) {
    try {
      const out = await runGh(["pr", "checks", String(prNumber)], { allowNonZero: true });
      checksSection = out.trim() || "(gh pr checks returned no output)";
    } catch (err) {
      checksSection = `gh pr checks failed: ${err.message}`;
    }
  }
  const report = [
    `# Quarantine report — ${name}`,
    "",
    `Written: ${ts()}`,
    `PR: ${prNumber != null ? `#${prNumber}` : "(none detected in agent output)"}`,
    `Retries used: ${retryCounts.get(name) ?? 0}`,
    "",
    "## Check status (`gh pr checks`)",
    "",
    "```",
    checksSection,
    "```",
    "",
    "## Last 50 lines of agent output",
    "",
    "```",
    ...tailLines,
    "```",
    "",
  ].join("\n");
  try {
    await writeFile(path.join(FAILED_DIR, `${name}.report.md`), report, "utf-8");
    log("quarantine", `report written: failed/${name}.report.md`);
  } catch (err) {
    log("error", `quarantine report write failed: ${err.message}`);
  }
}

// ONE automatic retry when the failure looks transient. Returns true when
// the prompt was re-queued (file stays in docs/pr-prompts/).
function maybeRetryTransient(name, matchText) {
  const count = retryCounts.get(name) ?? 0;
  if (count >= 1) return false;
  if (!isTransientFailure(matchText)) return false;
  retryCounts.set(name, count + 1);
  log("retry", `${name}: transient failure signature matched — retrying once (attempt 2)`);
  seen.delete(name);
  enqueue(name, { source: "transient-retry" });
  return true;
}

// Extract a PR number from the agent's combined stdout/stderr output.
function extractPrNumber(text) {
  const urlMatch = text.match(/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/);
  if (urlMatch) return Number(urlMatch[1]);
  const hashMatch = text.match(/(?:PR|pr|pull request)\s*#(\d+)/);
  if (hashMatch) return Number(hashMatch[1]);
  return null;
}

// escalates:true — a human decides this merge, so the watcher must NOT enable auto-merge.
// It labels the PR `do-not-merge` (the label already existed, described as "escalates:true -
// Marco merges this, not automation (DOCTRINE 5b)" — it was simply never applied by anything)
// and leaves the PR open. CP-26 in scripts/pr-gates/pr-gates.mjs fails while that label is
// present, so the hold is enforced at the gate and not only by this decision. Removing the
// label IS the human's act of approval: CI re-runs, CP-26 passes, and the PR becomes mergeable.
//
// Before 2026-08-17 none of this existed: the string "escalates" appeared nowhere in the
// watcher and `gh pr merge --auto --squash` ran on every PR it opened. This is the OPS-6
// near-miss mechanism (a destructive migration one green build away from auto-merging).
//
// 2026-08-18 — this function used to unconditionally re-apply `do-not-merge` every time
// an escalates prompt reached it. When Marco reviewed PR #1158 and removed the label at
// 00:26:53Z, an armed re-run of the same prompt at 01:45:08Z re-labeled it 78 minutes
// later, silently reversing his decision. A rule that only guards one direction does not
// guard the gate. decideEscalationAction below encodes the two-directional rule: a human's
// removal is respected, and a re-run on a pre-existing PR is a no-op.

// Pure decision function for escalates PRs. Kept side-effect-free so the escalation
// policy can be unit-tested without spawning gh or writing labels.
//
// Inputs:
//   prCreatedAtMs   — PR createdAt in ms since epoch
//   runStartedAtMs  — this watcher run's start time in ms
//   currentLabels   — array of label names currently on the PR
//   doNotMergeEvents— array of {event: "labeled"|"unlabeled", createdAt: iso} for the
//                     do-not-merge label ONLY (caller filters). Unsorted OK.
//
// Actions:
//   "spent"          — PR pre-dates this run; prompt was consumed elsewhere already,
//                      caller must move to processed/ with NO label, NO comment.
//   "already-labeled"— PR already carries do-not-merge; caller MUST NOT re-add.
//   "declined"       — the most recent do-not-merge event is `unlabeled`. A human made
//                      the call; caller MUST NOT re-apply, must log the decline loudly.
//   "apply"          — apply the label + post the comment.
export function decideEscalationAction({
  prCreatedAtMs,
  runStartedAtMs,
  currentLabels,
  doNotMergeEvents,
}) {
  if (
    Number.isFinite(prCreatedAtMs) &&
    Number.isFinite(runStartedAtMs) &&
    prCreatedAtMs < runStartedAtMs
  ) {
    return {
      action: "spent",
      reason: `PR pre-dates this run (created ${new Date(prCreatedAtMs).toISOString()}, run started ${new Date(runStartedAtMs).toISOString()}) — the prompt was already consumed by an earlier run`,
    };
  }
  if ((currentLabels ?? []).includes("do-not-merge")) {
    return {
      action: "already-labeled",
      reason: "PR already carries `do-not-merge` — no duplicate apply",
    };
  }
  const sorted = (doNotMergeEvents ?? [])
    .slice()
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const mostRecent = sorted[0];
  if (mostRecent && mostRecent.event === "unlabeled") {
    return {
      action: "declined",
      reason: `most recent \`do-not-merge\` event is \`unlabeled\` at ${mostRecent.createdAt} — a human already released this PR, refusing to re-apply`,
    };
  }
  return { action: "apply", reason: null };
}

// Fetch the state needed to decide the escalation action. Isolated so holdForMarco stays
// small and so the transport can be swapped in tests if we ever want an integration one.
async function fetchEscalationState(prNumber) {
  const pr = await runGh(
    ["pr", "view", String(prNumber), "--json", "createdAt,labels"],
    { json: true },
  );
  // `gh api` substitutes {owner}/{repo} from the current git remote, so this works in
  // both the interactive tree and the watcher clone without hard-coding GH-Mantova/…
  const events = await runGh(
    ["api", `repos/{owner}/{repo}/issues/${prNumber}/events`, "--paginate"],
    { json: true },
  );
  const doNotMergeEvents = events
    .filter(
      (e) =>
        (e.event === "labeled" || e.event === "unlabeled") &&
        e.label?.name === "do-not-merge",
    )
    .map((e) => ({ event: e.event, createdAt: e.created_at }));
  return {
    prCreatedAtMs: Date.parse(pr.createdAt),
    currentLabels: (pr.labels ?? []).map((l) => l.name),
    doNotMergeEvents,
  };
}

// Post the "held for Marco" comment via a temp file. The old --body path split
// the (unquoted) body on shell whitespace and failed with "accepts at most 1 arg(s),
// received 42" on every escalates PR (#1158, #1165, #1166 all lost their comment).
async function postHeldForMarcoComment(prNumber) {
  const body =
    "Held for Marco: this prompt declared `escalates: true`, so the watcher did not enable " +
    "auto-merge and applied the `do-not-merge` label. CP-26 fails while the label is present. " +
    "Remove the label once you have reviewed it — that is what releases the merge.";
  const tmpFile = path.join(__dirname, `.held-for-marco-${prNumber}.tmp.md`);
  try {
    await writeFile(tmpFile, body, "utf-8");
    await runGh(["pr", "comment", String(prNumber), "--body-file", tmpFile]);
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      // best-effort cleanup
    }
  }
}

async function holdForMarco(prNumber, promptName, runStartedAtMs, _hbOpts = {}) {
  const hbStartedMs = Date.now();
  startHeartbeat(
    MERGE_WAIT_HEARTBEAT,
    () => `waiting for Marco review of PR #${prNumber} (elapsed=${Math.round((Date.now() - hbStartedMs) / 1000)}s)`,
    null,
    _hbOpts,
  );
  try {
    let state;
    try {
      state = await fetchEscalationState(prNumber);
    } catch (err) {
      // If we can't read PR state, fall back to fail-loud: warn and skip label + comment
      // rather than blindly re-applying (which is exactly the bug being fixed).
      log(
        "merge",
        `PR #${prNumber}: could NOT read escalation state (${err.message}) — refusing to modify label. Verify by hand.`,
      );
      return {
        ok: false,
        marco: true,
        reason: `escalates:true — could not read PR state (${err.message}); label NOT touched, verify by hand.`,
      };
    }

    const decision = decideEscalationAction({
      prCreatedAtMs: state.prCreatedAtMs,
      runStartedAtMs,
      currentLabels: state.currentLabels,
      doNotMergeEvents: state.doNotMergeEvents,
    });

    if (decision.action === "spent") {
      log("merge", `PR #${prNumber}: escalates:true — ${decision.reason}. Filing prompt as processed, no label/comment.`);
      return { spent: true, reason: decision.reason };
    }

    if (decision.action === "already-labeled") {
      log("merge", `PR #${prNumber}: escalates:true — ${decision.reason}`);
      return { ok: false, marco: true, reason: `escalates:true — ${decision.reason}` };
    }

    if (decision.action === "declined") {
      log(
        "merge",
        `PR #${prNumber}: escalates:true — REFUSING to re-apply \`do-not-merge\`: ${decision.reason}`,
      );
      return {
        ok: false,
        marco: true,
        reason: `escalates:true — ${decision.reason}`,
      };
    }

    log("merge", `PR #${prNumber}: escalates:true — NOT enabling auto-merge; labelling do-not-merge`);
    try {
      await runGh(["pr", "edit", String(prNumber), "--add-label", "do-not-merge"]);
    } catch (err) {
      // Fail LOUD, never silently: an unlabelled escalates PR is exactly the hazard this closes.
      log("merge", `PR #${prNumber}: FAILED to apply do-not-merge label: ${err.message}`);
      return {
        ok: false,
        marco: true,
        reason: `escalates:true — auto-merge withheld, but the do-not-merge label could NOT be applied (${err.message}). Apply it by hand before anyone merges.`,
      };
    }
    try {
      await postHeldForMarcoComment(prNumber);
    } catch (err) {
      log("merge", `PR #${prNumber}: comment failed (non-fatal): ${err.message}`);
    }
    return { ok: false, marco: true, reason: "escalates:true — held for Marco, labelled do-not-merge" };
  } finally {
    stopHeartbeat();
  }
}

// Enable auto-merge, then poll until merged or failure.
async function waitForMerge(prNumber, promptName, _hbOpts = {}) {
  const hbStartedMs = Date.now();
  startHeartbeat(
    MERGE_WAIT_HEARTBEAT,
    () => `waiting for merge of PR #${prNumber} (elapsed=${Math.round((Date.now() - hbStartedMs) / 1000)}s)`,
    null,
    _hbOpts,
  );
  try {
    try {
      log("merge", `enabling auto-merge on PR #${prNumber}`);
      await runGh(["pr", "merge", String(prNumber), "--auto", "--squash", "--delete-branch"]);
    } catch (err) {
      log("merge", `auto-merge enable failed for PR #${prNumber}: ${err.message}`);
      // Continue anyway — the PR may merge if the user/CI handles it.
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < MERGE_TIMEOUT_MS) {
      let data;
      try {
        data = await runGh(
          ["pr", "view", String(prNumber), "--json", "state,statusCheckRollup,mergedAt"],
          { json: true },
        );
      } catch (err) {
        log("merge", `gh pr view failed: ${err.message} — retrying in ${POLL_INTERVAL_MS / 1000}s`);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (data.state === "MERGED") {
        log("merge", `PR #${prNumber} merged at ${data.mergedAt}`);
        return { ok: true };
      }
      if (data.state === "CLOSED") {
        return { ok: false, reason: "closed-without-merge" };
      }

      const checks = data.statusCheckRollup ?? [];
      const failed = checks.find(
        (c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED" || c.conclusion === "TIMED_OUT",
      );
      if (failed) {
        return {
          ok: false,
          reason: `ci-${failed.conclusion.toLowerCase()}`,
          check: failed.name ?? "(unknown)",
        };
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return { ok: false, reason: "timeout" };
  } finally {
    stopHeartbeat();
  }
}

// tests-docs policy merge loop. Returns:
//   { ok: true }                          — merged
//   { ok: false, marco: true, reason }    — doesn't qualify / timed out → Marco
//   { ok: false, ci: true, reason, check }— CI red → quarantine path
//   { ok: false, reason }                 — closed without merge
async function waitForPolicyMerge(prNumber, _hbOpts = {}) {
  const hbStartedMs = Date.now();
  startHeartbeat(
    MERGE_WAIT_HEARTBEAT,
    () => `waiting for merge of PR #${prNumber} (elapsed=${Math.round((Date.now() - hbStartedMs) / 1000)}s)`,
    null,
    _hbOpts,
  );
  try {
    // Static gate first: a diff outside tests/** + docs/** (or containing
    // migrations) never qualifies — hand to Marco immediately, no waiting.
    let filesData;
    try {
      filesData = await runGh(["pr", "view", String(prNumber), "--json", "files"], { json: true });
    } catch (err) {
      return { ok: false, marco: true, reason: `files query failed: ${err.message}` };
    }
    const cls = classifyPolicyFiles(filesData.files ?? []);
    if (!cls.ok) {
      return { ok: false, marco: true, reason: cls.reason };
    }
    // Capture the file path list once; pass to verdictApproves so the guard
    // can reject a MERGE verdict that cites files not in this PR.
    const policyPrFiles = (filesData.files ?? []).map(
      (f) => (typeof f === "string" ? f : (f.path ?? "")),
    );

    const startedAt = Date.now();
    let mergeEnabled = false;
    while (Date.now() - startedAt < MERGE_TIMEOUT_MS) {
      let data;
      try {
        data = await runGh(
          ["pr", "view", String(prNumber), "--json", "state,statusCheckRollup,mergedAt"],
          { json: true },
        );
      } catch (err) {
        log("merge", `gh pr view failed: ${err.message} — retrying in ${POLL_INTERVAL_MS / 1000}s`);
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      if (data.state === "MERGED") {
        log("merge", `PR #${prNumber} merged at ${data.mergedAt} (policy: tests-docs)`);
        return { ok: true };
      }
      if (data.state === "CLOSED") {
        return { ok: false, reason: "closed-without-merge" };
      }

      const checks = data.statusCheckRollup ?? [];
      const failed = checks.find(
        (c) => c.conclusion === "FAILURE" || c.conclusion === "CANCELLED" || c.conclusion === "TIMED_OUT",
      );
      if (failed) {
        return {
          ok: false,
          ci: true,
          reason: `ci-${failed.conclusion.toLowerCase()}`,
          check: failed.name ?? "(unknown)",
        };
      }

      const allGreen =
        checks.length > 0 &&
        checks.every((c) => ["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion));

      if (!mergeEnabled && allGreen && (await verdictApproves(prNumber, policyPrFiles))) {
        if (DRY_RUN) {
          log("dry-run", `PR #${prNumber}: all tests-docs conditions met — would enable auto-merge`);
          return { ok: false, marco: true, reason: "dry-run: auto-merge not executed" };
        }
        try {
          log("merge", `PR #${prNumber}: tests-docs policy satisfied — enabling auto-merge`);
          await runGh(["pr", "merge", String(prNumber), "--auto", "--squash", "--delete-branch"]);
          mergeEnabled = true;
        } catch (err) {
          log("merge", `auto-merge enable failed for PR #${prNumber}: ${err.message}`);
        }
      }

      await sleep(POLL_INTERVAL_MS);
    }

    return {
      ok: false,
      marco: true,
      reason: mergeEnabled
        ? "timeout after auto-merge enabled"
        : "timeout waiting for green checks + MERGE verdict",
    };
  } finally {
    stopHeartbeat();
  }
}

// Move all queued + on-disk -ready.md files into paused/.
async function pauseQueue(reason) {
  queuePaused = true;
  log("PAUSE", `queue paused: ${reason}`);

  // Move in-memory queue
  const drainable = queue.splice(0);
  for (const filePath of drainable) {
    const name = path.basename(filePath);
    fixLanePaths.delete(filePath);
    try {
      await rename(filePath, path.join(PAUSED_DIR, name));
      log("PAUSE", `moved ${name} → paused/`);
    } catch (err) {
      log("PAUSE", `could not move ${name}: ${err.message}`);
    }
    seen.delete(name);
  }

  // Also move any -ready.md files still on disk at the top level
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name)) {
        await rename(path.join(PROMPT_DIR, name), path.join(PAUSED_DIR, name));
        log("PAUSE", `moved ${name} → paused/ (disk scan)`);
      }
    }
  } catch (err) {
    log("PAUSE", `disk scan failed: ${err.message}`);
  }

  // Write a SUMMARY in paused/
  const summary = `Queue paused at ${ts()}\nReason: ${reason}\n\nAll remaining -ready.md files were moved here. After you've fixed the upstream issue (re-run the failed prompt, roll back main, etc.), move the prompts back to docs/pr-prompts/ to resume.\n`;
  await writeFile(path.join(PAUSED_DIR, "PAUSED_SUMMARY.md"), summary);
}

// Pull main locally so the next prompt sees the merged commit.
async function syncMain() {
  try {
    log("sync", "git fetch + git checkout main + git pull");
    await runGh(["repo", "view", "--json", "name"], { json: true }); // sanity — confirm gh works
    // Use plain git via spawn (gh doesn't pull)
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["fetch", "origin"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git fetch ${code}`))));
    });
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["checkout", "main"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git checkout main ${code}`))));
    });
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["pull"], { cwd: REPO_ROOT, shell: true });
      child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`git pull ${code}`))));
    });
    log("sync", "main is up to date");
  } catch (err) {
    log("sync", `failed: ${err.message}`);
    throw err;
  }
}

// --- Lockfile helpers ---

// Read the command line for a PID. Returns "" if it cannot be determined
// (assume the worst → caller treats as "matches" to fail safe).
function readProcessCommandLine(pid) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
      );
      return out.trim();
    }
    const out = execFileSync("ps", ["-p", String(pid), "-o", "command="], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    return "";
  }
}

function isWatcherNodeProcess(pid) {
  const cmd = readProcessCommandLine(pid);
  if (!cmd) return true; // fail safe — assume it IS a watcher
  // Match `node ... pr-watcher/index.mjs` or `node ... pr-watcher\index.mjs`.
  return /node/i.test(cmd) && /pr-watcher[\\/]index\.mjs/i.test(cmd);
}

async function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    let pid = null;
    try {
      const content = await readFile(LOCK_FILE, "utf-8");
      pid = Number(content.trim());
    } catch {
      // unreadable lockfile — treat as stale
    }
    if (pid && !Number.isNaN(pid)) {
      let alive = false;
      try {
        process.kill(pid, 0);
        alive = true;
      } catch {
        // ESRCH = process does not exist (stale lockfile)
      }
      if (alive) {
        if (isWatcherNodeProcess(pid)) {
          log("WARN", `another watcher instance is running (PID ${pid}, node + pr-watcher/index.mjs). Exiting cleanly to avoid queue conflicts.`);
          process.exit(0);
        }
        log("watcher", `lockfile PID ${pid} is alive but is NOT a watcher process — overwriting`);
      } else {
        log("watcher", `stale lockfile (PID ${pid} not found) — overwriting`);
      }
    }
  }
  await writeFile(LOCK_FILE, String(process.pid), "utf-8");
}

function releaseLock() {
  try {
    unlinkSync(LOCK_FILE);
  } catch {
    // best-effort
  }
}

// --- Child-process reaper ---
//
// SAFETY (LL-33): the watcher only ever kills PIDs it spawned ITSELF and
// recorded in CHILDREN_FILE. It never enumerates `claude` processes by name
// and never calls taskkill /IM claude.exe — Marco's interactive Claude Code
// and Cowork sessions must never be killed by the watcher.

async function readTrackedChildren() {
  try {
    const raw = await readFile(CHILDREN_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.pids)) {
      return data.pids.filter((n) => typeof n === "number" && n > 0);
    }
  } catch {
    // missing / unreadable / unparsable → empty list
  }
  return [];
}

async function writeTrackedChildren(pids) {
  try {
    await writeFile(CHILDREN_FILE, JSON.stringify({ pids }, null, 2), "utf-8");
  } catch (err) {
    log("reaper", `could not write children file: ${err.message}`);
  }
}

async function recordChildPid(pid) {
  const pids = await readTrackedChildren();
  if (!pids.includes(pid)) pids.push(pid);
  await writeTrackedChildren(pids);
}

async function removeChildPid(pid) {
  const pids = (await readTrackedChildren()).filter((p) => p !== pid);
  await writeTrackedChildren(pids);
}

// Kill ONE specific PID and its whole process tree. Safe: only call with a
// PID we recorded as one of OUR spawned children.
function killProcessTree(pid) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
        stdio: ["ignore", "ignore", "ignore"],
      });
    } else {
      try {
        process.kill(-pid, "SIGTERM");
      } catch {
        process.kill(pid, "SIGTERM");
      }
    }
  } catch {
    // already gone / not ours anymore — best-effort
  }
}

// On startup, kill the SPECIFIC PIDs the previous watcher run left behind.
// Only PIDs in CHILDREN_FILE — never enumerate claude.exe by name.
async function reapPreviousChildren() {
  const pids = await readTrackedChildren();
  if (pids.length === 0) return;
  log("reaper", `previous watcher run left ${pids.length} tracked child PID(s): ${pids.join(", ")}`);
  for (const pid of pids) {
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      // dead already
    }
    if (alive) {
      log("reaper", `killing leftover child PID ${pid} (+ process tree)`);
      killProcessTree(pid);
    } else {
      log("reaper", `tracked PID ${pid} already gone`);
    }
  }
  await writeTrackedChildren([]);
}

// Reference to the currently-running spawned child (or null). Updated by the
// drain loop and read by shutdown handlers.
let currentChild = null;

function killCurrentChildTree() {
  if (currentChild && currentChild.pid) {
    log("reaper", `terminating current child PID ${currentChild.pid} (+ tree) before exit`);
    killProcessTree(currentChild.pid);
  }
}

// --- Reviewed-set helpers (auto-review) ---

async function loadReviewedSet() {
  const set = new Set();
  try {
    const raw = await readFile(REVIEWED_STATE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.reviewed)) {
      for (const n of data.reviewed) {
        if (typeof n === "number") set.add(n);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      log("review", `warning: could not load reviewed-set (${err.message}) — starting empty`);
    }
  }
  return set;
}

async function saveReviewedSet(set) {
  const tmp = REVIEWED_STATE_FILE + ".tmp";
  const data = JSON.stringify({ reviewed: [...set].sort((a, b) => a - b) }, null, 2);
  try {
    await writeFile(tmp, data, "utf-8");
    await rename(tmp, REVIEWED_STATE_FILE);
  } catch (err) {
    // Retry once — Windows can intermittently throw EPERM on same-volume rename
    log("review", `state save failed (${err.message}), retrying...`);
    try {
      await writeFile(tmp, data, "utf-8");
      await rename(tmp, REVIEWED_STATE_FILE);
    } catch (err2) {
      log("review", `state save failed again (${err2.message}) — continuing (worst case: duplicate review next tick)`);
    }
  }
}

// On first enable, seed the reviewed-set with all recent PRs so we never
// auto-review historical work. Only PRs that appear AFTER this point get
// a review prompt written for them.
async function seedReviewedSet(set) {
  log("review", "seeding reviewed-set with recent PRs (open + merged, limit 50)...");
  try {
    const prs = await runGh(
      ["pr", "list", "--state", "all", "--limit", "50", "--json", "number"],
      { json: true },
    );
    for (const pr of prs) {
      set.add(pr.number);
    }
    log("review", `reviewed-set seeded with ${set.size} PR(s) — only new PRs will be auto-reviewed`);
  } catch (err) {
    log("review", `warning: seed failed (${err.message}) — continuing without seed (may review historical PRs)`);
  }
  await saveReviewedSet(set);
  return set;
}

// Render the review prompt template, replacing {{PR_NUMBER}}, {{PR_TITLE}},
// {{PROMPT_DIR}}, and {{PR_FILES}}.
export function renderTemplate(template, prNumber, prTitle, promptDir, prFiles) {
  const fileList = Array.isArray(prFiles) && prFiles.length > 0
    ? prFiles.map(f => `- ${f}`).join("\n")
    : "(unknown — reviewer must fetch via `gh pr view <N> --json files`)";
  return template
    .replaceAll("{{PR_NUMBER}}", String(prNumber))
    .replaceAll("{{PR_TITLE}}", prTitle)
    .replaceAll("{{PROMPT_DIR}}", promptDir ?? "")
    .replaceAll("{{PR_FILES}}", fileList);
}

let reviewTemplate = null;
const REVIEW_TEMPLATE_FILE = path.join(__dirname, "review-prompt-template.md");

async function loadReviewTemplate() {
  try {
    reviewTemplate = await readFile(REVIEW_TEMPLATE_FILE, "utf-8");
    return true;
  } catch (err) {
    log("review", `warning: could not load review template (${err.message}) — auto-review disabled`);
    return false;
  }
}

// Poll GitHub for newly-opened PRs and write a review prompt for each.
// This function only WRITES files — the normal queue drain handles execution.
let reviewedSet = null;

async function pollForNewPrs() {
  if (queuePaused) return;
  let prs;
  try {
    prs = await runGh(
      ["pr", "list", "--state", "open", "--json", "number,title,isDraft,createdAt,baseRefName"],
      { json: true },
    );
  } catch (err) {
    log("review", `poll failed: ${err.message} — will retry next tick`);
    return;
  }

  const now = Date.now();
  for (const pr of prs) {
    if (pr.isDraft) continue;
    if (pr.baseRefName !== "main") continue;
    if (reviewedSet.has(pr.number)) continue;
    const age = now - new Date(pr.createdAt).getTime();
    if (age < REVIEW_MIN_AGE_MS) continue; // grace period — authoring agent may still be finishing

    const promptName = `rev-${pr.number}-ready.md`;
    if (DRY_RUN) {
      log("dry-run", `would write review prompt ${promptName} for PR #${pr.number} ("${pr.title}")`);
      continue;
    }
    const promptPath = path.join(PROMPT_DIR, promptName);
    let prFilesList = null;
    try {
      prFilesList = await prFileList(pr.number);
    } catch (err) {
      log("review", `warning: could not fetch file list for PR #${pr.number}: ${err.message} — continuing with empty list`);
    }
    const body = renderTemplate(reviewTemplate, pr.number, pr.title, PROMPT_DIR, prFilesList);
    try {
      await writeFile(promptPath, body, "utf-8");
    } catch (err) {
      log("review", `could not write prompt for PR #${pr.number}: ${err.message}`);
      continue;
    }
    reviewedSet.add(pr.number);
    await saveReviewedSet(reviewedSet);
    log("review", `enqueued review for PR #${pr.number} ("${pr.title}") → ${promptName}`);
  }
}

// Auto-update-branch: bring our own open PRs that fell BEHIND main up to
// date. Conflicting PRs (mergeStateStatus DIRTY) are skipped — update-branch
// can't resolve conflicts; those need a human rebase.
async function pollForBehindPrs() {
  if (queuePaused) return;
  let prs;
  try {
    prs = await runGh(
      ["pr", "list", "--author", "@me", "--state", "open", "--json", "number,title,mergeStateStatus"],
      { json: true },
    );
  } catch (err) {
    log("update", `poll failed: ${err.message} — will retry next tick`);
    return;
  }
  for (const pr of prs) {
    if (pr.mergeStateStatus === "DIRTY") {
      log("update", `PR #${pr.number} has conflicts — skipping update-branch`);
      continue;
    }
    if (pr.mergeStateStatus !== "BEHIND") continue;
    if (DRY_RUN) {
      log("dry-run", `PR #${pr.number} is BEHIND — would run gh pr update-branch ${pr.number}`);
      continue;
    }
    try {
      await runGh(["pr", "update-branch", String(pr.number)]);
      log("update", `PR #${pr.number} branch updated (was BEHIND)`);
    } catch (err) {
      log("update", `update-branch failed for PR #${pr.number}: ${err.message}`);
    }
  }
}

async function drain() {
  if (running || queue.length === 0 || queuePaused) return;

  // Nightly cutoff — refuse to start a new prompt past STOP_AT. The
  // in-flight prompt (if any, called from inside an existing session) is
  // unaffected; this is purely a gate before pulling the next one.
  if (isPastStopTime()) {
    log("STOP_AT", `past cutoff ${STOP_AT}, ${queue.length} prompt(s) left in queue`);
    log("STOP_AT", "queued prompts stay in docs/pr-prompts/ — next run will pick them up");
    process.exit(0);
  }

  running = true;
  await sweepOrphanWorktrees();
  const filePath = queue.shift();
  fixLanePaths.delete(filePath);
  const name = path.basename(filePath);
  deferredNames.delete(name); // no longer deferred: we are processing it now

  let promptBody;
  try {
    promptBody = await readFile(filePath, "utf-8");
  } catch (err) {
    log("error", `could not read ${name}: ${err.message}`);
    seen.delete(name);
    running = false;
    drain();
    return;
  }

  // Dependency gating: unmet front-matter dependencies defer the prompt.
  // The file is NOT consumed — it leaves `seen` so the periodic rescan
  // re-checks it on the next walk.
  const deps = parseWatcherFrontMatter(promptBody);
  if (hasDeclaredDependencies(deps)) {
    const unmet = await unmetDependencies(deps);
    if (unmet.length > 0) {
      log("deps", `${name} deferred: ${unmet.join("; ")} — re-check next rescan`);
      deferredNames.add(name);
      writeQueueState(); // publish immediately so the watchdog sees runnable=0 promptly
      seen.delete(name);
      running = false;
      drain();
      return;
    }
    deferredNames.delete(name); // gate opened — no longer deferred
    log("deps", `${name}: all dependencies met (merged: [${deps.requiresMerged.join(", ")}], files: ${deps.requiresFilesOnMain.length}, on-main: ${deps.requiresOnMain.length})`);
  }

  if (DRY_RUN) {
    log("dry-run", `${name}: would run ${CLAUDE_BIN} --print --max-turns ${MAX_TURNS} (${promptBody.length} bytes); file NOT consumed`);
    // Keep `name` in `seen` so dry-run doesn't re-log the same prompt forever.
    running = false;
    drain();
    return;
  }

  log("start", `${name} (max-turns=${MAX_TURNS})`);
  const startedAt = ts();
  // Wall-clock start of THIS run in ms. Used by holdForMarco to detect prompts that
  // re-fired against a PR that was created by an earlier run — those must NOT
  // re-apply the do-not-merge label (see decideEscalationAction).
  const runStartedAtMs = Date.now();
  const chunks = [];
  let lastLine = "";

  const child = spawn(
    CLAUDE_BIN,
    [
      "--print",
      "--max-turns",
      String(MAX_TURNS),
      "--dangerously-skip-permissions",
      "--verbose",
    ],
    {
      cwd: REPO_ROOT,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  currentChild = child;
  if (child.pid) {
    await recordChildPid(child.pid);
  }

  child.stdin.write(promptBody);
  child.stdin.end();

  const trackLastLine = (c) => {
    const lines = c.toString("utf-8").split(/\r?\n/).filter((l) => l.trim());
    if (lines.length > 0) lastLine = lines[lines.length - 1];
  };

  child.stdout.on("data", (c) => {
    process.stdout.write(c);
    chunks.push(c);
    trackLastLine(c);
  });
  child.stderr.on("data", (c) => {
    process.stderr.write(c);
    chunks.push(c);
    trackLastLine(c);
  });

  let runTimedOut = false;
  startHeartbeat(name, () => lastLine, () => {
    runTimedOut = true;
    // Reuse the existing safe kill path — never taskkill /IM (LL-33).
    killCurrentChildTree();
  });

  child.on("close", async (code) => {
    stopHeartbeat();
    if (child.pid) await removeChildPid(child.pid);
    if (currentChild === child) currentChild = null;
    const endedAt = ts();
    const agentOutput = Buffer.concat(chunks).toString("utf-8");
    const header = [
      `# ${name}`,
      `Started: ${startedAt}`,
      `Ended:   ${endedAt}`,
      `Exit:    ${code}`,
      "",
      "---",
      "",
    ].join("\n");
    let logBody = header + agentOutput;

    // Per-run wall-clock watchdog fired. Quarantine THIS prompt only and
    // keep draining the queue — a single hung run must not freeze the tail
    // (decoupled from pauseQueue, which is reserved for CI-red cascades).
    if (runTimedOut) {
      const capMin = RUN_TIMEOUT_MS / 60000;
      const dest = path.join(BLOCKED_DIR, name);
      const logDest = path.join(BLOCKED_DIR, `${name}.log`);
      const noteDest = path.join(BLOCKED_DIR, `${name}.run-timeout.md`);
      const note = [
        `# Run-timeout — ${name}`,
        ``,
        `Started: ${startedAt}`,
        `Killed:  ${endedAt}`,
        `Cap:     ${capMin} min (PR_WATCHER_RUN_TIMEOUT_MIN=${capMin})`,
        `Exit:    ${code}`,
        ``,
        `The watcher's per-run wall-clock watchdog fired: the spawned child`,
        `had not exited after ${capMin} minutes. The watcher killed the child`,
        `tree via killCurrentChildTree() and parked the prompt so the queue`,
        `keeps draining. Investigate before re-queuing.`,
        ``,
      ].join("\n");
      try {
        await rename(filePath, dest);
        await writeFile(logDest, logBody);
        await writeFile(noteDest, note, "utf-8");
        log("BLOCKED", `${name} → blocked/ (run-timeout after ${capMin} min)`);
      } catch (err) {
        log("error", `run-timeout move failed: ${err.message}`);
      }
      seen.delete(name);
      running = false;
      drain();
      return;
    }

    // Review job failures must not freeze the authoring pipeline.
    const reviewJob = isReviewJob(name);

    // Agent failed. Two failure shapes:
    //   (a) Usage / rate limit — transient, will recover. Keep prompt
    //       queued, write a soft-halt log next to it, exit watcher cleanly.
    //       On next start (after the limit resets), it gets picked up again.
    //   (b) Real failure — move to failed/ with the log. If auto-merge mode
    //       and NOT a review job, pause downstream; otherwise continue.
    if (code !== 0) {
      if (isUsageLimitError(agentOutput)) {
        // (a) Soft halt — usage/rate limit detected
        const softLogDest = path.join(PROMPT_DIR, `${name}.usage-limit.log`);
        try {
          await writeFile(softLogDest, logBody);
        } catch (err) {
          log("error", `could not write soft-halt log: ${err.message}`);
        }
        log("USAGE_LIMIT", `${name} hit a usage/rate limit (exit ${code})`);
        log("USAGE_LIMIT", `prompt left in docs/pr-prompts/ — restart watcher after limit resets`);
        log("USAGE_LIMIT", `soft-halt log: ${path.relative(REPO_ROOT, softLogDest)}`);
        seen.delete(name);
        running = false;
        // Exit code 2 = "soft halt, retry later" (distinct from 1 = real fail)
        process.exit(2);
      }

      // Transient failure? One automatic retry — prompt stays in place.
      if (maybeRetryTransient(name, agentOutput)) {
        running = false;
        drain();
        return;
      }

      // (b) Real failure — quarantine: move to failed/ with .log + report,
      // then either pause or continue
      const dest = path.join(FAILED_DIR, name);
      const logDest = path.join(FAILED_DIR, `${name}.log`);
      try {
        await rename(filePath, dest);
        await writeFile(logDest, logBody);
        log("FAIL", `${name} → failed/ (exit ${code})`);
      } catch (err) {
        log("error", `move failed: ${err.message}`);
      }
      await writeQuarantineReport(name, agentOutput, extractPrNumber(agentOutput));
      seen.delete(name);
      // Review job failures do not pause the authoring pipeline.
      if (AUTO_MERGE && !reviewJob) {
        await pauseQueue(`agent exited ${code} on ${name}`);
        running = false;
        return;
      }
      running = false;
      drain();
      return;
    }

    // Agent succeeded — review jobs mirror their verdict file into a PR
    // comment (remote-ops: readable from the GitHub mobile app). Restarting
    // the watcher mid-job can rarely re-run a review and post a duplicate
    // comment — accepted, simpler than tracking mirrored PRs in state.
    if (reviewJob) {
      // PIPELINE GUARD 1: validate the verdict against the actual PR file list
      // before mirroring. A stale watcher clone can cause the review agent to
      // cite files from local main that are not in the PR under review. Those
      // phantom references are detected here and the verdict is quarantined to
      // blocked/ rather than mirrored — keeping the false verdict off GitHub.
      const reviewPrNum = reviewJobPrNumber(name);
      let guardBlocked = false;
      if (reviewPrNum != null) {
        try {
          const guardPrFiles = await prFileList(reviewPrNum);
          const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${reviewPrNum}-review.md`);
          let verdictText = "";
          try {
            verdictText = await readFile(verdictPath, "utf-8");
          } catch {
            // verdict file not found — guard cannot run; let mirror proceed
            verdictText = "";
          }
          if (verdictText) {
            const guardResult = validateVerdict({ verdictText, prFiles: guardPrFiles });
            if (!guardResult.ok) {
              guardBlocked = true;
              log("verdict-guard", `PR #${reviewPrNum}: verdict cites files not in PR — blocking mirror, moving to blocked/`);
              const dest = path.join(BLOCKED_DIR, name);
              const logDest = path.join(BLOCKED_DIR, `${name}.log`);
              const noteDest = path.join(BLOCKED_DIR, `${name}.guard-block.md`);
              const note = [
                `# Verdict-guard block — ${name}`,
                ``,
                `Blocked: ${ts()}`,
                `PR: #${reviewPrNum}`,
                ``,
                `The verdict named the following file(s) that are NOT in PR #${reviewPrNum}:`,
                ``,
                ...guardResult.unmatched.map((p) => `  - ${p}`),
                ``,
                `This usually means the review agent ran against a stale local main`,
                `(syncMain() only advances inside the AUTO_MERGE block for non-gated PRs).`,
                ``,
                `Action: re-queue this review prompt after the watcher clone is updated,`,
                `or remove the phantom file references from the verdict and re-queue.`,
                ``,
              ].join("\n");
              try {
                await mkdir(BLOCKED_DIR, { recursive: true });
                await rename(filePath, dest);
                await writeFile(logDest, logBody, "utf-8");
                await writeFile(noteDest, note, "utf-8");
              } catch (mvErr) {
                log("error", `verdict-guard move to blocked/ failed: ${mvErr.message}`);
              }
            }
          }
        } catch (guardErr) {
          // Guard infrastructure failure (e.g. gh call failed). Log and
          // proceed — the guard failing open is better than silently dropping
          // legitimate verdicts. The phantom-file defect is a quality issue,
          // not a security issue.
          log("verdict-guard", `guard check failed for PR #${reviewPrNum}: ${guardErr.message} — proceeding with mirror`);
        }
      }

      if (guardBlocked) {
        seen.delete(name);
        running = false;
        drain();
        return;
      }

      await mirrorVerdictToPr(name);
    }

    // For review jobs skip the entire AUTO_MERGE block.
    // A review job's output mentions the PR it reviewed; running auto-merge
    // on that number would violate the manual-review gate.
    let mergeReport = "";
    if (AUTO_MERGE && !reviewJob) {
      const prNumber = extractPrNumber(agentOutput);
      if (prNumber == null) {
        // Agent exited 0 but never opened a PR.
        //
        // Case 1: agent declared NO-OP: — a legitimate no-PR outcome.
        // File to processed/ so it doesn't get re-queued or triage-labelled.
        // The check is case-sensitive and allows optional leading whitespace,
        // matching the "NO-OP: <one-line reason>" convention from the doctrine.
        const noOpMatch = agentOutput.split(/\r?\n/).some((line) =>
          /^\s*NO-OP:/.test(line),
        );
        if (noOpMatch) {
          const dest = path.join(PROCESSED_DIR, name);
          const logDest = path.join(PROCESSED_DIR, `${name}.log`);
          const noOpReason = "WATCHER: agent reported NO-OP — filed to processed/ (no PR needed).";
          try {
            await rename(filePath, dest);
            await writeFile(logDest, `${noOpReason}\n\n${logBody}`);
            log("NO-PR", `${name} → processed/ (agent said NO-OP — legitimate no-PR outcome)`);
          } catch (err) {
            log("error", `move no-op to processed/: ${err.message}`);
          }
          seen.delete(name);
          running = false;
          drain();
          return;
        }

        // Case 2: NO_PR_RESTAGE is enabled — bounded auto-restage (up to 3 attempts).
        if (NO_PR_RESTAGE) {
          const nextName = nextRestageName(name);
          if (nextName !== null) {
            // Attempt available — rename in PROMPT_DIR so the watcher re-arms it.
            const nextFilePath = path.join(PROMPT_DIR, nextName);
            const logDest = path.join(PROMPT_DIR, `${nextName}.log`);
            const attemptLabel = nextName.match(/-b-ready\.md$/i) ? "2 (b)" : "3 (c)";
            try {
              await rename(filePath, nextFilePath);
              await writeFile(logDest, `WATCHER: restage attempt ${attemptLabel} — prior run opened no PR.\n\n${logBody}`);
              log("NO-PR", `${name} → ${nextName} (no PR found — attempt ${attemptLabel})`);
            } catch (err) {
              log("error", `restage rename failed: ${err.message}`);
            }
            seen.delete(name);
            enqueue(nextName, { source: "no-pr-restage" });
            running = false;
            drain();
            return;
          }

          // Bound exhausted (this was attempt 3) — hard failure to failed/.
          const dest = path.join(FAILED_DIR, name);
          const logDest = path.join(FAILED_DIR, `${name}.log`);
          const failReason =
            "WATCHER: agent exited 0 but opened no PR on all 3 attempts — " +
            "quarantined to failed/ for manual review.";
          try {
            await rename(filePath, dest);
            await writeFile(logDest, `${failReason}\n\n${logBody}`);
            log("FAIL", `${name} → failed/ (no PR opened on 3 attempts — hard failure)`);
          } catch (err) {
            log("error", `move no-pr hard-fail: ${err.message}`);
          }
          await writeQuarantineReport(name, agentOutput, null);
          seen.delete(name);
          if (AUTO_MERGE && !reviewJob) {
            await pauseQueue(`${name}: no PR opened after 3 attempts`);
            running = false;
            return;
          }
          running = false;
          drain();
          return;
        }

        // Case 3: NO_PR_RESTAGE disabled — legacy fallback: file to no-pr-opened/.
        const reason =
          "WATCHER: agent exited 0 but no PR number was found in its output — " +
          "filed to no-pr-opened/ for manual review, NOT treated as success.";
        const dest = path.join(NO_PR_DIR, name);
        const logDest = path.join(NO_PR_DIR, `${name}.log`);
        try {
          await rename(filePath, dest);
          await writeFile(logDest, `${reason}\n\n${logBody}`);
          log("NO-PR", `${name} → no-pr-opened/ (agent exited 0 but no PR number found)`);
        } catch (err) {
          log("error", `move no-pr: ${err.message}`);
        }
        seen.delete(name);
        running = false;
        drain();
        return;
      } else {
        log("merge", `${name}: opened PR #${prNumber}, policy=${AUTO_MERGE_POLICY}, waiting…`);
        // escalates:true short-circuits BOTH merge paths — the flag means a human decides, so
        // auto-merge is never enabled regardless of AUTO_MERGE_POLICY.
        const result = deps.escalates
          ? await holdForMarco(prNumber, name, runStartedAtMs)
          : AUTO_MERGE_POLICY === "tests-docs"
            ? await waitForPolicyMerge(prNumber)
            : await waitForMerge(prNumber, name);
        mergeReport = `\n\n---\n[watcher] merge result for PR #${prNumber}: ${JSON.stringify(result)}\n`;

        if (result.spent) {
          // PR pre-existed this run — the agent's re-run found the same PR and would
          // otherwise trip the merge-step side effects (re-label, re-comment). Bail
          // out cleanly: file the prompt as processed with the "spent" note in the
          // log, and take no other action on the PR.
          log("merge", `${name}: PR #${prNumber} spent (${result.reason}) — moving prompt to processed/ with no action`);
          logBody = logBody + mergeReport;
          const dest = path.join(PROCESSED_DIR, name);
          const logDest = path.join(PROCESSED_DIR, `${name}.log`);
          try {
            await rename(filePath, dest);
            await writeFile(logDest, logBody);
            log("ok", `${name} → processed/ (spent — PR pre-existed this run)`);
          } catch (err) {
            log("error", `move ok (spent): ${err.message}`);
          }
          seen.delete(name);
          running = false;
          drain();
          return;
        }

        if (!result.ok && result.marco) {
          // tests-docs: PR doesn't qualify for auto-merge — leave it open for
          // Marco, file the prompt as processed (the agent's work succeeded).
          log("merge", `${name}: PR #${prNumber} stays for Marco (${result.reason})`);
        } else if (!result.ok && (result.ci || result.reason?.startsWith("ci-"))) {
          // CI landed red — failure quarantine (one transient retry first).
          let checksOut = "";
          try {
            checksOut = await runGh(["pr", "checks", String(prNumber)], { allowNonZero: true });
          } catch (err) {
            checksOut = err.message;
          }
          if (maybeRetryTransient(name, `${result.reason} ${result.check ?? ""}\n${checksOut}`)) {
            running = false;
            drain();
            return;
          }
          const dest = path.join(FAILED_DIR, name);
          const logDest = path.join(FAILED_DIR, `${name}.log`);
          try {
            await rename(filePath, dest);
            await writeFile(logDest, logBody + mergeReport);
            log("FAIL", `${name} → failed/ (PR #${prNumber} CI red: ${result.reason} on ${result.check ?? "?"})`);
          } catch (err) {
            log("error", `move failed: ${err.message}`);
          }
          await writeQuarantineReport(name, agentOutput, prNumber);
          seen.delete(name);
          await pauseQueue(`PR #${prNumber} CI red: ${result.reason}`);
          running = false;
          return;
        } else if (!result.ok) {
          // Timeout / closed-without-merge — move to blocked/ + pause downstream
          const dest = path.join(BLOCKED_DIR, name);
          const logDest = path.join(BLOCKED_DIR, `${name}.log`);
          try {
            await rename(filePath, dest);
            await writeFile(logDest, logBody + mergeReport);
            log("BLOCKED", `${name} → blocked/ (PR #${prNumber}: ${result.reason})`);
          } catch (err) {
            log("error", `move blocked: ${err.message}`);
          }
          seen.delete(name);
          await pauseQueue(`PR #${prNumber} blocked: ${result.reason}`);
          running = false;
          return;
        } else {
          // Merged — sync local main before next prompt
          try {
            await syncMain();
          } catch (err) {
            log("sync", `WARNING: main sync failed: ${err.message} — next prompt may run on stale base`);
          }
        }
      }
    }

    // Success path — move to processed/
    logBody = logBody + mergeReport;
    const dest = path.join(PROCESSED_DIR, name);
    const logDest = path.join(PROCESSED_DIR, `${name}.log`);
    try {
      await rename(filePath, dest);
      await writeFile(logDest, logBody);
      log("ok", `${name} → processed/`);
    } catch (err) {
      log("error", `move ok: ${err.message}`);
    }

    seen.delete(name);
    running = false;
    drain();
  });

  child.on("error", async (err) => {
    stopHeartbeat();
    if (child.pid) await removeChildPid(child.pid);
    if (currentChild === child) currentChild = null;
    log("error", `spawn failed: ${err.message}`);
    seen.delete(name);
    running = false;
    drain();
  });
}

async function scanExisting() {
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name)) enqueue(name, { source: "startup-scan" });
    }
  } catch (err) {
    log("error", `initial scan: ${err.message}`);
  }
}

// Preflight: warn (loudly, with the greppable tag `untracked-ready-prompt`)
// for any top-level *-ready.md / *-HOLD.md sitting in PROMPT_DIR that is
// UNTRACKED in the enclosing git repo. Warning only — the watcher will still
// dispatch an untracked -ready.md; the queue path is unchanged. Returns the
// count so main() can fold it into the preflight summary.
async function warnOnUntrackedReadyPrompts() {
  let porcelain;
  try {
    porcelain = await new Promise((resolve, reject) => {
      const out = [];
      const err = [];
      const child = spawn(
        "git",
        ["-C", PROMPT_DIR, "ls-files", "--others", "--exclude-standard", "--", "."],
        { shell: true },
      );
      child.stdout.on("data", (c) => out.push(c));
      child.stderr.on("data", (c) => err.push(c));
      child.on("error", reject);
      child.on("close", (code) => {
        if (code !== 0) {
          return reject(new Error(Buffer.concat(err).toString("utf-8").trim() || `exit ${code}`));
        }
        resolve(Buffer.concat(out).toString("utf-8"));
      });
    });
  } catch (e) {
    log("watcher", `untracked-prompt scan skipped: ${e.message}`);
    return 0;
  }

  const names = parseUntrackedReadyPrompts(porcelain);
  if (names.length === 0) return 0;

  log(
    "WARN",
    `untracked-ready-prompt: ${names.length} ready/HOLD prompt(s) in ${PROMPT_DIR} are UNTRACKED in git. ` +
      `Untracked prompts are invisible to worktree stations, lost on \`git clean\`, and can be STASHED AWAY ` +
      `by start-watcher.ps1 (git stash push --include-untracked) when the tracked tree is dirty. ` +
      `Commit each to origin/main via a docs-only PR to make it real. Files: ${names.join(", ")}`,
  );
  for (const n of names) {
    log("WARN", `untracked-ready-prompt: ${n}`);
  }
  return names.length;
}

// Periodic rescan — fallback for fs.watch events lost by the OS. Walks
// the watched directory and queues any -ready.md file not already seen.
// The `seen` Set covers both queued and in-flight prompts, so the dedupe
// in `enqueue` makes this safely idempotent.
async function rescan() {
  if (queuePaused) return;
  try {
    const entries = await readdir(PROMPT_DIR);
    for (const name of entries) {
      if (isReady(name) && !seen.has(name)) {
        enqueue(name, { source: "rescan" });
      }
    }
  } catch (err) {
    log("error", `rescan: ${err.message}`);
  }
  // Idle poll cycle also sweeps settled verdicts so a long-running watcher
  // doesn't accumulate untracked pr-*-review.md files in the clone tree.
  await runArchiveSettledVerdicts();
  // Publish fresh queue state after every rescan so the watchdog has an
  // up-to-date view of what this node can actually dequeue.
  await writeQueueState();
}

// Informational scan for stray claude.exe processes. We do NOT auto-kill —
// Marco runs interactive Claude Code / Cowork sessions whose PIDs are
// indistinguishable from a leaked watcher child by image name alone. The
// only PIDs the watcher ever terminates are the ones it spawned itself and
// recorded in CHILDREN_FILE (reapPreviousChildren / killCurrentChildTree).
// This warning is purely informational: surface the count so Marco can
// decide whether to clean them up by hand.
// Sweep stray empty folders at repo root whose name is a literal Windows
// absolute path with collapsed backslashes — e.g. "C:ProjectOperations2docspr-reviews".
// These appear when an agent runs `mkdir C:\ProjectOperations2\docs\...` in bash
// (backslashes are escape chars, so the path collapses to one literal name).
// SAFETY: only matches names starting with "C:ProjectOperations2" AND only
// removes them when empty. Legitimate paths never start with "C:".
async function sweepMalformedLiteralPathDirs() {
  // Match the malformed-path family. The leading "C:" can survive as a
  // literal colon, get stripped entirely, or get encoded by Windows as a
  // Private Use Area codepoint (0xF03A) since ":" is reserved in NTFS
  // filenames. Allow any single non-alphanumeric char (or none) between
  // "C" and "ProjectOperations2".
  const MALFORMED = /^C[^A-Za-z0-9]?ProjectOperations2/;
  try {
    const entries = await readdir(REPO_ROOT);
    for (const name of entries) {
      if (!MALFORMED.test(name)) continue;
      const full = path.join(REPO_ROOT, name);
      try {
        const s = await stat(full);
        if (!s.isDirectory()) continue;
        const inner = await readdir(full);
        if (inner.length !== 0) {
          log("watcher", `sweep: skipping non-empty malformed dir "${name}" (${inner.length} entries)`);
          continue;
        }
        await rmdir(full);
        log("watcher", `sweep: removed empty malformed literal-path dir "${name}"`);
      } catch (err) {
        log("watcher", `sweep: could not inspect "${name}": ${err.message}`);
      }
    }
  } catch (err) {
    log("watcher", `sweep skipped: ${err.message}`);
  }
}

function warnOnOrphanClaudeProcesses() {
  if (process.platform !== "win32") return;
  try {
    const out = execFileSync(
      "tasklist",
      ["/FI", "IMAGENAME eq claude.exe", "/FO", "CSV", "/NH"],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const pids = [];
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^"claude\.exe","(\d+)"/i);
      if (m) pids.push(Number(m[1]));
    }
    if (pids.length > 0) {
      log(
        "WARN",
        `found ${pids.length} claude.exe process(es) running (PIDs: ${pids.join(", ")}). These may be interactive sessions — NOT auto-killed. Inspect manually if you suspect leaks.`,
      );
    }
  } catch (err) {
    log("watcher", `orphan check skipped: ${err.message}`);
  }
}

async function main() {
  await acquireLock();
  await ensureDirs();
  log("watcher", `repo:        ${REPO_ROOT}`);
  log("watcher", `prompt-dir:  ${PROMPT_DIR}`);
  log("watcher", `watching     ${PROMPT_DIR}`);
  log("watcher", `pattern:     (pr|rev)-*-ready.md`);
  log("watcher", `claude:      ${CLAUDE_BIN}`);
  log("watcher", `gh:          ${GH_BIN}`);
  log("watcher", `max-turns:   ${MAX_TURNS}`);
  log("watcher", `merge-pol:   ${AUTO_MERGE_POLICY}`);
  log("watcher", `merge-tmout: ${MERGE_TIMEOUT_MS / 60000} min`);
  log("watcher", `run-tmout:   ${RUN_TIMEOUT_MS > 0 ? `${RUN_TIMEOUT_MS / 60000} min` : "OFF"}`);
  log("watcher", `poll-every:  ${POLL_INTERVAL_MS / 1000} s`);
  log("watcher", `rescan:      ${RESCAN_INTERVAL_MS / 60000} min`);
  log("watcher", `auto-review: ${AUTO_REVIEW ? "ON" : "OFF"}`);
  log("watcher", `auto-update: ${AUTO_UPDATE ? `ON (every ${UPDATE_POLL_INTERVAL_MS / 1000} s)` : "OFF"}`);
  log("watcher", `transient:   ${TRANSIENT_PATTERNS.length} retry signature(s)`);
  if (DRY_RUN) {
    log("watcher", `dry-run:     ON — no claude runs, no mutating gh calls, no file moves`);
  }
  if (STOP_AT_TIMESTAMP !== null) {
    const cutoffIso = new Date(STOP_AT_TIMESTAMP).toISOString();
    const minsFromNow = Math.round((STOP_AT_TIMESTAMP - Date.now()) / 60000);
    log("watcher", `stop-at:     ${STOP_AT} → ${cutoffIso} (~${minsFromNow} min from now)`);
  } else {
    log("watcher", `stop-at:     (none — runs until queue empty or SIGINT)`);
  }

  warnOnOrphanClaudeProcesses();
  await sweepMalformedLiteralPathDirs();
  await reapPreviousChildren();
  await sweepOrphanWorktrees();

  const untrackedCount = await warnOnUntrackedReadyPrompts();
  log("watcher", `preflight: untracked-ready-prompt count = ${untrackedCount}`);

  await runArchiveSettledVerdicts();

  await scanExisting();
  await writeQueueState(); // publish initial state after startup scan

  const watcher = fsWatch(PROMPT_DIR, { persistent: true }, (event, name) => {
    if (!name) return;
    debouncedEnqueue(name);
  });

  watcher.on("error", (err) => log("error", `fs.watch: ${err.message}`));

  const rescanTimer = setInterval(rescan, RESCAN_INTERVAL_MS);

  // Auto-review: load template, seed reviewed-set, start poll loop
  let reviewPollTimer = null;
  if (AUTO_REVIEW) {
    const templateOk = await loadReviewTemplate();
    if (templateOk) {
      reviewedSet = await loadReviewedSet();
      reviewedSet = await seedReviewedSet(reviewedSet);
      reviewPollTimer = setInterval(pollForNewPrs, REVIEW_POLL_INTERVAL_MS);
      log("review", `poll-every:  ${REVIEW_POLL_INTERVAL_MS / 1000} s, min-age: ${REVIEW_MIN_AGE_MS / 60000} min`);
    }
  }

  // Auto-update-branch poll loop
  let updatePollTimer = null;
  if (AUTO_UPDATE) {
    updatePollTimer = setInterval(pollForBehindPrs, UPDATE_POLL_INTERVAL_MS);
    pollForBehindPrs(); // immediate first pass
  }

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("watcher", `shutting down (${signal})`);
    clearInterval(rescanTimer);
    if (reviewPollTimer) clearInterval(reviewPollTimer);
    if (updatePollTimer) clearInterval(updatePollTimer);
    stopHeartbeat();
    try {
      watcher.close();
    } catch {
      // best-effort
    }
    killCurrentChildTree();
    releaseLock();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("exit", () => {
    // Last-ditch: only runs on a clean event-loop drain. We've usually
    // already gone through `shutdown(...)`, but if something called
    // process.exit() directly we still want to kill our tracked child.
    if (!shuttingDown) {
      killCurrentChildTree();
      releaseLock();
    }
  });
}

// Only start the daemon when executed directly. Importing this module (the
// unit-style logic tests do `await import(...)`) must NOT start a watcher.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
