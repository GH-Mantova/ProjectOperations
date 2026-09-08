# Station 00 — Supervisor | 2026-09-08T04:09Z–2026-09-08T04:5xZ

**BLIND RUN.** Desktop Commander was unreachable. Nothing was armed, merged, labelled, unlabelled,
staged or dispatched-by-mutation. This run COLLECTED through the Cowork mount and acted on nothing —
which is a different report from "I was blind, so I did nothing" (STATION-CAPABILITIES section 3).

## GROUND

```
UTC            2026-09-08T04:09:26Z
origin/main    e185e244            (.git/refs/remotes/origin/main, read as a FILE — git is refused against the mount)
dev tree       main @ e185e244     C:\ProjectOperations2   (.git/refs/heads/main — identical, so 0 ahead / 0 behind by ref equality)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap AGREE. `packed-refs` still pins `refs/remotes/origin/main` at `66194af6`
(permanently stale, on file); the loose ref wins and is what is quoted above.

## WHAT I MEASURED

**[MEASURED] Blindness, after a proper load — three `ToolSearch` calls before any conclusion.** A
keyword search for `desktop-commander`, a keyword search for `start_process powershell shell command
execution`, and a `select:` naming five Desktop Commander ids. The first two returned
`plugin:desktop-commander:desktop-commander` as *still connecting*; the third returned no matching
tool. The session then reported it verbatim: `plugin:desktop-commander:desktop-commander
(CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"`. That is a failure AFTER a
successful load attempt, not an unloaded schema — so it is blindness, and the STOP applies.

**[MEASURED] The device-bridge git guard installed, and it is load-bearing for this run's headline
finding.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, last line quoted
verbatim:

```
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

Controls, both directions: `which git` → `/sessions/<id>/.local/bin/git`; `git ls-tree -r
--name-only origin/main -- docs/pr-prompts` inside the mount → `REFUSED: git against a mounted folder
from the device-bridge VM`, **exit 99**; POSITIVE control, `git --version` outside any mount →
`git version 2.34.1`. The guard is doing exactly its job.

**[MEASURED] Board, GitHub MCP read-only, 04:1xZ.** Three open PRs — `#1802` (`tr-s3-manager-escalation`,
03:05:18Z) · `#1805` (`triage-holds-open-pr-duplicate-bucket`, 03:12:37Z) · `#1806`
(`design-ref-exempt-no-screen`, 03:24:45Z). `#1803` MERGED at **04:10:51Z**, inside this run's window.
`#1804` merged 03:25:14Z, `#1807` 03:33:20Z, `#1808` 03:45:04Z.

**[MEASURED] RULE 2, live tree, pinned.** `docs/pr-prompts/processed/pr-*.log` in
`C:\ProjectOperations2` — never the clone. `PR #1802` → **0**, `PR #1805` → **0**, `PR #1806` → **0**.
POSITIVE control `marco.:true` → **620**. NEGATIVE control, freshly minted needle → **0**. Corpus is
live: `rev-1807-ready.md.log` is present and carries `#1807`'s MERGE verdict.

**[MEASURED] Lane, and the `opened PR #` precondition obeyed.** The watcher's daily clone log,
selected by NAME SHAPE first and mtime second (never constructed from a date), is
`…\pr-watcher\logs\2026-09-07.log` — the local-date naming trap, exactly as section 9.5 records, since
its newest line is stamped `2026-09-08T04:13:23.281Z`. `opened PR #` → **4** (POSITIVE control
`[merge]` → 9; NEGATIVE control → 0), newest `2026-09-07T23:37:34Z … opened PR #1797`. **No
`opened PR #` line for any of the three open PRs**, which is `[CANNOT MEASURE]`, never "second lane".
Corroborated by the instrument the kill loop cannot erase: `.arming-log.txt`'s last row is
`2026-09-07T23:32:16Z ARMED pr-doctrine-s9-powershell-readonly-automatic-variables`, and **no arm
exists inside any of the three PRs' windows**, so no watcher build could have started. Second lane,
recorded as `[NO LANE VERDICT — hand-classified]`.

**[MEASURED] Hand-classification under `classifyPolicyFiles`.**

| PR | a path that decides it | verdict |
|---|---|---|
| `#1802` | `apps/api/src/modules/crm/reminders/comms-reminder-escalation.service.ts` | **MARCO'S** |
| `#1805` | `scripts/pipeline/triage-holds.ps1` | **MARCO'S** |
| `#1806` | `scripts/pipeline/lint-prompt.mjs` | **MARCO'S** |

`#1806`'s first two files (`docs/pr-prompts/PROMPT-SCHEMA.md`, `scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs`)
are both test-or-docs and would have read as eligible had the file list been sampled and stopped.
The third page settles it.

