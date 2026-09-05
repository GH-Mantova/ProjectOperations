# Station 00 — Supervisor | 2026-09-05T12:09Z–2026-09-05T12:2xZ

## GROUND

```
UTC            2026-09-05T12:09:05Z
origin/main    b0c61266            (read from .git/refs/remotes/origin/main in the mount — NOT a fetch)
dev tree       main @ b0c61266     C:\ProjectOperations2   (loose ref; refs written 2026-09-05T12:00Z)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

🔴 **THIS RUN WAS BLIND.** Doc version and bootstrap AGREE — that is the only preflight step that
passed cleanly.

**What I could not reach: Desktop Commander, and therefore the entire Windows host.** The schema was
loaded first, exactly as the contract's step 1 requires, so this is not the `InputValidationError`
that masquerades as blindness:

```
ToolSearch "desktop-commander start_process interact_with_process read_file"
  -> No matching deferred tools found. Some MCP servers are still connecting:
     plugin:desktop-commander:desktop-commander
[waited 20 s, retried]
  -> plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
     "MCP server ... connection timed out after 30000ms"
```

**Consequence, stated so it cannot be mistaken for a quiet board:** no `powershell.exe`, so no
`status-sweep.ps1`, no `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`, no `gh`, no
`git`. **This run holds no liveness verdict, no smoke verdict, no safe-to-act verdict and no merge
verdict, and it mutated nothing on the board.**

**But it is not a dead run.** Per `STATION-CAPABILITIES.md` §3 ("No second transport", landed
`#1641`), the workspace mount of `C:\ProjectOperations2` **is** the live dev tree, so COLLECT and
most of PHASE 1 were performed through it. Everything below is a file read from that mount, or a
**read-only** GitHub MCP call — never presented as coverage for the tree the watcher globs.

The previous run — 11:08Z, same station, one cadence earlier — was **SIGHTED** (shell PID 26640).
Two consecutive hourly occurrences, one sighted and one blind, is another data point for the
intermittency §2 records.

## WHAT I MEASURED

**[MEASURED] The board is NOT empty, and it is not quiet either.** Two PRs are open, both created
inside the previous run's window, neither armed:

| PR | created | branch | files | lane |
|---|---|---|---|---|
| `#1662` retire the legacy plant-days path and drop its five columns | 11:45:57Z | `pr-plantdays-retire-and-drop` | 6, incl. `apps/api/prisma/migrations/…` | second lane |
| `#1664` make the discipline roll-up stage-aware (`SCOPE_STAGE_AWARE_V1`) | 11:59:08Z | `pr-stages-s1-rollup-becomes-stage-aware` | 2, both `apps/web/…` | second lane |

