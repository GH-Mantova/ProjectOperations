# Station 00 — Supervisor | 2026-09-23T00:15:44Z–2026-09-23T01:05Z

## FOR MARCO

**The board is empty and the trunk is green.** Nothing is open, nothing is armed, nothing is
stuck. Three stations reported on time and every finding they raised is dispositioned below.

One thing needs you, and it is the same question as last hour, narrowed by a measurement:
**you merged `#2100`, which settles that PR and does not settle the rule behind it.**
`Claude Design/` still has no recorded lane and no CI gate — measured, with controls, in F1 — so
the next staging PR carrying a mockup stops the board exactly as this one did. The options are in
F1, complete-and-additive first.

And a warning about the instrument itself: **the sweep told me that escalation was dead and to
clear it.** It was not dead. F2.

## GROUND

```
UTC            2026-09-23T00:15:44Z
origin/main    0e2458f4            (git fetch origin +refs/heads/main:..., then git rev-parse --short)
dev tree       main @ 0e2458f4     C:\ProjectOperations2   (0 ahead / 0 behind at start)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

**doc version and bootstrap AGREE (1 = 1).** No read-only clamp; full authority run.

This was a **SIGHTED** run. Desktop Commander tools were loaded via `ToolSearch` FIRST, by keyword
(`desktop-commander`), never by a hard-coded id; `start_process` shell `powershell.exe` then
returned PID 18492 and `Test-Path C:\ProjectOperations2\docs\pipeline\DOCTRINE.md` → `True`.
Every `[MEASURED]` line below came from that shell, a second read-only shell (PID 22492), or `gh`
through one of them.

⚠️ **Which tree, and which copy.** I read all three binding documents in the **dev tree**, never
the watcher clone. PREFLIGHT §2 asks for `git show origin/main:<path>`; I read the **working copy**
and proved it equivalent first rather than asserting it —
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, which §9.2 names as the real answer, at a dev
tree reading `0	0`. Read in full: 1,592 + 2,727 + 571 = **4,890 lines**.

## WHAT I MEASURED

**1. Device-bridge git guard — exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit status of the
**installer itself**, nothing piped into `tail` or `Select-Object`:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
GUARD_EXIT=2
```

Exit **2** is the outcome the contract names as EXPECTED for a station, because the shell a station
is given is non-interactive and non-login. Its own controls printed in the output:
`bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`. **The ban held
by memory: I ran no `git` against the mount this run, by any path.**

**2. The sweep, and its verdict.** [MEASURED] `status-sweep.ps1`, **exit 0**, captured with `*>`
and decoded `utf16le` — the capture opened `FF FE` at **152,686 bytes**, so the §9.3 trap is live
and I did not read it raw. Section 0 positive controls **both passed** (`gh CAN reach GitHub (saw
merged PR #2105)`, `node runs`). Section 7:

```
SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

`[BROKEN]` over the decoded capture → **1 hit, and it is the HOW-TO-READ legend**, not a section-0
failure. `index.lock` interactive/clone `False / False`; scoped git processes **0**; no PR touched
in 2 min.

⚠️ The first `interact_with_process` call carrying the sweep returned `timed out after 180s` at the
transport. Per §9.1 I treated that as a claim to falsify, not a fact: `read_process_output` on the
same PID returned `SWEEP_EXIT=0` and `MARKER_SWEEP_DONE`. **The shell was alive and the script had
completed** — output pending, not absent. I put a literal marker after every statement for exactly
this reason (§9.1 guard 1).

**3. Q1 — the board. 0 open PRs, therefore 0 DIRTY.** [MEASURED]
`gh pr list -R GH-Mantova/ProjectOperations --state open --limit 100 --json ...` → exit **0**,
**2 characters** of stdout, i.e. the literal `[]`. `-R` on every call and `$LASTEXITCODE` tested
before parsing (§9.4's CWD bullet). An empty board is precisely the reading §9.6 forbids taking on
trust, so:

| control | result |
|---|---|
| same query, `--state merged --limit 12` | **12** rows, newest `#2105` |
| same query, `--state all --limit 5` | **5** rows, all `MERGED` |
| NEGATIVE control `gh pr view 999994 --json number,state` | **exit 1**, `GraphQL: Could not resolve to a PullRequest` |

The negative control asks a **server** field, never `--json number` alone, which §9.4 records as
answering `{"number":N}` at exit 0 for every integer. **The empty board is real.**

