#!/usr/bin/env node
// merge-queue.mjs - sequential, fail-safe PR merger for ProjectOperations.
//
// For each PR number, in the order given:
//   1. GUARD: refuse if the PR is on NEVER_MERGE, carries a hold label, or is
//      otherwise blocked by policy (see refusalFor() below). These checks run
//      before any network call that could mutate state.
//   2. if already MERGED -> skip
//   3. if BEHIND main     -> gh pr update-branch (merge commit, not rebase)
//   4. wait until all checks are green AND it is mergeable
//   5. squash-merge it
//   6. confirm state == MERGED before moving to the next PR
//
// Stops immediately (non-zero exit) on: a failing check, a real merge
// conflict, or a BLOCKED state (needs an approving review / permission).
// Nothing is merged out of order and the next PR never starts until the
// previous one is confirmed merged.
//
// Requires: the gh CLI, authenticated - the same environment the watcher uses.
//
// Usage:
//   node scripts/pr-watcher/merge-queue.mjs 417 418 419 420 421 422 423 424 416
//   node scripts/pr-watcher/merge-queue.mjs --dry-run 417 418
//   node scripts/pr-watcher/merge-queue.mjs 425          # after fixing its body marker
//
// Self-heal: a FAILED required check does NOT immediately abort. Once per PR,
// the queue re-runs the failed jobs (`gh run rerun <id> --failed`) and re-enters
// the wait loop. If the re-run still fails, the queue stops without merging.
// This auto-clears transient flakes (e.g. tendering-e2e webkit) while still
// refusing genuine failures.
//
// Tunables (env): MERGE_POLL_SEC (30), MERGE_TIMEOUT_MIN (60),
//   MERGE_METHOD (squash|merge|rebase), PR_WATCHER_GH_BIN (gh),
//   PR_WATCHER_NEVER_MERGE (comma-separated PR numbers, overrides the default list).
//
// NEVER_MERGE list:
//   The default list is sourced from docs/pipeline/DOCTRINE.md §8.3 merge policy.
//   It contains PRs that must never be auto-merged regardless of their check status
//   (e.g. production-data writes, real-identity PRs that need a human at the keyboard).
//   Override at runtime with PR_WATCHER_NEVER_MERGE=552,538 for testing.
//   Note: the PowerShell equivalents (pipeline-lib.ps1, merge-queue.ps1,
//   enable-automerge.ps1, monitor-board.ps1) carry divergent copies of this list;
//   see PR body for the flagged follow-up on reconciling them.
//
// HOLD LABELS:
//   A PR carrying any of: do-not-merge, needs-marco, hold  is refused before merge.
//   Labels are read per-PR with `gh pr view <n> --json labels` — NOT from a board
//   listing, which renders labels empty (LL-47). A label-read failure is a REFUSAL,
//   not a pass — an unreadable label set is exactly the state in which we must not merge.
//
// escalates: true:
//   A prompt's `escalates: true` flag causes the watcher (index.mjs ~1256) to apply
//   the `do-not-merge` label to the PR it opens. This queue's hold-label check (above)
//   already covers that case — if the label is present, the PR is refused. We do NOT
//   attempt to map a PR back to its originating prompt to re-read the flag directly,
//   because no reliable mapping exists in the current system (the prompt filename is not
//   recorded in the PR body or in shepherd-state.md in a machine-parseable form).
//   The honest implementation is the label, and it is documented here so the next
//   reader stops looking for a separate escalates check.

import { execFileSync } from "node:child_process";

const GH = process.env.PR_WATCHER_GH_BIN || "gh";
const POLL_SEC = Number(process.env.MERGE_POLL_SEC || 30);
const TIMEOUT_MIN = Number(process.env.MERGE_TIMEOUT_MIN || 60);
const MERGE_METHOD = process.env.MERGE_METHOD || "squash";

// ---------------------------------------------------------------------------
// NEVER_MERGE list
// Default: empty — both #552 (production-data) and #538 (real-identity) were
// discharged and merged before 2026-07-14. Three PowerShell scripts still carry
// @(552, 538); pipeline-lib.ps1 was already corrected to empty. The JS queue
// starts empty to match the library and avoid refusing PRs that no longer exist.
// Override with env PR_WATCHER_NEVER_MERGE=552,538 to restore for testing.
// See §8.3 of docs/pipeline/DOCTRINE.md for the merge-policy statement that
// governs what belongs on this list.
// ---------------------------------------------------------------------------
function buildNeverMergeList() {
  const env = process.env.PR_WATCHER_NEVER_MERGE;
  if (env != null && env.trim() !== "") {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
  }
  // Default: empty — see comment above.
  return [];
}

const NEVER_MERGE = buildNeverMergeList();

// Hold labels: any PR carrying one of these is refused before merge.
const HOLD_LABELS = new Set(["do-not-merge", "needs-marco", "hold"]);

