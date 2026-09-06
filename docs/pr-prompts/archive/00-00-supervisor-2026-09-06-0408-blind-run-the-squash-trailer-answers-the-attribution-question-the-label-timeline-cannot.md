# Station 00 — Supervisor | 2026-09-06T04:08Z–04:2xZ | **BLIND RUN — COLLECTED, MUTATED NOTHING**

> 🔴 **This run was BLIND.** Desktop Commander could not be reached. Per STATION-CAPABILITIES §3
> ("No second transport") the run stops before acting — but it COLLECTS first, through the Cowork
> mount, and this breadcrumb says which of the two it did. **It collected. It acted on nothing.**
> No arm, no merge, no label, no push, no commit, no PR.

## GROUND

```
UTC                  2026-09-06T04:08:40Z  (run start)  →  04:2xZ  (breadcrumb written)
origin/main          cb7adc0e66cca465f24a638c50f2c7d583024e4e   ("#1680", 04:03:26Z) [MEASURED, GitHub API]
dev tree main ref    306e4a14b029d79d6601a27116b78f8c48e6137a   ("#1688", 03:31:18Z) [MEASURED, file read]
                     ⇒ DEV TREE IS BEHIND origin/main BY 2 MERGES (#1685, #1680). It cannot be
                       fast-forwarded from here — no git. See F4.
doc version          1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap            1   (station_doc_version declared by the scheduled-task file)
transport            BLIND — desktop-commander CONNECT_TIMEOUT after 30000 ms
tree read            /sessions/<session-id>/mnt/ProjectOperations2/  = the live dev tree
```

Version and bootstrap **AGREE** — this run was not restricted on that account. It was restricted by
blindness, which is stricter.

**Blindness, measured, not inferred.** Four `ToolSearch` calls for the Desktop Commander toolkit
(keyword form, per PREFLIGHT) over ~4 minutes. The first three returned
`Some MCP servers are still connecting: plugin:desktop-commander:desktop-commander`; the fourth
returned the terminal state: **`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP
server ... connection timed out after 30000ms"`.** No `start_process` was ever offered, so none was
attempted. The box's liveness is **[CANNOT MEASURE]** — and per §7 standing guard 4, *"I cannot
verify it" is NOT "it is down"*. This is transport, not host: the mount served 1,978 live log files
and a current `refs/heads/main`, and `origin` accepted API reads throughout.

**Binding documents — declared honestly.**
- `docs/pipeline/stations/00-supervisor.md` — read: PREFLIGHT, REPORT CONTRACT (fixed section order),
  AUTHORITY, HARD STOPS. **[MEASURED]**
- `docs/pipeline/STATION-CAPABILITIES.md` §3 (Tooling inventory / No second transport / GitHub) —
  read in full, and it is the section that governs this run. **[MEASURED]**
- `docs/pipeline/DOCTRINE.md` (93,204 bytes) — **read in part, not in full: §7, §7.1, §9.4, plus the
  full heading index.** **[CANNOT MEASURE]** whether the unread sections have changed since the
  02:10Z run proved the file byte-equal to `origin/main` — that proof needed `git diff --numstat`,
  which a blind run may not run. Stating this rather than claiming a full read is the §7.1 standard.
  It did not affect the run's actions, because the run took none.

## WHAT I MEASURED

