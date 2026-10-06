---
premise: '! test -f scripts/pipeline/dispatch.mjs'
premise_means: >-
  A finding one station hands to another (disposition DISPATCHED) has no file-backed home, so
  nothing can list the open ones. ESCALATED has needs-marco/, and status-sweep.ps1 section 5 reads
  it. DISPATCHED lives only in archived breadcrumbs, which no instrument reads. MEASURED
  2026-09-10 by Station 04 over 607 files: two rotted citations were dispatched and then
  re-discovered by four consecutive sweeps over nine days. Re-checked 2026-10-02 at origin/main
  c145476c: no dispatched/ folder, no dispatch script, and status-sweep.ps1 reads only needs-marco/
  among the escalation queues. Source:
  needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md (local, gitignored).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  test -f scripts/pipeline/dispatch.mjs &&
  test -f docs/pipeline/dispatched/README.md &&
  grep -q "DISPATCH_REGISTER_V1" scripts/pipeline/status-sweep.ps1 &&
  ! git check-ignore -q docs/pipeline/dispatched/x.md &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/dispatch.mjs
  - scripts/pipeline/__tests__/dispatch.test.mjs
  - docs/pipeline/dispatched/README.md
  - docs/pipeline/dispatched/closed/.gitkeep
  - scripts/pipeline/status-sweep.ps1
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  New folder, new script, one read in the sweep, one doctrine paragraph. Reverting returns
  DISPATCHED to breadcrumb-only. Register files already merged stay as harmless history.
escalates: true
module: pipeline
---

# A tracked register for DISPATCHED findings, listed by the status sweep

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

**Yes, add the register.** One small tracked file per open hand-off, listed by the sweep with its
age, closed when the work lands. Same pattern as `retire-escalation.mjs`
(`pr-retire-escalation-tracked-record`): a tracked folder plus one helper. If that slice has
already merged, follow its conventions for arguments, `--record-into` and exit codes exactly. If it
has not, implement the same conventions as described below.

Tag the new code with `DISPATCH_REGISTER_V1`.

## The register: `docs/pipeline/dispatched/`

It is **tracked**. Confirm `git check-ignore` exits 1 for a file in it, and add a narrow `!`
exception if a broader rule catches it. One file per open dispatch:
`<YYYY-MM-DD>-<to-station>-<slug>.md`, with front matter:

```
---
id: <YYYY-MM-DD>-<to-station>-<slug>
from: <station id>
to: <station number, e.g. 05>
opened_at: <ISO-8601 UTC>
finding: <one line>
done_when: <one line: what will be true when it lands>
source: <breadcrumb path or PR number that raised it>
---
```

Closing **moves** the file to `docs/pipeline/dispatched/closed/` and adds `closed_at`, `closed_by`
and `evidence`. Never delete.

## The helper: `scripts/pipeline/dispatch.mjs`

```
node scripts/pipeline/dispatch.mjs open  --to 05 --slug <s> --finding "<...>" --done-when "<...>" \
     --from <station id> --source <ref> --record-into <PR worktree>
node scripts/pipeline/dispatch.mjs close --id <id> --by <station id> --evidence "<...>" --record-into <PR worktree>
node scripts/pipeline/dispatch.mjs list  [--repo <path>]     # open dispatches, oldest first, with age in days
```

- `open` and `close` write **only** into `--record-into`, which must be a git worktree and **not**
  the dev tree (`C:\ProjectOperations2`). The record rides in the station's own PR; a loose file in
  the dev tree blocks its fast-forward. Refuse with that reason.
- `open` refuses a duplicate id. `close` refuses an id that is not open. Empty `--finding`,
  `--done-when` or `--evidence` is refused.
- Success prints the written path as the only stdout line.
- UTF-8, no BOM, LF.

## The sweep: `scripts/pipeline/status-sweep.ps1`

In section 5, beside the `needs-marco/` cross-check, add a block that lists open dispatches **from
`origin/main`**, not the working copy (DOCTRINE section 9: the working copy is routinely behind).
Use `git ls-tree --name-only origin/main docs/pipeline/dispatched/` and `git show origin/main:<path>`
for the front matter. One `LIVE` line per open dispatch:

`dispatched: <id>  to=<to>  age=<n>d  finding=<finding>`

Flag any older than 7 days with `<-- STALE DISPATCH`. Print `no open dispatches` when the folder is
empty, and `[CANNOT MEASURE] dispatched register absent on origin/main` when the folder is
missing. Absent is not empty.

PowerShell rules (DOCTRINE 9.1): no single-letter variable names, and no automatic-variable names as
assignment or loop targets.

`pr-sweep-clone-dirty-and-unpushed` also edits this file, in a different block. If it has merged,
rebase onto it. Do not touch its block.

## DOCTRINE

Where DOCTRINE defines the four dispositions (`ACTIONED / DISPATCHED / ESCALATED / DEFERRED`), add
one paragraph: **a DISPATCHED finding is recorded with `dispatch.mjs open` in the same PR as the
breadcrumb that dispatches it, and the receiving station closes it with `dispatch.mjs close` in the
PR that lands the work.** Do not edit the station docs individually; they defer to DOCTRINE for
dispositions. Then run `node scripts/pipeline/lint-station.mjs`. If it reports a canonical-hash
change, re-record with `--write-canonical` and commit `_canonical-blocks.json`.

## Tests: `scripts/pipeline/__tests__/dispatch.test.mjs`

Two temp `git init` repos, one as the dev tree and one as the record worktree:

1. `open` writes the file with all seven fields; stdout is exactly its path.
2. `close` moves it to `closed/` with the three new fields; the original path is gone.
3. `list` returns open dispatches oldest first, with age.
4. `--record-into` equal to the dev tree is refused.
5. A duplicate `open`, and a `close` of an unknown id, are both refused.
6. **Negative control:** empty `--evidence` on `close` is refused and nothing moves.

`escalates: true`: it edits the shared sweep and DOCTRINE. The PR opens labelled `do-not-merge`,
and Marco releases it.
