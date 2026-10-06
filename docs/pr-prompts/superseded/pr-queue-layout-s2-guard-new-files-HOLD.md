---
premise: '! test -f scripts/pipeline/check-queue-layout.mjs'
premise_means: >-
  The prompt-queue layout standard (docs/pipeline/QUEUE-LAYOUT.md, QUEUE_LAYOUT_V1, shipped in #1999
  on 2026-09-17) is written but guarded by nothing. Its S2 (shared constant plus path guard), S3
  (migrate the queue) and S4 (enforce in CI) were never drafted. MEASURED 2026-10-02 at origin/main
  57a4909e: no queue-layout module, no checker, no CI step. Over the last 300 commits, files added or
  renamed under docs/pr-prompts/ went to archive/ 484, root breadcrumbs 323, superseded/ 126, root
  HOLDs 118, needs-marco/ 7 (a gitignored folder, force-added), and root `*-ready.md` 2. The last
  two are tracked armed prompts, which the standard says are never tracked.
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  test -f scripts/pipeline/queue-layout.mjs &&
  test -f scripts/pipeline/check-queue-layout.mjs &&
  grep -q "check-queue-layout.mjs" .github/workflows/ci.yml &&
  grep -q "QUEUE_LAYOUT_LINE_AT_TODAY_V1" docs/pipeline/QUEUE-LAYOUT.md
scope:
  - scripts/pipeline/queue-layout.mjs
  - scripts/pipeline/check-queue-layout.mjs
  - scripts/pipeline/check-breadcrumb.mjs
  - scripts/pipeline/__tests__/check-queue-layout.test.mjs
  - .github/workflows/ci.yml
  - docs/pipeline/QUEUE-LAYOUT.md
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  New module, new checker, one CI step, one doc section. Reverting removes the guard; no file is
  moved and nothing else changes.
escalates: true
module: pipeline
---

# Queue layout: guard new and moved files, leave everything that exists where it is

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's rulings (2026-10-02)

1. **Draw the line at today.** No existing file moves. S3's migration is **cancelled**. Only files a
   PR **adds or renames** under `docs/pr-prompts/` must follow the layout.
2. **Tracked files only.** The watcher's own gitignored working folders (`processed/`, `failed/`,
   `blocked/`, `paused/`, `no-pr-opened/`, `awaiting-review/`, `reviewed/`) are out of scope. The
   watcher is not changed.
3. **`archive/` is the reports folder.** Reports pass through the queue root as `00-NN-…` breadcrumbs
   and are swept to `archive/`. No `reports/` folder is created, and no station, script or bootstrap
   changes.

This slice does S2 and S4 together, because "new files only" cannot misfire on the ~1,400 legacy files.

## 1. The shared constant: `scripts/pipeline/queue-layout.mjs`

Pure ES module, exported, no I/O. Tag it `QUEUE_LAYOUT_LINE_AT_TODAY_V1`.

- `EXCEPTION_REASONS`: `needs-marco`, `blocked`, `failed`, `paused`, `no-pr-opened`, `abandoned`,
  exactly the closed list in QUEUE-LAYOUT.md.
- `ROOT_FIXED_FILES`: `README.md`, `PROMPT-SCHEMA.md`, `BACKLOG.yaml`, `BACKLOG-DECISIONS.md`,
  `ESCALATIONS.yaml`, `.arming-log.txt`, `.queue-sync-ledger.txt`, `queue-watch-state.md`,
  `shepherd-state.md`, plus any `TEMPLATE-*.md`.
- The breadcrumb `NAME_RE` must exist in exactly one place. `check-breadcrumb.mjs` runs its checks
  at top level, so importing it would execute it. **Move** `NAME_RE` into `queue-layout.mjs`,
  byte-identical, and have `check-breadcrumb.mjs` import it from there, keeping its own
  `export { NAME_RE }` so existing importers still work. Do not copy the regex.
- `classifyQueuePath(path)` takes a repo-relative path under `docs/pr-prompts/` and returns
  `{ ok, state, reason }`:

