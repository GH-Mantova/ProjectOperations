# Station 00 — Supervisor | 2026-09-24T19:14:11Z–2026-09-24T19:40Z

## GROUND

```
UTC            2026-09-24T19:15:17Z
origin/main    d97806c9            (fetch first, then rev-parse)
dev tree       main @ d97806c9      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`), so this run was not restricted to read-only.

**This run was SIGHTED.** Not blind — named explicitly, because a blind run and a healthy quiet run
produce the same "no news".

---

## WHAT I MEASURED

### Reachability, guard, binding-read contract

- [MEASURED] Windows host reachable. Desktop Commander ids were **deferred**; a keyword `ToolSearch`
  for `desktop-commander` loaded them first, so a cold-call failure would have been an unloaded
  schema, not blindness. `start_process` shell `powershell.exe` → PID 44812, then
  `2026-09-25T05:14:45.9072663+10:00` / `main` / `d97806c9`.
- [MEASURED] **`vm-git-guard.sh` exit code: `2`**, read directly from the installer with no pipeline
  appended. Last line, verbatim:
  `PATH="/sessions/practical-brave-maxwell/.local/bin:$PATH" git <args>`
  Headline: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Its own controls, quoted: `bash -lc 'command -v git'` →
  `/sessions/practical-brave-maxwell/.local/bin/git`; `bash -c 'command -v git'` → `/usr/bin/git`.
  **Seventh consecutive run at exit 2.** Not re-filed — see F6.
- [MEASURED] **All three binding docs in the dev tree are byte-identical to `origin/main`**, so
  reading the working copy was sound this run. Sanctioned probe, no piped hash (PREFLIGHT step 2):
  `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
  docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and
  `git rev-list --left-right --count HEAD...origin/main` → `0	0`. Read in the **dev tree**, never the
  watcher clone.
- [MEASURED] `status-sweep.ps1` ran to completion, 417 lines, captured with `*>` and decoded
  **`utf16le`** (§9.3 — a `utf8` read would have split it into unparseable sections). Section 0
  positive controls both `[LIVE]` PASS. **Section 7 VERDICT: `SAFE TO ACT`.** No `[BROKEN]`.
  `[STALE]` rows: **0** — the four `[STALE]` string hits are the legend and a quoted [FILE] line, not
  escalation rows, so the section-5 discharge backlog is genuinely clear this run.

### COLLECT

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0.** Structure
  2 checked, 0 malformed. Freshness: `00` 1.1h (cadence 1h) ok · `03` 20.3h (24h) ok · `04` 1.2h (4h)
  ok · `05` 4.9h (24h) ok. **No station SILENT.**
- [MEASURED] Crossed against `lastRunAt` (scheduled-tasks MCP), because the breadcrumb is one
  instrument and cannot name a cause: `00` 19:14:11Z · `04` 18:09:50Z · `05` 14:22:54Z · `03`
  2026-09-23T23:02:54Z · `weekly-security-audit` **`enabled: false`**. Every enabled station's
  `lastRunAt` aligns with its newest breadcrumb. **No occurrence to chase, no transcript to read.**
- [MEASURED] Station 04's 18:10Z breadcrumb is genuinely **unreported**. Probe asked `origin/main`, not
  the dev-tree index (`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`):
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` matched by basename → **0** for
  `00-04-scanner-2026-09-24-1810`; POSITIVE control `00-00-supervisor-2026-09-24` → **19**; NEGATIVE
  control, a freshly minted needle → **0**.
- [MEASURED] Depth-1 tracked breadcrumbs on `origin/main`: **1**, my own 1815Z one. All five of its
  findings carry dispositions, so it is archived this run.

### The board

