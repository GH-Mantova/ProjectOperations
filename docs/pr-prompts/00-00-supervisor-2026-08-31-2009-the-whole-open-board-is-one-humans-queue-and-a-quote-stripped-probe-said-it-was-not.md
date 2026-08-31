# Station 00 — Supervisor | 2026-08-31T20:08Z–2026-08-31T20:25Z

## GROUND

```
UTC            2026-08-31T20:08:50Z
origin/main    756147e0            (fetched, then rev-parse)
dev tree       main @ 756147e0     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions AGREE — this run acted. **SIGHTED**: `start_process` shell `powershell.exe` returned
`2026-09-01T06:08:50+10:00 / LAPTOP-E6NHU4E4 / True` on the first call. This was not a blind run.

## WHAT I MEASURED

- `[MEASURED]` **Ground.** `git fetch origin` then `git rev-parse --short origin/main` and
  `--short HEAD` both → `756147e0`. The dev tree was ALREADY at `origin/main` — no fast-forward was
  needed this run, and the untracked-file FF trap (DOCTRINE §9.2, twice on 08-31) did not arise.
  `git diff --cached --name-status` → **empty**; the shared index was clean on arrival.

- `[MEASURED]` **Sweep.** `scripts/pipeline/status-sweep.ps1` at 20:09:41Z — section 0 both positive
  controls LIVE (`gh` saw merged #1458; `node` runs), section 7 **`SAFE TO ACT`**. Re-run at
  20:11Z immediately before the arm (DOCTRINE: the verdict expires the moment it prints):
  `in-progress prompts: 0` · `index.lock interactive/clone: False / False` · `git processes: 0` ·
  `no PR touched on GitHub in the last 2 min` · `armed (*-ready.md): 0` · **still `SAFE TO ACT`**.

- `[MEASURED]` **Watcher.** `watcher node: RUNNING pid 32916`, auto-restart wrapper alive (1),
  heartbeat age 100 min. With `armed: 0` at that moment, a stale heartbeat is **idle, not wedged**
  (DOCTRINE §9.5 — the heartbeat only ticks mid-run). Clone parked on `feat/lint-not-a-prompt`,
  `dirty=1` — "off main" is NOT "broken"; no `MERGE_HEAD`, no rebase, no unmerged paths.

- `[MEASURED]` **Board.** 3 open PRs, all `CLEAN`, all **13 pass / 0 fail / 0 pending**:
  **#1457** (lint NOT_A_PROMPT), **#1450** (crm-s9 AnchorPicker), **#1443** (scope SUB discipline).
  `main` branch CI last 3 runs: 3 success — trunk green.

- `[MEASURED]` **Collection.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` →
  `structure: 4 checked, 0 malformed`, freshness **CLEAN**, no station SILENT:
  `00` 1.7h (cadence 2h) · `03` 21.2h (24h) · `04` 2.0h (4h) · `05` 6.0h (24h).
  All four root breadcrumbs are already TRACKED on `origin/main` (`git status` shows no `??` under
  `docs/pr-prompts/`), i.e. **no station has reported anything new since the 18:30Z collection.**
  There was nothing new to disposition; what remained was to archive what already carried one.

- `[MEASURED]` **Arming detector (RULE 4), both instruments.**
  Instrument 1 — `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-sweep-worktree-liveness-HOLD.md`
  → `ADMIT (size 3)`, with `git version 2.55.0.windows.3` confirmed resolvable first (DOCTRINE §9.5:
  a broken `git` makes all five gate probes fail OPEN, and a skipped gate reads as an ADMIT).
  Instrument 2 — the **three-marker union** read live from `lint-prompt.mjs:727-732`
  (`DO_NOT_ARM_COMMENT` `/<!--\s*watcher:\s*do-not-arm\s*-->/i`, `DO_NOT_ARM_CAPS` `/DO NOT ARM/`,
  `ARM_ONLY` `/Arm ONLY/`). Target → **0 hits**, against two positive controls that both fired:
  `pr-524-rates-b-slice2-canonical-HOLD.md` → 1 (`Arm ONLY`), `pr-dns-s5-checker-flip-to-fail-HOLD.md`
  → 1 (`do-not-arm`). Instrument 3 — I read the prompt BODY in full for a **prose** gate (neither
  regex sees one). None. `## STANDING AUTHORITY` is present and is boilerplate, not a gate.

