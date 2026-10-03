# Prompt queue layout standard

<!-- QUEUE_LAYOUT_V1 -->

Written 2026-09-17, S1 of 4. This document is the canonical source for the queue folder
standard.

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

Adding a seventh reason is a change to this document AND to the shared constant in
`scripts/pipeline/queue-layout.mjs`. It is never done by creating a new folder unilaterally.
If a situation does not fit any of the six reasons, that is evidence the vocabulary is
incomplete and the question goes to Marco.

## Reports are not prompts

Station breadcrumbs and run reports belong in `docs/pr-prompts/archive/`, not in the
queue root. When this document was written, 31 report files were sitting loose in the
queue root. S3's migration was cancelled by decision (see below). The `archive/` folder
replaces `reports/` everywhere in this document: a report is evidence of a run, not a
unit of work to dispatch. Root-level `00-NN-…` breadcrumbs are in transit to `archive/`
and pass the layout guard; see "In force from 2026-10-02" below.

## Nothing is ever deleted

Retiring a prompt means moving it to the appropriate folder. Marco's standing rule - first
stated when `processed/` was introduced - is that no prompt file is deleted. A reader
tracing a PR back to its prompt can always find the prompt because it was moved, never
removed.

This rule binds any future migration: every file that moves was moved, verifiably, to a
named destination. No file disappears.

## In force from 2026-10-02 (QUEUE_LAYOUT_LINE_AT_TODAY_V1)

Marco's three rulings on 2026-10-02 set the enforcement line.

**Ruling 1 — Draw the line at today.** No existing file moves. S3's migration is
**cancelled by decision, not pending**. Only files a PR **adds or renames** under
`docs/pr-prompts/` must follow the layout. The ~1,400 files that existed before
2026-10-02 are grandfathered. `check-queue-layout.mjs --legacy-report` prints the
count and state breakdown as a historical record.

**Ruling 2 — Tracked files only.** The watcher's own gitignored working folders
(`processed/`, `failed/`, `blocked/`, `paused/`, `no-pr-opened/`, `awaiting-review/`,
`reviewed/`) are out of scope. The watcher is not changed.

**Ruling 3 — `archive/` is the reports folder.** Reports pass through the queue root
as `00-NN-…` breadcrumbs and are swept to `archive/`. No `reports/` folder is
created, and no station, script or bootstrap changes.

### What the guard checks

`check-queue-layout.mjs --range <base>...<head>` lists every file that a PR **adds**
(status `A`) or **renames to** (status `R` destination) under `docs/pr-prompts/`. It
classifies each path using `classifyQueuePath` from `scripts/pipeline/queue-layout.mjs`
and exits 1 on any violation, 0 otherwise. Edits (`M`) and deletes (`D`) of existing
files are never checked — touching a legacy file is not a layout event.

### Valid destinations for new or renamed files

| destination | result |
|---|---|
| root `*-HOLD.md` | ok — hold |
| root name matching breadcrumb `NAME_RE` | ok — report in transit to `archive/` |
| root file in `ROOT_FIXED_FILES` (README, BACKLOG, etc.) | ok — queue-file |
| root `TEMPLATE-*.md` | ok — queue-file |
| root `*-ready.md` | **violation**: armed prompts are never tracked |
| any other root file | **violation** |
| `archive/**` | ok — archived report |
| `superseded/**` | ok — superseded prompt |
| `merged/**` | ok — merged prompt |
| `draft/**` | ok — draft prompt |
| `brainstorm/**` | ok — brainstorm note |
| `exceptions/<reason>/**` with `<reason>` in the closed list | ok — exception |
| `exceptions/<anything else>/**` | **violation**: names the closed list |
| `needs-marco/**` | ok **with warning** — gitignored folder force-added; prefer `exceptions/needs-marco/` |
| `binned-shipped-*/**`, `processed/**`, any other folder | **violation**: legacy or unknown folder |

### Shared constant

`scripts/pipeline/queue-layout.mjs` is the single source of truth for:

- `NAME_RE` — breadcrumb filename regex (also re-exported from `check-breadcrumb.mjs`)
- `EXCEPTION_REASONS` — the closed vocabulary of valid exception reasons
- `ROOT_FIXED_FILES` — infrastructure files allowed at the queue root
- `classifyQueuePath(path)` — the classifier used by the guard

### CI step

The guard runs in the `pipeline-tests` job as a **pull-request-only** step. Push to main
is not checked: main only changes by PR merge, and the PR was already checked.

## Previous status note

The "Not in force yet" section that appeared in S1 has been replaced by this section.
S2 (shared constant and path guard) and S4 (CI enforcement) were done together in one PR
on 2026-10-02. S3 (migration of existing files) is cancelled by Marco's ruling 1 above.
