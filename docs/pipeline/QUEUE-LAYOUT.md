# Prompt queue layout standard

<!-- QUEUE_LAYOUT_V1 -->

Written 2026-09-17, S1 of 4. This document is the canonical source for the queue folder
standard. It is NOT yet enforced by CI or code - that is S4's job. Anyone reading this
before S4 merges is reading a standard that is written but not guarded.

## The six states

Every prompt lives in exactly one state at any moment. The watcher keys on `armed`; the
other five are Marco's operational categories.

| state | where | meaning |
|---|---|---|
| brainstorm | `docs/pr-prompts/brainstorm/` | being thought about; not a prompt yet; nothing reads it |
| draft | `docs/pr-prompts/draft/` | written, not approved; inert - no gate, no arm, no build |
| hold | `docs/pr-prompts/*-HOLD.md` | approved and staged; on main; waiting on its gate |
| armed | `docs/pr-prompts/*-ready.md` | the rename IS the dispatch; the only state `READY_PATTERN` matches |
| merged | `docs/pr-prompts/merged/` | its PR is confirmed MERGED on main |
| superseded | `docs/pr-prompts/superseded/` | replaced; the replacement is named inside the file |

## Why hold and armed are filenames, not folders

This is a mechanical fact, not a style preference.

`scripts/pr-watcher/index.mjs:3545` calls `fsWatch(PROMPT_DIR, { persistent: true }, ...)`
with NO `recursive: true`. On Windows, a file-system change inside a subdirectory fires no
event on the parent directory watch. Only the 5-minute `RESCAN_INTERVAL_MS` sweep would
notice such a change.

If `armed` were a folder, moving a file into it would silently turn arming from an
immediate event-driven dispatch into an eventual one (at most 5 minutes late, at least
occasionally silent). Anyone proposing to make `armed` a folder must change the watch call
first - add `recursive: true` and verify it on Windows - before the folder layout is safe
to adopt.

`hold` stays a filename for the same reason: it is a sibling state to `armed`, and the
cognitive load of "filenames are hot states, folders are cold states" is lower than a
mixed rule.

## merged is not processed

The retired `processed/` folder was entered when a prompt's PR **opened** - not when it
merged. A prompt could therefore sit in `processed/` while its PR was still open, had
been closed unmerged, or had merged, with nothing in the folder to distinguish the three
outcomes.

On 2026-09-16 two armed prompts (`ratescol-s4`, `scopecards-s2b`) were filed as processed
when their PRs opened. Both PRs were later confirmed merged - but the pattern demonstrated
that `processed/` was an ambiguous state: "a PR exists" is not "a PR merged".

`merged/` is entered only on a confirmed `MERGED` state from `gh pr view --json state` or
equivalent. A prompt whose PR was opened but is still open, was closed unmerged, or is
unknown stays in its current state (or moves to `exceptions/`) until the outcome is known.

## Exceptions are not lifecycle states

Exceptions sit under `docs/pr-prompts/exceptions/<reason>/`. The reason is a closed
vocabulary - these are the only valid values:

- `needs-marco`
- `blocked`
- `failed`
- `paused`
- `no-pr-opened`
- `abandoned`

Adding a seventh reason is a change to this document AND to the shared constant that S2
will introduce. It is never done by creating a new folder unilaterally. If a situation
does not fit any of the six reasons, that is evidence the vocabulary is incomplete and the
question goes to Marco.

## Reports are not prompts

Station breadcrumbs and run reports belong in `docs/pr-prompts/reports/`, not in the
queue root. When this document was written, 31 report files were sitting loose in the
queue root. S3's migration will move them; this document records why they do not belong
there: a report is evidence of a run, not a unit of work to dispatch.

## Nothing is ever deleted

Retiring a prompt means moving it to the appropriate folder. Marco's standing rule - first
stated when `processed/` was introduced - is that no prompt file is deleted. A reader
tracing a PR back to its prompt can always find the prompt because it was moved, never
removed.

This rule binds S3's migration: every file that moves in S3 was moved, verifiably, to a
named destination. No file disappears.

## Not in force yet

This standard is WRITTEN in S1 (this PR) and ENFORCED in S4. Between S1 and S4:

- S2 introduces the shared constant and the path guard (code only, guard is a warning).
- S3 migrates the existing queue to match this layout.
- S4 turns the guard on in CI (lint fails on a violation).

Until S4 merges, a station that follows this layout is doing the right thing; a station
that does not is not yet failing CI. Raise a discrepancy with Marco rather than silently
non-conforming.
