# Station 00 — Supervisor | 2026-09-21T12:09:43Z–2026-09-21T12:58Z

## GROUND

```
UTC            2026-09-21T12:09:43Z
origin/main    55454b07            (fetched, then rev-parse)
dev tree       main @ 76ed975a     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`). Full authority this run; no read-only downgrade.

**NOT BLIND.** Stated loudly: four Station 00 runs today (04:10, 07:10, 10:09 and one earlier)
filed blind-run breadcrumbs, and a blind run and a healthy quiet run produce the same "no news".
This run reached the Windows shell on its first call.

## WHAT I MEASURED

**Reachability.** `[MEASURED]` Desktop Commander `start_process`, shell `powershell.exe`, returned
`PROBE-OK 2026-09-21T22:08:17` (Brisbane) plus `git rev-parse` output on the first call. Every
chain below echoed a literal `MARKER_*` after each statement (§9.1 guard 1).

**VM git guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Last line quoted verbatim per the contract:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/funny-admiring-wright/.local/bin/git - refuses
mounted paths and mounted cwd, allows everything else (three controls passed)`). **Install PASSED.**

**Binding-document freshness.** `[MEASURED]` `git diff --numstat origin/main -- <path>` in the DEV
TREE after fetch — never the piped-hash form (§9.1 records it unsound in `powershell.exe`).
All three of `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** = not different, so reading the working
copies was safe. All three were read in full.

**Dev tree.** `[MEASURED]` `git rev-list --left-right --count HEAD...origin/main` → `0 8`
(0 ahead, 8 behind). `git diff --cached --name-status` → **EMPTY** — nothing staged by another
session, checked immediately before my only commit (§9.2, shared index).

**Sweep.** `[MEASURED]` `status-sweep.ps1` captured to a file and decoded with node. The capture is
`FF FE` UTF-16LE (156,556 B) — §9.3's `*>` trap, decoded rather than read raw. Verdict section 7:
**`SAFE TO ACT`**. Re-run at 12:19:49Z after my one mutation: still `SAFE TO ACT`.

**Watcher.** `[MEASURED]` from the sweep's `[LIVE]` lines: node **RUNNING pid 9744**, auto-restart
wrapper alive (1), heartbeat age 14 min, `armed (*-ready.md): 0`. An idle watcher with 0 armed is
CORRECT, not wedged. I did not restart it and did not run `-Fix`.

**Breadcrumb freshness + the `lastRunAt` cross-check.** `[MEASURED]`
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `structure: 11 checked, 0
malformed`, `CLEAN`; `00` 1.1h · `03` 11.9h · `04` 2.1h · `05` 11.5h, none SILENT. Crossed against
`list_scheduled_tasks` per the COLLECT table, because the breadcrumb is one instrument and cannot
name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00-supervisor` | 2026-09-21T12:07:54Z (this run) | 11:08Z | aligned, healthy |
| `03-machine-minder` | 2026-09-21T00:20:35Z | 00:21Z | aligned, healthy |
| `04-scanner` | 2026-09-21T10:09:32Z | 10:10Z | aligned, healthy |
| `05-sot-keeper` | 2026-09-21T00:04:02Z | 00:45Z | aligned (breadcrumb written 41 min into the run) |

Four enabled tasks; `weekly-security-audit` remains `enabled: false`. **No station is SILENT and no
occurrence is missing** — every row is the healthy "both fresh and aligned" case, not the two
failure shapes that also print `ok`.

**Tracked-set check before treating anything as unreported.** `[MEASURED]` `git ls-files
docs/pr-prompts` → 1279 entries; all **11** depth-1 `00-*.md` breadcrumbs in the dev tree match by
basename and are **TRACKED**. Nothing was re-committed as "unreported" (the duplicated-basename
trap in the station doc).

**The board — three open PRs, and the lane of each.** `[MEASURED]` `gh pr view <n> -R <owner>/<repo>`
per PR, `-R` on every call and `$LASTEXITCODE` tested before parsing (§9.4 CWD bullet):

| PR | created | labels | `tendering-e2e` | other non-success |
|---|---|---|---|---|
| #2047 `feat/role-grant-registry-v1` | 11:46:34Z | `do-not-merge` | IN_PROGRESS | CP-26 + PR gates |
| #2044 `feat/crmvis-s8-comms-threads` | 11:09:14Z | `do-not-merge` | **SUCCESS** | CP-26 + PR gates |
| #2042 `feat/scopecards-s4b-push-panel-ui` | 10:02:39Z | none | **FAILURE** | none |

**Four of the five board "reds" are one cause and are parked by design.** `[MEASURED]` from
**column 3** of each CP-26 job log (§9.1 — column 1 is the job name and grepping the whole line
matches every line), verbatim on both PRs:
`FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.`
That is the `[LABEL_PRESENT]` verdict token, which DOCTRINE §9.4 records as **parked, nothing to
do** — and the same check runs twice (as the required check and as a step inside `PR gates`), which
is why one cause reads as two reds on each PR. Only Marco removes the label. **These are not work.**

**#2042's lane, re-taken this run** (§10.1: a lane verdict is only as of the minute it was taken).
`[MEASURED]` `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #2042\b'` — prompt logs
only, `rev-*` excluded — → **3 hits**, carrying a real watcher verdict:
`merge result for PR #2042: {"ok":false,"marco":true,"reason":"outside tests/ or docs/:
apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}`.
POSITIVE control `PR #2040` → 1 hit; NEGATIVE control `PR #999994` → 0. Watcher-opened, **Marco's**.