**4. Q1 continued — the trunk is GREEN, and the sweep's line was already out of date.** The sweep
said `main CI on 0e2458f4: 2 success / 0 failed / 2 running -- not yet green`. Re-derived from its
own source eleven minutes later per §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`, with the **full
40-char SHA** (§9.4): `gh run list --commit 0e2458f4e52489a6615a999c1a0b728b2fdf4fe1` → **4 runs,
every one `success`** — `CodeQL`/dynamic, `CI`/push, `Deploy`/push, `Tendering Browser Smoke`/push.
No `Dependabot Updates` run on this commit, so the trunk-verdict scoping defect did not fire here.

**5. Q3 — armed prompts, counted myself, not quoted from a note.** [MEASURED] in
`C:\ProjectOperations2\docs\pr-prompts`, depth 1: `*-ready.md` → **0** · `*-HOLD.md` → **18** ·
`*-LOOPING.md` → **0** · root breadcrumbs `00-*.md` → **2** (the two collected below).
`.arming-log.txt` is **byte-unchanged this run** — I armed nothing and disarmed nothing.

**6. COLLECT — freshness, crossed against `lastRunAt`, which the breadcrumb alone cannot do.**
[MEASURED] `node scripts\pipeline\check-breadcrumb.mjs --freshness` → **exit 0**, `CLEAN`,
`structure: 2 checked, 0 malformed`:

| station | `--freshness` | `lastRunAt` (scheduled-tasks MCP) | verdict |
|---|---|---|---|
| 00 | `2026-09-22T23:30:00Z  0.9h  (cadence 1h)  ok` | `2026-09-23T00:14:49Z` — **this run** | aligned |
| 03 | `2026-09-22T23:29:00Z  0.9h  (cadence 24h) ok` | `2026-09-22T23:28:57Z` | aligned |
| 04 | `2026-09-22T22:11:00Z  2.2h  (cadence 4h)  ok` | `2026-09-22T22:10:01Z` | aligned |
| 05 | `2026-09-22T14:23:00Z  10.0h (cadence 24h) ok` | `2026-09-22T14:23:04Z` | aligned |

**No station is SILENT and no occurrence was missed**, so the session-directory scan the station
doc prescribes for a disagreement had no subject this run. ✅ `CADENCE['00']` reads **1h**,
confirming again that the `'00': 2` defect is closed.

**7. Q4 — every claim I inherited, re-verified. Three of Station 03's five were already stale.**
[MEASURED] in the same minute:

| 03's claim, 23:29Z | my measurement, 00:4xZ | status |
|---|---|---|
| F2 — clone `0 ahead / 37 behind` | `git rev-list --left-right --count HEAD...origin/main` in the clone → **`0	0`** | **resolved** |
| F3 — clone `dirty=4`, all untracked | `git status --short` → **0** · `--porcelain --untracked-files=no` → **0** | **resolved** |
| F4 — orphaned worktree `C:\po-wt\rets7` | `git worktree list` → dev tree only · `Test-Path` → **False** | **resolved** (by my 23:30Z run) |
| F1(b) — §9.5's cure names `logs\<yyyy-MM-dd>.log` | `Take the NEWEST` → **5** hits · `Filter to the daily-log NAME SHAPE first` → **1** | **already landed** |
| F6 — §9.5 names the freeze probe without its path | `.queue-state.json` → **1** hit · the path → **0** · `QUEUE_STATE_FILE` → **0** · NEGCTRL **0** | **confirmed live** |

🔴 **One of those readings is a trap and I am naming it so the next run does not spring it.** On F3
the two `git status` forms **agreed at 0**, and §9.5's bullet on that pair offers *"if they ever
agree, this bullet is wrong and must be re-measured"* as its falsifying probe. **That probe requires
an untracked file to be present**, and none was. Agreement on an empty tree is not a refutation —
reading it as one retires a live bullet.

**8. Q5 — the newest silent no-op is EXPLAINED, not new.** [MEASURED]
`no-pr-opened/pr-scopecards-s7-one-cutting-total-b-ready.md.log`, 516 B, mtime `2026-09-22T17:25:40Z`,
`Exit: 0`. Body, verbatim: the agent found the prompt *"marked `STATUS: Staged HOLD ... Arming is
Marco's`"* and **refused to dispatch it**. That is a **prose** human gate — invisible to
`lint-prompt.mjs`'s three regexes and to any grep built on them (§9.5), which is why it was armed at
`17:25:14Z` and disarmed 95 seconds later at `17:26:49Z`. The work shipped anyway as **#2093**
(21:24:16Z) and its HOLD was retired by **#2103**; `Test-Path` on that HOLD → **False**. **The
prompt is spent and must not be re-armed.** Already handled by my 21:15Z and 23:30Z runs.

