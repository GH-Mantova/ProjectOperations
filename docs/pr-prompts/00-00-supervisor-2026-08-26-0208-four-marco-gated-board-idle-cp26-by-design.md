# Station 00 — Supervisor | 2026-08-26 02:08Z–02:20Z

## GROUND

```
UTC            2026-08-26 02:08:40Z
origin/main    8f0377e5
dev tree       main @ 8f0377e5  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority run, not read-only.
NOT BLIND: `start_process` powershell.exe reached `LAPTOP-E6NHU4E4` on the first call.

## WHAT I MEASURED

**Board — 4 open, unchanged from the 00:08Z run.** [MEASURED]
`gh pr list --state open --json number,title,mergeStateStatus,isDraft,headRefName,labels`

| PR | mergeState | labels | head check-runs |
|---|---|---|---|
| #1325 docs(sot-04) B-P0a Job-canonical | UNSTABLE | `do-not-merge` | 6 success / 5 skipped / **1 failure** |
| #1323 feat(pipeline) arm-prompt.ps1 serializer | UNSTABLE | `do-not-merge` | 11 success / **1 failure** |
| #1320 fix(web) gate /crm + /clients behind RequirePermissions | **CLEAN** | none | **12/12 success** |
| #1316 feat(tendering) capacity service + tenders.allocate | **CLEAN** | none | **12/12 success** |

**RULE 2 — all FOUR are watcher-routed to Marco. Reasons read from the live log, not inferred.** [MEASURED]
Probe: `Select-String -Path C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\*.log -Pattern 'PR #(1316|1320|1323|1325) stays for Marco'` → **4 hits, all in `2026-08-24.log`** (the live file, named for the watcher's START date; mtime 02:08Z today).

```
[2026-08-25T07:37:21Z] PR #1316 stays for Marco (outside tests/ or docs/: apps/api/jest.config.ts)
[2026-08-25T09:48:19Z] PR #1320 stays for Marco (outside tests/ or docs/: apps/web/src/App.tsx)
[2026-08-25T12:28:10Z] PR #1323 stays for Marco (escalates:true — held for Marco, labelled do-not-merge)
[2026-08-25T16:29:20Z] PR #1325 stays for Marco (escalates:true — held for Marco, labelled do-not-merge)
```

A label-only check would have MISSED #1316 and #1320 — both carry **no label at all** and are 12/12 green.
That is exactly the half-the-board blind spot; the log probe is the only complete instrument.

**The two reds are CP-26 ALONE, and CP-26 is the gate working.** [MEASURED]
Job logs pulled per DOCTRINE §3 (`gh api …/actions/jobs/<id>/logs`), not read off the PR page.
Both #1323 (job 97987021950) and #1325 (job 97987008696) print ten CP verdict lines. Nine PASS or SKIP.
The tenth, identical on both:

```
FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.]
##[error]Process completed with exit code 1.
```

**There is no defect here to chase.** The gate states its own release condition, and the condition is Marco.

**#1323's cancelled-e2e trap is CLEARED.** [MEASURED] Last run its second red was
`##[error]The operation was canceled.` at 42 s — a cancellation that `gh pr checks` reports as `fail`.
The rerun I fired at 00:08Z completed: #1323's head `d66fb2db` now shows **11 success / 1 failure**, the
one failure being CP-26. The e2e is green.

**Trunk GREEN, read per-commit — never from `status-sweep`'s trunk colour (a measured coin flip).** [MEASURED]
`gh api repos/GH-Mantova/ProjectOperations/commits/8f0377e5…/check-runs` → **total=12, 11 success, 1 skipped, 0 failure.**

**Watcher LIVE, two independent signals agreeing.** [MEASURED]
- Exact-cmdline probe (`pr-watcher[\\/]index\.mjs`): **1 node, pid 29024, up since 2026-08-24 05:35:04Z.**
- `.queue-state.json` **`ts` FIELD** (not mtime) = `2026-08-26T02:08:07.093Z` — current to the second at probe time.
- `status-sweep`: `[LIVE] watcher node: RUNNING pid 29024`, `armed 0`, `blocked/ 0`.

**Wrapper absent — and that is NOT the fault §3b claims.** [MEASURED] `supervise-watcher.ps1` wrapper count = **0**
while node is alive. Station doc §3b would have me relaunch it. **I did not, deliberately** — §3b is a known
defect that starts a SECOND supervisor carrying a kill loop. The real restart cover is the scheduled task
`\PO Watcher Keepalive` → `ensure-watcher.ps1`: **state=Ready, lastRun 02:05:02Z (3 min before probe),
lastResult=0.** Coverage exists; §3b's remedy would have damaged it.

