# Station 00 — Supervisor | 2026-08-28T08:08Z–2026-08-28T08:25Z

## GROUND

```
UTC            2026-08-28T08:09:10Z
origin/main    2503c4aa
dev tree       main @ 2503c4aa   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run had full authority, not read-only.
Desktop Commander reached the box on the first call (`powershell.exe`, `LAPTOP-E6NHU4E4`). **This was
a SIGHTED run, not a quiet one.**

## WHAT I MEASURED

- **[MEASURED]** `bring-up-to-speed.ps1` @08:09:49Z — verdict **`SAFE TO ACT`**: no board mutation in
  progress, no remote activity in the last 2 min, `index.lock` false in both trees, 0 git processes.
- **[MEASURED]** Board: **1 open PR — #1369** `feat(crm-s2): three CRM nav items with in-page tab
  shells`, `CLEAN`, CI **13 pass / 0 fail / 0 pending**. Merged since my 06:08Z run: #1366, #1367,
  #1368, #1370, #1371, #1372 (six, four of them by a concurrent actor between 06:37Z and 07:11Z).
- **[MEASURED]** Trunk: main CI last 3 runs 3 success / 0 not-success.
- **[MEASURED]** Watcher `node` **pid 5444 alive**, started 05:05Z; auto-restart wrapper alive (3);
  heartbeat age 78 min — which with an empty queue is **idle, not wedged** (it ticks only mid-run).
- **[MEASURED]** Queue at start: **armed 0**, in-progress 0, needs-marco 14, no-pr-opened 107,
  failed 20, blocked 0.
- **[MEASURED]** `check-breadcrumb.mjs --freshness` → exit 1: 74 checked, **1 malformed**
  (04's `…-2026-08-27-0617-instruction-drift-lint-station-only-sees-backticked-paths.md`, still
  UNTRACKED), 2 untracked breadcrumbs. Freshness: 00 2.0h, 03 33.2h, 04 2.0h, 05 18.0h — **no station
  silent** (silence is 2× cadence).
- **[MEASURED]** `git status --porcelain docs/pr-prompts` → **24 ` D`** entries (tracked, missing from
  disk). I classified every one: **21 have 2+ files in the gitignored `processed/` sink** ⇒ consumed
  residue, expected. **3 have zero** in `processed/` and zero in `no-pr-opened/`, and were added by
  the newest board PRs — `pr-lint-armed-gate-inversion-HOLD.md` (#1370, 07:05Z),
  `pr-lint-not-a-prompt-HOLD.md` and `pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD.md`
  (#1371, 07:08Z). Those three were **never consumed — they were never written to disk at all.**
- **[MEASURED]** `git reflog --date=iso` on the dev tree: HEAD reached its current SHA by
  `reset: moving to origin/main` — **four times today** (05:05Z, 05:38Z, 07:04Z, 07:11Z).
- **[MEASURED]** #1369 routing, from `processed/pr-crm-s2-nav-three-items-tabs-b-ready.md.log`:
  `[watcher] merge result for PR #1369: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/App.tsx"}`
  — and `gh pr view 1369 --json files` confirms `apps/web/src/App.tsx` is in the diff. **The reason is
  TRUE.**
- **[MEASURED]** Positive control for the arming check (DOCTRINE §7): the case-sensitive union grep
  over the three `do-not-arm` syntaxes fires on `pr-524-rates-b-slice2-canonical-HOLD.md` (1 hit) and
  is silent on the prompt I armed (0 hits). **A check never seen to pass is not a check.**
- **[MEASURED]** Watcher clone `C:\po-watcher\ProjectOperations`: branch=main, **dirty=35**.
- **[MEASURED]** 4 orphaned worktrees: `sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`,
  `po-wt-h`.

## WHAT CHANGED

1. **Materialised 3 prompts** that were tracked on `HEAD` and absent from disk, byte-exact via
   `git show HEAD:<path>` → `writeFileSync(Buffer)` (never `git checkout`, which resurrects consumed
   prompts). Read back: all three `exists=true`; ` D` count **24 → 21**.