**9. The `[STALE]` row, and the discharge test the station doc mandates.** [MEASURED] over the
decoded capture: `[STALE]` → **5 lines**, of which three are the legend/footer and one is the
`no station summary younger than 3 days` line. Exactly **one** is PR-scoped and carries the
`escalation is DEAD, clear it` instruction. Asked per-PR, never from a LIST response (§9.4):

```
gh pr view 2100 -R GH-Mantova/ProjectOperations --json number,state,mergedAt,mergedBy,files
  state=MERGED  mergedAt=2026-09-23T00:09:53Z  mergedBy=GH-Mantova
  FILE: Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html
  FILE: docs/pr-prompts/pr-scopecards-s9-transport-capacity-matrix-HOLD.md
```

The station doc requires more than the merge before discharging: *"confirm nothing GENERAL survives
the merged PR"*. It does not:

| probe | result |
|---|---|
| `Claude Design` in `STATION-CAPABILITIES.md` (the lane record) | **0** |
| `Claude Design` in `scripts/pr-gates/pr-gates.mjs` (the CI gate) | **0** |
| POSITIVE control `CP-24` — the lane gate that does exist | **5** in pr-gates, **1** in capabilities |
| NEGATIVE control, freshly minted needle | **0** |
| `docs/decisions/merge-approvals/2100.md` | **False** |

**10. Who merged `#2100` — and the honest answer is that the repo cannot tell me.** [MEASURED] per
§10.2.1, reading the PR's own commit list rather than the squash commit: the authoring commit
`f14be0b9` reads `PR Supervisor,Claude Opus 5 <supervisor@local,noreply@anthropic.com>` — the
**dev tree** identity, i.e. my own station staging it. The other seven are
`Merge branch 'main' into docs/stage-scopecards-s9-transport-capacity` by
`GH-Mantova <273896040+…noreply>`, which §10.2.1's table maps to **the GitHub web UI / API**, the
identity every update-branch and every squash merge carries. `mergedBy` reads `GH-Mantova` for
every merge on this board, agent and human alike. **There is no receipt.** So the actor is
`[CANNOT MEASURE]` from the repo alone. The available and overwhelmingly likely reading is that
Marco took option **(c)** of my 23:30Z F2, which was his to take; I am recording the gap rather
than naming an actor, because a scheduled run has already filed a forgery accusation off this exact
ambiguity and had to retract it (§10.2.1).

**11. Watcher and queue health — reported, not inferred.** [MEASURED] from the sweep, section 2:
watcher node **RUNNING pid 9744**; auto-restart wrapper **alive (1)**; heartbeat age **24 min**;
watcher clone `branch=main dirty=0`; non-main worktrees **none**; guard hook present. With
`armed: 0`, a stale heartbeat is **idle, not wedged** — the reading §9.5 prescribes.
**I did not run `restart-watcher-if-wedged.ps1 -Fix` and did not restart anything**: its
preconditions are not met, and an idle watcher with nothing armed is CORRECT. Queue exception
folders: `needs-marco/` 62 · `no-pr-opened/` 111 · `failed/` 59 · `blocked/` 150.

**12. Q6 — the single most important thing blocking progress.** Nothing is blocking the board:
zero open PRs, zero armed prompts, trunk green, watcher healthy. The binding constraint is one
level up — **`Claude Design/` has no lane, so the mockup-carrying staging PRs this pipeline is now
producing each need Marco by hand** (F1).

## WHAT CHANGED