**Nothing mid-flight, nothing wedged.** [MEASURED] No `index.lock` in either tree. No `MERGE_HEAD` /
`REBASE_HEAD` / `CHERRY_PICK_HEAD` / rebase-merge / rebase-apply in the dev tree. **`git.exe` process count = 0.**

**ARMED = 0 at depth 1 in the dev tree** (the tree the watcher globs). [MEASURED] The clone holds 2
`*-ready.md` (`pr-sot-ll36-sot-purity-ready.md`, `rev-1162-ready.md`) — **clone-side ready files are INERT.**
Dev-tree staged index **empty**, so nothing of another chat's is sitting in the shared index.

**COLLECT — the surface is empty, and that is honest, not blind.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **exit 0, CLEAN**; 20 checked, 0 malformed.
The dev tree is at `origin/main` (`rev-list --count HEAD..origin/main` = **0**), so the working-tree
freshness read is trustworthy this run rather than the 24-hour lie it told when the tree was behind.

```
00  last 2026-08-26T00:08Z   2.0h ago  (cadence 2h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-08-25T23:01Z   3.1h ago  (cadence 4h)   ok
04  last 2026-08-25T22:10Z   4.0h ago  (cadence 4h)   ok
05  last 2026-08-25T14:11Z  12.0h ago  (cadence 24h)  ok
```

**No station has reported since my own 00:08Z breadcrumb.** Zero new findings to disposition. Every
station is inside cadence; 04 is due about now and will fire on its own schedule.

## WHAT CHANGED

**Nothing on the board. No merge, no arm, no label, no restart, no dispatch.** `origin/main` is the same
`8f0377e5` it was at 00:08Z; no PR opened or closed; armed stayed 0.