**So the supervisor merge lane is EMPTY again this run.** All three open PRs are Marco's — two by
label, one by watcher routing. RULE 2 binds on #2042; the label binds on #2047 and #2044.

**The one real red, diagnosed.** `[MEASURED]` `tendering-e2e` on #2042, run `35594588742`:
**5 failed / 161 passed**. Run history on that branch, `gh run list --branch <b>`:

| run | sha | failures |
|---|---|---|
| 10:02:41Z `35586590400` | `9976caee` | **1** — `batch4-quotes.spec.ts:183` |
| 10:18:21Z `35588032310` | `06833a5a` | **1** — same |
| 10:31:15Z `35589179704` | `8d1b5a0a` | **1** — same |
| 10:46:21Z `35590519440` | `e7a058bc` | **1** — same |
| 11:00:22Z `35591720058` | `42820e01` | **1** — same |
| 11:18:22Z `35593351152` | `7108942b` | **1** — same |
| 11:32:23Z `35594588742` | `c96514d7` | **5** — same, **plus 4 new** in `batch1-dashboards.spec.ts` |

Two distinct causes, and separating them is the whole point:

1. **`batch4-quotes.spec.ts:183` has failed on all seven runs** — deterministic, not a flake, and in
   #2042's own area. The failing assertion is at line 240:
   `await expect(page.getByText(/alternative pricing scenarios/)).toBeVisible();` → `element(s) not
   found`, inside *"Edit opens ONE canonical editor strip; all 8 tabs render their structure"*.
   #2042's diff is 7 files, all under `apps/web/src/pages/tendering/` (`ClientQuotesPanel.tsx`,
   `QuotePushPanel.tsx`, `QuotePushDiffModal.tsx`, `quotePush.helpers.ts` + 3 test files). The
   S4b work restructures the canonical editor strip, and the Cost Options tab's copy no longer
   renders. **This is a genuine regression in the PR, not CI noise.**
2. **The 4 `batch1-dashboards` failures appeared once, on the newest run only**, accompanied in the
   same job by `duplicate key value violates unique constraint
   "user_dashboards_user_id_slug_is_system_key"` at 11:39:10, 11:39:24 and 11:39:39Z — a test-data
   uniqueness collision. #2042's diff touches no dashboard file.

**POSITIVE CONTROL that the trunk is not the cause, and it is the load-bearing measurement:**
`tendering-e2e` is **SUCCESS on #2044**, a sibling branch off the same base, run in the same window.
`main` CI on `55454b07` is `4 success / 0 failed (trunk green)`. So this is #2042-specific and there
is no main regression to chase — the docs-only-PR-fails-a-code-check inference does not apply.

**Second lane — this is the measurement that decided the run.** `[MEASURED]` the authoring identity
per commit on #2042's branch (§10.2.1: `%an` names a TREE, so read it with that table):

