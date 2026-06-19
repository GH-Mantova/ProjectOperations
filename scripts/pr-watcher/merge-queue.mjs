#!/usr/bin/env node
// merge-queue.mjs - sequential, fail-safe PR merger for ProjectOperations.
//
// For each PR number, in the order given:
//   1. if already MERGED -> skip
//   2. if BEHIND main     -> gh pr update-branch (merge commit, not rebase)
//   3. wait until all checks are green AND it is mergeable
//   4. squash-merge it
//   5. confirm state == MERGED before moving to the next PR
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
//   MERGE_METHOD (squash|merge|rebase), PR_WATCHER_GH_BIN (gh).

import { execFileSync } from "node:child_process";

const GH = process.env.PR_WATCHER_GH_BIN || "gh";
const POLL_SEC = Number(process.env.MERGE_POLL_SEC || 30);
const TIMEOUT_MIN = Number(process.env.MERGE_TIMEOUT_MIN || 60);
const MERGE_METHOD = process.env.MERGE_METHOD || "squash";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const prs = args.filter((a) => /^\d+$/.test(a)).map(Number);

if (prs.length === 0) {
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

(async () => {
  log(`merge-queue: ${prs.join(", ")}${dryRun ? " (dry-run)" : ""}`);
  for (const pr of prs) await mergeOne(pr);
  log(`done - all ${prs.length} processed.`);
})().catch((e) => { console.error(`[${ts()}] ERROR: ${e.message}`); process.exit(1); });
