# Station 00 — Supervisor | 2026-09-05T16:08Z–2026-09-05T16:3xZ

## GROUND

```
UTC            2026-09-05T16:08:25Z
origin/main    41e9600a            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 41e9600a     C:\ProjectOperations2   (HEAD == origin/main, 0/0)
doc version    1                   (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run is read-write within its lane.

`[MEASURED]` **SIGHTED run.** `start_process` shell `powershell.exe` → PID 26636; host clock
`2026-09-05T16:08:25Z`. Desktop Commander tools arrive deferred and were loaded with `ToolSearch`
BEFORE the first call, per PREFLIGHT step 1 — no call was made cold, so no `InputValidationError`
was available to be mistaken for blindness.

`[MEASURED]` **The three binding documents carry `origin/main`'s content**, verified the sound way
(§9.2 — never a piped hash): `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, run in the dev tree
`C:\ProjectOperations2` and not the watcher clone. All three read in full.

## WHAT I MEASURED

### Preflight sweep — SAFE TO ACT, twice

`[MEASURED]` `scripts/pipeline/status-sweep.ps1`, captured to a FILE (84,646 B,
`C:\po-sup-fix-scripts\sweep-1608.txt`) because it returns early and hides its own §7 verdict.
Section 0 controls both PASS. Section 7: `SAFE TO ACT`. Section 3: `in-progress prompts 0` ·
`index.lock interactive/clone False / False` · `git processes running 0` · `no PR touched in the
last 2 min`. **Re-run in full immediately before the arm below** (`sweep-pre-arm.txt`) — same
verdict, same section-3 inputs. A `[LIVE]` verdict expires the moment it prints; `#1615` merged
110 s after one.

### COLLECT — nothing new since 15:08Z, and that is a measurement, not an assumption

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0;
`structure: 1 checked, 0 malformed`. Freshness: `00` 1.1 h · `03` 17.2 h · `04` 2.0 h · `05` 2.0 h,
all `ok`, **no station SILENT**.

`[MEASURED]` The queue root holds exactly **one** breadcrumb — this station's own 15:08Z report,
already tracked (`git ls-files --error-unmatch` → found) and merged as `#1671` at 15:24:55Z. Every
other breadcrumb is in `archive/`, newest three all written 15:25Z by that same PR. **So there is no
uncollected 03/04/05 finding this cycle**: 04's 14:10Z and 05's 14:11Z reports were collected and
dispositioned by the 15:08Z run (C1–C5 there), and 03 does not fire until 23:00Z.

⚠️ `00`'s `ok` is the weakest row in that table and this run does not lean on it: `check-breadcrumb.mjs`
still holds `'00': 2` against a live cron of `5 * * * *`, so `--freshness` cannot call `00` SILENT
until three consecutive hourly runs are missed. Crossed against `lastRunAt` instead, as the COLLECT
step requires — the 15:08Z run is this station's own predecessor and its PR is on `main`.

### The board — unchanged in the hour, and no lane verdict on any of it

`[MEASURED]` `gh pr list --state open --json number,title,mergeStateStatus,labels,isDraft,headRefName,createdAt,author`,
assign-then-count (§9.4) → **OPEN=3**, all `CLEAN`, all `labels=[]`, none draft, all `14 pass / 0 fail
/ 0 pending`:

| PR | created | head | classification |
|---|---|---|---|
| **#1667** | 14:17:15Z | `fix/lint-arm-only-case-insensitive` | `scripts/pipeline/lint-prompt.mjs` ⇒ **MARCO'S** |
| **#1665** | 12:18:59Z | `pr-scopecosts-s1-operational-cost-lines-api` | migration ⇒ **MARCO'S** |
| **#1662** | 11:45:57Z | `pr-plantdays-retire-and-drop` | migration, **destructive** (drops five columns) ⇒ **MARCO'S** (§8.3 outright) |

`[MEASURED]` Nothing has merged since `#1671` at 15:24:55Z, and `main` is `41e9600a` with `4 success /
0 failed / 0 running` — **trunk green**. `[MEASURED]` `.arming-log.txt` last arm before this run:
`2026-09-04T22:03:13Z pr-crmui-account360-s1-tiles-and-next-action` — **no arm in 18 hours**, and the
queue was `armed: 0` with the watcher idle (node RUNNING pid 20000, wrapper alive, heartbeat 45 min,
which with an empty queue is idle and not wedged).

The three PRs' classification is unchanged from the 15:08Z run, which measured the RULE 2 probe on the
live tree with both controls and got `#1662 → 0 · #1665 → 0 · #1667 → 0` prompt-logs. I did not
re-derive it: nothing merged, nothing was armed, and no processed log can have appeared for a PR the
watcher never opened. All three remain `[NO LANE VERDICT — hand-classified]`.

