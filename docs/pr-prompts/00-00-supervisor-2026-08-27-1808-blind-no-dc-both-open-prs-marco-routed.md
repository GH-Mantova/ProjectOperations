# Station 00 — Supervisor | 2026-08-27T18:08Z–2026-08-27T18:26Z

**FIRST LINE: this run was BLIND FOR THE BOX. Desktop Commander exposed zero tools. No board
mutation was performed and none was possible. A blind run and a quiet board both produce "no news" —
this was the blind kind.** Doc version and bootstrap version MATCH (1 = 1), so no version fault.

## GROUND

```
UTC            2026-08-27T18:08Z (start) — 2026-08-27T18:26Z (end)
origin/main    d23d6cfb   [MEASURED via GitHub API] — no local fetch; `git` over the workspace
                          bridge against the Windows .git is a HARD STOP (stale index.lock)
dev tree       branch/SHA [CANNOT MEASURE] — no git. Content probe proves it is BEHIND main:
                          scripts/pipeline/check-breadcrumb.mjs still carries CADENCE['03'] = 4,
                          which #1355 changed to 24 and merged to main at 16:31:31Z.
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md)
```

**Provenance for the whole report (DOCTRINE §7.1).** Desktop Commander was absent, so there was no
PowerShell on the host. What I *did* have is the workspace mount of the **dev tree itself**
(`C:\ProjectOperations2`) and of `C:\po-watcher`, read-only in practice because `git` is forbidden
over that bridge. Filesystem claims below are therefore measured against **the tree the watcher
globs**, not against `origin/main` — the substitution the preflight forbids was not made. GitHub API
reads are used only for PR/commit state and are labelled as such.

## WHAT I MEASURED

**1. Desktop Commander — absent. [MEASURED]** Four `ToolSearch` calls over ~110 s
(`desktop-commander`; `start_process powershell interact_with_process read_process_output`;
`desktop commander start process terminal`; `execute command windows shell process file read
write search`). The server sat in the "still connecting" list for the first two and then left that
list **without registering a single tool**. That is a failed bring-up, not a slow one.

**2. Preflight step 1 consequences. [MEASURED, by absence of the tool]**

| Capability | State this run |
|---|---|
| Arm (`git mv` tracked `-HOLD.md` → `-ready.md`) | **IMPOSSIBLE** — needs git on the host |
| Merge (`Assert-SmokedOrEscalate` → `Merge-Pr`) | **IMPOSSIBLE** — `gh` lives on the box |
| FF the clone / clear a lock / read a PID | **IMPOSSIBLE** |
| Read the dev tree + watcher clone | **AVAILABLE** (workspace mount) |
| Read PR / commit / check-run state | **AVAILABLE** (GitHub API) |

**3. Board. [MEASURED — GitHub API, 18:1xZ]** Two open PRs, no others.

