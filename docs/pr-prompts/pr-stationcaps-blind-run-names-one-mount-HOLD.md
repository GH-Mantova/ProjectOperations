---
premise: grep -c "BLIND_RUN_OTHER_MOUNTS_V1" docs/pipeline/STATION-CAPABILITIES.md | grep -q "^0$"
premise_means: >-
  The blind-run block in STATION-CAPABILITIES section 3 still enumerates only the
  ProjectOperations mount, so a blind run still has no reason to believe the watcher
  clone is readable. The correction has not landed.
scope:
  - docs/pipeline/STATION-CAPABILITIES.md
done_when: grep -q "BLIND_RUN_OTHER_MOUNTS_V1" docs/pipeline/STATION-CAPABILITIES.md && grep -q "verdicts-archive" docs/pipeline/STATION-CAPABILITIES.md
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: pipeline
---

# The blind-run ceiling names one mount and the session has eleven

`docs/pipeline/STATION-CAPABILITIES.md` section 3, under the heading that begins "No second
transport", carries the block a blind run is told to read before it decides what it may do. That
block enumerates what the Cowork mount gives such a run: *"the working tree, the queue,
`docs/pr-prompts/processed/*.log` (the RULE 2 probe), `.arming-log.txt`, every station breadcrumb,
and the three binding documents."*

**Every item in that list lives inside `/sessions/<id>/mnt/ProjectOperations2/`, and that is the
only mount the block names.** Section 4 of the same file — three sections further down, under a
different heading — lists `C:\po-watcher` and `C:\po-watcher\ProjectOperations` as mapped folders
as well. Nothing joins the two, and a reader of the ceiling has no reason to walk forward to the
mapping table.

## The measurement behind this prompt

Station 00's blind run of 2026-09-08T04:09Z (breadcrumb
`00-00-supervisor-2026-09-08-0409-blind-run-check-breadcrumb-freshness-reads-two-live-stations-as-never-having-reported.md`,
finding F3) measured **eleven** mounts present in one blind scheduled session, `po-watcher` among
them, and through it read the watcher's **live** daily clone log —
`…\pr-watcher\logs\2026-09-07.log`, newest line `[2026-09-08T04:13:23.281Z] [update] PR #1805
branch updated (was BEHIND)`, four minutes old at the moment of reading. POSITIVE control
`[merge]` matched 9 lines; NEGATIVE control, a freshly minted needle, matched 0.

Three things a blind run is currently told it cannot have, and demonstrably can:

1. the `opened PR #<n>` lane discriminator, which lives in the clone's daily log and nowhere in
   the dev tree;
2. the clone's `docs/pr-reviews/` and `C:\po-watcher\verdicts-archive\`, which are **two of the
   three homes** DOCTRINE section 9.5 requires a run to check before it may write "no verdict for
   PR N";
3. a dated observation about the watcher, quoted from a line the watcher itself wrote.

## What to change — one paragraph, one file

Edit **`docs/pipeline/STATION-CAPABILITIES.md` and nothing else.** Inside section 3's blind-run
block, immediately after the sentence enumerating what the mount gives a blind run, add a paragraph
that does all four of the following:

1. **Carries the literal marker `BLIND_RUN_OTHER_MOUNTS_V1`** so this prompt's premise dies when
   the work lands, and so a later reader can find the claim by symbol rather than by line number.
2. **Names the other mounts by name** — the session maps `C:\po-watcher` and
   `C:\po-watcher\ProjectOperations` as well as `C:\ProjectOperations2`, and every one of them is
   readable on a blind run. Say that the mount list is a property of the session, so a run should
   enumerate `/sessions/<id>/mnt/` rather than assume the one folder this block used to name.
3. **States the three-homes consequence explicitly**, citing DOCTRINE section 9.5: the review
   verdict for a PR may live in the dev tree, in the clone, or in `C:\po-watcher\verdicts-archive\`,
   and a blind run that reads only the dev tree cannot write "no verdict for PR N". Name
   `verdicts-archive` in the text — the `done_when` above checks for it.
4. **Re-states the verdict prohibition in the same paragraph**, so the addition cannot be misread
   as a relaxation. A blind run still cannot RUN anything on the host, so it still may not claim a
   liveness, smoke, safe-to-act or merge verdict: those come from `restart-watcher-if-wedged.ps1`
   and `status-sweep.ps1`, and no log line substitutes for either. The distinction the paragraph
   must draw is between **quoting** a timestamped line the watcher wrote and **issuing a verdict**
   about the watcher.

Also add the falsifying probe, in one sentence: enumerate `/sessions/<id>/mnt/` from inside a blind
run and read the newest daily log under the clone's `scripts/pr-watcher/logs/`; if only one mount is
present, or the clone is unreadable, this paragraph is wrong and must be re-measured.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Constraints

- **One file.** `docs/pipeline/STATION-CAPABILITIES.md`. Do not touch DOCTRINE, do not touch any
  station doc, do not touch `sot/`. This file carries no hash-gated canonical block, which is why
  this change can be made here rather than hand-landed.
- **Do not restate a DOCTRINE section 9 trap.** Section 3 of this file already carries an explicit
  no-paraphrase rule, and three previous paraphrases drifted and had to be removed. **Point** to
  section 9.5 for the three-homes rule; do not copy its text.
- **Do not remove or weaken the STOP.** The existing sentences saying a blind run reports blindness
  as loudly as ever and stops before acting must survive verbatim.
- **Do not renumber or reorder the file's sections.** `check-breadcrumb.mjs` and `lint-station.mjs`
  both read this repository's docs by text order; an added paragraph is safe, a moved heading is not.
- Do not write a section heading with its leading hashes inside running prose anywhere in the PR
  body — `check-breadcrumb.mjs` orders sections by first occurrence of the literal text.

## Why it is worth a slice of its own

The board measured **0 of 39** held prompts able to enter the `tests-docs` auto-merge lane on
2026-09-08T02:08Z, and **0 of 11** gate-satisfied candidates on 2026-09-08T05:2xZ: every arm
available lands on Marco. This change is `docs/`-only, so it is one of the few pieces of real work
on this board that `classifyPolicyFiles` admits without a human. That is a second reason to land it
as its own prompt rather than folding it into a larger docs PR.