**[MEASURED] Queue.** `armed: 0` (`*-ready.md` at depth 1 → none), **39** `-HOLD.md`,
`.arming-log.txt` 66 rows, last arm **4.6 h** ago. `docs/pr-prompts/` root holds four breadcrumbs and
no stray artefacts.

**[MEASURED] Receipts.** `docs/decisions/merge-approvals/` at `e185e244` ends `1796 · 1797 · 1799`;
`1802 · 1803 · 1805 · 1806` absent. **This proves nothing about `#1803`**, which merged at 04:10:51Z,
*after* the ref this tree is pinned to — `[CANNOT MEASURE]`. For `#1804` (merged 03:25:14Z, before
that ref) the absence is real and is one more datapoint for the standing escalation that CP-26 is
armed by LABELLING and never fires on an unlabelled second-lane PR. Not re-raised.

**[MEASURED] A section 7 lie I told myself, inside this run.** `node check-breadcrumb.mjs … | tail -25;
echo "EXIT=$?"` printed `EXIT=0`. `$?` after a pipeline is the **last** element's status — `tail`'s. Run
unpiped, node exits **2**. The exit code that decides had been silently replaced by one that decides
nothing, and it agreed with the answer I expected.

## WHAT CHANGED

**Nothing on the board and nothing in the repo except this file.** No arm, no merge, no label, no
unlabel, no branch, no PR, no source-of-truth edit, no worktree, no stash, no watcher action, and no
`git` anywhere — the guard would have refused it and I did not ask. `.arming-log.txt` is unchanged.

This breadcrumb is **UNTRACKED** in the dev tree at
`docs/pr-prompts/00-00-supervisor-2026-09-08-0409-…md`. A blind run cannot open the PR that would
track it (the GitHub MCP token is write-403), so the next sighted run must sweep it up.

## FINDINGS

### F1 — `check-breadcrumb.mjs --freshness` reports two LIVE stations as `NO BREADCRUMB EVER` on a blind run, and it is the first instrument the collect is told to run

🔴 **The tracked set is built with `git`, the guard correctly refuses `git` against the mount, the
script catches the failure and prints an answer anyway.** Section 9.6 with the collect's opening
instrument attached.

[MEASURED] 2026-09-08T04:2xZ at `e185e244`, from inside the mount, node exit **2**, stderr **EMPTY**:

```
  00  last 2026-09-08T04:08:00Z  0.1h ago  (cadence 2h)  ok
  03  NO BREADCRUMB EVER
  04  last 2026-09-08T02:10:00Z  2.1h ago  (cadence 4h)  ok
  05  NO BREADCRUMB EVER
SILENT: 2 station(s) past cadence
```

**Both `NO BREADCRUMB EVER` lines are false.** On disk, this minute:
`00-03-machine-minder-2026-09-07-2303-…md` and
`00-05-sot-keeper-2026-09-07-1412-sot04-was-a-model-behind-and-sot02s-snapshot-rotted-again-in-one-day.md`
— 03 reported **5.1 h** ago and 05 **14.0 h** ago, both inside cadence.

**The mechanism, by anchor, not by line number.** `tracked()` holds
`const probes = [`git ls-tree -r --name-only origin/main -- ${DIR}`, `git ls-files ${DIR}`]` and a
`catch { /* instrument unavailable — try the next one */ }`. **Both probes are the same instrument.**
When git is unavailable the function returns nothing, `fromMain` is skipped, and freshness is computed
from `readdirSync(DIR)` alone — depth 1. **So a station reads `NO BREADCRUMB EVER` exactly when its
newest breadcrumb has been ARCHIVED**, which is 03 and 05 and is not 00 or 04, whose newest are still
in the root. That is the predicted pattern and it matches perfectly.

⚠️ **This inverts a documented safety property.** Section 9.5 records that archiving a breadcrumb
"can never make a station read SILENT", because freshness is recursive through `git ls-tree -r`. True
for a sighted run. **On a blind run archiving is the very thing that makes a station read SILENT** —
and the doc a reader consults says the opposite.

⚠️ **The failure is one-directional and lands on the dangerous side.** The structure pass is
unaffected (`4 checked, 0 malformed`, all correct) so three quarters of the output is right, nothing
is empty, nothing warns, and the wrong quarter says *two stations have never reported in their
lives* — which is an invitation to dispatch, or to escalate a healthy station as stopped.

🔧 **The complete-and-additive fix (RULE 1, both halves pass).** When `tracked()` yields nothing,
print `[CANNOT MEASURE] tracked set unavailable — freshness is depth-1 only` and emit `UNKNOWN`
instead of `NO BREADCRUMB EVER`. It is complete — it covers every future transport that lacks git,
not just this one — and it is additive: no passing run changes behaviour, no data is touched, and the
exit code only stops overstating.

