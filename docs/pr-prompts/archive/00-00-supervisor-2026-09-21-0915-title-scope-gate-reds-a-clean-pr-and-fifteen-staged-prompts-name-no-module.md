# Station 00 — Supervisor | 2026-09-21T09:08Z–2026-09-21T09:30Z

## GROUND

```
UTC            2026-09-21T09:08:37Z
origin/main    18c9935a            (fetched, then rev-parse)
dev tree       main @ 76ed975a      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE — this run was not read-only.

This run was **SIGHTED**. Desktop Commander loaded via keyword `ToolSearch`, `start_process`
shell `powershell.exe` returned PID 16836 and carried the whole run. Not a blind run.

Device-bridge git guard installed at the top of the run, last line quoted verbatim:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

All three binding documents read IN FULL from `git show origin/main:<path>` in the dev tree,
never the working copy: `00-supervisor.md` (1349 lines, `git diff --numstat origin/main` EMPTY),
`DOCTRINE.md` (2616 lines), `STATION-CAPABILITIES.md` (544 lines).

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1`, captured to file and decoded `utf16le` per
DOCTRINE 9.3 (`SWEEP_LINES=455`). Section 0 positive controls both PASS. Verdict at 09:09:35Z:
**CAUTION** — no local lock, but a PR was touched on GitHub within 2 minutes.

[MEASURED] **Re-measured the gate immediately before the only board mutation**, 09:15:22Z:
`index.lock` dev/clone `False` / `False`; `git.exe` processes `0` (null-guarded count per
DOCTRINE 9.4); newest open-PR `updatedAt` `2026-09-21T09:11:34Z` — **3.8 min old, outside the
2-minute window**. CAUTION had cleared on its own terms. Mutations were made gh-only, plus an
isolated worktree off `origin/main`; the dev tree's index was never touched.

[MEASURED] **Board**, 3 open at sweep time: `#2040` BEHIND / 12 pass 1 fail 2 pending, `#2038`
BLOCKED / 10 pass 0 fail 4 pending, `#2036` BLOCKED. **Zero DIRTY.** `#2036` MERGED by Marco at
`09:10:11Z` mid-run (`gh pr view 2036 --json state,mergedAt` — `state=MERGED`, labels `[]`); the
0808 run had left it for him and he took it.

[MEASURED] **`#2040`'s red, from the job log, never the PR page** (run `35581135955`, job
`106274036725`, read from column 3 per DOCTRINE 9.1): `not ok` count **0** — every test passed —
and the step exited 1 on
`[TITLE_SCOPE_UNRESOLVED] scope "rbac" names nothing this repo can point at`.

[MEASURED] **The cure, decided by the instrument and not by me**, both directions controlled:
`PR_TITLE='feat(web): SLICE 17 S2 …'` → `PASS  scope=web normalised=web via=vocabulary`, exit 0.
NEGATIVE control, a freshly minted needle as the scope → `FAIL [TITLE_SCOPE_UNRESOLVED]`, exit 1.
`--self-test` green the same minute: `vocabulary=140 entries, baseline=0 ratcheted scope(s)`.

[MEASURED] **The upstream cause.** `git show origin/main:…/pr-company-manage-s2-retire-adminonly-HOLD.md`
carries `premise`, `premise_means`, `scope`, `done_when`, `size` — and **no `module:` key**.
Census over every depth-1 `-HOLD.md`/`-ready.md`, `rev-*` excluded: **22 staged prompts, 7 carry
`module:`, 15 do NOT.** POSITIVE control (three that do) named in the escalation; NEGATIVE
control, a minted needle → **0**.

[MEASURED] **Watcher.** RUNNING pid 9744, auto-restart wrapper alive (1), heartbeat 2 min,
build in flight `rev-2040-ready.md`. HEALTHY — no restart considered, none needed.

[MEASURED] **COLLECT — freshness.** `check-breadcrumb.mjs --freshness`: `structure: 12 checked,
0 malformed`, `CLEAN`, exit **0**. `00` 1.1h · `03` 8.9h · `04` 3.1h · `05` 8.5h — all `ok`,
**no station SILENT**.