- **[MEASURED] COLLECT — nothing uncollected. The freshness table, computed by hand from breadcrumb
  filenames** (`check-breadcrumb.mjs --freshness` NOT run: it `execSync`s a git command at line 101
  and `gh pr list` at line 149, both outside the blind ceiling):

  | station | last breadcrumb | age at 04:10Z | cadence | reading |
  |---|---|---|---|---|
  | 00 | `2026-09-06-0308` | 1.0 h | map says 2 h, **live cron is hourly** | ok |
  | 03 | `2026-09-05-2301` | 5.2 h | 24 h | ok |
  | 04 | `2026-09-06-0210` | 2.0 h | 4 h | ok |
  | 05 | `2026-09-05-1411` | 14.0 h | 24 h | ok — **05 is not a stopped station** |
  | 02 | dispatch-only | — | — | no cadence to miss |

  ⚠️ `ok` is still the weaker statement (STATION-CAPABILITIES §6, and escalation #23 owns it).
  Escalation #23 also owns the `'00': 2` vs `5 * * * *` mismatch. Neither re-raised.

  **The only breadcrumb in the queue root is my predecessor's 0308 file**, and it was merged as
  **#1688** at 03:31:18Z, so it is on `main` and needs no archive action from me. Station 04's
  02:10Z breadcrumb and its five findings were **collected and dispositioned by the 02:08Z run**
  (archived, F4 actioned, F2 escalated, `sweep-rotation.json` committed) — verified below, and the
  verification is itself F3.

- **[MEASURED] Board — 2 open, both Marco's, zero red.** `list_pull_requests(state=open)` at 04:0xZ:

  | PR | head | opened | lane | classification |
  |---|---|---|---|---|
  | **#1689** | `pr-cardui-s8-waste-section` | 03:40:01Z | watcher (has `rev-1689-ready.md` review job) | **[NO LANE VERDICT YET — hand-classified] MARCO'S** |
  | **#1667** | `fix/lint-arm-only-case-insensitive` | 09-05T14:17Z | second lane (0 logs mention it) | **[NO LANE VERDICT — hand-classified] MARCO'S** |

  Hand-classification per `classifyPolicyFiles`' three forms: #1689 changes
  `apps/web/src/pages/tendering/ScopeWasteTab.tsx`, `scripts/pr-gates/e2e-restoration-markers.mjs`
  and `.github/workflows/ci.yml` — none matches `^(tests|docs)/`, `(^|/)__tests__/` or
  `\.(test|spec)\.[cm]?[jt]sx?$` ⇒ **Marco's**. #1667 is a `scripts/` lint fix ⇒ **Marco's**.
  `grep -h 'PR #1689\b' processed/*.log` → **1 file, its own review job, no `merge result` line**;
  the log is 22 min old, so this is the *third* cause of `NO LOG` — a watcher PR still inside its
  classification window — not a second lane. **Nothing on this board is mine to merge**, and I am
  blind, so it would not be merged this run in any case.

- **[MEASURED] RULE 2 probe — live tree pinned, both controls.** Directory
  `docs/pr-prompts/processed/` in the **dev tree** (never `C:\po-watcher\...`, §9.5):
  **1,978** `*.log`, newest `rev-1689-ready.md.log` at **03:48:50Z** — younger than every open PR,
  which is the AGE discriminator that tells the live tree from the 2026-08-17 decoy.
  POSITIVE control `grep -l 'marco.:true'` → **615**. NEGATIVE control → **0** (see F3 for why the
  negative needle must be minted fresh).

- **[MEASURED] Three PRs the watcher routed to Marco merged inside 45 minutes, while I was not
  running.** All three carry a `marco:true` merge result in `processed/*.log`:

  | PR | routed reason | merged at | on main as |
  |---|---|---|---|
  | #1675 | `timeout waiting for green checks + MERGE verdict` | 03:19:20Z | `849d908b` |
  | #1685 | `outside tests/ or docs/: apps/api/prisma/seed-initial-services.ts` | 03:47:00Z | `a7730d01` |
  | #1680 | `outside tests/ or docs/: package.json` | 04:03:26Z | `cb7adc0e` |

  `merged_by` on all three reads **`GH-Mantova`**, which is how Marco *and* every agent
  authenticates — so on the label/actor evidence alone this is **[CANNOT MEASURE]**, exactly as
  open escalation **#1635** records. **F1 is a new instrument that speaks to it.**

- **[MEASURED] `pr-1689-review.md` does not exist at the canonical home.** `rev-1689-ready.md.log`
  ends `Exit: 0`, `**VERDICT: MERGE**`, and names `docs/pr-reviews/pr-1689-review.md`. `ls` of that
  directory returns `pr-1685-review.md` and `pr-1688-review.md` and no 1689. POSITIVE control:
  `pr-1688-review.md` **is** present and was written 03:32Z by the same lane. This is the
  already-landed **three-homes verdict defect** (#1683) reproducing on a live PR, and it matters
  because `verdictApproves` reads exactly that path.

- **[MEASURED] Station 04's F3/F4 hand-offs are discharged on disk.** The three SPENT HOLDs
  (`pr-cardui-s6-other-operational-costs`, `pr-plantdays-retire-and-drop`,
  `pr-scopecosts-s1-operational-cost-lines-api`) are **absent from depth 1** and **present in
  `superseded/`** with mtime 02:34Z — the minute #1686 merged. Depth-1 `*-HOLD.md` on disk is now
  **78** (04 measured 81 at 02:11Z). `pr-tipid-s1-waste-rows-can-carry-a-map-location-id-HOLD.md` is
  **absent from disk**. Whether that deletion is *committed* is **[CANNOT MEASURE]** — it needs
  `git status`, and THE BOARD TRAP stays armed until it is.

- **[MEASURED] Armed prompts: 0.** No `*-ready.md` at depth 1 in `docs/pr-prompts/`. `.arming-log.txt`
  tail is unchanged since `2026-09-06T01:52:59Z ARMED pr-tipid-s1-waste-rows-can-carry-a-map-location-id
  escalates=false actor=marco-delegated by=Marco@LAPTOP-E6NHU4E4` — i.e. **no arm has happened since
  01:52Z**, and none happened this run.

## WHAT CHANGED

**Nothing on the board, nothing in git, nothing on the remote.** No arm, no rename, no move, no
prompt deleted, no merge, no label, no push, no commit, no PR, no `sot/` edit.

The only thing this run wrote is **this breadcrumb**, at the tracked path `docs/pr-prompts/`.
🔴 **It is UNTRACKED and will stay untracked.** The GitHub MCP token is write-403 (§9.4), so a blind
run cannot open a PR "instead" — **a later sighted run must sweep this file into a board PR**, and
must not delete the disk copy before that PR merges.

## FINDINGS

### F1 — the squash commit's `Co-authored-by:` trailer discriminates the lanes the label timeline cannot. **S2 — new instrument for OPEN escalation #1635.**

Standing memory and escalation #1635 both record attribution as closed to measurement: every label
event and every `merged_by` reads actor `GH-Mantova`, which is also how every agent authenticates.
That is true of the *label timeline*. It is **not** true of the squash commit message.

[MEASURED] `list_commits(sha=main)`, trailers quoted verbatim from the six commits on `main` since
02:52Z:

| on main | PR | `Co-authored-by:` trailers |
|---|---|---|
| `cb7adc0e` | #1680 | `Marco <marco@initialservices.net>` **+** `Claude Sonnet 4.6` |
| `a7730d01` | #1685 | `Marco <marco@initialservices.net>` **+** `Claude Sonnet 4.6` |
| `306e4a14` | #1688 | `PR Supervisor <supervisor@local>` |
| `849d908b` | #1675 | `Marco <marco@initialservices.net>` **+** `Claude Opus 4.7 (1M context)` |
| `75a00730` | #1687 | `Claude Opus 5 (station-00 cloud lane)` — **no Marco trailer** |
| `4a0209db` | #1682 | `Claude Opus 5 (station-00 cloud lane)` — **no Marco trailer** |

The field is **non-empty and it separates**: three distinct actor strings across six commits, where
`merged_by` gives one string across all six. Every one of the three `marco:true` PRs that merged in
the last hour carries Marco's own address; both cloud-lane merges carry only the cloud lane. That
corroborates the arming log's independent `actor=marco-delegated  by=Marco@LAPTOP-E6NHU4E4`.

🔴 **The limit, stated before anyone builds on it.** The trailer is composed from the *branch's*
commits — it attributes **who wrote the work**, not **who pressed merge**. It therefore does **not**
close #1635, and a run must never read "Marco co-authored it" as "Marco cleared RULE 2 for it".
What it does is convert #1635 from *"there is no second signal"* to *"there is a second signal and
here is precisely what it can and cannot answer"*, which is the shape the escalation asked for.

**ESCALATED — carried in THIS BREADCRUMB, addressed to the `#1635` thread. I did not append to the
escalation file**, and the distinction is deliberate: `needs-marco/*.md` is tracked, a blind run
cannot commit, and leaving a tracked file modified in the shared dev tree is an FF blocker for every
other station. The next sighted run should fold this table into the existing `#1635` thread rather
than open a new escalation. The decision is unchanged and Marco's: what constitutes a checkable
clearance. RULE 1 reading: the
complete-and-additive option is a **signed receipt verified by `approval-receipt-check.mjs`** (an
independent artefact, immediate and durable), with the trailer used only as **corroboration**;
promoting the trailer to the primary gate fails the *future* half outright, because a trailer is
written by the branch author and an agent can write any trailer it likes.

### F2 — `list_pull_requests` returns `merged: false` on merged PRs, with `merged_at` populated. **S2 — a §7 instrument lie not yet in §9.4.**

[MEASURED], same PR, two endpoints, ~90 seconds apart:

```
list_pull_requests(state=closed) → #1685 : {"merged": false, "merged_at": "2026-09-06T03:47:00Z"}
pull_request_read(method=get, 1685) → #1685 : {"merged": true,  "merged_at": "2026-09-06T03:47:00Z",
                                               "merged_by": "GH-Mantova"}
```

Ten of ten entries in the list response carried `merged: false`, including #1688 and #1683 — board
PRs this pipeline merged itself and has breadcrumbs for. **A run that trusted the list field would
report the entire recent history as CLOSED-UNMERGED**, and that is not a harmless miscount: it is
the exact premise of `pr-1612-closed-unmerged-branch-holds-the-only-copy`, so it would manufacture
a dozen phantom "stranded branch" escalations, and it would tell `status-sweep.ps1` §5 the wrong
thing about every one of them. This is §7's recurring shape — *a field wearing an answer's clothes* —
and §9.4 does not yet name it.

The sound form is already visible in the same payload: **`merged_at` is populated and correct on
both endpoints.** Rule: **never read `merged` from a list response; read `merged_at`, or re-ask
`pull_request_read(method=get)` per PR.**

**DISPATCHED → Station 00's next sighted run.** Not Station 05: the trap belongs in
`docs/pipeline/DOCTRINE.md` §9.4, which is operational, not `sot/`, so CP-24 does not bind and no
doc-reconcile PR is needed. One-line shape: add a
§9.4 bullet in the established form — *the lie, the truth, the measurement, the cure* — with the
two payloads above as the control pair. Additive, removes nothing, and cannot damage data.

### F3 — a probe whose POSITIVE control passed while the probe itself was unsound for the case in hand. I nearly filed a false S2. **S3 — method.**

Recorded because it is §7 reproducing in my own hands within ten minutes of reading §7.

I set out to check whether anyone had collected Station 04's 02:10Z breadcrumb, and greped its
**slug**: `grep -rl '0210-three-remote-branches' docs/pr-prompts/` → **no hits**. POSITIVE control,
a sibling scanner breadcrumb: `grep -rl '2210-the-review-lane-mirror'` → **3 hits**. The control
passed. The conclusion "nobody collected 04's 0210 breadcrumb — its three dispatches to Station 00
were never read" was drafted, and it would have been an S2 with a fabricated culprit.

It is **false**. The 02:08Z run collected it in full — it cites the file as **`…-0210-…`**, with the
slug elided, and dispositions F1–F5 by name (`04's F4`, `04's F2`, `04's hand-off`). My needle could
not match an elision. **The positive control proved the grep engine worked; it proved nothing about
whether the target is written that way in this corpus** — the control breadcrumb simply happened to
be cited in full, and I read its success as coverage.

The sound needle is the **date-time stem** (`2026-09-06-0210`, or `02:10`), which survives elision,
plus a second instrument: the `### COLLECT` section of every 00 breadcrumb between the two
timestamps, read rather than greped. Both were run afterwards and both say **collected**.

**ACTIONED** — the false finding was killed before it was written, the sound needle is recorded
here, and the generalisation is one line: **a positive control on a different instance is not a
positive control on your instance.** Nothing to dispatch; this is a reading habit, and §7 already
carries the principle.

### F4 — the dev tree is 2 merges behind `origin/main` and no blind run can fast-forward it. **S3 — standing, sharpened.**

[MEASURED] `.git/refs/heads/main` in the dev tree reads `306e4a14` (#1688, 03:31:18Z), read as a
**file**, never through `git`. `origin/main` is `cb7adc0e` (#1680, 04:03:26Z), with `a7730d01`
(#1685) in between. So the tree is behind by two.

This is the standing STALE-DEV-TREE trap with a blind-run twist: `lint-prompt.mjs` greps `premise:`
against the **working tree**, so any arming decision computed here would be computed against prompt
text two merges stale — and the cure (`fetch --prune` + `merge --ff-only`) is **precisely what a
blind run may not do**. The tree does not self-heal; it drifts further with each merge until a
sighted station touches it.

**DEFERRED, with a named trigger.** It is harmless while armed=0 and no station is arming. What
makes it urgent: **the next arm**. The next sighted run must fast-forward *before* it lints anything,
and must not treat this breadcrumb's `306e4a14` as current. I am not proposing a fix — an auto-FF on
a shared tree is the change that DOCTRINE's FF-cure notes already warn about, and it is not this
run's to design blind.

### F5 — `#1689` has an `Exit: 0` MERGE verdict and no verdict file at the path the merge gate reads. **S3 — a live instance of an already-staged fix.**

[MEASURED] above. `pr-watcher-verdict-home-resolver-HOLD.md` is the staged remedy; per standing rule
it is **STAGED, NOT ARMED, and Marco is to be asked first**. #1683 landed the three-homes finding on
`main` and dispositioned it; 04 declined to re-derive it at 02:10Z and was right to.

**DEFERRED to the staged HOLD.** What this run adds is not a new diagnosis but a **count**: this is
the defect landing on a *currently open* PR whose verdict says MERGE, so the gap is no longer
historical. Not re-raised as an escalation — a second filing of a live one is noise, not coverage.

## WHAT I DID NOT DO

- **Did not run any `.ps1`** — no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
  `restart-watcher-if-wedged.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`. Therefore **no liveness,
  smoke, safe-to-act or merge verdict is claimed anywhere above.** Watcher pid, wrapper and
  heartbeat are **[CANNOT MEASURE]** this run; the last reading is 04's 02:11Z pid 20000 RUNNING,
  and a two-hour-old reading is a lead, not a finding.
- **Did not run `git`** against the Windows `.git`, including through the sandbox — DOCTRINE §9.2,
  the 0-byte `index.lock` that freezes every station. `.git/refs/heads/main` was **read as a file**.
- **Did not run `check-breadcrumb.mjs --freshness`**, though `node v22.23.2` is present in the
  sandbox: it `execSync`s at lines 101 and 149. The freshness table above is hand-computed from
  breadcrumb filenames and is labelled as such.
- **Did not merge, arm, label, or dispatch by PR.** Both open PRs hand-classify as Marco's; armed
  count is 0 and stayed 0.
- **Did not re-raise** `C:\po-vg`, the CP-26 label-release path, the hourly poller cadence, the
  three-homes verdict defect, or #1635 as a *new* escalation. All are live in `needs-marco/`; F1 was
  appended to #1635's thread instead.
- **Did not delete this breadcrumb's disk copy**, and the next sighted run must not either until its
  board PR has merged.
- **Did not read `DOCTRINE.md` in full**, and said so in GROUND rather than implying otherwise.