2. **Labelled #1369 `do-not-merge`** and commented the routing evidence on it. Read back:
   `labels=do-not-merge state=CLEAN`. **Not merged.**
3. **Armed exactly one prompt**: `pr-breadcrumb-gitignore-gate-routing-not-mention-HOLD.md` →
   `-ready.md`, by `git mv` of the tracked HOLD. Read back: armed **0 → 1**; `git diff --cached
   --name-status` carries **only** that `R100` and nothing from another chat.
4. **This board PR**: 04's 0610 breadcrumb swept up, this breadcrumb, and one new staged HOLD prompt.
   Nothing else.

## FINDINGS

### F1 — Three prompts staged an hour ago existed only in git, never on the disk the watcher globs

`pr-lint-armed-gate-inversion-HOLD.md`, `pr-lint-not-a-prompt-HOLD.md` and
`pr-station-contract-breadcrumb-validator-and-qa-claim-HOLD.md` merged to `main` at 07:05Z/07:08Z and
were absent from `C:\ProjectOperations2\docs\pr-prompts`. Arming is a `git mv` of an **on-disk**
tracked HOLD, so all three were unarmable while looking perfectly landed on GitHub. This is the exact
shape that makes a queue audit lie: the prompt is real, the PR merged, and the board is empty.

**ACTIONED** — restored byte-exact from `HEAD` and read back (see WHAT CHANGED 1). The three are now
armable. I armed none of them; arming is one at a time and I had a higher-priority candidate.

### F2 — The dev tree is synced with `git reset`, which structurally cannot materialise a new file

Root cause of F1, and it is general. `reset` (mixed) moves `HEAD` and rewrites the index and **never
touches the working tree**. Every prompt added on `main` by a board PR is therefore invisible to the
watcher until somebody notices a ` D` line. The same command also silently swallows a staged arming
rename in the shared index — which is how an arming commit was lost on 2026-08-22.
`git fetch` + `git merge --ff-only origin/main` fails neither way: it writes the files, and it
**refuses** on divergence instead of quietly winning.

This is Marco's to ratify because it forbids a command several concurrent chats use routinely.
**RULE 1 applied:**

- **Option A (complete + additive — recommended).** Make `merge --ff-only` the binding dev-tree sync
  rule and enforce it in `.claude/hooks/guard.mjs` (deny-only, dev tree only, fail-open). Solves it
  immediately and in future; damages no data entry — it only refuses a command, and a refusal is
  information. The prompt is written and staged as
  `pr-devtree-sync-ff-only-guard-HOLD.md` in this PR, unarmed, awaiting his answer.
- **Option B (documentation only).** Record the rule in the station docs and rely on stations to obey.
  Fails the "future" half of RULE 1 — this pipeline has repeatedly proved that an unenforced
  instruction drifts, and the actor doing the reset is often not the actor reading the doc.
- **Option C (a sweeper that materialises ` D` prompts each run).** Fails the "completely" half: it
  treats the symptom every two hours and leaves the arming-commit loss untouched.

**ESCALATED** — Marco: may `git reset` be blocked in `C:\ProjectOperations2`? Nothing else in this
finding needs him.

### F3 — #1369 is watcher-routed to Marco, and the routing verdict is correctly owned