[MEASURED] **Freshness crossed against `lastRunAt` (scheduled-tasks MCP), as the contract
requires** — the breadcrumb is one instrument and cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00-supervisor` | `09:07:53Z` (this run) | 08:08Z | aligned, healthy |
| `03-machine-minder` | `00:20:35Z` | 00:21Z | aligned, healthy |
| `04-scanner` | `06:10:30Z` | 06:11Z | aligned, healthy |
| `05-sot-keeper` | `00:04:02Z` | 00:45Z | aligned, healthy |

No row matches either failure shape (`lastRunAt` stale, or fresh-with-no-breadcrumb). Nothing to
disposition as SILENT and no transcript needed to be read.

[MEASURED] **Sweep section 5 `[STALE]` escalation rows: ZERO this run.** A filter for `[STALE]`
over the decoded sweep returned 4 lines and **all four are the legend and the completion
banner** — no escalation row carried the tag. Nothing to discharge.

[MEASURED] **Unlanded work in the shared dev tree**, by the sound probe
`git diff --numstat origin/main -- <path>` (DOCTRINE 9.2 — `git status` on a behind tree answers
about HEAD, not about `origin/main`): four consumed `-HOLD.md` deleted and the arming log a
**strict superset, 2 insertions / 0 deletions** — the append-only shape.

[MEASURED] **A SECOND ACTOR IS LIVE IN THE DEV TREE AND ARMED A PROMPT DURING THIS RUN.** The
arming log names `actor=station-00.interactive-0004`, `by=Marco@LAPTOP-E6NHU4E4`, at `08:56:21Z`
(`pr-company-manage-s2-retire-adminonly`) and again at **`09:09:59Z`**
(`pr-scopecards-s4b-push-panel-ui`) — the second one *after this run had already started*.
`*-ready.md` count moved 0 → 1 between the sweep and the census.

## WHAT CHANGED

1. **`#2040` title corrected**, `gh pr edit`, exit 0, read back:
   `{"title":"feat(web): SLICE 17 S2 - swap final AdminOnly route guard for company.manage",
   "state":"OPEN"}`. Not a code change — the diff is untouched, one file, `apps/web/src/App.tsx`.
2. **`#2040` branch updated** (`gh pr update-branch`, `✓ PR branch updated`, exit 0). It was
   BEHIND and needed it anyway; it is also what retriggers the title gate, since an edit alone
   does not.
3. **This board PR** lands, from an isolated worktree off `origin/main` at `C:\po-wt\st00-collect-0915`:
   - the **four consumed `-HOLD.md`** (`company-manage-s2-retire-adminonly`,
     `crmvis-s7-comms-inbox`, `scopecards-s4a-push-by-destination-api`,
     `scopecards-s4b-push-panel-ui`) — all four are built or building, so leaving them staged
     makes `triage-holds.ps1` offer them as arming candidates (DOCTRINE 10.6);
   - the **two unlanded arming rows**, reapplied the append-only way — read the live dev-tree
     copy, append only rows absent from `origin/main`, never restore-then-overwrite. Read-back:
     136 → **138 rows, 22737 bytes, byte-identical to the dev tree's copy**;
   - the **untracked 0710 blind-run breadcrumb**, which `--freshness` flagged `UNTRACKED — it
     reaches nobody until a board PR commits it`.
4. **One escalation written** to the dev tree's `docs/pr-prompts/needs-marco/` (count 61 → 62).
   That folder is gitignored — confirmed `git check-ignore -v` → `.gitignore:82`, exit 0, against
   negative controls `CLAUDE.md` → exit 1 and this breadcrumb's own path → exit 1 — so it is
   **not** in this PR and reaches Marco only through the sweep and through this section.

Nothing else was mutated. No merge was performed this run.

## FINDINGS