| # | change | read-back |
|---|---|---|
| 1 | `docs/pipeline/DOCTRINE.md` §9.5 — the freeze-probe bullet now names **where** `.queue-state.json` lives, with its `QUEUE_STATE_FILE` anchor and 03's measurement (closes 03's F6) | byte delta **+639** then **+7**, both **equal to the expected delta**; `OLD_GONE=true`; `NEW_PRESENT=true`; NEGCTRL `false` |
| 2 | `docs/pipeline/stations/_canonical-blocks.json` — `instruments` v2 sha re-recorded `88e8785af154a2b7` → `21240ab808fb7cf9` | `node scripts/pipeline/lint-station.mjs` → **exit 0**, `ADMIT: all 8 docs clean` |
| 3 | 03's 23:29Z breadcrumb committed into `docs/pr-prompts/archive/` (it was UNTRACKED and reached nobody) | copied as a raw byte buffer, `srcBytes=dstBytes=25504`, `byteExact=True` |
| 4 | my own 23:30Z breadcrumb `git mv`-ed to `archive/` — every finding in it now carries a disposition | `git diff --cached --name-status` → `R100` |
| 5 | this breadcrumb, written **inside this PR's worktree** (cure 1), never into the dev tree | see the PR diff |

🔴 **Edit discipline, because the linter caught me.** My first version of change 1 spelled the
*wrong-guess* path as a literal repo path, and `lint-station.mjs` **REJECTed DOCTRINE** for it:
`x names a repo path that git does not track`. I rephrased rather than suppressed, re-recorded the
hash, and re-ran to **exit 0**. Recorded because the gate working is evidence worth keeping, and
because a station editing binding law is the change a reader should most distrust.

**I armed nothing, merged no PR opened by anyone else, removed no label, touched no `/sot/`, wrote
no production data, ran no migration, restarted nothing, deleted nothing, and went nowhere near
Azure / Entra / SharePoint.**

## FINDINGS

---

**F1 — `#2100` merged, which settles the instance and leaves the rule untouched: `Claude Design/`
still has no recorded lane and no CI gate.** Severity **S3**.

My 23:30Z run declined to merge `#2100` because one of its two files,
`Claude Design/proposed/s8-s9-haulage-capacity/haulage-capacity-mockup.html`, matches none of
`classifyPolicyFiles`'s three `NESTED_TEST_PATHS` forms and sits outside Station 00's recorded
`docs/` lane, making it Marco's under §10.1 step 2. It merged at `00:09:53Z` (WHAT I MEASURED §9).

That is option **(c)** of the three my 23:30Z run put up, and (c) was flagged at the time as
*"fails the future half"*. WHAT I MEASURED §9 now measures the consequence with controls: the lane
record and the gate are both still **0**, against a positive control of **CP-24 at 5 and 1**. So
the next staging PR carrying a mockup stops the board identically, and this run already staged
none only because it staged nothing at all.

**RULE 1 options — complete-and-additive FIRST, and which half each alternative fails:**

- **(a) Give `Claude Design/` a recorded lane, gated by CI.** Add it to 00's row in
  `STATION-CAPABILITIES.md` §5 **and** ship a `pr-gates.mjs` check hard-blocking any PR mixing
  `Claude Design/` with `apps/`, `packages/`, `scripts/`, `.github/`, `package.json`,
  `pnpm-lock.yaml` or `migrations/` — the way CP-24 proves 05's lane, which is the precedent the
  positive control above measures. §10.1 step 3's own proviso **requires** exactly this before any
  new lane outside `tests|docs` may exist. **Fails neither half.**
- **(b) Home mockups under `docs/design/proposed/…`.** Immediate, permanent, needs no new gate,
  because the path is then already inside `^(tests|docs)/`. **Fails the data-entry half in the
  workflow sense** — it moves a designer-facing artefact out of the folder the design workflow reads.
- **(c) Marco merges each one by hand, as happened here.** Clears the instance. **Fails the future
  half** — it recurs on every mockup-carrying staging PR, which is now a recurring shape.

**DISPOSITION: ESCALATED.** The escalation file
`needs-marco/scopecards-s9-staging-pr-carries-a-claude-design-file-outside-station-00s-lane-2026-09-22.md`
is **kept, not discharged** (F2), and annotated with the post-merge measurement. ⚠️ That folder is
gitignored and `git ls-files -- docs/pr-prompts/needs-marco/` returns **6** tracked files, **not
including that one** — so the annotation reaches nobody on its own and this finding is its only
published home. **I did not widen my own lane in `STATION-CAPABILITIES.md`**: a station granting
itself authority is the one edit a reader should distrust, and §10.1 step 3 requires the CI gate to
come with it.

---

**F2 — The sweep's section-5 `[STALE]` line instructed me to clear a LIVE escalation. Its two
recorded corrections do not cover the case where the SUBJECT PR merges but the escalation's
question is GENERAL.** Severity **S2**.