⚠️ **Falsifying probe: the pattern, not the counts.** Run `--freshness` twice, once where `git` is
refused and once where it resolves, on a board where at least one station's newest breadcrumb is in
`archive/` and another's is in the root. If the archived station reads a date under the refused-git
run, this finding is wrong.

🔴 **Scope note for whoever lands it: this is NOT `tests-docs` eligible.** The change is in
`scripts/pipeline/check-breadcrumb.mjs`; `classifyPolicyFiles` refuses on that path however many test
files ride with it. It is Marco's, and saying so now is cheaper than discovering it at the gate.

**DISPOSITION: DEFERRED**, with the successor named and the fix written out above. A blind run may not
write, stage or arm a prompt, and this is the second consecutive run to end holding a fix it cannot
land.

### F2 — the 0408 breadcrumb is named and stamped for a slot its run never occupied, and `--freshness` believes the name

[MEASURED] The addendum on disk is
`00-00-supervisor-2026-09-08-**0408**-addendum-…md`, its GROUND line reads `UTC 2026-09-08T04:0xZ` and
its header claims the window `04:0xZ–04:1xZ`. **The PR that carried it, `#1808`, was created
`03:43:25Z` and merged `03:45:04Z`** — and its own text says it is an addendum to the **0308** run,
same run, later measurement. Mount mtime corroborates at `03:45:19Z`. So a breadcrumb describing
measurements taken at "04:0xZ" reached `main` twenty-five minutes before that time.

**The consequence is measured, not hypothetical.** `--freshness` reads `00  last 2026-09-08T04:08:00Z
0.1h ago … ok` — a date parsed straight out of that filename. The 04:08 occurrence is **this run**,
which at that moment had produced nothing. A run that produced no report was reading as reported-on-time,
by a station's own file. That is the `lastRunAt`-versus-breadcrumb hazard from the AUTHORITY section,
reached from a third direction: not a run that fired and died, but a **name that claims a slot the
work did not run in**.

🔧 **The cheap remedy, and it is a discipline not a gate:** name the breadcrumb from the run's measured
UTC start, never from the cron slot it expects to be filed under. An addendum written at 03:43Z is
`-0343-`. This run is named `-0409-` for exactly that reason. A durable version would have
`check-breadcrumb.mjs` warn when a breadcrumb's filename timestamp is in the future relative to the
commit that tracks it — worth pairing with F1, same file, same PR.

⚠️ **[CANNOT MEASURE] one alternative**, and it does not change the remedy: the disk copy may have been
rewritten after `#1808` merged (the untracked-copy path the station doc warns about), in which case
the stamp is honest and the *filename* alone is wrong. Discriminating needs `git`, which this run does
not have.

**DISPOSITION: DEFERRED** — folded into F1's successor prompt as a second assertion in the same file.

### F3 — the blind-run ceiling names one mount, and the session has eleven; the watcher clone is readable blind and its LIVE log is in it

STATION-CAPABILITIES section 3's blind-run block enumerates what the mount gives a run — "the working
tree, the queue, `docs/pr-prompts/processed/*.log`, `.arming-log.txt`, every station breadcrumb, and
the three binding documents" — and every item is inside `/sessions/<id>/mnt/ProjectOperations2/`, the
only mount it names. **Section 4, three sections later, lists `C:\po-watcher` and
`C:\po-watcher\ProjectOperations` as mapped folders too.** Nothing joins the two, and a reader of the
ceiling has no reason to walk forward to the mapping table.

[MEASURED] this run: eleven mounts are present, `po-watcher` among them, and through it the watcher's
**live** daily clone log was read — `…\pr-watcher\logs\2026-09-07.log`, newest line
`[2026-09-08T04:13:23.281Z] [update] PR #1805 branch updated (was BEHIND)`, four minutes old at the
time of reading, POSITIVE control `[merge]` → 9, NEGATIVE control → 0.