The log names PR **#1369** with `marco:true`, and the stated reason (`outside tests/ or docs/:
apps/web/src/App.tsx`) is verifiably true of that PR's own diff. So the 08-28T06:20Z root cause —
that the merge lane can log a verdict for a PR the run never opened (#1367, F7) — is a defect of
**attribution, not of universal falsity**: the lane can and does log correctly-owned verdicts. That
narrows the fix and it is a positive control the earlier finding lacked.

**ACTIONED** — labelled `do-not-merge`, evidence commented on the PR, **not merged** (RULE 2). The
label makes a gate visible that previously existed only inside a gitignored log, which is why a
label-only board check reads half the board wrong.

### F4 — One prompt armed: the breadcrumb gate tests a mention, not a routing destination

`pr-breadcrumb-gitignore-gate-routing-not-mention-HOLD.md` lints ADMIT, carries no `requires_*` gate,
`escalates: false`, and zero `do-not-arm` markers under the case-sensitive union grep (control fired
on the known-positive). Its premise is still LIVE — `ROUTING_VERBS` does not appear in
`scripts/pipeline/check-breadcrumb.mjs` (0 hits), so the fix has not shipped.

**ACTIONED** — armed 0 → 1 at 08:13Z. It is the highest-leverage item on the queue because the same
gate is what currently rejects 04's 0617 breadcrumb (F6).

### F5 — Widening the sot byte gate before `sot/03` is repaired would redden the trunk

04 (0610) measured that `check-sot-bytes.mjs` is a blocking CI gate hardcoded to 3 of 7 `sot/` files
and blind to the 9 `U+FFFD` that 05 (2026-08-27T14:11Z) found **committed on main** in `sot/03`.
Widening coverage first turns a green trunk red board-wide; repairing `sot/03` first does not. Only
Station 05 may edit `sot/`.

**DISPATCHED** — to **05-sot-keeper** (runs daily, last 18.0h ago): repair the 9 replacement chars in
`sot/03` via a doc-reconcile PR **before** anyone widens the checker. I will stage the widening prompt
with a `requires_merged` gate on that PR once it exists.

### F6 — 04's 0617 breadcrumb is still malformed and still untracked, and that is now the proof

It is rejected by the very gate F4 exists to fix — a *mention* of a gitignored path, not a routing
into one. `check-breadcrumb.mjs` runs in CI on `main`, so landing it today would redden the board.

**DEFERRED** — it lands unchanged the moment the armed fix merges, and that landing IS the acceptance
test. It becomes urgent if the armed prompt fails to open a PR: then the gate blocks a real report
indefinitely and the breadcrumb must be hand-corrected instead.

### F7 — The watcher clone is diverged, so the guards merged in #1358/#1360 are not running

`C:\po-watcher\ProjectOperations` is dirty=35 and was measured at 06:23Z as 16 behind / 2 ahead with
local commits, so `merge --ff-only` cannot succeed there. The watcher executes `index.mjs` **from the
clone**, so every guard merged since is inert. Dispatched at 06:23Z; 03 has not run since 33.2h ago
(cadence 24h — late, not silent).

**DISPATCHED** — re-dispatched to **03-machine-minder**, unchanged: converge the clone in an idle
window, never `git checkout` the 35 ` D` paths. Armed count was 0 for most of this window, so there is
no queue risk in doing it.

### F8 — Four orphaned worktrees and three untracked HOLD prompts persist

`sot-d-register`, `sot-readme-fetch`, `sotk-03-ledger`, `po-wt-h`; and untracked
`pr-hygiene-gitignore-no-pr-opened-HOLD.md`, `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md`,
`pr-watcher-idle-tick-liveness-HOLD.md`. Untracked prompts are invisible to a clone and to CI.

**DEFERRED** — I kept this PR to breadcrumbs plus one prompt rather than bulk-landing files whose CI
behaviour I have not measured. Urgent when a fresh clone is next made, or when one of those three is
chosen for arming — at which point it must be `git add`ed first.

## WHAT I DID NOT DO

- **Did not merge #1369.** It is green, CLEAN and unblocked technically; it is held by Marco's human
  gate and RULE 2. I labelled it and left it.
- **Did not arm more than one prompt**, and did not arm the three I materialised or the guard prompt I
  staged.
- **Did not touch `sot/`**, Azure/Entra/SharePoint, production data, or the watcher clone's git.
- **Did not clear the 21 consumed-prompt ` D` entries** — that is tracked-on-main residue with a
  known owner, and `git checkout` on any of them re-arms dead work.
- **Did not quote a trunk colour from the sweep** — main's CI was read per-commit-run instead.
- **Did not land 04's 0617 breadcrumb** (F6) or the three untracked prompts (F8).