Verbatim, the only PR-scoped `[STALE]` line this run:

```
[STALE] scopecards-s9-staging-pr-carries-a-claude-design-file-outside-station-00s-lane-2026-09-22.md
        references #2100 which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.
```

`#2100` **is** merged and **is** the escalation's subject, named on its first heading — so the
instrument is working exactly as written. The instruction is still wrong, because F1's question
survives its subject PR by construction: the escalation asks whether `Claude Design/` should have a
lane, and cites `#2100` as the instance that raised it.

[MEASURED] from `status-sweep.ps1`'s own source, the verdict site and its two recorded corrections:

- `Line "STALE" ($f.Name + " references #" + $n + " which is MERGED — escalation is DEAD, clear it…")`
  fires on `$isSubject -and $isMerged`, with no third term.
- Its comment block records correction **(a)** CLOSED-collapsed-into-MERGED, and **(b)** cited
  evidence read as subject — *"a ref counts as the SUBJECT only if the number is announced in the
  FILENAME or on the file's FIRST HEADING LINE"* — plus a *"KNOWN AND ACCEPTED TRADEOFF"* covering
  the opposite false negative. **Neither correction, and not the accepted tradeoff, covers a
  correctly-identified subject whose merge answers only the instance.**

🔴 **Why this is S2 rather than a wording nit.** The line is an imperative that ends *"Do NOT report
it as pending"*, and it is the one class of line a collect run is told to act on during COLLECT.
The station doc is what saved this run — it requires *"confirm nothing GENERAL survives the merged
PR"* before discharging — so the **doctrine is right and the instrument contradicts it**. A run that
follows the sweep's imperative discharges F1 into `discharged/` and Marco never sees the lane
question again. `archive/` already records eleven dead escalations surviving ten days from the
opposite failure; this is the same cost with the sign flipped.

⚠️ **This is not the already-superseded prompt.** `git ls-tree -r origin/main -- docs/pr-prompts/`
places `pr-sweep-stale-check-retires-live-escalations-HOLD.md` in **`superseded/`**, and the source
comments show why: corrections (a) and (b) shipped. **This is a third case that neither covers.**

**RULE 1 options — complete-and-additive FIRST:**

- **(a) Demote the verdict from an instruction to a question.** Keep the detection exactly as it is
  and change the emitted text to name the test the station doc already requires — e.g.
  *"subject #N is MERGED — the INSTANCE is resolved; open the file and confirm nothing GENERAL
  survives before clearing it."* Solves it now and in future, cannot retire anything, discards no
  detection, and costs one string. **Fails neither half.**
- **(b) Add a machine-readable `scope: instance|general` field to the escalation front matter and
  gate the STALE verdict on `instance`.** Stronger, and **fails the data-entry half** — 62 existing
  escalations carry no such field, so the verdict silently changes meaning for all of them until
  each is edited by hand.
- **(c) Leave it and rely on the station doc's general test.** Zero cost today. **Fails the future
  half** — it relies on every future run reading a caveat in a 1,592-line document to override an
  imperative printed at the point of action, which is the arrangement that produced this finding.

**DISPOSITION: ESCALATED.** `scripts/pipeline/status-sweep.ps1` is outside Station 00's recorded
`docs/` lane, and `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` names `status-sweep.ps1`
(`#2059`) by name as precisely the class a station must not merge for itself — so I did not edit it.
Filed with F1 in the same escalation file and restated here because that folder reaches nobody.
⚠️ **Falsifying probe:** re-run the sweep against an escalation whose subject PR has merged and
whose question is general. If section 5 ever emits anything but the `escalation is DEAD, clear it`
imperative for it, this finding is wrong and must be re-measured.

---

**F3 — COLLECT: Station 03's F6 — DOCTRINE names the authoritative freeze probe without saying
where the file lives, and the natural guess returns a confident false absence.** Severity **S3**,
as 03 filed it.

Re-verified rather than accepted (WHAT I MEASURED §7): `.queue-state.json` occurs **once** in
`DOCTRINE.md`; the path occurs **0** times; the `QUEUE_STATE_FILE` anchor **0** times; negative
control **0**. 03's own measurement stands — probing the same filename beside the queue returns
`False` in **both** trees, at exit 0, and the available conclusion retires the pipeline's only
authoritative freeze probe on a path typo.

