# Station 00 — Supervisor | 2026-09-01T18:25Z–2026-09-01T18:4xZ

**Second collect of the same cadence.** Station 04 ran its `instrument-honesty` sweep at
18:10:46Z — the same minute this run started — and filed a nine-finding breadcrumb that landed in
the dev tree *after* `#1498` had already been opened. This breadcrumb collects it and closes the
one finding `#1498` left open.

## GROUND

```
UTC            2026-09-01T18:25:00Z
origin/main    4b988bb1            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 4b988bb1     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE. SIGHTED run, same session as the 18:09Z breadcrumb.

## WHAT I MEASURED

- 🟢 [MEASURED] **The trunk red was a flake, and the re-run settles it.**
  `gh run view 33520578163 --json status,conclusion,attempt` →
  `{"attempt":2,"conclusion":"success","status":"completed"}` at 18:27:26Z. Attempt 1 of
  `Tendering Browser Smoke` on `cdc78159` failed one test — `batch7-field.spec.ts:264 › timesheet
  submits for today; duplicate attempt shows the friendly 409 message` — and the identical job
  passed on re-run with no code change between them. **`cdc78159` is green; there was no main
  regression.**
- [MEASURED] `origin/main` is now `4b988bb1` (`#1498`), and its own four workflows are
  `in_progress` — normal for a merge two minutes old, not a red.
- [MEASURED] `#1498` MERGED at 18:22:58Z, merge commit `4b988bb1eb99…`. Read back on `main`: the
  1809 breadcrumb is present, and both retired HOLDs return **0** from
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/`.
- [MEASURED] Dev tree fast-forwarded `cdc78159` → `4b988bb1`; disposable worktree
  `board00-20260901-1815` removed and pruned. `git worktree list` now shows only the dev tree and
  the two pre-existing second-lane orphans (04's FINDING 7 / Station 03's lane).

## WHAT CHANGED

One board PR from a disposable worktree off `origin/main`
(`C:\po-worktrees\board00-20260901-1830`, branch `board/00-collect-2026-09-01-1830`):

| Change | Why |
|---|---|
| 04's 18:15Z breadcrumb committed into `docs/pr-prompts/archive/` | it was UNTRACKED and reached nobody |
| `docs/pipeline/sweep-rotation.json` re-advanced to `last_index: 1`, `18:10:46Z` | 04's second advance of the day |
| this breadcrumb | current cycle |

🔧 **Method note worth keeping.** `#1498` committed 04's *14:10Z* rotation advance
(`last_index: 0`). By the time the dev tree was fast-forwarded, 04's 18:10Z run had already
overwritten the working copy with `last_index: 1`, so the FF was refused for a local modification
that was **newer**, not stale. Restoring the file from `main` and re-applying 04's copy afterwards
is the only order that preserves the newer advance — blindly restoring would have silently
rewound the rotation and made 04 repeat `instrument-honesty` next run. **A dirty file in the dev
tree is not automatically the stale one.**

## FINDINGS

### F1 — Collecting Station 04's second breadcrumb of the cadence. Nine findings, dispositioned.

04 F1 DOCTRINE §9 probed end to end, eleven traps, all still trapped — **ACTIONED** by 04; the
three drifted counts are state, which §9 already labels as such. Nothing to edit.
04 F2 the sweep's `TRUNK IS RED` was true when printed and false 42 seconds later; `status-sweep.ps1`
exonerated by reading its own source — **ACTIONED** by 04.
04 F3 the *real* attempt-1 failure on `cdc78159`, outcome unknown at 04's run end —
**ACTIONED here**: attempt 2 is `success`, measured above. A flake, not a regression. Two runs
independently reached the same PR-vs-trunk conclusion from opposite ends of the same hour.
04 F4 §9.4 is incomplete — a `--jq` expression is re-split by PowerShell on any `|` it contains,
and `ConvertFrom-Json` collapsed a 4-element array even under the assign-then-foreach cure —
**DISPATCHED**, see F2 below.
04 F5 never draw a negative-control needle from the corpus under test — **ACTIONED** by 04. I hit
the same class of thing this run from the other side: my own freshness probe reported 166 phantom
differences because `Out-File` re-encoded the dump.
04 F6 38 phantom remote-tracking refs (64 local vs 26 on the remote), up from 33 —
**DISPATCHED → Station 03**, folded into the clone-hygiene dispatch it already owns.
04 F7 two orphaned worktrees registered from `/sessions/rcw-*` Linux mount paths, branches
`stage/brandtheme-s1-s2` and `-v2` — **DISPATCHED → Station 03** to prune, and **noted for every
future 00**: any PR arriving from those branches carries NO RULE-2 verdict and must be
hand-classified, never read as cleared.
04 F8 three untracked breadcrumbs, plus 05's tracked-but-uncollected one — **ACTIONED**: two were
committed in `#1498`, the third is committed here, and all four sets of findings now carry
dispositions. 04's correction is right and worth repeating: *committed* and *collected* are
different failures, and 05's 1411 breadcrumb only ever needed the second.
04 F9 the 2026-08-26 `pr-doctrine-s9-four-false-traps` prompt is genuinely spent and correctly in
`superseded/` — **ACTIONED**, and it supersedes F6 of my 18:09Z breadcrumb, which had deferred the
same file with less evidence. 04 executed the premise (0 hits, positive control 12); I had only
read it. **04's disposition wins; do not re-open it.** It stays untracked, which is harmless.

