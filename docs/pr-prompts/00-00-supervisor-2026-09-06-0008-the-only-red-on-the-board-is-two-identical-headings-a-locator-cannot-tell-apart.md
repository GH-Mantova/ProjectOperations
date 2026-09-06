# Station 00 — Supervisor | 2026-09-06T00:08:30Z–2026-09-06T00:28Z

## GROUND

```
UTC            2026-09-06T00:08:30Z
origin/main    162d9d2c
dev tree       main @ 162d9d2c  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority this run. SIGHTED: `start_process`
(`powershell.exe`) returned a live shell, PID 30960, on the first call.

All three binding documents were read in full. The dev tree was `0 0` against `origin/main` with
`git diff --numstat` and `git diff --cached --name-status` both EMPTY, so the working copies of
`00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md` are byte-identical to `origin/main`
by the sound test (`--numstat` empty is the real answer, PREFLIGHT step 2) — no piped hash was
taken, and none is quoted.

## WHAT I MEASURED

### Sweep — SAFE TO ACT, captured to a file because it returns early

`powershell -File scripts\pipeline\status-sweep.ps1 *> C:\po-sup-fix-scripts\sweep-0006.txt`,
exit 0, 88,866 bytes, generated `2026-09-06 00:09:17Z`. §7 verdict, read from the file:

```
SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