| path | result |
|---|---|
| root `*-HOLD.md` | ok, `hold` |
| root name matching breadcrumb `NAME_RE` | ok, `report` (in transit to `archive/`) |
| root file in `ROOT_FIXED_FILES` | ok, `queue-file` |
| root `*-ready.md` | **violation**: "armed prompts are never tracked; the rename is the dispatch" |
| any other root file | **violation** |
| `archive/**` | ok, `report` |
| `superseded/**` | ok, `superseded` |
| `merged/**` | ok, `merged` |
| `draft/**` | ok, `draft` |
| `brainstorm/**` | ok, `brainstorm` |
| `exceptions/<reason>/**` with `<reason>` in `EXCEPTION_REASONS` | ok, `exception` |
| `exceptions/<anything else>/**` | **violation**: names the closed list |
| `needs-marco/**` | ok **with a warning**: "gitignored folder force-added; prefer exceptions/needs-marco/". Station flows read this folder, so it is not blocked. |
| `binned-shipped-*/**`, `processed/**`, any other folder | **violation**: "legacy or unknown folder; nothing new goes here" |

## 2. The checker: `scripts/pipeline/check-queue-layout.mjs`

```
node scripts/pipeline/check-queue-layout.mjs --range <base>...<head>    # CI and local
node scripts/pipeline/check-queue-layout.mjs --legacy-report            # informational only
```

- `--range` lists `git diff --name-status --find-renames <range> -- docs/pr-prompts/`. It checks
  every **A** (added) path and every **R** (renamed) **destination**. M and D are never checked:
  editing or deleting a legacy file is not a layout event.
- Print one line per checked path (`ok <state> <path>` or `VIOLATION <path>: <reason>`), then a
  summary. Exit 1 on any violation, 0 otherwise. Warnings never fail.
- **Exit 2 when the range cannot be read** (bad ref, shallow clone), with a `[CANNOT MEASURE]` line.
  Never 0 when nothing was read. Same rule as `check-pr-title.mjs`.
- Print controls before the verdict, following `check-pr-title.mjs`: classify one known-good and one
  known-bad path, and fail with exit 2 if either comes out wrong.
- `--legacy-report` walks the tracked tree on HEAD and prints counts per state, plus a count of
  existing paths that would fail. It always exits 0. This is the record of what the line at today
  grandfathers.

## 3. CI: `.github/workflows/ci.yml`

In the existing `pipeline-tests` job (which already has `fetch-depth: 0`), add a step **for pull
requests only**:

`node scripts/pipeline/check-queue-layout.mjs --range "origin/${{ github.base_ref }}...HEAD"`

Do not add a new job or touch any other step.

## 4. `docs/pipeline/QUEUE-LAYOUT.md`

Add a section headed **"In force from 2026-10-02 (QUEUE_LAYOUT_LINE_AT_TODAY_V1)"** that records the
three rulings above. It also says:

- S3 is cancelled by decision, not pending.
- `archive/` replaces `reports/` everywhere in this document; edit the "Reports are not prompts"
  section to say so.
- The watcher's working folders are out of scope.
- The guard checks only added or renamed tracked files.

Replace the "Not in force yet" section with a pointer to the new one. Keep "Nothing is ever deleted"
unchanged.

**Do not touch `sot/`.** `pr-queue-layout-sot-entry-HOLD.md` is Station 05's to update by hand.
Say in the PR body that it now needs these rulings.

## Before opening the PR, replay the guard over history

Run `--range` over each of the last 40 merged PRs' merge commits (`<sha>^1...<sha>`). Paste a table
of PR number, paths checked and violations into the PR body. Expected: the only violations are the
two historical tracked `*-ready.md` files, if they fall in range, and nothing else. **If any other
legitimate add trips the guard, fix the rule rather than shipping a gate that fails real work**, and
say what you changed.

## Tests: `scripts/pipeline/__tests__/check-queue-layout.test.mjs`

1. Every row of the table above, through `classifyQueuePath`.
2. A temp `git init` repo with a base commit holding legacy files in `processed/` and
   `binned-shipped-x/`. A head commit that **modifies** one and adds a valid HOLD exits 0. Legacy
   files are not judged.
3. A head commit that **adds** a file to `processed/` exits 1.
4. A **rename** of a root HOLD into `superseded/` exits 0; a rename into `binned-shipped-x/` exits 1.
5. An unreadable range exits 2, never 0.
6. **Negative control:** a range with no `docs/pr-prompts/` changes exits 0 and says it checked 0
   paths.

`escalates: true`: it adds a CI gate. The PR opens labelled `do-not-merge`, and Marco releases it.