### The throughput question, measured for the first time

`[MEASURED]` `scripts/pipeline/triage-holds.ps1` → `spent=0 gates-satisfied=40 still-gated=42
unreadable=0 of 82`, exit 0, calibrated on 2 distinct verdicts. Identical to the 15:08Z reading.

I then classified all **40** `ADMIT` prompts by the lane their own `scope:` paths would land in, using
`classifyPolicyFiles`' definition copied verbatim from `scripts/pr-watcher/index.mjs` — all three
`NESTED_TEST_PATHS` forms plus the `(^|/)migrations/` refusal (`C:\po-sup-fix-scripts\admit-lane-classify.mjs`).

**POSITIVE CONTROLS, both independent of this run:** the parser returns **6** scope paths for
`pr-plantdays-retire-and-drop-HOLD.md` and **8** for `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md`
— matching, exactly, the 6-of-6 and 8-of-8 file counts the 15:08Z run measured against `#1662` and
`#1665` from the GitHub side. A scope parser that agrees with a file list it never saw is reading the
block, not the first line.

```
TOTALS {"TESTS-DOCS":4,"MARCO":36}  of 40
```

**36 of the 40 `ADMIT` candidates land outside `tests|docs` and therefore stop at Marco** — **11** under
`scripts/`, **10** on a `migrations/` path, **8** under `apps/`, **3** under `.github/`, **2** under
`sot/` (Station 05's, CP-24), **1** `package.json` and **1** under `.claude/`, summing to 36. (I first
wrote that breakdown from reading the table and it was wrong in three of seven buckets and did not sum
to 36 — the corrected figures are `Group-Object`'d from the classifier's own output.) Only **four** can
reach `main` without him:

| prompt | scope |
|---|---|
| `pr-artifactregister-s2-name-what-is-missing-HOLD.md` | `docs/design/ARTIFACT-REGISTER.md` |
| `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` | `docs/plans/claude-design-spec-regeneration-plan.md` |
| `pr-smoke-share-worker-tokens-HOLD.md` | `tests/e2e/**` |
| `pr-vmguard-s2-preflight-installs-guard-HOLD.md` | **all seven station docs + `_canonical-blocks.json`** |

## WHAT CHANGED

**On the board:** nothing merged, nothing labelled, nothing closed. This PR opened.

**In the queue:** `pr-claudedesign-s2-spec-regeneration-plan-HOLD.md` **ARMED** →
`…-ready.md` (F1). Armed count went `0` → `1`. Nothing else was armed, renamed, moved or staged.

**In the dev tree:** only what the arm left — `.arming-log.txt` +1 line and the `-HOLD.md` deleted.
`git diff --cached --name-status` was EMPTY before the arm (checked, because the index is shared with
concurrent chats) and `arm-prompt.ps1` released its own staged rename, leaving it EMPTY after.

**In this isolated worktree** off `origin/main` (`C:\po-wt\board-1608`, branch
`board/00-collect-2026-09-05-1608`, clean at checkout `41e9600a`): the HOLD deletion, the arming-log
line, the 15:08Z breadcrumb archived, and this report.

## FINDINGS

### F1 — the watcher sat idle for 18 hours with 40 gate-cleared candidates, and nobody had measured which of them could actually merge

`[MEASURED]` at `41e9600a`. `armed: 0`, watcher idle, last arm `2026-09-04T22:03:13Z`. The 15:08Z run
declined to arm and gave a sound reason — *"the board's throughput constraint is Marco's review queue,
not the arm rate; arming faster makes that queue longer, not shorter."* **That reason is correct for 36
of the 40 and wrong for the other 4**, and until this run nobody had separated them: a `docs/`- or
`tests/`-only prompt merges through the live `tests-docs` policy with **no human at all** (§10.3, 48
`ok:true` verdicts, six of them after `#1400`), so arming one adds nothing to Marco's queue by
construction.

Applying §10.6's own test — cross the prompt's `scope:` against `gh pr list --state open --json
number,files`, **not** the head branch — none of the four overlaps `#1662`, `#1665` or `#1667`.

**Armed: `pr-claudedesign-s2-spec-regeneration-plan`,** one at a time, by
`scripts/pipeline/arm-prompt.ps1` (never a bare `git mv`), Actor `station-00-scheduled-1608Z`.