| committed | identity | what it names |
|---|---|---|
| 10:02:08Z | `Marco <marco@initialservices.net>` | the **watcher clone** — the original build |
| 10:18/10:46/11:00/11:18/11:32Z | `GH-Mantova <…@users.noreply.github.com>` | GitHub's API — `Merge branch 'main'` branch-updates |
| **10:31:06Z** | **`station-00.interactive-0004 <marco@initialservices.net>`** | a **supervised interactive lane**, committing from a dev-tree worktree |

So the seven runs are **one human-authored fix attempt plus five automatic branch-updates**, not
seven fix attempts. And that lane is **live right now**: `[MEASURED]` `.arming-log.txt` records
`2026-09-21T11:25:01Z ARMED pr-permission-role-reconciler … actor=station-00.interactive-0004 …
pid=28272`, which became **#2047 at 11:46:34Z** — 22 minutes before this run started.

**Mount enumeration.** `[MEASURED]` `/sessions/<id>/mnt/` holds **4** entries this session
(`ProjectOperations2`, `PR-Master`, `outputs`, `uploads`). `po-watcher` and `po-sup-fix-scripts` are
**not** mounted here, against the eleven `STATION-CAPABILITIES.md` §3 records for a blind run —
which is why that section says to enumerate the mounts rather than assume them. Not a defect this
run (Desktop Commander reached both paths regardless), but it would have bounded a blind one: the
three-homes review-verdict rule needs the `po-watcher` mount.

## WHAT CHANGED

**One mutation, plus this breadcrumb's own PR.**

1. **Discharged the one dead escalation** the sweep tagged `[STALE]` —
   `docs/pr-prompts/needs-marco/pr-2038-review-fix.md` → `needs-marco/discharged/`, with
   `_DISCHARGE-NOTE-2026-09-21-1230-pr-2038.md` written beside it. **Moved, never deleted.**
   Evidence and read-backs under F1.

Nothing else. **No PR was merged, labelled, unlabelled, rebased, or pushed to. No prompt was armed,
disarmed, renamed or moved. No `do-not-merge` label was removed. No `sot/` file was touched. The
watcher was not restarted. The dev tree was not fast-forwarded and nothing was committed on `main`.**

## FINDINGS

### F1 — The sweep's one `[STALE]` escalation row was genuinely dead; discharged, with the general half kept alive

`status-sweep.ps1` section 5 tagged exactly one row:
`pr-2038-review-fix.md references #2038 which is MERGED -- escalation is DEAD, clear it.`
Per the COLLECT contract I did **not** clear it on the tag alone. `[MEASURED]` re-asked
individually — never from a list response, which §9.4 records as unusable for `merged` —
`gh pr view 2038 -R <owner>/<repo> --json number,state,mergedAt` → `state=MERGED
mergedAt=2026-09-21T09:41:11Z`; NEGATIVE control `gh pr view 999994` → exit **1**.

`[MEASURED]` Before calling anything corrupt, the file's bytes were checked with node (§9.3):
880 B, `U+FFFD`=**0**, `â€`-signature=**0**. **The file is clean** — the em-dash mojibake visible
through `Get-Content` is the documented FALSE positive in the PowerShell reader. A run that trusted
its eyes here would have filed a corruption finding against an undamaged file.

Reading the body, the escalation is PR-scoped and spent — **but one clause is general**: the
hex-ratchet gate treats any hex literal under `apps/web/src/**` as a violation *including test
data*, so a test asserting a colour is ABSENT must embed the hex it asserts against and is failed
for doing so. That is a property of the gate, not of #2038, and it will recur. It is recorded here
and in the discharge note so that clearing the dead row does not silently retire a live observation.

**Read-backs:** gone from `needs-marco/` → `True`; present in `discharged/` → `True`; note present
→ `True`; `needs-marco/` count **63 → 62**. **Falsifying probe, as the contract requires — re-ran
the whole sweep at 12:19:49Z and read section 5:** the file is mentioned **0** times and **no real
`[STALE]` escalation row remains** (the 4 residual `[STALE]` string matches are the report's own
legend and header lines, which contain the literal token — §9.6's rule about probing the document
instead of the corpus). Verdict still `SAFE TO ACT`.

**DISPOSITION: ACTIONED** — discharged and verified by re-running the instrument that raised it.

### F2 — #2042 carries a real, deterministic regression in its own area, and a live second lane owns the branch