`main` moved `df030fe2 -> b0c61266` at 12:00:07Z (`#1663`, the previous run's own addendum).

**[MEASURED] Lane probes, from the mount, with controls.** Three of the previous run's four probes
re-run for `#1662` and run for the first time for `#1664`:

| probe | `#1662` | `#1664` | control |
|---|---|---|---|
| prompt file on disk | `pr-plantdays-retire-and-drop-HOLD.md` — **still HOLD** | `pr-stages-s1-rollup-becomes-stage-aware-HOLD.md` — **still HOLD** | 0 `-ready.md` in the queue root |
| `.arming-log.txt` newest row | `2026-09-04T22:03:13Z` — **no arm for 14 h** | same | log tail read in full |
| RULE 2 — `PR #<n>` in `processed/pr-*.log` | **0** | **0** | POS `PR #600` -> **1**; NEG `zzzQqXNeedle` -> 0 |
| `marco.:true` census over `processed/*.log` | — | — | **612** (regex form; the `-SimpleMatch` form is the one that fails open) |

⚠️ **A trap for the next run reusing this probe:** searching **all** `processed/*.log` rather than
`processed/pr-*.log` returns **2** for `PR #1662` — `rev-1662-ready.md.log` and
`rev-1663-ready.md.log`. Those are the **reviewer's** logs, not a watcher build. `rev-<N>-ready.md`
are REVIEW JOBS. Restricting to `pr-*.log`, as RULE 2 specifies, returns **0** for both PRs.
**`[NO LANE VERDICT — hand-classified]` for both.**

**[MEASURED] Hand-classification, by `classifyPolicyFiles`' three forms.**

- `#1662` — carries `apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/migration.sql`.
  `(^|/)migrations/` refuses it before anything else is examined. **⇒ MARCO'S.** Unchanged from the
  previous run's finding.
- `#1664` — two files. `apps/web/src/pages/tendering/scope-cards/utils/__tests__/discipline-rollup.test.ts`
  matches `(^|/)__tests__/`; `apps/web/src/pages/tendering/scope-cards/utils/discipline-rollup.ts`
  matches **none** of the three forms. One file outside the policy set is enough. **⇒ MARCO'S.**

**[MEASURED] The reviewer said MERGE on both, and that is not a lane verdict.**
`processed/rev-1662-ready.md.log` (exit 0, 11:57:35Z) -> `Verdict: **MERGE** for PR #1662`;
`rev-1664-ready.md.log` (exit 0, 12:05:44Z) -> `Verdict: **MERGE**`. A reviewer verdict speaks to the
diff. It is not `marco:true`, it is not a label, and it does not clear RULE 2.

**[MEASURED, and it is new] `#1662`'s row-count gate was run against the DEV database, and the PR
body says so itself.** The body's own caveat, quoted:

> **⚠️ Caveat — these are DEV-database counts, not production.** … If a separate production database
> exists, **its** counts are the ones that actually matter, and this PR must not be merged until
> Marco has confirmed the same query returns five zeros there.

The previous run escalated the merge because evaluating the gate is a production-data judgement. It
is narrower and harder than that: **the gate has not been evaluated against production at all.** The
five zeros are 23 seeded dev rows.

**[MEASURED] `#1662` also flags a `/sot/` burn-down it correctly refused to do itself** — body item
3: `sot/04-data-model.md` line 906 still lists the five dropped fields among `ScopeOfWorksItem`'s
suggested measures.

**[MEASURED] Station freshness — `lastRunAt` crossed against the newest breadcrumb per station.**
`check-breadcrumb.mjs --freshness` was **not** run: it shells out to `git`, and §9.2 forbids running
`git` against the Windows `.git` through anything but Desktop Commander. This is the MCP half of the
table only, and it is `[CANNOT MEASURE]` on breadcrumb shape.

| station | cadence | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 supervisor | 1 h (`5 * * * *`) | 12:08:03Z (this run) | 09-05 1155 | aligned |
| 04 scanner | 4 h | 10:09:41Z | 09-05 1010 | aligned |
| 05 sot-keeper | 24 h | 09-04T14:10:38Z | 09-04 1411 | aligned; next 14:10Z |
| 03 machine-minder | 24 h | 09-04T23:00:50Z | 09-04 2301 | aligned; next 23:00Z |
| 06 pr-master | **no entry** | **n/a** | 09-05 0620 | 06 has no cadence — known, already open |

No station reads SILENT on the instrument available. **06 is not in `list_scheduled_tasks` at all**,
which is the already-escalated "06 HAS NO CADENCE" item, not a new finding — yet 06 (or the cloud
lane) opened four PRs in the last ninety minutes.

**[MEASURED] COLLECT is closed.** The queue root holds exactly two breadcrumbs, both mine from the
11:08Z run, both read in full. No station breadcrumb arrived unread since the previous run
dispositioned and archived the rest.

## WHAT CHANGED

**On the board: nothing.** No merge, no label applied or removed, no arm, no branch update, no
comment, no PR opened. A blind run cannot mutate the board and this one did not try.

**On disk: one file** — this breadcrumb, written to `C:\ProjectOperations2\docs\pr-prompts\`. It is
**UNTRACKED**, and a blind run cannot open a PR to track it (the GitHub MCP token is write-403).
**The next sighted 00 run must sweep it up.** Its filename matches no watcher glob, so it arms
nothing while it sits there.

## FINDINGS

### F1 — This run was blind; the previous one, one hour earlier, was not

`plugin:desktop-commander:desktop-commander` returned `CONNECT_TIMEOUT` after 30 s, on a retry, with
the schema load performed first. The host itself is not implicated: the mount served every read
asked of it, including files written by the previous run's shell.

**DISPOSITION: DEFERRED.** The cause is a standing, already-recorded item — the transport, not the
host, and `STATION-CAPABILITIES.md` §3 carries the correction on `main` as of `#1641`. Re-raising it
would be the sixth run to re-derive the same thing. What this run adds is one measured data point:
**sighted at 11:08Z, blind at 12:08Z, consecutive occurrences of the same hourly task.** **Trigger
that makes it urgent:** two consecutive blind runs, which would mean a cadence of board work lost
rather than an alternating one.

### F2 — `#1662` is still open, still Marco's, and its gate is weaker than the previous run recorded

Re-verified by three probes with controls (table above), not by trusting the previous breadcrumb's
sentence. Still `-HOLD` on disk, still no arm, still no lane verdict, `mergeable_state: blocked`.

New this run: **the five zeros are dev-database counts.** The PR body states this itself and names
the confirmation it needs. So the merge is not merely a production-data judgement Marco must make —
**the query the gate depends on has never been run where it counts.**

**DISPOSITION: ESCALATED.** Already filed at
`needs-marco/pr-1662-destructive-migration-open-on-the-board-2026-09-05.md`; this is an amendment to
it, carried here because that directory is gitignored. 🔴 **Standing instruction, restated: do not
merge `#1662`. Its empty label set is not a clearance** — the watcher labels only prompts it builds,
and it did not build this one.

### F3 — `#1664` is a second second-lane PR, and it hand-classifies to Marco too

Opened 11:59:08Z, thirteen minutes after `#1662`, from a branch that reads exactly like a queue
prompt whose `-HOLD.md` was never armed. Two files; one of them is outside `tests|docs|__tests__`.
The reviewer's `MERGE` verdict is about the diff and clears nothing.

There is nothing wrong with the change — it is a careful refactor that pins its own equivalence to
the pre-stage fold. That is the point: **the danger is not that a bad PR arrives, it is that a good
one arrives through a path with no gate on it,** and the next one may carry a migration.

**DISPOSITION: ESCALATED** — same file, same question as F2 of the 11:55Z addendum, now with a
second instance in the same hour. `#1664` is Marco's; **do not merge it.** RULE 1 options are
unchanged and option (a) — a required check that fails any PR touching `migrations/` without a
signed receipt — is the only one that passes both halves; F3 widens the case for it, because the
gap it names admits any second-lane PR, not only migrations.

### F4 — A third measured instance of the never-retired-HOLD defect. DO NOT ARM two named prompts

`pr-plantdays-retire-and-drop-HOLD.md` and `pr-stages-s1-rollup-becomes-stage-aware-HOLD.md` are
both **still tracked as `-HOLD`** while the PRs built from them are open. Arming either renames a
HOLD in the working tree only and opens a **duplicate** PR for work already in flight — which is
exactly how `#1634`/`#1639` and `#1611`/`#1637` happened. That makes three measured instances.

🔴 **Standing, until each PR is merged or closed: do not arm either prompt.** Generalised, and worth
more than the two names: **before arming any prompt, check whether an open PR's head branch equals
its slug.** That test is two seconds and catches the whole class.

**DISPOSITION: DEFERRED.** The permanent fix — a queue check that fails a prompt whose slug matches
an open head branch — is still unstaged; it belongs with 06's queue-check work and is named here
rather than dispatched blind, because I cannot stage a prompt this run.

### F5 — `sot/04-data-model.md:906` still lists the five columns `#1662` drops

`#1662` refused to touch `/sot/` and flagged it, correctly. If `#1662` merges, that line describes
columns that no longer exist.

**DISPOSITION: DISPATCHED — Station 05, SoT Keeper**, whose next occurrence is 14:10Z today.
Handover: burn down the five `excavator_days` / `bobcat_days` / `ewp_days` / `hook_truck_days` /
`semi_tipper_days` entries at `sot/04-data-model.md` line 906 **only after `#1662` merges** — doing
it first would make `/sot/` describe a schema that still has the columns. A doc-reconcile PR, per
CP-24.

### F6 — Arming stays stopped, and the trigger the previous run handed me still says stop

The 11:08Z run's replacement trigger: *no commit on `origin/main` from a lane other than your own
within the last cadence, **and** open `pr-cardui-s*` at zero.* Measured: the other lane merged
`#1658` at 11:02:40Z and has opened two PRs since. **First half fails outright.** Nothing was armed;
`.arming-log.txt` is unchanged at `2026-09-04T22:03:13Z`, now 14 h old.

**DISPOSITION: DEFERRED** — this is starvation with a live cause, not blockage. The queue holds 83
`-HOLD` prompts and 0 armed. **What would change it:** the other lane going quiet for a full cadence
**and** the two open PRs resolving. A blind run could not have armed in any case — `arm-prompt.ps1`
needs a shell.

## WHAT I DID NOT DO

- **I did not merge, label, unlabel, auto-merge, update or comment on `#1662` or `#1664`.** Both are
  Marco's by hand-classification, and I was blind besides.
- **I did not run `git` against the Windows `.git` through the mount** (§9.2 — the 0-byte
  `index.lock` that freezes every station), and therefore did not run
  `check-breadcrumb.mjs --freshness` or `lint-prompt.mjs`, both of which shell out to it. The
  freshness table above is the MCP half only, and is labelled as such.
- **I did not run any `.ps1`,** so I claim no liveness, smoke, safe-to-act or merge verdict — and did
  not substitute GitHub-side reads for one.
- **I did not arm anything** (F6), touch `/sot/`, touch Azure / Entra / SharePoint, or read or write
  production data.
- **I did not edit the project-memory index.** It is over its measured read limit and carries a
  documented `$`-replacement corruption trap; board state belongs in this breadcrumb, where it can
  expire, not there.
- **I did not open a PR for this breadcrumb** — the GitHub MCP token is write-403 and the shell is
  gone. It sits untracked in the dev tree.

## HANDOVER

- **Marco — two open PRs, both yours, neither gated by anything automatic.** `#1662` drops five
  columns irreversibly and **its zero-count gate has only ever been run against the dev database** —
  the PR body says so and asks you to confirm production before merge. `#1664` is a clean refactor
  that arrived through the same ungated path. The ruling still wanted is **F2(a) of the 11:55Z
  addendum**: a required check that fails any `migrations/` diff without a signed receipt.
- **Station 05 (14:10Z today):** F5 — `sot/04-data-model.md:906`, **after** `#1662` merges.
- **The next 00 run:** sweep this untracked breadcrumb into your board PR. **Do not arm
  `pr-plantdays-retire-and-drop-HOLD.md` or `pr-stages-s1-rollup-becomes-stage-aware-HOLD.md`** while
  their PRs are open, and apply F4's general test — slug versus open head branch — to every candidate.
  Re-run the lane probes yourself; three of the four are file reads and work blind.
