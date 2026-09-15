# Station 00 — Supervisor (addendum to 2308) | 2026-09-14T23:26Z–2026-09-14T23:3xZ

## GROUND

```
UTC            2026-09-14T23:26:00Z
origin/main    834747ef            (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 834747ef     C:\ProjectOperations2   (0 0 against origin/main, numstat EMPTY, cached EMPTY)
doc version    1
bootstrap      1
```

This addendum exists for one reason: **my 2308 breadcrumb left F1's verification INCOMPLETE and told the
next run to read the re-run's conclusion as its first action. The conclusion arrived before this run
ended.** Leaving it unrecorded would bill the next run for a fact I already hold, and — worse — the
standing instruction I wrote would have it re-run a job that has already answered.

## WHAT I MEASURED

- [MEASURED] **The main re-run went GREEN.** `gh run view 34904096022 -R GH-Mantova/ProjectOperations
  --json status,conclusion` → `{"conclusion":"success","status":"completed"}` at `2026-09-14T23:27Z`.
  The same job was `in_progress` at 23:14Z, 23:15Z, 23:20Z, 23:23Z and 23:26Z, so this is a completed
  re-run and not a stale read of the original. **`origin/main` is no longer red.**
- [MEASURED] **`#1941` merged.** `gh pr view 1941 --json state,mergedAt` →
  `{"state":"MERGED","mergedAt":"2026-09-14T23:21:25Z"}`, squashed as `834747ef`, subject
  `docs(board): 00 collect 2308 …`. Native auto-merge, armed at 23:20:14Z and read back — not a hand merge.
- [MEASURED] **The post-merge fast-forward took the documented two-cause path, in order, and both causes
  fired.** Four breadcrumb/receipt paths that `#1941` landed were byte-identical on disk
  (`git rev-parse origin/main:<p>` = `git hash-object <p>` on all four, quoted in full in the run log) and
  were deleted; `docs/pipeline/sweep-rotation.json` was restored to HEAD with a node write — never
  `git checkout -- <path>`. The fast-forward **still refused**, naming `sweep-rotation.json`, exactly as
  `00-supervisor.md` predicts: restoring to HEAD introduces the LF/CRLF smudge that is the *first*
  diagnosis, after the *second* one has been cured. `git add --renormalize` + `git update-index --refresh`
  staged **nothing** (`--cached` EMPTY), the fast-forward then succeeded, the four files were replaced from
  the **new** HEAD, and all three read-backs passed: `rev-list --left-right --count HEAD...origin/main` →
  `0	0`, `git diff --numstat` → EMPTY, `git diff --cached --name-status` → EMPTY.
- [MEASURED] **And the restore re-smudged the four files it had just written.** After the read-backs
  passed, `git status --porcelain` showed ` M` on all four while `git diff --numstat` was EMPTY — §9.2's
  "status answers about HEAD's stat-cache, `--numstat` is the real answer". A second
  `git add --renormalize` on those four staged **nothing** and cleared the ` M` rows. Final state:
  `--cached` EMPTY, `--numstat` EMPTY, **zero ` M` rows**.
- [MEASURED] Disposable worktree `C:\po-worktrees\st00-2326` removed (`git worktree remove --force`,
  exit 0) and `git worktree prune` run. `git worktree list` now shows the dev tree plus the same three
  pre-existing orphans, unchanged and untouched.

## WHAT CHANGED

`origin/main` `8c6bffc3` → `834747ef` (my own `#1941`). The dev tree fast-forwarded to it and is clean.
The re-run I fired in the 2308 run completed green. **No other mutation: no merge of anyone else's PR, no
arm, no label, no watcher action, no worktree pruned, no branch deleted, nothing in `/sot/`.**

## FINDINGS

### F1a — The trunk red was non-deterministic, for the THIRD time, and "re-run it" is no longer an adequate disposition