The only writes this run were diagnostic scripts under `C:\po-sup-fix-scripts\` and this breadcrumb.

One instrument correction worth recording: my first probe script used PowerShell `>` redirection into
`gh --json`, which wrote **UTF-16** and made `JSON.parse` die on a BOM. Re-run through `cmd /c`, which is
byte-faithful. The failure looked like malformed GitHub output and was entirely my redirect.

## FINDINGS

### 1. The board is 100% blocked on Marco, and every machine under it is healthy

Four open PRs, all four watcher-routed to him. #1316 and #1320 are **12/12 green and CLEAN** — they would
merge the instant they were released. #1323 and #1325 are green on every gate except CP-26, which is the
human gate itself and which cannot go green until the `do-not-merge` label comes off. Only Marco removes it.

His 2026-08-25 22:10Z batch clearance is **SPENT** — it named #1322/#1319/#1317/#1321, all now closed. A
clearance is for that batch only, so none of these four is cleared, including the two carrying no label.

Watcher live, trunk green, no locks, armed 0, all stations reporting. There is no machine fault to fix.
**The queue is not stuck; it is waiting, correctly, at the one gate an agent may not open.**

**DISPOSITION: ESCALATED** — question for Marco below.

### 2. Arming stays paused, on purpose, and this is the run to say why out loud

I armed nothing. Not because a gate blocked me — three HOLDs are armable on their own merits
(`pr-unified-api-key-vault-slice4c-retire-old-screens` #1111, 11 days old; `pr-rates-consumers-s3-persona-export`
#1257, 5 days; `pr-fv2-maintenance-usage-intervals`) — but because arming now makes things worse.

Every armed prompt produces a PR, and the watcher routes most PRs to Marco. A fifth Marco-gated PR does not
add throughput; it enlarges the batch he must review and, because branch protection requires up-to-date,
**every merge pushes the rest BEHIND and costs ~13 minutes of CI each.** Four PRs already pay that tax.

My resume condition from the 00:08Z run — *#1323 merges, OR Marco-gated open ≤ 2, AND no commit on
origin/main in the preceding 10 min* — is **not met** (Marco-gated = 4, #1323 unmerged). It stands.

**DISPOSITION: DEFERRED** — becomes actionable the moment Marco clears any two of the four.

### 3. Nineteen breadcrumbs are untracked and reach nobody but memory

`check-breadcrumb` tagged 19 of 20 `NOTE … is UNTRACKED — it reaches nobody until a board PR commits it`.
They sit at a tracked *path* but have never been committed, and they accumulate because a board PR is what
sweeps them up — and arming (finding 2) is paused.

I did **not** open a PR to commit them. Two reasons, both binding: **LL-38 — the Supervisor does not create
PRs**; and the watcher auto-merges docs PRs under `tests-docs` **only for PRs its own prompt run opened**, so
a station-chat PR would sit forever and become a fifth stuck PR — the exact harm finding 2 avoids.

This is survivable because **project memory is the primary channel** (STATION-CAPABILITIES §7) and it is
intact. It becomes urgent only if a breadcrumb carries a finding memory does not.

**DISPOSITION: DEFERRED** — clears itself with the next board PR; re-raise if arming stays paused past ~24 h.

### 4. Station doc §3b would have damaged a working restarter tonight

§3b ENSURE-UP instructs an unconditional relaunch of `supervise-watcher.ps1` whenever the wrapper is absent
and node alive — the exact state measured this run. Executing it starts a second supervisor carrying a kill
loop, against a watcher whose restart cover (`\PO Watcher Keepalive`, Ready, lastResult 0, last fired 3
minutes before my probe) is already closed and correct.

The instruction is stale, versioned, and an agent can fix it — but the fix is a repo docs PR, which finding
3 explains I must not open from this chat.

**DISPOSITION: DEFERRED** — staged as work for 06/the next board PR; harmless while every station keeps
checking Keepalive instead of obeying §3b literally.

## WHAT I DID NOT DO

- **Did not merge anything.** All four PRs are watcher-routed; RULE 2 is a human gate separate from the
  label, and it is not overridden by green, by CLEAN, by an absent label, or by a MERGE verdict.
- **Did not remove a `do-not-merge` label** from #1323 or #1325, and did not try to drive CP-26 green.
  CP-26 red **is** the gate. Spending a CI run on it would be spending it to defeat a safety check.
- **Did not arm a HOLD**, though three qualify — see finding 2.
- **Did not relaunch the watcher wrapper** per §3b — see finding 4.
- **Did not restart, kill, or clear anything.** No lock, no wedge, no hang; `restart-watcher-if-wedged`
  reports an idle watcher with 0 armed prompts as CORRECT, not wedged.
- **Did not touch the clone's git** (`dirty=38`, parked on `docs/sot-04-bp0a-job-canonical`). Parked-on-a-
  branch is not corrupt, and the dirt is by-design deletions plus live verdict files.
- **Did not prune the orphaned worktrees** — each holds an unpushed commit.
- **Did not touch Azure / Entra / SharePoint, production data, or `/sot/`.**

---

## FOR MARCO — one decision, and it is the whole board

Everything below the gate is healthy and idle. Four PRs are waiting on you and nothing else can move until
some of them clear. Two are already 12/12 green.

**#1316** (capacity service + `tenders.allocate`) and **#1320** (gate `/crm` and `/clients` behind
`RequirePermissions crm.view`) — **12/12 green, CLEAN, no label.** They are held only by the watcher's
routing rule, because each touches one file outside `tests/` or `docs/` (`apps/api/jest.config.ts` and
`apps/web/src/App.tsx` respectively). Both are additive permission/capability work.

**#1323** (arming serializer — exclusive lock + index guards) and **#1325** (sot-04 B-P0a reversed to
Job-canonical) — green on every gate except CP-26, which fails **because** they carry `do-not-merge`.
#1325 already carries a reviewed **MERGE** verdict. #1323 is the fix for the arming race itself.

Applying **RULE 1** — solve it completely, now and in future, without damaging existing or future data entry:

**Option A (complete + additive — recommended).** Clear all four in one batch: say so in chat for #1316 and
#1320, and remove the `do-not-merge` label from #1323 and #1325. Passes both halves — it unjams the board
completely, and none of the four writes or migrates data (#1323 is pipeline tooling, #1325 is a doc, #1316
and #1320 are additive permission code). It also lands #1323, which permanently removes the arming race
rather than leaving it to recur.

**Option B (partial).** Clear only #1323 first, then the rest next cycle. Fails the *complete* half — it
leaves three PRs stuck and pays the update-branch CI tax twice. Safe on data.

**Option C (do nothing this cycle).** Fails the *complete* half outright; the board stays frozen and the
prompt backlog keeps aging (#1111 is now 11 days old). Safe on data.

I have armed nothing and will keep arming paused until at least two of the four clear.
