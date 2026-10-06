---
premise: '! test -f scripts/pipeline/retire-escalation.mjs'
premise_means: >-
  Retiring a needs-marco escalation leaves no tracked record. docs/pr-prompts/needs-marco/ is
  gitignored, so the file move and the _DISCHARGE-NOTE written beside it reach nobody through git.
  MEASURED 2026-10-02 at origin/main cf09be41: `git check-ignore -v` names the needs-marco/ line in
  .gitignore. 00-supervisor.md (the COLLECT step that says "Move-Item it into
  docs/pr-prompts/needs-marco/discharged/ ... leave a _DISCHARGE-NOTE-*.md beside them") admits the
  gap and says "say in your breadcrumb what you discharged". No script exists for the move.
  Worked instance, 2026-09-23: 18 of 62 escalations were retired into needs-marco/_resolved-2026-09-23/
  with a README. A scheduled Station 00 found the files gone, saw no record anywhere and filed
  "18 escalations deleted by an actor I cannot identify" at S1. It cost most of a run and a
  correction PR (#2106). Dispatched to Station 06 as item 12 of the 2026-09-24 handover
  (docs/pr-prompts/archive/00-06-pr-master-2026-09-24-1200-...md).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  test -f scripts/pipeline/retire-escalation.mjs &&
  test -f docs/pipeline/discharges/README.md &&
  grep -q "retire-escalation.mjs" docs/pipeline/stations/00-supervisor.md &&
  ! git check-ignore -q docs/pipeline/discharges/x.md
scope:
  - scripts/pipeline/retire-escalation.mjs
  - scripts/pipeline/__tests__/retire-escalation.test.mjs
  - docs/pipeline/discharges/README.md
  - docs/pipeline/stations/00-supervisor.md
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  New script, new folder, one station-doc paragraph. Reverting returns stations to the manual
  Move-Item. Discharge notes already merged stay as harmless history.
escalates: true
module: pipeline
---

# Retiring an escalation leaves a tracked record

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

**One helper writes a tracked log.** A single retire command moves the escalation file and writes a
short tracked note: what was retired, when, by whom, and the evidence. The note goes in
`docs/pipeline/discharges/`. The escalation files themselves **stay untracked**. Do not un-ignore
`needs-marco/`. Marco chose this over tracking the whole folder.

## What to build

### `scripts/pipeline/retire-escalation.mjs`

Node, no dependencies beyond the standard library (like the other `check-*.mjs` scripts).

```
node scripts/pipeline/retire-escalation.mjs \
  --file docs/pr-prompts/needs-marco/<name>.md \
  --actor <station id, e.g. station-00.interactive-0004> \
  --evidence "<one line: what was measured that proves it is resolved>" \
  --record-into <path to the worktree that will carry the note in a PR> \
  [--repo <dev tree root, default: cwd>] [--dry-run]
```

It does exactly three things, in this order:

1. **Validates.** Refuse with a non-zero exit and a plain message if:
   - `--file` does not exist, or is not directly under `docs/pr-prompts/needs-marco/`;
   - `--actor` or `--evidence` is empty;
   - `--record-into` is missing, is not a git worktree, or **is the same directory as `--repo`**.
     The note must ride in a PR. An untracked file left in the dev tree blocks its fast-forward,
     the known trap behind the 2026-09-04 FF blocker. Say that in the error.
   - the destination `needs-marco/discharged/<name>.md` already exists. **Never overwrite.**
2. **Moves** the file to `docs/pr-prompts/needs-marco/discharged/<name>.md` with a rename, never
   copy-then-delete. Create `discharged/` if absent. It is never a delete.
3. **Writes the tracked note** to
   `<record-into>/docs/pipeline/discharges/<YYYY-MM-DD-HHmm>Z-<slug>.md`, where the slug is the
   escalation's basename without `.md`:

   ```
   ---
   item: <name>.md
   title: <first markdown heading of the escalation file, or the basename>
   retired_at: <ISO-8601 UTC>
   actor: <actor>
   moved_to: docs/pr-prompts/needs-marco/discharged/<name>.md
   ---

   ## Evidence
   <evidence>
   ```

   Write UTF-8, no BOM, LF line endings. Read the title before the move.

Print the note path on stdout as the **only** success-stream line, so a caller can `git add` it.
`--dry-run` prints what it would do and touches nothing.

If the move succeeds and the note write fails, **move the file back** and exit non-zero. Never
leave a retired escalation with no record. That half-state is the exact defect being fixed.

### `docs/pipeline/discharges/README.md`

Short. Say what the folder is (one note per retired escalation, written by
`retire-escalation.mjs`), that the escalation file itself lives untracked in `needs-marco/discharged/`
on the dev box, and that this folder is the record any station checks before reporting an
escalation as "missing" or "deleted". Confirm the folder is not caught by `.gitignore`
(`git check-ignore` must exit 1). If a broader ignore rule catches it, add a narrow `!` exception.

### `docs/pipeline/stations/00-supervisor.md`

In the COLLECT paragraph that currently says to `Move-Item` into `needs-marco/discharged/` and leave
a `_DISCHARGE-NOTE-*.md`:

- Replace the manual move with the `retire-escalation.mjs` call, with `--record-into` pointing at the
  run's breadcrumb PR worktree.
- Keep every existing check before the move (re-ask the PR individually, the negative control,
  "confirm nothing GENERAL survives").
- Replace "say in your breadcrumb what you discharged" with: the note is committed in the same PR as
  the breadcrumb.
- Add one line to the escalation-census step: **before reporting an escalation as gone, check
  `docs/pipeline/discharges/` on `origin/main` for its name.** That line is what would have stopped
  the 2026-09-23 false S1.

Do not edit any other station doc, and do not edit anything under `sot/` (CP-24).

## Tests: `scripts/pipeline/__tests__/retire-escalation.test.mjs`

`node:test`, everything in a temp dir with two `git init` repos: one as the "dev tree", one as the
record worktree.

1. Happy path: the file moves to `discharged/`, the note appears with all five front-matter fields,
   and stdout is exactly the note path.
2. `--record-into` equal to `--repo`: refused, nothing moved.
3. File outside `needs-marco/`: refused.
4. Destination already exists in `discharged/`: refused, and the original is untouched.
5. Note write fails (make the target read-only, or point `--record-into` at a path that can't be
   written): the file is **moved back** and the exit is non-zero.
6. `--dry-run`: nothing moved, nothing written.
7. **Negative control:** empty `--evidence` is refused, so a record can never be written without
   its proof.

## Out of scope

- Backfilling notes for past retirements. The 2026-09-23 batch is already explained by #2106.
- Items 9 and 21 of the handover (dispatch home, escalations only in the watcher clone). This folder
  is the shape they can reuse, but they are separate slices.

`escalates: true`: it changes how a shared queue is handled. The PR opens labelled `do-not-merge`,
and Marco releases it.