The re-run of run `34904096022` on the unchanged commit `8c6bffc3` went **green**. The diff did not
change; only the attempt did. That is the definition of non-determinism, and it retires the alternative
hypothesis Station 03 correctly left open — a defect in the dashboard-create path would have failed again.

**So the class is settled and the mechanism is not.** What is known: the failure is a Postgres
`duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"` against
`@@unique([userId, slug, isSystem])` on `model UserDashboard`, surfacing as four dashboard assertions in
`tests/e2e/pr-acceptance/batch1-dashboards…` on chromium. What is **[CANNOT MEASURE]** without reading the
green runs' logs side by side: *which* actor inserts the second row — suite ordering, a shared seed, or a
retry that re-POSTs a dashboard the first attempt already created.

⚠️ **This is occurrence three, and all three were cleared by a re-run**: `#1920` at 21:09Z, `#1920` again
at 22:35Z, and `main` at 23:26Z. A flake that recurs on a three-hour cadence is a defect with an
intermittent trigger, and the cost is no longer one re-run — it is that **every board PR's required checks
now have a real chance of a false red**, which is the failure mode that trains a run to re-run reflexively
instead of reading.

**DISPATCHED** — to my own next occurrence, with the decision pre-made so it is not re-litigated: **stage a
`fixes_pr` prompt naming the constraint. Do not re-run a fourth time and call it a flake.** The prompt's
executable premise should assert the collision is reachable — e.g. that no test-side guard exists around
the dashboard-create path — and its scope is `apps/api` plus `tests/e2e`, which `classifyPolicyFiles`
routes to Marco. That is the right outcome: it is a real defect and it should have a human on it.

⚠️ **Do NOT read this as licence to arm it blind.** The 2308 run measured `gates-satisfied=4` with two of
the four annotated as possible duplicates of the two open PRs; a fifth prompt for this must not be armed
while `#1920` — which is itself a `UserDashboard` preset seed — is open, or it will collide with the very
work that keeps surfacing the constraint.

### F1b — I wrote a standing instruction to the next run that was already stale when I wrote it

My 2308 breadcrumb tells the next 00 run to read `gh run view 34904096022` **first, before anything else**.
Seven minutes after that file was committed, the answer arrived in the same session. Had I not written this
addendum, the next run would have spent its opening move re-deriving a fact I already held — and the run
after that would have inherited the instruction unchanged.

This is the shape `00-supervisor.md` names directly: *"a disposition addressed to a FUTURE RUN outlives its
own fix and bills a later run to re-discover it."* It is cheap to avoid and I did not avoid it; the addendum
is the repair, not the prevention.

**ACTIONED** — the instruction is superseded here, in a tracked file that lands in the same queue directory
and the same freshness set as the breadcrumb it corrects. 🔧 **The general rule worth carrying: a
disposition that hands a pending measurement to a future run must be re-checked before the run ends, and
superseded in writing if it has resolved.** A run that fires an async probe owns its result for as long as
the run lasts.

## WHAT I DID NOT DO

- **Did not merge `#1923` or `#1920`.** Both still carry live `marco:true` verdicts; the trunk going green
  changes nothing about RULE 2. `#1923` remains green, clean, unlabelled and Marco's.
- **Did not stage the `fixes_pr` prompt this run.** The class is settled but the mechanism is not, and
  `PROMPT-SCHEMA.md` requires an executable premise. A prompt whose premise I cannot write honestly is a
  prompt that lints ADMIT and builds the wrong thing.
- **Did not arm anything.** `armed` was 0 at the start of the 2308 run and 0 at the end of this one.
- **Did not re-run any further job**, on `main` or on either open PR. The question the re-run existed to
  answer has been answered.
- **Did not touch the watcher, the clone, any worktree, any branch, `/sot/`, Azure, Entra or SharePoint.**
- **Did not use `git checkout -- <path>`, `checkout .`, `reset --hard`, `stash pop` or `git clean`** at any
  point in the fast-forward cure. Every restore was `git show <ref>:<path>` written with node.