- `[MEASURED]` **Watcher routing, RULE 2 — with the instrument REPAIRED mid-run.** See F3.
  Working probe (regex, no double quotes): `Select-String -Path *.log -Pattern 'marco.:true'` in
  `docs/pr-prompts/processed/` → **592** hits; negative control `marco.:false` → **0**; breadth
  control `marco` → 1261. Filtered to this board's three PRs:
  ```
  [watcher] merge result for PR #1450: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/crm/AccountDetailPage.tsx"}
  [watcher] merge result for PR #1457: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}
  [watcher] merge result for PR #1443: {"ok":false,"marco":true,"reason":"escalates:true - PR already carries `do-not-merge` - no duplicate apply"}
  ```
  **All three open PRs are watcher-routed to Marco.** RULE 2 binds; this run merged none of them.

- `[MEASURED]` **Worktree registry vs disk, re-measured at 20:13Z** (the defect the armed prompt
  fixes): `git worktree list` → 2 entries (dev tree + this run's board worktree).
  `Get-ChildItem C:\po-worktrees -Directory` → 5. Set difference = **4 registry escapees**, all
  pre-existing and unchanged: `fix-followup-notes` (17 Aug), `ph` (31 Aug 06:38Z),
  `po-scan-1787002207` (17 Aug), `scan-1787220682` (20 Aug). The 20:09Z sweep printed
  `orphaned worktrees: none` in the same minute those four sat on disk.

- `[MEASURED]` `docs/pr-prompts/needs-marco/` holds **15** files; the sweep's section 5 tags **8 of
  them [STALE]** against MERGED/CLOSED PRs (#1135, #1134, #1431, #213, #212, #1345/#1343/#1344,
  #1340, #1342, #1337, #1158, #727). Every sweep since has reprinted the same eight.

- `[INFERRED]` `docs/pr-reviews/pr-1457-review.md` existed **untracked** in the dev tree and carries
  `VERDICT: MERGE` for #1457 with its self-verification checklist. Untracked in a shared tree is one
  `git clean` away from gone — the exact class recorded in
  `REVIEW-VERDICTS-AND-ESCALATIONS-ARE-BEING-LOST-2026-08-26.md`. Landed in this run's PR.

## WHAT CHANGED

1. **ARMED `pr-sweep-worktree-liveness`** at `2026-08-31T20:11:50Z` via
   `scripts/pipeline/arm-prompt.ps1 -Name pr-sweep-worktree-liveness` (never a bare `git mv`).
   Read back: `Get-ChildItem docs\pr-prompts -Filter *-ready.md` → exactly
   `pr-sweep-worktree-liveness-ready.md` (**armed 0 → 1**, no `rev-*` present, so the real count and
   the raw count agree); `git diff --cached --name-status` → **empty** (the script's
   `ARM_INDEX_RELEASED` step released the staged rename, so the staged-`R100`-with-no-file trap
   cannot be seeded through it); `.arming-log.txt` tail records
   `2026-08-31T20:11:50Z ARMED pr-sweep-worktree-liveness escalates=false`.
2. **Board PR** (this one), from a disposable worktree off `origin/main`, never the shared dev tree:
   - `git rm docs/pr-prompts/pr-lint-not-a-prompt-HOLD.md` — CONSUMED at 18:13:56Z into PR #1457 but
     still tracked on `main`, which is what makes `triage-holds.ps1` report a spent prompt.
   - archived four dispositioned breadcrumbs to `docs/pr-prompts/archive/` (the 16:09Z, 18:09Z and
     18:30Z Station 00 runs and Station 04's 18:10Z sweep). Safe for freshness: `check-breadcrumb.mjs`
     builds `trackedSet` from `git ls-tree -r` and matches by **basename** (DOCTRINE §9.5).
   - landed `docs/pr-reviews/pr-1457-review.md`, previously untracked.
   - this breadcrumb.
3. **Nothing merged.** All three open PRs are watcher-routed to Marco (RULE 2).
4. **`pr-sweep-worktree-liveness-HOLD.md` was deliberately NOT removed from `main`** in this PR — it
   is armed and running right now; its tracked deletion belongs to the board PR that follows its
   consumption, exactly as `pr-lint-not-a-prompt-HOLD.md` did here.

## FINDINGS

### F1 — The board's ENTIRE open set is one person's queue, and everything else is green

Three open PRs, three `CLEAN`, three 13/13 green, trunk green, watcher alive, queue empty. And all
three are watcher-routed to Marco: #1450 and #1457 for touching code `outside tests/ or docs/`,
#1443 because it carries `do-not-merge`. #1457 additionally has a completed reviewer verdict of
**MERGE** sitting in `docs/pr-reviews/pr-1457-review.md`. There is no CI work, no conflict, no
rebase and no diagnosis left on this board — the only thing between it and empty is one human
action. This is not a defect and it is not an escalation of a *problem*; it is the answer to
"what is the single most important thing blocking progress right now", and the honest answer this
run is **Marco is**.

**DISPOSITION: ESCALATED** — to Marco, as a decision, not a status update. #1457 (`lint-prompt`
NOT_A_PROMPT verdict for breadcrumbs) is docs-tooling only, has a MERGE verdict, and its own tests
pass in CI; #1450 and #1443 are product code and want his eye. Nothing here asks him to remove a
label or override a routing rule as a class — only to take the three PRs that are waiting on him.

### F2 — I armed the three-defect sweep fix; the sweep proved its own third defect while I did it

`pr-sweep-worktree-liveness` armed at 20:11:50Z. It is one prompt fixing three defects in
`scripts/pipeline/status-sweep.ps1`: (1) every non-dev-tree worktree labelled an "aborted run
leftover" with no liveness test, which once invited a prune of a live Station 05 worktree holding
five uncommitted `sot/` edits; (2) `TRUNK IS RED` decided by grepping the rendered table's commit
TITLE instead of the `conclusion` field; (3) `$wt` being the wrong POPULATION — it reads the git
registry, and being absent from the registry is what MAKES a worktree an orphan.

Defect (3) reproduced live inside this run: at 20:09:41Z the sweep printed
`orphaned worktrees: none` while four escapee directories sat under `C:\po-worktrees`. And the
run demonstrated defect (1) prospectively — the disposable board worktree I created at 20:12Z will
be reported by the very next sweep as an "aborted run leftover — investigate/prune" while this PR
is still being written in it.

**DISPOSITION: ACTIONED** — armed, one at a time, index read back clean. The next arm decision
belongs to the run that finds this one consumed.

### F3 — A probe written with escaped double quotes returned 0 with a 0 negative control, and 0 is what "no PR is routed to Marco" looks like

The RULE 2 live probe is documented as `'"marco":true'` in `docs/pr-prompts/processed/*.log`. Written
through Desktop Commander's `-Command` layer as
`Select-String -SimpleMatch -Pattern '\"marco\":true'`, it returned **0** — and its negative control
`\"marco\":false` **also returned 0**. Two opposite queries, identical answers, exit 0 both times:
DOCTRINE §9.6 in its purest form. Had I stopped at the positive query I would have written *"no open
PR is watcher-routed"* and been one step from merging three of Marco's PRs — the precise failure
RULE 2 exists to prevent.

The cause is already in DOCTRINE §9.4 — *"escaped double quotes DO NOT [survive the `-Command`
layer]"* — but it is stated there **about `--jq` expressions only**, and I read it that way. It is
not a `gh` fact; it is a shell fact, and it silently destroys any `Select-String`, `findstr` or
`node -e` pattern containing a quote character. The working form avoids the quote entirely:
`-Pattern 'marco.:true'` (regex, `.` matches the quote) → 592 / 0 / 1261 with controls.

Also observed this run, same family: `'EXIT=' + [string]$LASTEXITCODE` printed `EXIT=string` — the
`$` token was consumed before PowerShell parsed the line, exactly as §9.1 records, and it produced a
*valid* command with a value I never wrote rather than a loud parse error.

**DISPOSITION: DEFERRED** — the fix is a one-line generalisation of §9.4's bullet from "a `--jq`
expression" to "any pattern argument", plus naming `Select-String -Pattern` as a second victim. That
bullet lives inside the hash-gated `instruments v2` canonical block, so it needs a prompt and a
`lint-station.mjs --write-canonical` re-record, not a hand edit — worth its own arm, not worth
displacing `pr-sweep-worktree-liveness`. **What makes it urgent:** the next station that writes a
quoted-literal probe and believes its empty result. That has now happened twice in eight days
(the `[regex]::Escape` / `-SimpleMatch` case on 08-30 reported 6 of 7 gate producers absent).

### F4 — Station 03 is 21.2 hours into a 24-hour cadence with an undelivered dispatch

`check-breadcrumb --freshness` reads `03  last 2026-08-30T23:01:00Z  21.2h ago  (cadence 24h)  ok` —
not SILENT by the tool's own rule (2× cadence), but 03 is carrying the clone-hygiene dispatch issued
at 18:09Z with corrected numbers (phantom refs are CLONE-ONLY, 33, and fluctuating; the dev tree
carries 11 stashes; the clone wants one `git fetch --prune`). Its crumb turns 24h old at
**2026-08-31T23:01Z**, roughly three hours from this run's end.

**DISPOSITION: DEFERRED** — re-check next run. **What makes it urgent:** 23:01Z passing with no new
03 breadcrumb. At that point treat it as overdue by policy and say so loudly rather than waiting for
the 48-hour SILENT threshold, because a device-task station that ran and could not report is
indistinguishable from one that never fired.

### F5 — Eight dead escalations have been reprinted as [STALE] by every sweep for days

`docs/pr-prompts/needs-marco/` holds 15 files. The sweep's section 5 cross-checks them against
GitHub and tags 8 as [STALE] — each referencing a PR that is MERGED or CLOSED, each ending
"escalation is DEAD, clear it." Nobody has. They are untracked (`.gitignore:76-83`), so they exist
only on this box, and they cost every station that reads a sweep the work of skipping them.

**DISPOSITION: DISPATCHED → 03 (machine-minder), folded into the existing clone-hygiene dispatch.**
Queue files are 03's lane, not 00's, and deleting is a mutation 00 should not do in a shared tree on
a hunch. 03: for each of the eight the sweep names, confirm the referenced PR state live, then move
the file to `docs/pr-prompts/needs-marco/discharged/` — **move, never delete**; report the count
before and after. Leave the seven that carry no PR reference alone; a `[FILE]` line is not a
[STALE] one.

### F6 — Housekeeping the last run named, now done

`pr-lint-not-a-prompt-HOLD.md` was consumed into #1457 at 18:13:56Z but remained tracked on `main`,
which is exactly what makes `triage-holds.ps1` report a prompt as spent. Removed here. Four
dispositioned breadcrumbs archived. The untracked reviewer verdict for #1457 landed.

**DISPOSITION: ACTIONED** — verified by this PR's own diff.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs are watcher-routed to Marco, re-verified live this run with
  a repaired instrument (F3). RULE 2 is not cleared by green, by CLEAN, by an empty label array, or
  by a reviewer's MERGE verdict — only by Marco, in chat, for that batch.
- **Did not remove or clear any `do-not-merge` label** (#1443 carries one).
- **Did not touch `/sot/`** — that is Station 05's, and nothing this run needed it.
- **Did not touch Azure / Entra / SharePoint.** Absolute.
- **Did not arm a second prompt.** RULE 4: one at a time.
- **Did not delete the four worktree escapees**, the 11 dev-tree stashes, or anything under
  `C:\po-worktrees`. The armed prompt makes the sweep *report* them; Station 03 acts.
- **Did not clear the eight dead `needs-marco/` files myself** — dispatched (F5).
- **Left alone:** the dev tree's modified `docs/data-model/metadata-catalog.json`, the untracked
  `PR-BODY-crm-chain-v1.md`, `.pr-drafts/`, `outputs/`, and
  `docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`. None is mine to land
  blind, and none blocks anything.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` was not run because the sweep
  reported the node ALIVE with a wrapper and `armed: 0` at that moment; an idle watcher with an
  empty queue is CORRECT, not wedged. `[CANNOT MEASURE]` does not apply — I did not need the deeper
  verdict, and I am not claiming one.