Section 0 controls both `[LIVE]`: `gh` reached GitHub (saw merged #1683); `node` runs. Section 3:
in-progress prompts **0**, `index.lock` interactive/clone **False / False**, git processes **0**,
no PR touched on GitHub in the last 2 min. Section 4: **armed 0**, needs-marco 27, no-pr-opened
109, failed 41, blocked 120. Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.

⚠️ The capture is UTF-16LE — PowerShell's `*>` redirection, DOCTRINE §9.3. It reads correctly
through `Get-Content`; a byte-wise or hash comparison against it would be meaningless. Captured to
a file anyway, because `status-sweep.ps1` returns early and hides its own §7 verdict when streamed.

### Board — FIVE open PRs, and every one of them is Marco's

[MEASURED] `gh pr view <n> --json ...` per PR, plus the sweep's section 1:

| PR | state | CI | files | lane | classification |
|---|---|---|---|---|---|
| **#1682** | BLOCKED | **13 pass / 1 fail** | 3 (`apps/web/**` + one `__tests__/`) | second lane | **MARCO'S** — `apps/web/src/pages/…/CuttingSection.tsx` is outside all three `NESTED_TEST_PATHS` forms |
| **#1680** | CLEAN | 14/0/0 green | — | **watcher** | `marco:true`, `reason: outside tests/ or docs/: package.json` — RULE 2 binds |
| **#1675** | CLEAN | 9/0/0 green | — | **watcher** | `marco:true`, `reason: timeout waiting for green checks + MERGE verdict` — RULE 2 binds |
| **#1667** | CLEAN | 14/0/0 green | 2 (`scripts/pipeline/lint-prompt.mjs` + `__tests__/`) | second lane | **MARCO'S** — `lint-prompt.mjs` is outside the three forms |
| **#1662** | CLEAN | 14/0/0 green | 6, incl. `apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/migration.sql` | second lane | **MARCO'S** — matches `(^\|/)migrations/`, and it is a five-column DROP (DOCTRINE §8.3, destructive) |

`main` CI on `162d9d2c`: 4 success / 0 failed / 0 running — trunk green. **DIRTY: zero.** No PR has
frozen CI; the board is not conflict-blocked.

**RULE 2 probe, live tree, with both controls.** `docs\pr-prompts\processed` in
`C:\ProjectOperations2` — **1972** logs, newest `2026-09-05T23:30:15Z`, which is younger than the
oldest open PR (#1662, opened `2026-09-05T11:45:57Z`), so this is the live directory and not the
watcher clone's 17-day-stale decoy. POSITIVE `marco.:true` → **614**. NEGATIVE, freshly minted this
run, `zzQq00N20260906T0012` → **0**. Probe over `pr-*.log` only, excluding `rev-*`:

```
PR #1682 → 0   NO LOG
PR #1680 → 2   [watcher] merge result for PR #1680: {"ok":false,"marco":true,…"package.json"}
PR #1675 → 1   [watcher] merge result for PR #1675: {"ok":false,"marco":true,…"timeout…"}
PR #1667 → 0   NO LOG
PR #1662 → 0   NO LOG
```

**`NO LOG` has three causes and I discriminated all three**, with the launch log — a different
instrument from the processed-log probe, per the correction landed on `main`. `watcher-launch.log`
(2,460,241 bytes), POSITIVE control `opened PR #` → **166** occurrences, NEGATIVE `opened PR #999999`
→ **0**:

```
opened PR #1682 → 0     opened PR #1667 → 0     opened PR #1662 → 0
opened PR #1680 → 1  [2026-09-05T21:41:26.888Z] … opened PR #1680, policy=tests-docs, waiting…
opened PR #1675 → 1  [2026-09-05T17:27:48.484Z] … opened PR #1675, policy=tests-docs, waiting…
```

So #1682, #1667 and #1662 are **`[NO LANE VERDICT — hand-classified]`** second lanes, not
watcher PRs whose verdict died in transit and not PRs still inside a `waiting…` window. None of
the three falls inside a §10.1 step-3 station lane — 00's is `docs/`, 05's is `sot/`, and all three
touch neither — so the exception does not reach them and step 2 stands.

### #1682's red — root cause NAMED from the job log, and it is not a flake

Never diagnosed from the diff. `gh run view 33998992441 --job 101394389617 --log`, 410,297 bytes,
2,990 lines. The run's `headSha` is `d32b177012ca91403b3faef7581879c97bf8cd06` — **the PR's current
head**, so this red is current, not a stale rollup.

Tendering browser smoke: **19 passed**. PR-acceptance suite: **160 passed, 4 failed**, all four in
`tests/e2e/pr-acceptance/batch3-scope-cutting.spec.ts` (`:56`, `:106`, `:146`, `:226`), all four
failing on the same line through the same helper:

```
batch3-scope-cutting.spec.ts:48   await expect(page.getByText("Concrete cutting")).toBeVisible();
Error: strict mode violation: getByText('Concrete cutting') resolved to 2 elements:
    1) <h3 class="s7-type-section-heading">…</h3> aka getByRole('heading', { name: 'Concrete cutting(0 rows)' })
    2) <h3 class="s7-type-section-heading">…</h3> aka getByRole('heading', { name: 'Concrete cutting(0 items)' })
```

**This is AMBIGUITY, not absence.** Both elements are present and visible; Playwright refuses to
choose. `.first()` would turn it green and would be a MASK — it would silently pick whichever
section happens to render first and the four tests would go on asserting against a section they
never meant to drive.

**The two elements are both deliberate.** [MEASURED] `git show
origin/pr-cardui-s7-cutting-section:apps/web/src/pages/tendering/scope-cards/ScopeCardsTab.tsx`
renders `<CuttingSection>` at line 892 **and** `<ScopeCuttingSheet>` at line 898, one directly above
the other, with the PR's own comment saying so: *"The take-off is the READ view of what the editable
Cutrite sheet below has produced."* On `origin/main` the same file renders `<ScopeCuttingSheet>`
alone (line 852) and nothing else. So the PR adds a second `h3.s7-type-section-heading` whose text
differs from the first only by `(N items)` versus `(N rows)`.

### Freshness — every station inside cadence, and 00's `ok` is the weakest of the five

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0,
`structure: 6 checked, 0 malformed, 0 skipped`:

```
00  last 2026-09-05T23:08:00Z   1.1h ago  (cadence 2h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-05T23:01:00Z   1.2h ago  (cadence 24h)  ok
04  last 2026-09-05T22:10:00Z   2.0h ago  (cadence 4h)   ok
05  last 2026-09-05T14:11:00Z  10.0h ago  (cadence 24h)  ok
```

⚠️ `check-breadcrumb.mjs`'s own `CADENCE` map still carries `'00': 2` while 00's live cron is
`5 * * * *` — hourly. That is the already-filed one-character defect; it means 00 is not called
SILENT until 4 h, i.e. after three consecutive missed hourly runs. Crossed against the station doc's
required second instrument: my own predecessor ran at 23:08Z and its PR **#1683 merged 23:30:29Z**,
1.1 h before this run's start, which is one hourly occurrence, so nothing was missed. No station is
SILENT and none needed a transcript read.

### Machinery

[MEASURED], sweep section 2, all `[LIVE]`: watcher node **RUNNING pid 20000**; auto-restart wrapper
**alive (1)**; heartbeat age **39 min** — which with `armed: 0` is idle, not wedged, and I did not
run `-Fix` on it. Watcher clone `branch=main dirty=4`. Guard hook present. One non-main worktree:
`C:\po-vg` `23c91ba9 [fix/no-rebase-while-checks-run]`, dirty=1, age 2416 min — the subject of the
open escalation below; **I did not touch it.**

## WHAT CHANGED

**One mutation, in `docs/pr-prompts/` only, from a disposable worktree off `origin/main`
(`C:\po-worktrees\board-0006`, created at `162d9d2c`).**

Six fully-dispositioned breadcrumbs `git mv`'d into `docs/pr-prompts/archive/`. Each was confirmed
tracked first with `git ls-files --error-unmatch` (six × exit 0; NEGATIVE control on a nonexistent
path → exit 1), and the staged result is six clean `R100` renames and nothing else:

- `00-00-supervisor-2026-09-05-2008-…`
- `00-00-supervisor-2026-09-05-2108-…`
- `00-00-supervisor-2026-09-05-2209-…`
- `00-00-supervisor-2026-09-05-2308-…`
- `00-03-machine-minder-2026-09-05-2301-…`
- `00-04-scanner-2026-09-05-2210-…`

The two station breadcrumbs (03's and 04's) were dispositioned in full by the 23:08Z run's finding
E, and 00's own four each carry a terminal disposition on every finding. Archiving is safe for
freshness: `check-breadcrumb.mjs` builds `trackedSet` with `git ls-tree -r` and matches by trailing
path segment, so an archived breadcrumb still counts and can never make a station read SILENT. It
does drop out of the depth-1 `structure` pass, which is the intended effect.

⚠️ The two carried DEFERRALS from the 23:08Z run are **not** discharged by archiving it — finding D
is re-opened below on its own stated condition, and finding C is re-deferred.

**This breadcrumb was written INSIDE the PR worktree**, not into the dev tree — cure 1 of the
post-merge fast-forward trap. No loose copy exists in `C:\ProjectOperations2`, so the next
fast-forward has no untracked file to collide with and the whole three-command restore dance is
avoided. Nothing else was staged; `git diff --cached --name-status` in the dev tree was EMPTY before
and after, and I committed from the worktree, not the shared index.

**Nothing was armed** (armed count 0 before and after), **no label was touched**, **no PR was
merged**, and **no branch but my own board branch was pushed.**

## FINDINGS

### A — [S2] The only red on the board is two headings a locator cannot tell apart, and the mask is one character away — DISPATCHED

`#1682` fails four PR-acceptance tests, all through `batch3-scope-cutting.spec.ts:48`, all with
`strict mode violation: getByText('Concrete cutting') resolved to 2 elements`. The PR renders
`<CuttingSection>` (read-only take-off, heading `Concrete cutting(0 items)`) directly above the
pre-existing `<ScopeCuttingSheet>` (editable Cutrite sheet, heading `Concrete cutting(0 rows)`),
both as `h3.s7-type-section-heading`. The coexistence is deliberate and documented in the PR's own
comment; the collision with the acceptance test is not.

**The bare `getByText` was only ever unique by accident**, and the helper's own comment two lines
above already records that the assertion proves nothing as a wait — the real wait is line 47
(`Showing items linked to CIV scope`). Line 48 is redundant belt-and-braces that has now become the
only thing red.

🔴 **`.first()` is the wrong fix and it is the obvious one.** It would pick a section arbitrarily
and let four tests that exist to drive the *editable* sheet go on asserting against whichever
rendered first — a green board over an untested feature. That is a mask, and DOCTRINE §8.2 forbids
it by name.

🔴 **And the honest fix needs a decision I may not make.** Disambiguating the assertion means
choosing what distinguishes the two sections, and the only thing that does today is the parenthetical
row/item count inside the heading text — which is content, not structure, and changes as soon as a
row exists. Making it structural (a `data-testid`, or distinct headings) is a change to shared
product code and a **UI question**: whether a user is meant to see two `h3`s on one card reading
`Concrete cutting` and differing only by `(0 items)` versus `(0 rows)`. Guessing that is guessing
intent (§5.5).

**DISPATCHED** — to the lane that owns `#1682`, not to Marco's queue, and not by me pushing to its
branch. `#1682` is a second lane, its head moved at `2026-09-05T23:33:31Z` (a
`Merge branch 'main' into …`, committer `GitHub` — the auto-update poller), and it is being driven
turn by turn. Pushing a fix onto a branch another actor is working is precisely the LL-38 collision
that BOARD DRIVING condition 3 exists to prevent, and condition 3 is the load-bearing one. I posted
the root cause, the two competing elements verbatim, and the reason `.first()` is a mask as a
comment on `#1682` so that lane does not re-derive 410 KB of job log. **What I did NOT do: touch the
branch, add a label, or write a needs-marco file** — an escalation can be wrong about *who* it needs,
and the human this needs is already in the room with the lane that owns the PR.

### B — [S2] Five open PRs, five different reasons none of them is mine, and the board is correctly stopped — DEFERRED

The board has not moved since `#1683` merged at `23:30:29Z`, and that is not a stall. Two PRs
(`#1680`, `#1675`) carry live watcher `marco:true` verdicts; three (`#1682`, `#1667`, `#1662`) are
second lanes that hand-classify to Marco under §10.1 step 2 — one on `package.json`, one on
`scripts/pipeline/lint-prompt.mjs`, one on a `migrations/` path that drops five columns. **Four of
the five are green and every required check has run.** Nothing here is waiting on automation.

⚠️ Worth naming so it is not re-derived: `#1675`'s `marco:true` reason is the **timeout** string,
which DOCTRINE §10.3 records as byte-identical to a genuine policy routing. That does not clear it —
a provably-weak routing reason does not clear a verdict, RULE 2 still binds — but it means `#1675`
is a docs-only PR that the tests-docs lane would have merged with nobody, permanently human-gated by
a defect. It is the same open item, now with a fourth instance.

**DEFERRED.** Re-open condition: any of the five changing state, or a sixth PR appearing that is
*not* Marco's — that one would be mine to drive and merge, and it would be the first in three runs.

### C — [S2] `check-breadcrumb.mjs` REJECTs a breadcrumb that is merely being WRITTEN — DEFERRED, unchanged

Carried from 23:08Z finding C. 00's COLLECT is the caller guaranteed to meet it, because it runs
`--freshness` across every station's newest file and another station may be mid-write. It did not
fire this run — `structure: 6 checked, 0 malformed` — which is evidence it is intermittent, not
evidence it is gone. **DEFERRED**, still for a fix of its own rather than a fold-in; it wants a
mtime-versus-now check before a malformed verdict is believed, and that is a `scripts/` change
outside this run's docs-only lane. Re-open condition: a second occurrence, or any run that
dispositions a station as malformed on this cause.

### D — [S1] The unpushed fix in `C:\po-vg` is now 40 hours old and still the only copy — carried, ESCALATED (unchanged)

Raised and escalated by the 23:08Z run to
`docs/pr-prompts/needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.
Re-verified live this run, not repeated from the note: the sweep's section 2 still reports
`C:/po-vg  23c91ba9 [fix/no-rebase-while-checks-run]  dirty=1 files  age=2416 min`. The branch
carries `fix(pr-watcher): never rebase a PR whose checks are still running` plus an 88-line guard
test — the fix for the open `PR_WATCHER_AUTO_UPDATE` escalation — and it has never been pushed.

**ESCALATED**, already filed; I am not re-filing it. It stays open because pushing another actor's
unpushed branch, and pruning a worktree holding uncommitted work, are both irreversible-adjacent and
Marco's. **The reason it is still worth a line here: the defect it fixes acted on the board during
this very run** — `#1682`'s head was updated by the auto-update poller at `23:33:31Z`, three minutes
after `#1683` merged, and the CI run I diagnosed is the one that update triggered.

### E — Breadcrumb hygiene — ACTIONED

Six fully-dispositioned breadcrumbs archived (WHAT CHANGED). The 23:08Z run named this as work it
deliberately left undone for two of them; four more had accumulated behind it. The queue root now
carries only this run's own breadcrumb, which is the state the station doc asks for. **ACTIONED** —
verified by the staged `R100` set and by `check-breadcrumb.mjs` exiting 0 on the result.

## WHAT I DID NOT DO

- **Did not merge anything.** All five open PRs are Marco's — two by live watcher verdict, three by
  hand-classification. `Assert-SmokedOrEscalate` was never reached because no candidate exists.
- **Did not push to `#1682`'s branch**, and did not apply `.first()` to make it green. Finding A
  says why: another lane owns it, and the honest fix needs a UI decision.
- **Did not remove or add a label** on any PR, and did not clear a `marco:true` verdict.
- **Did not arm anything.** Armed count was 0 at the sweep and 0 at the end; the backlog's one
  `READY TO STAGE` item (`rates-11c-blocked-consumers`) is a staging decision with an explicit
  ask-first standing rule, and three named prompts remain on the never-arm-right-now list.
- **Did not touch `C:\po-vg`**, its worktree, or its branch — finding D is Marco's.
- **Did not restart or `-Fix` the watcher.** `HEALTHY`/idle with 0 armed is correct, and a 39-minute
  heartbeat with an empty queue is idle by the sweep's own note, not wedged.
- **Did not run a smoke.** No PR is a merge candidate, so there is nothing a smoke's exit code could
  decide.
- **Did not touch `/sot/`**, `C:\po-watcher\ProjectOperations`'s git, or anything under
  `scripts/` — this run's diff is `docs/pr-prompts/` only.