**F1 — `#2040` was red on its TITLE, not on its code; every test in the failing job passed.**
The required check `Pipeline - watcher + linter tests` exited 1 solely on
`[TITLE_SCOPE_UNRESOLVED] scope "rbac"`. Read from column 3 of the job log; `not ok` = 0.
→ **ACTIONED.** Title set to `feat(web): …`, verified by running `check-pr-title.mjs` itself
(PASS, exit 0) against a minted-needle negative control (FAIL, exit 1), and the branch updated so
the gate actually re-runs. Not verified green yet — the re-run was in flight at write time, and
the EXIT CODE of the check decides, not my reading of the cause.

**F2 — 15 of 22 staged prompts carry no `module:`, so this recurs by construction.**
`lint-prompt.mjs` does not require the key, so all 15 lint ADMIT and can be armed; the gate that
catches the consequence runs only after the PR exists, which costs a CI cycle and a supervisor
turn each time. It cost one today. The complete-and-additive fix — require `module:` in
`lint-prompt.mjs`, resolved through `check-pr-title.mjs`'s own 140-entry vocabulary, with a
SHRINK-only baseline so none of the 15 is binned — is a `scripts/` change, outside Station 00's
recorded merge lane (`STATION-CAPABILITIES.md` section 5).
→ **ESCALATED**, with the RULE 1 option set and a falsifying probe, to
`needs-marco/prompts-carry-no-module-and-the-title-gate-fails-the-pr-2026-09-21.md`.

**F3 — four consumed HOLDs and two arming rows were sitting unlanded in the shared dev tree.**
DOCTRINE 9.5 requires any run that arms to commit the arming log in its board PR; the interactive
lane cannot, so the rows accumulate and a clone reads a stale arm history that *answers* rather
than staying silent — the more dangerous shape.
→ **ACTIONED.** Landed in this PR, additively, with the byte-count read-back quoted above.

**F4 — a second actor armed a prompt at `09:09:59Z`, after this run began.**
This is not a defect; it is the interactive lane working, and it is exactly the condition
DOCTRINE's single-actor rule exists for. It is recorded because a lane verdict is non-monotonic
(DOCTRINE 10.1) and because the next run will meet `pr-scopecards-s4b-push-panel-ui-ready.md`
armed with no watcher build yet behind it.
→ **DEFERRED.** No action is correct now. It becomes urgent only if that `-ready.md` is still
unbuilt with a stale heartbeat at the next run — that is a LOOP/STALL question, not this one.

**F5 — `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` while the live cron is
`5 * * * *`.** Re-measured both this run: `--freshness` printed `(cadence 2h)`; the MCP returned
`5 * * * *`. So `00` is only called SILENT after ~4h, i.e. after three consecutive missed hourly
runs — weak in the direction of not noticing a missed run.
→ **DEFERRED.** Already on file, already crossed against `lastRunAt` this run (the cure the
contract prescribes), and the one-character fix is a `scripts/` change in the same lane as F2.
It becomes urgent if a missed `00` occurrence is ever discovered that `lastRunAt` did not catch.

## WHAT I DID NOT DO

- **Did not merge anything.** `#2040` is not green yet; `#2038` had 4 checks pending and its
  lane was not established, and RULE 2's probe is per-PR and as-of-the-minute.
- **Did not add `rbac` to `title-scope-baseline.json`.** The gate's own output forbids it in as
  many words — that file may only SHRINK, and adding to it is the gate failing open.
- **Did not touch the dev tree's index, working copy, or its arming log.** A second actor was
  live in it. Everything was built in a disposable worktree with its own index.
- **Did not restart the watcher.** HEALTHY, heartbeat 2 min, wrapper alive, build in flight —
  and "never restart on BUSY".
- **Did not prune the orphaned worktree `C:/PR-Master/worktrees/po-vg`** (dirty=1 file,
  age 24556 min) or the registry escapee `C:\po-worktrees\po-fix-2005`. Both are Station 03's,
  the first **holds uncommitted work**, and a forced removal would discard it.
- **Did not archive any breadcrumb.** All 12 at depth 1 are from today's cycle; archive is for
  what has already been dispositioned in a previous cycle.
- **Did not stage the F2 fix prompt.** Which option to take is Marco's (RULE 1, hard stop 5),
  and writing the prompt before he chooses would be guessing his intent.
- **Did not touch Azure, Entra, SharePoint, `/sot/`, or production data.**
