# Station 00 — Supervisor ADDENDUM | 2026-09-22T16:45Z–2026-09-22T16:5xZ

Addendum to `00-00-supervisor-2026-09-22-1614-the-sweep-i-read-from-the-buffer-ended-mid-evidence-and-the-silence-detector-had-00-at-the-wrong-cadence.md`, which merged as **#2090** at
`2026-09-22T16:44:04Z`. That report is correct as written and nothing in it is withdrawn. This file
carries one finding made **after** it was committed, during the run's own close-out probes.

## GROUND

```
UTC            2026-09-22T16:45:26Z   (close-out of the 16:14:19Z occurrence)
origin/main    dd772da4               (#2090 merge commit dd772da4d77e22ddff14eaa18e1bf333834f6d89)
dev tree       main @ dd772da4        C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **MATCH**. Sighted run — Desktop Commander connected on the first call.

## WHAT I MEASURED

**[MEASURED] `#2090` merged and the dev tree received it.** Read back, not assumed:
`state=MERGED`, `mergedAt=2026-09-22T16:44:04Z`, merge commit `dd772da4`; `origin/main` moved
`2b94e088 → dd772da4`. Fast-forward clean on the first attempt with **all four** read-backs, not the
prescribed three:

```
git rev-list --left-right --count HEAD...origin/main   ->  0   0
git diff --numstat                                     ->  EMPTY
git diff --cached --name-status                        ->  EMPTY
git status --porcelain --untracked-files=no            ->  EMPTY
```

Content proof, because `0 0` can be true of a tree that never received the content: the working copy
reads `const CADENCE = { '00': 1, … }`, the new breadcrumb is on disk in the queue root, and
`00-04-scanner-…-BLIND-….md` is present in `archive/` and **absent** from the root.

**[MEASURED] Trunk on the new head.** `gh run list --commit dd772da4`: `CI` **success**,
`Push on main` **success**, `Deploy` and `Tendering Browser Smoke` still `in_progress`. **FAILED=0.**
⚠️ Stated as measured: the two long-running workflows had not finished when this run closed, so
"trunk green on `dd772da4`" is true of the required contexts and **not yet proven** of all four.

**[MEASURED] Worktree and branch cleaned up.** `git worktree remove --force` exit 0;
`git worktree list` → `C:/ProjectOperations2 dd772da4 [main]` only, no orphans. The remote branch was
already deleted by `Merge-Pr`. Scratch files were written only under `tmp-outputs/`, confirmed
gitignored (`git check-ignore -q tmp-outputs` → exit **0**) and then removed.

## WHAT CHANGED

Only this addendum breadcrumb, written inside its own PR worktree (cure 1). **No code, no prompt, no
label, no board state.** The board was **0 open PRs** before and after.

## FINDINGS

### F1 — `@($raw | ConvertFrom-Json).Count` returns **1** for every board, empty or not — and 1 is a plausible answer (S1)

**This is a PR-counting idiom, it never errors, and its wrong answer looks exactly like a small
healthy board.**

The close-out probe printed `RAW_JSON: []` and `OPEN_PR_COUNT=1` on the same screen, one line apart.
The `[]` is the truth: the board was empty. Isolated immediately, with a positive control:

| form | input | result | correct? |
|---|---|---|---|
| `@($raw \| ConvertFrom-Json).Count` | `[]` (empty board) | **1** | **NO** — truth is 0 |
| `@($raw \| ConvertFrom-Json).Count` | `[{"number":1},{"number":2}]` | **1** | **NO** — truth is 2 |
| `$v = $raw \| ConvertFrom-Json; @($v).Count` | `[]` | **0** | yes |

🔴 **It is not off-by-one on empty; it returns 1 on ANY input.** That is the uniform-answer
signature — the same shape as the `PRs touched in last 2 min = 15` against a `--limit 15` query in
the 15:14Z run's F2, and it is the second time in two runs that a hand-rolled board count has lied
in a uniform direction. **Cause:** in pipeline position `ConvertFrom-Json` emits the deserialized
array as a *single* object rather than enumerating it, so `@( … )` wraps the whole array as one
element. Assigning to a variable first makes PowerShell enumerate on the subsequent `@($v)`, which is
why the sound form differs only in where the parentheses fall.

🔴 **Both available misreadings are dangerous, and they point opposite ways.** On an empty board it
invents a PR that does not exist, so a station goes looking for work that is not there — or worse,
reports the board as non-empty. On a real board of five it reports **1**, so four PRs become
invisible to whatever decision that count feeds. Neither errors and neither is empty, so §9.6's
*"an empty result is not an empty world"* never fires: the result is `1`, which is not empty.

🔧 **The cure is to assign before counting, and to print the raw JSON beside any count taken from
it.** The only reason this was caught at all is that the probe happened to print `[]` on the line
above the count. A count with no raw form beside it cannot be falsified by its own reader.
⚠️ **And prefer `status-sweep.ps1`'s `[LIVE] OPEN PRs:` line over counting by hand** — this is
DOCTRINE §1's *"never hand-roll a board operation"* demonstrated for the second consecutive run, on
the two different hand-rolled counts a supervisor reaches for most.

⚠️ **Nothing was mis-acted on.** The `1` appeared during close-out, after `#2090` had merged, and
every board decision this run made was taken from the sweep's `[LIVE] OPEN PRs: 0` and from a
separately-measured `OPEN_PR_COUNT=0` at `16:23:53Z` that used the sound assign-then-count form. The
merged 16:14Z breadcrumb is unaffected.

⚠️ **Falsifying probe: the three-row table above.** Re-run both forms over `[]` and over a
two-element fixture. If the broken form ever returns `0` and `2`, this finding does not apply to that
PowerShell build.

**DISPOSITION: ACTIONED** — diagnosed, controlled with a positive control on a non-empty fixture, and
recorded here rather than in a chat message no scheduled run can read. No repo change: no shipped
script carries the broken form (`status-sweep.ps1`'s own count is sound, and its `OPEN PRs: 0` was
correct all run). The next station to hand-roll a PR count is the reader this is for.

## WHAT I DID NOT DO

- **Did not amend or reopen `#2090`.** It is merged and every fact in it is still true. A finding made
  after a report lands belongs in a new breadcrumb, not in a rewrite of the old one.
- **Did not grep the repo for other uses of the broken idiom.** That is a read-only audit across the
  whole tree — Station 04's lane, not mine (LL-38). **DISPATCHED to 04** by naming it here: the needle
  is `@(` … `| ConvertFrom-Json).Count` and any sibling shape that pipes directly into
  `ConvertFrom-Json` inside a subexpression and then counts. 04's next occurrence is
  `2026-09-22T18:09Z`.
- **Did not wait for `Deploy` and `Tendering Browser Smoke` to finish on `dd772da4`.** FAILED=0 with
  the required contexts green, and the next occurrence fires at `17:13Z` and will see them. Reported
  as in-progress rather than as green.
- **Did not arm, disarm, rename or retire any prompt**; did not touch `needs-marco/`; did not restart
  or probe the watcher; ran no `git` write in the watcher clone; ran no VM-side `git` against any
  mount (guard INERT, exit 2 — a reason for care, never a licence).
- **Did not touch Azure, Entra or SharePoint**, and wrote no production data. Absolute, and not
  reasoned past.