Measured above: `batch4-quotes.spec.ts:183` has failed on **all seven** runs of that branch across
90 minutes and seven SHAs, at `expect(page.getByText(/alternative pricing scenarios/)).toBeVisible()`
→ element not found, while the identical suite is **SUCCESS on sibling #2044** and trunk is green.
The cause is in #2042's own seven-file diff, all of it `apps/web/src/pages/tendering/**`.

Under the ACTIVE DRIVE MANDATE rule 2 a failed PR is mine to fix, not to escalate. **I did not fix
it, and the reason is BOARD DRIVING condition 3, not timidity.** The `station-00.interactive-0004`
lane authored the only content fix on that branch at 10:31:06Z and armed
`pr-permission-role-reconciler` at 11:25:01Z, which opened **#2047 at 11:46:34Z** — 22 minutes
before this run began. Pushing a second fix to a branch another Station 00 lane is actively working
is precisely the two-actors-one-board collision that LL-38 records and that the open escalation
`two-station-00s-on-one-board-and-the-safe-to-act-gate-reads-safe-between-arms-2026-09-14.md`
already names.

⚠️ **And that escalation's title is exactly what happened here: the sweep's `SAFE TO ACT` verdict
is computed from in-flight mutation signals — index locks, running `git`, a PR touched in the last
two minutes — none of which fire in the 43-minute gap between another lane's arms.** The gate read
SAFE and the board was not. **A `SAFE TO ACT` verdict is not evidence that this station is the only
actor**; the arming log and the per-commit authoring identity are, and they are cheap.

So the diagnosis is the deliverable, and it is complete enough to act on without re-deriving:
failing spec, failing line, failing assertion, the seven-run history that rules out flake, and the
sibling-PR positive control that rules out trunk.

**DISPOSITION: DISPATCHED** — to the `station-00.interactive-0004` lane, which owns this branch.
The fix is in `ClientQuotesPanel.tsx`'s Cost Options tab: restore the copy matching
`/alternative pricing scenarios/` (and the sibling `+ Add cost option` button asserted on line 241),
or update `batch4-quotes.spec.ts` if the S4b redesign deliberately retired that wording — which is
a product call, not a test fix, and should be stated as one. If that lane has gone quiet by the next
00 run, this becomes the next run's to fix directly.

### F3 — Four of the five board reds are the CP-26 park, and three consecutive collect runs have mis-read this shape

`[MEASURED]` `[LABEL_PRESENT]` on both #2047 and #2044, quoted verbatim above from column 3. DOCTRINE
§9.4 records that a PR carrying `do-not-merge` **can never be green** and shows as two reds with one
cause, that this is parked by design, and that *"three consecutive collect runs listed such PRs among
'the reds' as though they were something to fix."*

Worth stating positively because the raw counts invite the error: the sweep's own `[LIVE]` lines read
`#2047 CI: 12 pass / 2 fail`, `#2044 13 pass / 2 fail`, `#2042 14 pass / 1 fail` — **five failures**,
of which **four are one parked label apiece and zero are work**. Reading the verdict token instead of
the counts is what separates them, and it costs one job-log read per PR.

**DISPOSITION: ACTIONED** — classified and recorded; no action exists behind `[LABEL_PRESENT]`, since
only Marco removes the label. Recorded so the next run does not re-open it as work.

### F4 — The `batch1-dashboards` failures are a one-run test-data collision, not a #2042 defect

Four dashboard specs failed **only** on the newest run, with
`duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"` logged
three times inside the same job at the matching seconds. #2042 touches no dashboard file, and the
same four specs passed on the six preceding runs of the same branch.

I am **not** calling this a flake to be re-run away — DOCTRINE §2 forbids re-running hoping for green,
and a unique-constraint collision has a real cause: two dashboards created with the same
`(user_id, slug, is_system)` inside one run, i.e. the specs are not isolated from each other or from a
prior run's rows. That is a latent test-isolation defect that will recur intermittently on any branch.

**DISPOSITION: DEFERRED** — real, not now, and not this PR's. It is one observation on one run; the
honest next step is a second sighting rather than a speculative fix, and the four specs are green on
six of seven runs so nothing is blocked by it today. **It becomes urgent the moment it appears on a
PR whose merge it actually gates** — the signal to watch is the same constraint name appearing in a
`tendering-e2e` job on a branch that is otherwise green. If the next 00 run sees it again, it should
be dispatched to 01 as a test-isolation fix (unique slug per spec), not diagnosed afresh.