- **#1356** `fix(crm-s1): wire assigneeId into createTask; add account picker to RelationshipsPage
  note form` — head `ae10cdd1`, opened 16:25:45Z. **13/13 check-runs `success`**, every one started
  16:33–16:34Z (post-fuse, so the 12:00Z dated-time-bomb class does not apply).
- **#1353** `feat(pipeline): check-sot-refs + wire five sot/pipeline checkers into CI` — head
  `7e087844`, unchanged since 16:33Z.

**4. RULE-2 probe — the `processed/*.log` `"marco":true` probe, run on both. [MEASURED]**
Label-only checks are wrong on half the board; this is the live probe.

```
docs/pr-prompts/processed/pr-crm-lastmile-s1-unblank-todos-and-notes-ready.md.log
  [watcher] merge result for PR #1356:
  {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/CommsHubPage.tsx"}

docs/pr-prompts/processed/pr-lessons-folder-s3-ref-checker-ready.md.log
  [watcher] merge result for PR #1353:
  {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}
```

**BOTH OPEN PRs ARE WATCHER-ROUTED TO MARCO. RULE 2 binds on both. Neither was merged.**

**5. The #1356 routing reason is TRUE, not a phantom. [MEASURED — `get_files` on #1356]** The PR
changes exactly three files and `apps/web/src/pages/crm/CommsHubPage.tsx` is one of them (+37/−6),
alongside `RelationshipsPage.tsx` (+75/−5) and a new pure-logic test file (+122). Worth pinning
because the last two runs each found a routing reason that named a file the PR did not touch; this
one does not. No verdict-guard defect here.

**6. Arm-to-pickup — the watcher WAS alive after the last run. [MEASURED]** The prompt the 16:08Z
run armed is now consumed: `pr-crm-lastmile-s1-unblank-todos-and-notes-ready.md` and its `.log` sit
in `docs/pr-prompts/processed/`, log mtime 16:26Z (host clock is UTC+10; the mount reports
`2026-08-28 02:26 +1000`). PR #1356 was opened 16:25:45Z. **Watcher confirmed alive at 16:26Z.**
Liveness *now* is **[CANNOT MEASURE]** — PID identity is the only probe that works and it needs the
host. Log growth, heartbeat age and `.remember/now.md` mtime all lie; I did not quote them.

**7. ARMED count = 0. [MEASURED]** `ls docs/pr-prompts/*-ready.md` at depth 1 returns nothing.
Re-measured immediately before writing this file — still 0.

**8. Collector. [MEASURED]** `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit 1:
62 checked, 9 malformed, 7 skipped as pre-contract. Freshness: `00 ok (2.1h)`, `03 SILENT (19.2h,
cadence 4h)`, `04 ok (4.0h)`, `05 ok (4.0h)`.

**9. No new station breadcrumbs since the 16:08Z run. [MEASURED]** Newest breadcrumb mtimes
(converted from host UTC+10): 04's `1410` and 05's `1411` both landed 14:21Z and were already
collected by the 16:08Z run; the newest file of all is the 16:08Z run's own, at 16:30Z. Nothing
from 03 or 06.

## WHAT CHANGED

**Nothing.** No prompt armed, no prompt disarmed, no PR merged, no label touched, no file in `sot/`,
no git command run against the Windows `.git`, no `az` / Graph call. The only write this run made
anywhere is this breadcrumb.

## FINDINGS

### Finding 1 — Desktop Commander absent again; the blind rate is 23%, not the ~14% on record

**[MEASURED]** Counting `docs/pr-prompts/00-00-supervisor-2026-08-2[67]-*.md`: 21 supervisor runs
since 2026-08-26T00:00Z, and this run makes 22. Four of the 21 are named `*blind*` (08-26 0610,
08-26 1010, 08-26 1811, 08-27 1009); with this run that is **5 of 22 = 22.7 %**. The figure carried
in project memory was ~14 %. It is roughly **one run in four**, and each blind run costs the board
its only actor: nothing can be armed and nothing can be merged for two hours.

The open escalation already proposes **A: bounded preflight retry + a BLIND marker the next run must
acknowledge.** This run is evidence for the first half — I retried four times over ~110 s and the
server never registered, so a *bounded* retry would not have rescued it. The second half is what
matters more: four consecutive blind runs have now been written and **no later run has acknowledged
any of them**, because nothing forces it to.

**DISPOSITION: ESCALATED** — question for Marco, same option set, with a sharpened number.
Option A (complete + additive, RULE 1: passes both halves) — keep the bounded retry, and add a
`BLIND` marker file that the next run's preflight must read and acknowledge in its GROUND block;
touches no data entry, existing or future, and closes the loop permanently rather than per-run.
Option B (retry only) — fails the *complete* half: it does nothing when the bring-up fails outright,
which is what happened here. Option C (accept the rate, run 00 hourly so a blind slot costs less) —
fails the *complete* half too, and doubles the number of runs that can collide on the shared index.

### Finding 2 — the bootstrap's blind path produces a breadcrumb the linter must REJECT

**[MEASURED]** `00-00-supervisor-2026-08-27-1009-blind-desktop-commander-absent.md` is a careful,
accurate report — and `--freshness` **REJECTs** it for `missing section` on all five of `## GROUND`,
`## WHAT I MEASURED`, `## WHAT CHANGED`, `## FINDINGS`, `## WHAT I DID NOT DO`. It is one of the 9
malformed breadcrumbs in the count above.

The cause is a contradiction between two live documents. The scheduled-task bootstrap says of a
failed step 1: *"write one paragraph saying you are blind … and END THE RUN."* The report contract
in `00-supervisor.md` says *every* run writes a breadcrumb in the fixed five-section order. A run
that obeys the bootstrap literally writes something the collector rejects — so the loudest report
this pipeline can produce is the one most likely to be filtered out as malformed. That is exactly
backwards from the intent, which is that blindness be reported *as loudly as a defect*.

This breadcrumb is the existence proof that the two can be satisfied at once: it is five-section
compliant and it still leads with the blindness. The fix belongs in the repo layer an agent can
change — one clause in the station doc's preflight step 1: *"end the run"* → *"take no board action
and end the run, after writing the standard five-section breadcrumb with BLIND as its first line."*

I did not open that PR. Opening a board PR is a mutation, and this run is blind by the same
preflight that would authorise it; the honest move is to hand over verified text rather than push
from an instrument I cannot fully check.

**DISPOSITION: ESCALATED** — one-clause doc change, text above, ready to apply.

### Finding 3 — #1355 merged to main, but the dev tree still runs the old collector

**[MEASURED]** `#1355` merged at 16:31:31Z; `main` head is `d23d6cfb`. The dev tree's
`scripts/pipeline/check-breadcrumb.mjs:35` still reads `CADENCE['03'] = 4`. So the `03 SILENT
(19.2h, cadence 4h)` line printed above is **the known false SILENT**, produced by a stale copy of
the very instrument that was fixed 1.7 h ago. 03's real cadence is daily and its last report was
2026-08-26T23:01Z, which at 24 h is inside tolerance.

The durable point is not the cadence — that is fixed. It is that **stations read the dev tree, so a
merged fix is inert until the dev tree is fast-forwarded.** Every instrument fix this pipeline lands
has a silent window of exactly that length, and during it the fixed instrument keeps lying with full
confidence. Nothing in the contract makes any station responsible for closing that window.

I could not FF the dev tree — that is git on the host. It self-heals the moment any actor with
Desktop Commander pulls.

**DISPOSITION: DEFERRED** — real, not actionable from a blind run. It becomes urgent the moment a
Station 00 run dispositions this false SILENT as a *real* one and dispatches work to 03 on the
strength of it; that is a live risk every run until the dev tree is FF'd. If it is still behind at
the next sighted run, that run should FF first and disposition second.

### Finding 4 — both open PRs are Marco-gated; #1356 is green and waiting on RULE 2 alone

**[MEASURED]** #1356 is 13/13 green, its routing reason is truthful, and the only thing standing
between it and `main` is RULE 2 — the human gate, clearable only by Marco in chat, for that batch
only. #1353 is unchanged and was already escalated at 14:08Z on its 115 unresolved `sot/**`
references, with **A: land non-blocking → clean refs → make blocking** recommended; that question
is open and is deliberately not re-asked here.

Consequence for the board: **ARMED = 0, both PRs gated, and the only actor was blind.** The queue is
stalled on two independent gates at once. The RULE-2 breach count stays at **8** — the sole merge
since the last run was #1355, which came from a hand-authored worktree with no prompt and therefore
no routing, so it is not a ninth.

**DISPOSITION: ESCALATED** — for Marco: #1356 is green and Marco-routed. Clear it in chat for this
batch, or leave it standing. No station may merge it.

### Finding 5 — nothing to collect

**[MEASURED]** No station wrote a breadcrumb between 16:08Z and 18:26Z. 04 and 05 last reported at
14:21Z and were collected by the 16:08Z run; 03's daily slot is not due; 06 has no scheduled task at
all, which is already escalated and is not re-raised here.

**DISPOSITION: ACTIONED** — collection ran, the queue of uncollected findings is empty, verified by
mtime on every `00-*` breadcrumb newer than 16:00Z.

## WHAT I DID NOT DO

- **No board mutation of any kind** — no arm, no disarm, no merge, no label, no re-run. Preflight
  step 1 failed; a blind station does not touch the board.
- **No `git`, at all**, including read-only commands, against `C:\ProjectOperations2\.git` over the
  workspace bridge. That is the hard stop that leaves a 0-byte `index.lock` with no process behind
  it and freezes every station. `origin/main` and the dev tree's divergence were established from
  the GitHub API and from file *content* respectively.
- **Did not quote a watcher liveness verdict for "now."** Arm-to-pickup proves it was alive at
  16:26Z. The probes that would speak to 18:26Z — PID identity, Keepalive result — all need the host.
  Log growth, heartbeat age and `.remember/now.md` mtime were available over the mount and were
  deliberately not used: they are on the record as lying probes.
- **Did not re-ask #1353's escalation.** Answered at 14:08Z, answer unchanged.
- **Did not open the Finding 2 doc PR**, for the reason stated in that finding.
- **Did not re-raise** 06's missing schedule, 06 arming out of lane, the CP-gate-not-required root
  cause, or `sot/03`'s nine `U+FFFD` — all standing, all already escalated.
- **This breadcrumb is UNTRACKED** until a board PR commits it. It reaches nobody until then. The
  next sighted Station 00 run should sweep it up along with the twelve other untracked breadcrumbs
  the collector is currently flagging with `NOTE ... UNTRACKED`.