**Why this is worth landing, stated narrowly.** It gives a blind run three things the ceiling implies
it cannot have: the `opened PR #<n>` lane discriminator; the clone's `docs/pr-reviews/` and
`C:\po-watcher\verdicts-archive\`, which are two of the **three homes** section 9.5 requires before
"no verdict for PR N" may be written down; and a dated observation about the watcher.

🔴 **It removes nothing from the STOP and must not be read as loosening it.** A blind run still cannot
RUN anything, so it still may not claim a liveness, smoke, safe-to-act or merge verdict — those are
`restart-watcher-if-wedged.ps1` and `status-sweep.ps1`, and no log line substitutes for either. The
distinction is between quoting a timestamped line the watcher wrote and issuing a verdict about the
watcher. This run quotes; it does not verdict.

🔧 **The change is one paragraph in section 3's blind-run block**, naming the other mounts, naming the
three-homes consequence, and re-stating the verdict prohibition so the addition cannot be misread as a
relaxation. **Scope: `docs/pipeline/STATION-CAPABILITIES.md` alone — `docs/` only, so it IS
`tests-docs` eligible.**

**DISPOSITION: DEFERRED**, successor named. 🔧 **It is the second `tests-docs`-eligible prompt this
board has, and that matters more than the finding.** The 0208 run measured **0 of 39** HOLDs able to
enter the auto-merge lane and said the starvation "becomes urgent the moment a docs-or-tests-only HOLD
appears"; the 0408 run named the first (its F8, the `-like '?? *'` bullet for section 9.1). This is the
second. Two now exist and neither has been written, because both were found by runs that could not
write them.

### F4 — the board is three second-lane PRs, all Marco's, and this run merged none of them

Measured above: `#1802 · #1805 · #1806`, all `[NO LANE VERDICT — hand-classified]`, all **MARCO'S**
under `classifyPolicyFiles`. `#1803` merged at 04:10:51Z during this run by an actor this run did not
measure — recorded as board state and **not attributed**, because the discriminating identity is
per-commit and reading `mergedBy` produces the documented opposite error.

⚠️ **Condition 3 applies: Marco hand-drives this board.** Stand off his PRs.

**DISPOSITION: ACTIONED** — recorded, classified, and nothing touched. The board is state; re-measure,
never quote.

### F5 — blindness recurred, with the same signature and the same hard timeout

`CONNECT_TIMEOUT after 30000ms`, after a load, on a run whose two immediate predecessors were SIGHTED
(the 0208 run was blind; 0308 and its addendum were sighted throughout). The cause remains unknown and
the rate remains unmeasurable from the breadcrumbs, because a run's own blind-or-sighted declaration is
prose.

**DISPOSITION: ESCALATED** — unchanged, already on file, **not re-raised**. One datapoint attached:
blind at 04:09Z, hard 30 s timeout, both other MCP transports (GitHub read, workspace bash) healthy in
the same session — so it is the Desktop Commander transport specifically, not the session.

### F6 — `pollForBehindPrs` fired again, on schedule, on two PRs no automation can merge

[MEASURED] `[2026-09-08T04:13:20.768Z] [update] PR #1806 branch updated (was BEHIND)` and
`[04:13:23.281Z] [update] PR #1805 branch updated (was BEHIND)` — 2.5 minutes after `#1803` merged at
04:10:51Z. Both rebuilt PRs are hand-classified MARCO'S, so the rebuild buys nothing and feeds clone
drift.

**DISPOSITION: ESCALATED** — unchanged, already on file with its three options, one more datapoint.

### F7 — armed is 0 and the arm the last two runs identified is still unmade

`armed: 0`, 39 HOLDs, last arm 4.6 h ago. The 0408 run named the next move — stage the `docs/`-only
prompt carrying its F8 bullet into section 9.1 — and a blind run can neither write it, stage it, nor
`git mv` it.

**DISPOSITION: DEFERRED to the next sighted run**, with the queue now holding **two** named
docs-only successors (0408's F8, and this run's F3) plus one Marco-scoped one (this run's F1+F2).
The arming decision must be re-taken at the moment of the `git mv` and never inherited from this
breadcrumb.

## WHAT I DID NOT DO

- **Did not arm, merge, label, unlabel, stage, dispatch by mutation, or open a PR.** Blind: no
  `arm-prompt.ps1`, no `status-sweep.ps1`, no `smoke-pr.ps1`, no `pipeline-lib.ps1`, and the GitHub MCP
  token is write-403. **No liveness, smoke, safe-to-act or merge verdict is claimed anywhere above.**
- **Did not run `git` against the mount**, and did not work around the guard when it refused. A guard I
  could install is never a licence to route around it.
- **Did not write the three successor prompts** named in F1, F2 and F3. Writing a prompt is Station
  06's lane and staging one is a mutation a blind run may not make.
- **Did not re-raise** the blindness escalation, the `pollForBehindPrs` escalation, the CP-26
  vacuous-pass escalation, the eight stale remote heads, or the `C:\po-vg` dispatch to Station 03 —
  all on file, all with fresh datapoints attached where I had one.
- **Did not archive the four collected breadcrumbs.** Archiving is a `git mv` inside a board PR, and
  on this transport it is also what would push 03 and 05 into F1's false `NO BREADCRUMB EVER` for the
  next blind run.
- **Did not attribute `#1803`'s merge** to any actor. Reading identity from a squash merge is the
  documented way to get it backwards.
- **Did not touch source-of-truth, Azure, Entra or SharePoint**, and ran nothing in the watcher clone —
  it was read only.

**Needle minted and spent:** `zzQq00Needle20260908T0412`. Now in a tracked file and unusable again.

---

**Validator.** `node scripts/pipeline/check-breadcrumb.mjs` — structure pass only. Its `--freshness`
block is F1 and must not be quoted from this transport.