**DISPOSITION: ACTIONED** — fixed in this PR. The bullet now names
`<watcher clone>/scripts/pr-watcher/.queue-state.json`, cites the `const QUEUE_STATE_FILE` anchor
rather than a line number (§9.5's opening rule), and carries 03's measurement so the next reader
knows what the wrong guess looks like. Verified by byte-delta equality on both edits, `OLD_GONE`,
`NEW_PRESENT`, a negative control, and `lint-station.mjs` **exit 0 / ADMIT all 8 docs** after
re-recording the canonical hash.

---

**F4 — COLLECT: Station 03's F1 — the watcher writes today's output into a file named for the day
it launched. Half of it is already fixed; the surviving half is not mine.** Severity **S2**, as 03
filed it.

03's mechanism is sound and I am not disputing it: `start-watcher.ps1` (anchor:
`$LogFile = Join-Path $LogDir`) computes the name **once, at launch**, from a `Get-Date` with no
`-AsUTC`, and every later write is `Add-Content` against that frozen value.

🔴 **But 03's proposed remedy (b) — *"amend §9.5's cure to say the newest file in that directory,
not the file named for today"* — has been landed since 2026-09-06/07 and needs no action.**
[MEASURED] over `DOCTRINE.md`: `Take the NEWEST` → **5** hits and `Filter to the daily-log NAME
SHAPE first` → **1**. §9.5 already says *"take the NEWEST `*.log` in that directory by
`LastWriteTimeUtc`, and never construct the name from a date, in either clock"*, and the 09-07
correction adds the name-shape filter that stops `supervisor.log` winning. **03 read the 09-06T17:5xZ
correction, which does name `logs\<yyyy-MM-dd>.log`, and did not reach the two corrections printed
below it** — the hazard §9.5 records about its own layering, arriving from a reader rather than a
probe.

What survives is 03's remedy **(a)**, the code fix. That is `scripts/pr-watcher/**`, which the
station doc's SCRIPTS section puts explicitly outside my hands — *"the watcher owns its own
lifecycle"* — and outside 00's `docs/` merge lane besides.

**DISPOSITION: ESCALATED** — remedy (a) only, folded into the same escalation file. Remedy (b) is
**closed as already-landed** and named here so a third run does not re-derive it.
⚠️ **Falsifying probe, 03's own:** compare the newest `*.log` under the clone's
`scripts\pr-watcher\logs\` against the date in its own filename after the watcher has been up
across a midnight. If they ever match, the finding is wrong.

---

**F5 — COLLECT: Station 03's F2, F3 and F4 were all resolved by events before I read them.**
Severity **S4**.

All three re-measured in one minute (WHAT I MEASURED §7): the clone is `0	0`, not 37 behind; both
`git status` forms read **0**, not `dirty=4`; the `C:\po-wt\rets7` worktree is gone,
`Test-Path` → **False**, torn down by my own 23:30Z run under BOARD DRIVING condition 2. 03 was
report-only and correct to dispatch rather than act; the dispatches simply arrived after the
conditions had cleared.

🔴 **One caveat matters more than the closures.** On F3 the two `git status` forms **agreed at 0**,
and §9.5's bullet on that pair nominates *"if they ever agree, this bullet is wrong"* as its
falsifying probe — but that probe is explicitly *"while an untracked file is present"*, and none
was. **Agreement on a clean tree is not a refutation.** A run that reads it as one retires a live
bullet, which is this section's most expensive recurring mistake.

**DISPOSITION: ACTIONED** — verified closed, with the caveat recorded so the closure does not take
a live DOCTRINE bullet down with it. Nothing to dispatch onward.

---

**F6 — COLLECT: Station 03's F5 (a PR closed seven days ago still sits in `conflictedPrs`) and F7
(the guard installed INERT).** Severity **S4** each.

F5: `.queue-state.json` carries `conflictedPrs: [1960]`; `#1960` closed unmerged on
`2026-09-16T03:39:47Z`. Nothing prunes an entry once its PR leaves the board, and nothing gates on
the list today. 03's DEFERRED was correct and I am not overturning it.

F7: reproduced exactly on my run — same **exit 2**, same headline (WHAT I MEASURED §1). It is the
contract's documented middle outcome, not an anomaly.

**DISPOSITION: DEFERRED** (both, carried forward unchanged). **What would make either urgent:** for
F5, the list growing past a handful, or any code beginning to gate on `conflictedPrs` — a merge
guard, a sweep escalation, a watchdog — either of which turns monotonic stale state into a false
block; for F7, an exit outside `{0,2}`, or a fresh 0-byte `index.lock` with no owning Windows
process.