`[MEASURED]` RULE 4's detector, before arming, on the union of **all three** markers plus a prose
sweep: `DO_NOT_ARM_COMMENT` · `DO_NOT_ARM_CAPS` · `ARM_ONLY` → **none**; a prose-gate regex
(`ask Marco` / `Marco must` / `only Marco` / `after he` / `awaits Marco`) → **none**. Body read in
full: `## STANDING AUTHORITY` is the boilerplate that sits on ~51 of 59 prompts and is not a gate.
`escalates: false`, `gate_allow: none`, `seed_only: false`, `size: 1`, deliverable is one new
planning document that explicitly forbids itself from touching `Claude Design/` or `sot/`.

`[MEASURED]` **The historical never-arm ruling on this cluster was checked and does not bind s2.**
`#1557` (*"never-arm pr-claudedesign-s1 until its proposed/ rule lands"*) names **s1**, which has since
been armed (`.arming-log.txt:47`, 2026-09-04T06:41:04Z) and consumed — it sits in `processed/` with a
log. `git grep -i claudedesign origin/main -- docs/pipeline docs/pr-prompts CLAUDE.md sot` returns no
live never-arm text: every hit is an `archive/` breadcrumb or the arming log (negative control
`zzzNoSuchNeedleZzz` over `docs/pipeline` → 0, positive control returns the DOCTRINE/CAPABILITIES
lines that genuinely contain it). s2's own parking condition — 04's *"held until `#1589` lands"* —
**expired**: `#1589` merged 2026-09-04T20:48:58Z. `lint-prompt.mjs` returns `PROMOTE` with
`GATE_RELEASED requires_file_on_main: "Claude Design/docs/01-commercial.md" is now on origin/main`,
and that file is on `origin/main` (`git ls-tree -r --name-only origin/main -- "Claude Design/docs/"`,
negative control empty).

`[MEASURED]` Read back five ways: `-ready.md` on disk **True** · `-HOLD.md` gone **True** ·
`git check-ignore -v` on the new name → `.gitignore:75` (correctly invisible to `git status`, which is
why the disk check is the one that answers) · `.arming-log.txt` tail →
`2026-09-05T16:16:51Z ARMED pr-claudedesign-s2-spec-regeneration-plan escalates=false
actor=station-00-scheduled-1608Z` · `git diff --numstat` → exactly `1 0 .arming-log.txt` and
`0 94 …-HOLD.md`, nothing else · armed count `1`.

**DISPOSITION: ACTIONED.** The HOLD deletion **and** the arming-log line are both committed in this
PR — the first closes the never-retired-HOLD defect for this prompt (an armed prompt whose PR does not
delete it stays armable forever), the second closes §9.5's *"nothing commits the arming log on
purpose"* gap for this arm.

### F2 — the `tests-docs` auto-merge lane will land an unreviewed rewrite of all seven station contracts, and one armable prompt does exactly that

`[MEASURED]` `pr-vmguard-s2-preflight-installs-guard-HOLD.md` is `ADMIT`, gate released
(`requires_on_main: scripts/pipeline/vm-git-guard.sh :: ensure_on_path`), carries none of the three
arming markers and no prose gate — and its `scope:` is **all seven `docs/pipeline/stations/0*.md`
plus `docs/pipeline/stations/_canonical-blocks.json`**. Its `done_when` runs `lint-station.mjs`, so it
re-records the canonical-block hash by design.

Every one of those eight paths matches `^(tests|docs)/`. So `classifyPolicyFiles` admits it, the
`tests-docs` policy enables native auto-merge, and **a rewrite of the `station-contract v2` block that
binds all seven stations reaches `main` with nobody having read it.** The lane cannot see the
difference between a planning note and the pipeline's constitution; `docs/` is the whole of its
vocabulary. `#1563` is the precedent and §10.3 records it as the lane *working* — it auto-merged
`DOCTRINE.md` itself plus `_canonical-blocks.json` at 03:10:30Z with no reviewer.

DOCTRINE §10.3 already states the correct handling in its last paragraph — *"Hand-land when the content
must be exact — binding law, a canonical block, a correction to DOCTRINE itself"* — but that is written
as a **preference for the arming station**, not as a gate, and nothing enforces it. The prompt is sitting
in the `GATES SATISFIED` bucket where an arming decision looks, indistinguishable by any instrument
from the plan document I armed.

**DISPOSITION: ESCALATED — `docs/pr-prompts/needs-marco/`, RULE 1 options below.** This is not mine to
settle: it is a change to what the merge gate means, and the two credible fixes trade completeness
against throughput, which is a design call (§5.5). It is also not urgent-by-accident — **I did not arm
it, and I am naming it so the next run does not.**