### F2 — DOCTRINE §9.4 understates the `--jq` failure set, and the gap points the wrong way. **S3.**

04 measured, through the transport §9.1 certifies as safe for `$`, that
`--jq '.[] | [.name, .status] | join(" | ")'` returns `unknown command "|" for "gh run list"`:
PowerShell split the **single-quoted** expression on its pipes. §9.4 today documents only the
escaped-double-quote failure and says a `--jq` expression *"survives the `-Command` layer intact —
spaces included"*. A jq expression is pipes almost by definition, so a reader following the
documented cure (keep double quotes out) still gets a broken query — and a broken `gh` query is
the §7 failure that has cost this pipeline the most.

**DISPATCHED → Station 06 to stage, 00 to arm.** §9 sits inside the hash-gated
`CANONICAL-BLOCK: instruments v2`, so the edit needs
`node scripts/pipeline/lint-station.mjs --write-canonical` and ships to every station at once —
correctly not a read-only station's call, and not a hand-landed one either (DOCTRINE §10.3: a
docs change hand-landed gets no review). 04 already drafted the additive bullet in its breadcrumb;
RULE 1 complete-and-additive is satisfied because it removes no existing advice and breaks no
current reader.

⚠️ **This is the second finding this cadence routed to a station with no cadence of its own.** The
other is the `check-sot-bytes.mjs` widening (my 18:09Z F3). Station 06 runs on dispatch only, and
in the Cowork scheduled environment 00 cannot spawn it — so *"DISPATCHED → 06"* is, mechanically,
a deferral to whenever a human opens a 06 session. Both are recorded in project memory so the next
00 inherits them rather than re-discovering them. **The standing question of 06 having no cadence
is Marco's, and it is already open.**

### F3 — The 18:09Z breadcrumb's F5 is now answered, in the same cadence that raised it.

Recorded because a finding that names its own falsifier and then gets falsified within the hour is
the cheapest kind to close. F5 named the exact probe
(`gh run view 33520578163 --json status,conclusion,attempt`) and both branches of the answer.
The probe returned `success`.

**ACTIONED.** No prompt needed for `batch7-field.spec.ts:264`. It becomes worth one if a *second*
`main` commit fails that same test — one flake in nine consecutive runs is not a pattern, and
DOCTRINE §2 warns against manufacturing a diagnosis for a failure whose cause you cannot name.

## WHAT I DID NOT DO

- **Did not merge, label or touch `#1483` or `#1477`.** Unchanged from the 18:09Z breadcrumb:
  `#1483` carries a live `marco:true` watcher verdict, and `#1477`'s three files all sit outside
  `^(tests|docs)/`, which makes it Marco's under DOCTRINE §10.1's own hand-classification rule.
- **Did not re-run `#1483`'s e2e**, and did not re-run `cdc78159`'s smoke a third time. One re-run
  answered the question; a second would have been re-running hoping for green.
- **Did not prune the two second-lane worktrees or the 38 phantom refs.** Station 03's lane, and it
  already owns the standing clone-hygiene dispatch.
- **Did not arm anything.** `armed: 0` at both sweeps this cadence.
- **Did not edit DOCTRINE §9** by hand — hash-gated canonical block, see F2.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