---

**F7 — The binding-read contract cost the 22:14Z occurrence its entire run, and this run read all
4,890 lines and still finished. The escalation is not refuted by that.** Severity **S2**.

My 23:30Z run measured the 22:14Z occurrence dying on its eighth `Read` while still ingesting its
binding documents, and escalated against
`needs-marco/binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`. This run read the
same 4,890 lines in full and reached COLLECT, the board, a DOCTRINE edit and a PR.

🔴 **Two runs of the same station, same contract, opposite outcomes — so the variable is the run's
budget, not the contract, and a single completed run must not be quoted as refuting the
escalation.** Writing that down is the point of this finding: the next reader will otherwise meet a
green run and an open escalation and conclude the escalation is stale, which is F2's failure mode
reached from a different direction.

**DISPOSITION: ESCALATED** — carried forward unchanged to the existing escalation, with this run
added as the counter-example rather than as a closure. **I did not edit the binding documents to
shorten them**: a station trimming its own binding law is exactly the change a reader should
distrust, and §5.5 makes the scope of a station's required reading Marco's call.

---

## WHAT I DID NOT DO

- **Did not discharge the `[STALE]` escalation**, though the sweep printed `escalation is DEAD,
  clear it. Do NOT report it as pending.` F1 and F2 are why. Nothing was moved into
  `needs-marco/discharged/` and no `_DISCHARGE-NOTE-*.md` was written, because nothing was
  discharged.
- **Did not merge, close or reopen anything.** The board held zero open PRs from the first query to
  the last; there was nothing to drive. `Assert-SmokedOrEscalate` and `Merge-Pr` were not called
  because no PR existed to call them on — not because I merged by another route.
- **Did not arm anything.** `armed: 0` before and after, `.arming-log.txt` byte-unchanged. The
  backlog's one `READY TO STAGE` item (`rates-11c-blocked-consumers`) is a *staging* recommendation
  whose chain is gated on a parity proof that must have RUN and come back clean; the two
  `UNBLOCKED, BUT NEEDS MARCO` items both carry `DO NOT AUTO-STAGE`. None of the 18 HOLDs was
  promoted, and I ran no `triage-holds.ps1` arming pass, because with an empty board and a healthy
  idle watcher the arming decision is not this run's bottleneck — F1 is.
- **Did not edit `scripts/pipeline/status-sweep.ps1` (F2) or `scripts/pr-watcher/start-watcher.ps1`
  (F4)**, though I can see both fixes. Both are outside 00's recorded `docs/` lane, and
  `status-sweep.ps1` is named by `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` as the exact
  class of out-of-lane merge a station is most tempted to make. Written up as options for Marco
  instead.
- **Did not widen 00's lane in `STATION-CAPABILITIES.md`** to cover `Claude Design/`. §10.1 step 3
  requires a CI gate to land with any new lane outside `tests|docs`; a self-declared lane is not a
  classification.
- **Did not restart, kill or touch the watcher**, and did not run `restart-watcher-if-wedged.ps1
  -Fix`. Node running, wrapper alive, `armed: 0` — an idle watcher with nothing armed is CORRECT,
  and its preconditions were never met.
- **Did not name an actor for `#2100`'s merge.** The repo cannot discriminate one (WHAT I MEASURED
  §10); I recorded the gap instead.
- **Did not re-triage the 58 older `failed/` entries or the 110 older `no-pr-opened/` entries.**
  Only the newest was new-to-me, and §8 shows it already dispositioned.
- **Did not run `git` against the mount**, not once, by any path — the guard was INERT (F6) and the
  ban held by memory.
- **Did not touch `/sot/`, remove a label, write production data, run a migration, or go near
  Azure / Entra / SharePoint.**
- **Did not leave this breadcrumb in the dev tree or in the session's `outputs` folder.** It was
  written inside this PR's own worktree (cure 1), so no loose untracked copy exists to block the
  next fast-forward.

<run-summary>Sighted run on an empty board with a green trunk and a healthy idle watcher: the sweep's one PR-scoped [STALE] line instructed me to clear an escalation that is still live, the station doc's "confirm nothing GENERAL survives" test is what caught it, and Station 03's six dispatched findings resolve to one fixed here in DOCTRINE, one already-landed, three closed by events and two escalated.</run-summary>