**RULE 1 — complete-and-additive first.**
**(a)** Add a CP gate that fails any PR touching `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/stations/**` or `_canonical-blocks.json` **unless** it carries an explicit
`GATE-ALLOW: binding-docs` marker at column 0, the way CP-24 proves 05's `sot/` boundary. *Complete:*
it closes the hole for every future prompt and every lane, not just this one, and it fires on the
**diff** rather than on a label — which is the upstream half `#1635` is already open about. *Additive:*
it adds a check and removes no path; a binding-docs change can still land, it just has to say so.
Passes both halves of RULE 1.
**(b)** Narrow `NESTED_TEST_PATHS` to exclude `docs/pipeline/`. *Fails the additive half:* it silently
reclassifies every ordinary pipeline docs PR — including this station's own hourly board PRs — as
Marco's, which multiplies his queue by the one thing the lane exists to remove.
**(c)** Leave it and rely on §10.3's prose preference. *Fails the complete half:* it is exactly the
control that has already not held — §10.3's own worked example is a canonical-block change that
auto-merged.

### F3 — the sweep's §5 stale-claim block is now ~80 lines of dead escalations and is crowding out the live ones

`[MEASURED]` `status-sweep.ps1` §5 emitted **~80** `[STALE]` lines this run against **3** `[LIVE]`
ones (`lint-station-compares-the-wrong-version-field-2026-09-05.md → #1667`,
`pr-1662-destructive-migration-open-on-the-board-2026-09-05.md → #1662`, and one `#99999` sentinel
that reads `not found via gh`). A single file,
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`, accounts for **28** of them
on its own, because it cites every PR in its own narrative. `needs-marco/` holds **24** files.

The section is doing its job — every one of those lines is true, and the standing rule *"never act on a
§5 `[STALE]` line without reading the file"* still binds, so none of them can be swept mechanically.
The cost is that the three live lines are buried in eighty dead ones, in the section whose entire
purpose is *"the step that was being skipped"*.

**DISPOSITION: DEFERRED, with the urgency condition stated.** It becomes urgent the moment a run
**misses** a `[LIVE]` §5 line because of the noise — which is the same failure shape as the gitignored
`qa-findings.md` that swallowed a released gate for nine days, and unlike that one it is currently
recoverable by reading. The clean cure is a sweep change (group by file, print `[STALE] <file>: N dead
refs` on one line and list only the `[LIVE]` ones in full), which is `scripts/pipeline/status-sweep.ps1`
— outside this station's lane to merge, and there are already two `ADMIT` prompts queued against that
same file (`pr-statussweep-local-time-timestamps`, `pr-sweep-dead-queue-dir-reads`). Folding a third
change into a file with two pending prompts is how the duplicate-PR defect in §10.6 happens. It waits
for one of those to land.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs are hand-classified MARCO'S with the probe controlled in both
  directions by the 15:08Z run, and `#1662` is additionally a destructive column drop (§8.3). All three
  are CLEAN and green; none is waiting on me. I removed and applied no label, and **authored no
  `merge-approvals/` receipt** — no agent may.
- **Armed only ONE**, from four eligible candidates. `pr-vmguard-s2` is F2 and deliberately left; the
  other two were passed over for stated reasons — `pr-smoke-share-worker-tokens` rewrites the
  `pr-acceptance` harness that every future smoke depends on, so a green CI on its own PR is not proof
  it is safe for the instrument, and `pr-artifactregister-s2`'s `done_when` requires enumerating
  Marco's artifact gallery (≥35 `claude.ai/code/artifact/` ids) plus three files that exist only in
  `C:\Users\Marco\Downloads` — a headless code-writer can reach none of that, so it is a silent-no-op
  candidate, which is the worst failure mode we have.
- **Did not re-derive the RULE 2 probe.** Nothing merged and nothing was armed in the hour, so no
  processed log could have changed; re-running it would have produced a second reading of the same
  fact and spent tokens the station doc says are scarce.
- **Did not touch `sot/`** (two `ADMIT` prompts point there and both are 05's, CP-24), **the watcher
  clone** (`branch=main dirty=5`), or **`C:/po-vg`** (dirty=1, age 1936 min — `--force` would discard
  that file). The last two are 03's and already dispatched; 03 fires at 23:00Z.
- **Did not clear any `[STALE]` §5 line**, including the eleven against
  `agent-authored-rule-2-clearance-2026-09-04.md`.
- **Did not run `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean`**
  anywhere, and ran no `git` through any VM-side transport against the Windows `.git`.
- **Did not edit any canonical block.** This PR adds one breadcrumb, archives one, deletes one consumed
  HOLD and appends one arming-log line.
