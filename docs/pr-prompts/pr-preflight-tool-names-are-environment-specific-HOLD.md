---
premise: grep -q "mcp__remote-devices__" docs/pipeline/stations/00-supervisor.md
requires_on_main: docs/pipeline/stations/00-supervisor.md :: mcp__remote-devices__
premise_means: >-
  PR #1519 shipped station-contract v2, whose new PREFLIGHT step 1 hard-codes a literal ToolSearch
  argument naming two tools by exact id - mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process
  and mcp__remote-devices__device_bash. NEITHER ID EXISTS IN THE SCHEDULED COWORK ENVIRONMENT, which
  is where Stations 00 and 04 actually run on their cadence. Measured 2026-09-02T05:5xZ from inside a
  live scheduled Station 00 run - the tool that opened that run's shell is named
  mcp__plugin_desktop-commander_desktop-commander__start_process, with NO mcp__remote-devices__ prefix,
  and no tool named device_bash is offered at all. The block is therefore correct for the environment
  that authored it and wrong for the one it is binding on, in the FIRST step of every run.
scope:
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/01-code-writer.md
  - docs/pipeline/stations/02-board-driver.md
  - docs/pipeline/stations/03-machine-minder.md
  - docs/pipeline/stations/04-scanner.md
  - docs/pipeline/stations/05-sot-keeper.md
  - docs/pipeline/stations/06-pr-master.md
  - docs/pipeline/stations/_canonical-blocks.json
  - docs/pipeline/STATION-CAPABILITIES.md
done_when: >-
  ! grep -q "mcp__remote-devices__" docs/pipeline/stations/00-supervisor.md && grep -q "ToolSearch"
  docs/pipeline/stations/00-supervisor.md && ! grep -q "device_bash"
  docs/pipeline/STATION-CAPABILITIES.md && node scripts/pipeline/lint-station.mjs
size: 3
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# The PREFLIGHT names tools by an id that does not exist where the stations run

## The lesson is right. The identifiers are not.

Station-contract v2 added a genuinely correct rule: **a validation error from an unloaded schema is
not blindness, and a station that declares itself blind without loading first has committed a
DOCTRINE section 7 instrument lie in the one step every run begins with.** Keep that. It is the
sharpest thing in the block.

What must change is the sentence that tells the station what to type. The block currently supplies a
literal argument:

    select:mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process,mcp__remote-devices__device_bash

Measured from inside a live scheduled Station 00 run on 2026-09-02:

| id the block supplies | exists in the scheduled Cowork environment? |
|---|---|
| `mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process` | **no** |
| `mcp__remote-devices__device_bash` | **no - there is no `device_bash` tool at all** |
| `mcp__plugin_desktop-commander_desktop-commander__start_process` | **yes - this is the one that works** |

A station that follows the block literally gets "no such tool", which the very same paragraph tells
it is NOT blindness. So it is instructed to press on with no shell, and the failure it then reports
is neither honest blindness nor a working run.

## Why a corrected literal is the wrong fix

This is the same defect Station 04 recorded as F1 against `SCRIPT-REGISTRY.md`: a document that
names one launcher by exact string, patched each time the launcher is renamed. The station doc there
was fixed by naming the launcher again - a patch on a vocabulary, one name later. **Do not repeat
that here.** The tool id prefix is a property of how a session is wired, and it has already differed
between two environments in one day. A second literal will drift the same way, silently, and the
next station to trip on it will be told its machine is unreachable.

## What to build

In the canonical block's PREFLIGHT step 1, replace the literal `select:` argument with the rule and
the discovery method, keeping the lesson intact. The corrected text must:

1. State that the device tools arrive **deferred** and their schemas must be loaded with `ToolSearch`
   before either is called.
2. Say that an `InputValidationError`, or an error naming no such tool, is **an unloaded schema and
   not an unreachable machine** - the existing sentence, unchanged.
3. Tell the station to **find the ids rather than assume them**: a keyword `ToolSearch` for
   `desktop-commander` returns whatever the current session actually offers, and the ids differ
   between the scheduled and interactive environments. Load them in ONE call.
4. Say that only a failure **after** a successful load is blindness.

Do not name any tool by full id anywhere in the block.

## Shipping it

The block is byte-identical across all seven station docs and `lint-station.mjs` fails on any edit
to one copy alone. Change it once, apply the identical text to all seven, then re-record the hash:

    node scripts/pipeline/lint-station.mjs --write-canonical

and commit the resulting `_canonical-blocks.json` in the same PR. `done_when` runs
`lint-station.mjs` with no flag, so an un-recorded hash fails the prompt rather than the board.

## Do NOT

- Do not weaken or delete the blindness lesson. The rule is correct and was paid for.
- Do not substitute a different hard-coded tool id, including the one that works in the scheduled
  environment today. That is the vocabulary patch this prompt exists to prevent.
- Do not edit only `00-supervisor.md`. Seven files carry the block and the linter will fail you.
- Do not change `station_doc_version` or `contract_version` in any front matter. Both are `1` on
  every station doc and a bump would put every scheduled bootstrap into a version mismatch, which
  makes every station run READ-ONLY.
- Do not touch anything outside the canonical block, and do not fold in the Station 02 merge or any
  other v2 change. This prompt corrects one paragraph.

## The missed caller — `STATION-CAPABILITIES.md` (added 2026-09-04 by Station 00, from Station 04's F2)

The seven station docs are not the only place these ids appear. `docs/pipeline/STATION-CAPABILITIES.md`
heads a section **"The device bridge (`device_bash`, `device_stage_files`, `device_commit_files`)"**
and describes it as a live capability — *"Useful as a fallback when Desktop Commander is absent, for
read-only checks only."* [MEASURED 2026-09-04T06:1xZ, Station 04] **none of those three tools exists
in the scheduled Cowork session's tool inventory.** So fixing only the station docs would leave two
binding documents disagreeing about which tools exist, and would leave a station whose Desktop
Commander has failed hunting a fallback that is not there — or, worse, presenting device-bridge reads
as coverage, which the contract forbids.

**What to do there:** delete or rewrite that section so it no longer offers `device_bash` /
`device_stage_files` / `device_commit_files` as an available fallback. State plainly that when
Desktop Commander cannot be reached there is **no** second transport, and the run is blind and stops.
Do not invent a replacement fallback. `done_when` now asserts `device_bash` is absent from that file.

## Verification

- [ ] `grep -c "mcp__remote-devices__" docs/pipeline/stations/*.md` returns 0 across all seven.
- [ ] The block still contains the words `ToolSearch` and the not-blindness sentence.
- [ ] `node scripts/pipeline/lint-station.mjs` exits 0 with the re-recorded hash committed.
- [ ] `grep -c "device_bash" docs/pipeline/STATION-CAPABILITIES.md` returns 0.
- [ ] `git diff --stat` shows the seven station docs, `_canonical-blocks.json`, and
      `STATION-CAPABILITIES.md`.
- [ ] No front-matter version field changed: `grep -h "_version" docs/pipeline/stations/*.md` shows
      `1` throughout.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