### F5 — The oldest unanswered thing on this board is still the fv2 cluster question, now SEVEN days old

Carried forward, not re-derived: the 11:08Z run escalated it (its F3), 04 re-measured it at 10:10Z
today and on 2026-09-15. `pr-fv2-ai-digests-HOLD.md` is gated on
`apps/api/src/modules/forms/ai-form-import.service.ts`, which is absent from `origin/main`, and every
prompt that could produce it sits in `superseded/`. The gate cannot release and it masks
`pr-fv2-output-channels-HOLD.md` behind it.

I did not repair the gate, for the reason 04 and the 11:08 run both gave: the dead file gate is the
**only** gate on `pr-fv2-ai-digests`, so repairing it would immediately arm a prompt whose cluster
Marco has not confirmed is wanted.

**DISPOSITION: ESCALATED** — Marco. One question, unchanged since 2026-09-15: **is the fv2
AI-import / digests / output-channels cluster still wanted?** Options, complete-and-additive first
per RULE 1:

- **(A) Retire all three to `superseded/` in a board PR.** *Complete and additive*: removes two
  permanently-parked prompts and the dead gate together, ends the masking, destroys nothing —
  `superseded/` is recoverable and the prompts stay readable on `main`. Passes both halves. **Recommended.**
- **(B) Re-stage a replacement producer for `ai-form-import.service.ts`; leave both gates.** Complete
  only if the cluster is genuinely still wanted; fails the *immediate* half — the board carries two
  dead prompts until the producer ships.
- **(C) Repoint the gate at a file that exists.** Fails the *future* half: it arms a prompt on the
  strength of an edit nobody asked for, against a cluster whose status is the open question. **Not recommended.**

## WHAT I DID NOT DO

- **Merged nothing, and there was nothing I was permitted to merge.** All three open PRs are Marco's:
  #2047 and #2044 by `do-not-merge` label (`[LABEL_PRESENT]`, only Marco removes it), #2042 by a real
  watcher `marco:true` verdict re-taken this run. I did not run `Assert-SmokedOrEscalate` / `Merge-Pr`
  against any of them, did not enable auto-merge, and did not remove or add a label.
- **Did not push a fix to #2042**, though its red is real and rule 2 makes reds mine. BOARD DRIVING
  condition 3: another Station 00 lane authored that branch's only content fix and armed a prompt
  22 minutes before this run. Dispatched in F2 instead, with the full diagnosis so nothing is re-derived.
- **Did not re-run #2042's CI hoping for green** (§2). The failure is deterministic across seven SHAs.
- **Did not fast-forward the dev tree**, 8 behind. The interactive lane arms *from* that tree — its
  `.arming-log.txt` is the shared file — so a FF now is a shared-tree mutation against a live actor.
  Named so the next run inherits the reason. Nothing was committed on `main`.
- **Did not archive the 11 dispositioned depth-1 breadcrumbs.** They are all tracked and all count for
  `--freshness` by basename, so nothing is at risk; the archive move belongs in a PR of its own rather
  than mixed into this one.
- **Armed nothing and disarmed nothing.** Real armed count 0, watcher HEALTHY, so there was no arming
  decision to make. The backlog's one `READY TO STAGE` item (`rates-11c-blocked-consumers`) stays
  unstaged: its own note records the parity proof must have RUN clean first.
- **Did not restart or touch the watcher** — RUNNING pid 9744, wrapper alive, 0 armed. Restarting on
  anything short of WEDGED/DOWN is the LL-25 failure.
- **Did not touch the orphaned worktree** `C:/PR-Master/worktrees/po-vg` (holds 1 uncommitted file,
  age ~17 days) or the registry escapee `C:\po-worktrees\po-fix-2005`. Both are Station 03's, and the
  sweep says the first holds uncommitted work that `--force` would discard.
- **Did not do 03/04/05's work.** No local-tree cleanup, no audit, no `sot/` edit.
- **Touched no Azure / Entra / SharePoint surface, and wrote no production data.**
- **Wrote to no gitignored sink.** Nothing went to `docs/qa/qa-findings.md`, `qa-checklist.md`,
  `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md`. The one file I wrote into a gitignored
  folder is the discharge note, which is why F1 reports the discharge here as well.