// ---------------------------------------------------------------------------
// refusalFor — pure policy function, no side effects, no network calls.
//
// Parameters:
//   pr         : number — the PR number
//   labels     : string[] | null — label names read from `gh pr view --json labels`,
//                or null if the read FAILED (fail-closed: treated as a refusal).
//   neverMerge : number[] — the NEVER_MERGE list (defaults to module-level constant)
//
// Returns:
//   null            — PR may proceed to the merge loop
//   string          — a reason string (non-empty); the caller must refuse with exit 1
// ---------------------------------------------------------------------------
export function refusalFor({ pr, labels, neverMerge = NEVER_MERGE }) {
  // 1. Never-merge list check — cheapest and most catastrophic; runs first.
  if (neverMerge.includes(pr)) {
    return (
      `PR #${pr} is on the NEVER_MERGE list and must not be auto-merged. ` +
      `Remove it from the list only after Marco's explicit approval.`
    );
  }

  // 2. Label-read failure — fail closed.
  //    labels === null means the gh call threw or returned unparseable JSON.
  //    An unreadable label set is exactly the state in which we must not merge.
  if (labels === null) {
    return (
      `PR #${pr}: label read failed — cannot verify hold status. ` +
      `Refusing to merge until labels are readable.`
    );
  }

  // 3. Hold labels — do-not-merge, needs-marco, hold.
  //    Note: `escalates: true` in the originating prompt causes index.mjs to apply
  //    `do-not-merge`; that case is captured here by the label check rather than
  //    by re-reading the prompt flag (no reliable PR-to-prompt mapping exists).
  for (const lbl of labels) {
    if (HOLD_LABELS.has(lbl)) {
      return (
        `PR #${pr} carries the hold label "${lbl}" and must not be auto-merged. ` +
        `This queue never adds, removes, or merges past hold labels. ` +
        `Remove the label only after the hold condition is resolved ` +
        `(for do-not-merge: Marco's review; for needs-marco: Marco's sign-off).`
      );
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// readLabels — fetch the label names for a PR.
// Returns string[] on success, null on any failure (fail-closed contract).
// ---------------------------------------------------------------------------
function readLabels(pr) {
  try {
    const raw = gh(["pr", "view", String(pr), "--json", "labels"]);
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.labels)) return null;
    return parsed.labels.map((l) => (typeof l === "string" ? l : l.name));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI guard: if this module is imported (e.g. by tests), the queue must NOT
// auto-execute. The queue runs only when this file is the entry point.
// ---------------------------------------------------------------------------
const IS_MAIN = process.argv[1] &&
  (process.argv[1].endsWith("merge-queue.mjs") ||
   // Support being invoked via `node --test` path resolution on Windows
   process.argv[1].replace(/\\/g, "/").endsWith("merge-queue.mjs"));

const args = IS_MAIN ? process.argv.slice(2) : [];
const dryRun = args.includes("--dry-run");
const prs = args.filter((a) => /^\d+$/.test(a)).map(Number);

if (IS_MAIN && prs.length === 0 && !args.includes("--help")) {
  console.error("No PR numbers given. Example: node merge-queue.mjs 417 418 419");
  process.exit(1);
}

const ts = () => new Date().toISOString();
const log = (m) => console.log(`[${ts()}] ${m}`);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const gh = (a) => execFileSync(GH, a, { encoding: "utf8" });

function view(pr) {
  const out = gh([
    "pr", "view", String(pr), "--json",
    "number,title,state,mergeable,mergeStateStatus,statusCheckRollup,headRefName",
  ]);
  return JSON.parse(out);
}

// Re-run the failed jobs of the most recent workflow run on the PR's head
// branch. Returns true on a successful rerun dispatch; false if no run id was
// resolvable or the rerun command itself failed. Never throws.
function rerunFailedForBranch(pr, headRefName) {
  if (!headRefName) return false;
  try {
    const raw = gh(["run", "list", "--branch", headRefName, "-L", "1", "--json", "databaseId"]);
    const runs = JSON.parse(raw);
    const id = runs && runs[0] && runs[0].databaseId;
    if (!id) { log(`PR #${pr} no run id on branch ${headRefName} to rerun`); return false; }
    gh(["run", "rerun", String(id), "--failed"]);
    log(`PR #${pr} auto-rerun --failed dispatched for run ${id} (branch ${headRefName})`);
    return true;
  } catch (e) {
    log(`PR #${pr} auto-rerun failed: ${String(e.message).split("\n")[0]}`);
    return false;
  }
}

function checks(rollup) {
  let pending = 0, failed = 0, passed = 0;
  for (const c of rollup || []) {
    const status = (c.status || "").toUpperCase();              // QUEUED/IN_PROGRESS/COMPLETED ("" for legacy)
    const concl = (c.conclusion || c.state || "").toUpperCase(); // SUCCESS/FAILURE/... or PENDING
    if (status && status !== "COMPLETED") { pending++; continue; }
    if (["SUCCESS", "NEUTRAL", "SKIPPED"].includes(concl)) passed++;
    else if (["FAILURE", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "ERROR", "STARTUP_FAILURE"].includes(concl)) failed++;
    else pending++;
  }
  return { pending, failed, passed };
}

async function waitReady(pr) {
  const deadline = Date.now() + TIMEOUT_MIN * 60 * 1000;
  let autoRerunUsed = 0; // self-heal budget: at most one auto-rerun per PR
  while (Date.now() < deadline) {
    const d = view(pr);
    if (d.state === "MERGED") return { merged: true };
    if (d.state === "CLOSED") throw new Error(`PR #${pr} is CLOSED (not merged).`);

    const { pending, failed, passed } = checks(d.statusCheckRollup);
    if (failed > 0) {
      if (autoRerunUsed === 0 && !dryRun) {
        log(`PR #${pr} has ${failed} failing check(s) - attempting one auto-rerun before giving up`);
        const ok = rerunFailedForBranch(pr, d.headRefName);
        autoRerunUsed = 1;
        if (ok) { await sleep(POLL_SEC); continue; }
        throw new Error(`PR #${pr} has ${failed} failing check(s) and auto-rerun could not be dispatched. Stopping.`);
      }
      throw new Error(`PR #${pr} has ${failed} failing check(s) after auto-rerun. Stopping - investigate before merging.`);
    }
    if (d.mergeable === "CONFLICTING" || d.mergeStateStatus === "DIRTY")
      throw new Error(`PR #${pr} has merge conflicts - resolve manually, then re-run from #${pr}.`);

    if (d.mergeStateStatus === "BEHIND") {
      log(`PR #${pr} BEHIND main -> update-branch`);
      if (!dryRun) { try { gh(["pr", "update-branch", String(pr)]); } catch (e) { log(`  update-branch: ${String(e.message).split("\n")[0]}`); } }
      await sleep(POLL_SEC); continue;
    }
    if (pending > 0) { log(`PR #${pr} waiting on ${pending} check(s) (${passed} green)`); await sleep(POLL_SEC); continue; }
    if (d.mergeStateStatus === "BLOCKED")
      throw new Error(`PR #${pr} is BLOCKED with green checks (needs an approving review/permission). Approve it, then re-run from #${pr}.`);
    if (d.mergeable === "MERGEABLE" && (d.mergeStateStatus === "CLEAN" || d.mergeStateStatus === "UNSTABLE"))
      return { ready: true };

    log(`PR #${pr} mergeable=${d.mergeable} state=${d.mergeStateStatus}; waiting`);
    await sleep(POLL_SEC);
  }
  throw new Error(`PR #${pr} not ready within ${TIMEOUT_MIN} min. Stopping.`);
}

async function mergeOne(pr) {
  // GUARD PHASE — runs before any state-mutating call.
  const labels = readLabels(pr);
  const reason = refusalFor({ pr, labels });
  if (reason) {
    console.error(`[${ts()}] REFUSED: ${reason}`);
    process.exit(1);
  }

  const d0 = view(pr);
  if (d0.state === "MERGED") { log(`PR #${pr} already MERGED - skipping`); return; }
  log(`=== PR #${pr}: ${d0.title} ===`);

  const r = await waitReady(pr);
  if (r.merged) { log(`PR #${pr} already MERGED`); return; }
  if (dryRun) { log(`[dry-run] would squash-merge #${pr}`); return; }

  log(`PR #${pr} ready -> merging (--${MERGE_METHOD})`);
  try {
    gh(["pr", "merge", String(pr), `--${MERGE_METHOD}`]);
  } catch (e) {
    log(`  merge failed: ${String(e.message).split("\n")[0]} - update-branch + one retry`);
    try { gh(["pr", "update-branch", String(pr)]); } catch {}
    await sleep(POLL_SEC);
    gh(["pr", "merge", String(pr), `--${MERGE_METHOD}`]);
  }

  const cdl = Date.now() + 10 * 60 * 1000;
  while (Date.now() < cdl) {
    if (view(pr).state === "MERGED") { log(`PR #${pr} CONFIRMED MERGED`); return; }
    await sleep(Math.max(5, POLL_SEC / 2));
  }
  throw new Error(`PR #${pr} merge was issued but not confirmed MERGED. Stopping.`);
}

if (IS_MAIN) {
  (async () => {
    log(`merge-queue: ${prs.join(", ")}${dryRun ? " (dry-run)" : ""}`);
    for (const pr of prs) await mergeOne(pr);
    log(`done - all ${prs.length} processed.`);
  })().catch((e) => { console.error(`[${ts()}] ERROR: ${e.message}`); process.exit(1); });
}