- [MEASURED] **Q1 — five open PRs, all `BLOCKED`, none draft.** Raw `--json` plus `ConvertFrom-Json`,
  **no `--jq`** (§9.4's string-literal trap produces a blanket empty and is excluded by construction),
  then re-asked **per-PR** (LL-47 — never labels from a listing), exit 0 each, negative control
  `gh pr view 999999 --json number,state` exit **1**:

  | PR | labels | mergeStateStatus |
  |---|---|---|
  | #2167 | **[]** | BLOCKED |
  | #2166 | **[]** | BLOCKED |
  | #2164 | `do-not-merge` | BLOCKED |
  | #2158 | `do-not-merge` | BLOCKED |
  | #2148 | **[]** | BLOCKED |

  **Zero DIRTY.** The in-band positive control is #2164/#2158 still returning a label on the same
  query, so the empty three are a real change, not an empty-world reading.
- [MEASURED] CP-26 verdict token for #2167, quoted verbatim from column 3 of job `107789127047`
  (§9.4 — the token, never the counts): `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #2167
  was labelled do-not-merge and released, but docs/decisions/merge-approvals/2167.md is not in this
  PR's diff against merge-base with origin/main.`
- [MEASURED] `unlabeled` events for `do-not-merge`, one each: #2148 `GH-Mantova` 19:01:50Z · #2166
  `GH-Mantova` 19:05:39Z · #2167 `GH-Mantova` 19:06:23Z.
- [MEASURED] #2166's third red, `tendering-e2e`: **4 failed / 162 passed**, all four dashboard-customise
  assertions, on a diff touching only `scripts/pr-watcher/**`. Transient by §8 rule 5.
- [MEASURED] **Q3 — armed prompts counted with my own eyes:**
  `Get-ChildItem docs\pr-prompts -Filter *-ready.md` with a null guard → **0**. Not quoted from a note.
- [MEASURED] Watcher: node **RUNNING pid 42212**, wrapper alive (2), heartbeat 37 min (ticks only
  mid-run; stale + empty queue = idle, not wedged), clone `branch=main dirty=0`. Judged **only** from
  `status-sweep`'s live process read — never `ps` across an OS boundary (§9.6 / RULE 1).

### A §9.1 correction reproduced live, in my favour

- [MEASURED] `interact_with_process` returned **`✅ Process 44812 has finished execution`** with no
  output, on a `gh run view --log | Select-String` chain. Per
  `FALSE_TERMINATION_IS_AN_EARLY_READ_NOT_AN_UNRUN_STATEMENT_V1`, I treated it as a claim and **read
  the buffer**: **633 lines were pending.** The statements had run. A second instance later in the run
  behaved identically and the same guard settled it (`PID-ALIVE-2` on the next call). **The correction
  is confirmed, twice, and guard (2) — read the buffer, do not merely ping — cost one call each time.**
  Had I believed the message I would have abandoned a live shell mid-run, which is what the 12:1xZ
  instance did.

---

## WHAT CHANGED

All work done in an **isolated worktree off `origin/main`** on the Windows FS
(`C:\po-wt\st00-collect-20260924-1915`, branch `board/station00-2026-09-24-1915`) — never the dev
tree, never `C:\po-watcher`. BOARD DRIVING condition 3 satisfied before touching anything:
`status-sweep` §3 read `git index.lock interactive/clone: False / False`, `git processes touching our
trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`, verdict `SAFE TO ACT`.

- **`docs/pipeline/DOCTRINE.md` §9.1** — added Station 04's F3b as
  `CMD_CHAIN_ERRORLEVEL_IS_PARSE_TIME_V1`. Filed in **§9.1 (the shell)**, not §9.4 as dispatched: it is
  a `cmd` parse-time expansion, the exact sibling of the `-Command` `$`-expansion bullet it now sits
  beside, and `gh` is incidental to it. Edited with **node, by concatenation** — never
  `String.replace` with a replacement string (§9.3) — and the insert converted to the working-copy
  CRLF before writing. Read back: `ANCHOR_OCCURRENCES=1`, `BEFORE_BYTES=229899`,
  `AFTER_BYTES=233094`, `INSERT_BYTES=3195`, **`BYTE_DELTA_OK=true`**, `TOKEN_PRESENT=true`,
  negative control `false`; `git diff --numstat` → **`41	0`**, a pure insertion with no line-ending
  rewrite.
- **`docs/pipeline/stations/_canonical-blocks.json`** — re-recorded, deliberately, because §9 is a
  canonical block. **The positive/negative pair is the evidence the gate works:**
  `node scripts/pipeline/lint-station.mjs` **before** → `REJECT: 1 of 8 docs failed`, exit **1**;
  `--write-canonical` → `WROTE … instruments v2 f716d0916303711b · station-contract v5
  81ddf31ac807132b`, exit 0; **after** → `ADMIT: all 8 docs clean`, exit **0**.
- **`docs/pipeline/sweep-rotation.json`** — Station 04's rotation advance, swept in from the dev tree
  where 04 is required to leave it dirty (04 may not commit there). Raw-Buffer copy, `srcBytes=3039
  dstBytes=3039 byteExact=true`. **Without this the rotation silently stops and 04 repeats
  `repo-hygiene` forever.**
- **Station 04's 18:10Z breadcrumb** — swept in, raw-Buffer, `31966 B`, `byteExact=true`.
- **My 1815Z breadcrumb** — `git mv`'d to `docs/pr-prompts/archive/`, all five findings dispositioned.
- **`docs/pr-prompts/needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`**
  — new, **force-added so it is TRACKED** (the folder is gitignored by rule and partly tracked in
  fact; `git ls-files -- docs/pr-prompts/needs-marco/` returned 9 tracked files before this one).
- **This breadcrumb**, written **inside the PR worktree** (REPORT CONTRACT cure 1), so no loose copy
  is left in the dev tree to block the next fast-forward.
- **`gh run rerun 36043685925 --failed`** on #2166, exit 0 — the one board mutation this run made.
- **Nothing merged. No label touched. No prompt armed, disarmed or renamed. No receipt authored.**

---

## FINDINGS

### F1 — three PRs were released at 19:01–19:06Z and no scheduled run can write their CP-26 receipts

[MEASURED] #2148, #2166 and #2167 carried `do-not-merge` on two transports at 18:10Z (Station 04) and
carry **no label** now, confirmed per-PR with a working negative control and an in-band positive one
(#2164/#2158 still labelled). The `unlabeled` events are all `GH-Mantova`, 19:01:50Z–19:06:23Z.
CP-26 now reads **`[RELEASED_NO_RECEIPT]`** — which §9.4 classes as *a real finding*, unlike
`[LABEL_PRESENT]`, which is parked-by-design.

For #2167 and #2148 that is the **only** cause of red: their two failing checks are `Approval receipt
(CP-26)` and `PR gates — diff checks`, and CP-26 runs as a step inside the latter — two reds, one
cause. #2166 also failed `tendering-e2e` (4 of 166) on a `scripts/pr-watcher/**`-only diff, which is
§8 rule 5 transient; I re-ran it.

**I did not write the receipts.** `docs/decisions/merge-approvals/README.md` says in its own words that
both the watcher and Marco authenticate as `GH-Mantova`, so the `unlabeled` event I measured is
**unattributable** — `approved_by: marco` would be a claim I cannot measure, and CP-26 exists
precisely so that *"a released escalation"* is not *"indistinguishable from an agent clearing its own
gate."* Both recent precedents (`2161.md`, `2114.md`) were authored by the **interactive** lane citing
Marco's words in chat; a headless run has no such channel
(`rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`).

**ESCALATED** — new tracked file
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`, carrying
the RULE 1 options. (A) complete-and-additive: release by **committing the receipt**, or leave a
one-line PR comment the API can attribute — solves it now and in future, adds a record rather than
removing one. (B) hand-write three receipts now — fails the "future" half. (C) let a scheduled run
author `approved_by: marco` from the timeline alone — fails the "completely" half and I recommend
against it. A new file rather than an append, because this is a live board state, not a restatement;
it also **discharges the premise** of the tracked
`five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`, which is now
false.

### F2 — Station 04's F3b landed: `cmd /c "<cmd> & echo %ERRORLEVEL%"` reports the previous exit code

[MEASURED] It had **not** landed before this run: `Select-String -SimpleMatch -Pattern 'ERRORLEVEL'`
over `DOCTRINE.md` → **0**, with a fresh-needle negative control → **0**. It is in §9.1 now, with 04's
`check-ignore` truth-table, the "right by luck, not by measurement" note about 04's own two published
exit codes, the three sound forms, and a falsifying probe that can actually fail (*the chained form
returns the same answer for an ignored and a tracked file*).

**ACTIONED** — this run, in this PR. Verified by the read-backs under WHAT CHANGED and by
`lint-station.mjs` going REJECT → ADMIT across the deliberate hash re-record.

### F3 — Station 04's F3 was already landed; confirmed rather than re-filed

[MEASURED] `JQ_STRING_LITERAL_STRIPPED_UNDER_FILE_TOO_V1` is present in `DOCTRINE.md` §9.4 → **1 hit**,
negative control **0**. It landed in **#2175** at 18:34Z, minutes after 04 wrote the dispatch.

**ACTIONED** — already closed before this run began; recorded so the next collect does not re-open it.
I used the rule rather than the note: every `gh` call this run took raw `--json` plus
`ConvertFrom-Json`, no jq string literal, stderr kept, `$LASTEXITCODE` read.

### F4 — 571 of 577 local heads have no live remote counterpart (04's F1)

04 measured it and escalated it. [MEASURED] a home already exists and is current:
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`, last written 2026-09-24T03:23Z.

**ESCALATED** — already filed; no 49th file, per *add signal, not noise*. Deleting refs is irreversible
(§5.4) so no agent should act unasked. One thing this run adds to the evidence rather than the
question: **this PR's own branch is the generator** — `board/station00-2026-09-24-1915` will be squash-
merged, GitHub will delete the remote head, and nothing deletes the local ref. That is the ~24/day
accrual, observed from inside it.

### F5 — `C:/po-worktrees/sup-cwd-paths` still holds the only copy of 2 files (04's F2)

[MEASURED] by 04 at 18:11Z and unchanged in this run's sweep: `dirty=2 files age=701 min`, branch
`fix/pipeline-scripts-resolve-state-paths-from-module` absent from the 21 live remote heads, so the
work exists nowhere else. No lock files, so this is data-loss risk and **not** a wedged board.

**DISPATCHED → Station 03.** Worktrees and local trees are its lane and this is now the third
consecutive report carrying it; `nextRunAt` `2026-09-24T23:02:45Z`. I did not prune, force or commit —
`git worktree remove`'s refusal on a dirty tree is currently the only thing protecting the file.

### F6 — the device-bridge git guard is INERT, exit 2 — seventh consecutive run

[MEASURED] exit **2**, headline and both controls quoted under WHAT I MEASURED. Per PREFLIGHT this is
**the expected outcome for a station**, not an anomaly: the installer writes its `PATH` export into
`~/.bashrc` / `~/.profile` and a station's shell is non-interactive and non-login.

**DEFERRED** — urgent only if a run ever reports a **non-zero-other-than-2** exit (shim not written at
all), or if any station runs `git` from the VM against the Windows `.git`. I ran none: every git
command this run was on the Windows host.

### F7 — stale watcher log sidecars (04's F4), and the #2158 / HOLD overlap (04's F5)

[MEASURED] by 04: 6 ignored `*-ready.md.log` at depth 1 of the queue root plus 15 under `superseded/`,
inert because `READY_PATTERN` is `$`-anchored. And `pr-fv2-formrule-contract-HOLD.md` ADMITs while
overlapping open **#2158** on 9 of 12 scope entries.

**DEFERRED**, both, and the same reason covers them. Armed count is **0** and three of five open PRs
are released-but-unmergeable: arming anything now lengthens a queue that cannot drain, which is the
throughput constraint already on the record. The overlap must be confirmed **on the prompt's own
marker string, not the head branch**, before that HOLD is ever armed. The sidecars become urgent only
if `READY_PATTERN` is loosened at the tail, at which point 6 dead prompts arm themselves.

### F8 — Q6: the ONE thing blocking progress

**The receipt channel.** Zero PRs are DIRTY, zero prompts are armed, trunk is green, the watcher is
healthy and the queue is idle *correctly*. Every open PR is stopped at a human gate: two still parked
behind `do-not-merge`, three released but held by `[RELEASED_NO_RECEIPT]`. Nothing an agent is
permitted to do moves any of them. **DEFERRED to F1's escalation** — it is the same question and one
answer clears all three.

---

## WHAT I DID NOT DO

- **Did not write a CP-26 receipt.** Reasoned at length in F1: the release event is unattributable by
  the README's own account, so authoring one would certify what I cannot measure, and would make CP-26
  unable to tell Marco's approval from an agent's.
- **Did not merge anything, and did not touch a label.** All five open PRs are `BLOCKED`; the three
  released ones are red on CP-26 alone (plus one transient e2e). Removing a `do-not-merge` label is an
  absolute stop for me regardless.
- **Did not arm a prompt.** Armed count measured 0 by my own eyes. Arming while the board cannot drain
  makes the queue longer, not shorter.
- **Did not commit in the dev tree, or on `main`.** Everything is in a disposable worktree on a branch.
  `git diff --cached --name-status` in the dev tree was EMPTY throughout, so no concurrent chat's
  staged work was at risk (§9.2 — the dev-tree index is shared).
- **Did not run `git` from the VM against the Windows `.git`.** The guard is INERT (exit 2), so that
  ban was remembered, not enforced — stated plainly, because an inert guard is not a licence.
- **Did not prune a worktree, drop a stash, or delete a branch** — all irreversible, and
  `sup-cwd-paths` holds the only copy of two files.
- **Did not touch `/sot/`** (Station 05's), and did not do 03/04/05's work myself — F5 is dispatched,
  not performed.
- **Did not go near Azure, Entra or SharePoint.** Nothing this run came close.
- **Did not diagnose any red from the diff or the PR page.** Both CP-26 and the e2e failure were read
  from the job log.
