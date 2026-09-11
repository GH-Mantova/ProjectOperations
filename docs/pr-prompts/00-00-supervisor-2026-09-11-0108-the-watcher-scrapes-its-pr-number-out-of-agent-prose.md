# Station 00 — Supervisor | 2026-09-11T01:08:47Z–2026-09-11T01:5xZ

## GROUND

```
UTC            2026-09-11T01:08:47Z
origin/main    80a2caee  (at start)  ->  7b1ba03a  (after merging #1869)
dev tree       main @ 80a2caee       C:\ProjectOperations2
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This run was NOT read-only-forced.

**Sighted run.** Desktop Commander was loaded by keyword `ToolSearch` first, never by hard-coded id,
then `start_process` shell `powershell.exe` succeeded. Every probe below ran on the Windows host
through that shell.

**Which tree I read in.** All three binding documents were read from the dev-tree working copy,
`C:\ProjectOperations2`, after the sound equivalence check passed:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY**, and `HEAD` was `origin/main` exactly
(`80a2caee` both sides). No piped hash was taken — the `git show | git hash-object --stdin` form is
unsound under `powershell.exe`.

**Negative controls minted for this run** (each spent the moment this file is tracked):
`zzQq00Needle20260911T0115`, `zzQq00Needle20260911T0125`, `zzQq00Needle20260911T0132`,
`zzQq00Needle20260911T0134`, `zzQq00Needle20260911T0145`, `zzQq00N0911T0150`. Every one returned
**0** against the corpus it was run over.

**vm-git-guard install: FAILED, and no VM-side call was made.** `bash
"$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never executed — the Linux workspace
would not start: *"failed to mount … is under Plan9 share \"c\" which is not mounted"*, plus
*"ensure user: user awesome-tender-newton already exists unexpectedly"*, and the tool's own note that
*"A Windows update released September 8 prevents Claude's workspace from reaching your files."*
**There is no installer last line to quote because the installer never ran.** A failed install is a
FINDING, not a STOP. Exposure this run was **zero**: every `git` call was PowerShell on the Windows
host, none through the bridge, and both `index.lock` probes read False at the start and the end.
**Fourth consecutive run with this exact mount error** — already covered by
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`; not re-filed.

## WHAT I MEASURED

**status-sweep.ps1 ran twice, section 0 controls PASSED both times, section 7 said SAFE TO ACT both
times.** Captured with `*>` to `C:\po-sup-fix-scripts\`, **140,118 bytes**, decoded `utf16le` in node
— read as UTF-8 the 838-line report is structureless and its `====` headers match nothing. Generated
`01:10:44Z`; pre-merge re-run generated `01:19:52Z`. Section 0 both runs: `gh CAN reach GitHub`,
`node runs`. No `[BROKEN]`.

**Section 5 carries ZERO `[STALE]` rows — the 09-10T21:1xZ discharge is still holding.** A filter for
`[STALE]` over the 838 lines returned **4** hits and every one is the report's own legend, header or a
`[FILE]` line quoting the word; **zero** escalation rows. POSITIVE control `[LIVE]` over the same
lines → **98**; NEGATIVE control → **0**. Nothing new to clear during COLLECT.

**Station freshness is CLEAN and crosses cleanly against `lastRunAt`.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 1 checked, 0 malformed`.

| station | newest breadcrumb | `lastRunAt` (scheduled-tasks MCP) | reading |
|---|---|---|---|
| 00 | 2026-09-11T00:11Z | 2026-09-11T01:08:47Z | this run — aligned |
| 03 | 2026-09-10T23:10Z | 2026-09-10T23:01:10Z | aligned |
| 04 | 2026-09-10T22:10Z | 2026-09-10T22:09:55Z | aligned |
| 05 | 2026-09-10T14:11Z | 2026-09-10T14:10:55Z | aligned |

Five enabled tasks, the fifth `weekly-security-audit` (`30 7 * * 1`, last `2026-09-06T21:32:44Z`),
which is not a station. **No station is SILENT and none needed a transcript read.** The known
`CADENCE['00'] = 2` defect against a live cron of `5 * * * *` is unchanged and not re-filed.

**COLLECT: no other station has reported since my last run.** `docs/pr-prompts` holds exactly **one**
breadcrumb at depth 1, the 00:11Z run's own, and it is **already tracked** — `git ls-files
docs/pr-prompts` matched by trailing path segment returned **1** path for it. 03's 23:10Z and 04's
22:10Z breadcrumbs were collected and archived by earlier runs. Nothing was committed a second time.

**RULE 2 probe, pinned to the live tree, with both controls.** Over
`C:\ProjectOperations2\docs\pr-prompts\processed` and never the watcher clone: **2130** logs, newest
`2026-09-11T01:14:01Z` — younger than every open PR, which is the control that separates the live
directory from the clone's dead decoy; POSITIVE `marco.:true` (regex, written without a quote
character) → **629**; NEGATIVE, a minted needle → **0**; NEGATIVE, `PR #999998` over `pr-*.log` → **0**.

**Lane and verdict for all seven open PRs, measured at 01:1xZ.**

| PR | files | prompt-log hits | lane | verdict / classification |
|---|---|---|---|---|
| `#1869` | 3 × `docs/pr-prompts/**` | **0** | second lane | `[NO LANE VERDICT — hand-classified]` → all inside `^(tests\|docs)/` ⇒ **tests-docs, not Marco's** |
| `#1868` | 2 × `docs/pr-prompts/*-HOLD.md` | **0** | second lane | `[NO LANE VERDICT — hand-classified]` → inside ⇒ **tests-docs, not Marco's** |
| `#1865` | `apps/web/package.json`, `packages/ui/package.json`, `pnpm-lock.yaml`, receipt | **0** | second lane (`app/dependabot`) | `[NO LANE VERDICT — hand-classified]` → outside ⇒ **MARCO'S** |
| `#1852` | `scripts/pipeline/status-sweep.ps1`, receipt | **0** | second lane | `[NO LANE VERDICT — hand-classified]` → outside ⇒ **MARCO'S** |
| `#1850` | `scripts/pipeline/triage-holds.ps1`, receipt | 2 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` ⇒ **RULE 2** |
| `#1845` | `scripts/pipeline/status-sweep.ps1`, receipt | 2 | watcher | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` ⇒ **RULE 2** |
| `#1823` | 5 × `apps/api/**`, receipt | 2 | watcher | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` ⇒ **RULE 2** |

**Q1 — DIRTY count is ZERO.** No open PR is conflicted, so no PR has frozen CI and the board is not
blocked on a conflict. All seven carry **zero labels**; `#1823`'s `do-not-merge` was removed by Marco
and **that does not clear RULE 2**.

**Q3 — I counted the armed prompts myself.** `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'`:
**0** at 01:16Z and again at 01:19Z (the sweep agreed), **1** at 01:25Z — see F2. POSITIVE control
that the glob works: **40** `*-HOLD.md` at the same level.

**Marco merged `#1850` himself, mid-run.** `git log 80a2caee..7b1ba03a` shows `f3fbed20 … (#1850)`
landed between my ground stamp and my own merge. ⚠️ `gh pr list --state merged --limit 4` does **not**
show it — that list sorts by creation, not by `mergedAt`, so the `--limit N` truncation trap in
DOCTRINE §9.4 hides a just-merged older PR. `git log` is the sound instrument for "what landed since".

**The `tests-docs` eligibility question my last run left open is now ANSWERED: 0 of 9.** See F3; the
extraction and decision controls are recorded there.

**The clone's `dirty=4` is untracked-only, re-derived from its own source.** `git -C
C:\po-watcher\ProjectOperations status --short` → **3** at 01:3xZ, every one a `?? docs/pr-reviews/
pr-<n>-review.md` the `rev-<N>` job writes there by design; `git status --porcelain
--untracked-files=no` → **0**. Exactly the defect landed at 09-10T20:2xZ; not re-filed, and no
dispatch to 03.

**Watcher liveness — taken from the sweep's `[LIVE]` process read, not re-derived.** node pid
**18228** running, auto-restart wrapper alive (1), heartbeat age 0 min at 01:10Z.
`restart-watcher-if-wedged.ps1` was **NOT** run and **no WEDGED/DOWN verdict is claimed**: nothing in
this run's signals suggested one, and 03 measured the full chain two hours earlier.

**Queue and escalation census.** `-HOLD.md` at depth 1: **40**; `needs-marco/` **50** (now 51 — see
WHAT CHANGED); `no-pr-opened/` **109**, newest entry still `2026-09-02T03:47Z`; `failed/` **45**;
`blocked/` **132**.

## WHAT CHANGED

1. **`#1869` MERGED** — `7b1ba03a` on `origin/main` at `01:22:42Z`, via `Assert-SmokedOrEscalate -PR
   1869` → `True` then `Merge-Pr -PR 1869` → `True`. Read back from GitHub, not from the primitive:
   `state=MERGED`, `mergedAt=2026-09-11T01:22:42Z`, `mergeCommit=7b1ba03a98…`; then
   `git fetch origin +refs/heads/main:refs/remotes/origin/main` and `git rev-parse --short
   origin/main` → **`7b1ba03a`**. Second lane, hand-classified tests-docs, independently reviewed
   (`docs/pr-reviews/pr-1869-review.md`, first line `VERDICT: MERGE`, all three homes checked), zero
   labels, no watcher verdict to override. `git diff --name-status f3fbed20 7b1ba03a` → **3 M**, all
   under `docs/pr-prompts/`.
2. **A LOOPING prompt was renamed, stopping a duplicate-PR build.**
   `pr-scopecards-s0-plan-b-ready.md` → `pr-scopecards-s0-plan-b-LOOPING.md` at `01:29:53Z`. See F1.
3. **`DOCTRINE.md` §10.1 gained one bullet** (`PRNUMBER_SCRAPED_FROM_PROSE_V1`), in this PR. Spliced
   in node by **concatenation** — never `String.replace` with a replacement string — with the byte
   delta asserted on both passes: 172,854 → 177,758 (delta 4,904, expected 4,904, EXACT) → 180,109
   (delta 2,351, expected 2,351, EXACT). Anchor uniqueness checked before each splice (1 occurrence
   each), each new marker present exactly once afterwards, `U+FFFD` → 0, and the `â€`
   double-encode signature unchanged at 2 (both pre-existing on `main`; my inserted text contains 0).
   `git diff --numstat` → **107 insertions, 0 deletions**. The bullet is **OUTSIDE** the
   `instruments v2` canonical block, so it costs one document and needs no hash re-record.
4. **One new `needs-marco/` file written** in the dev tree, where the sweep reads it — the folder is
   gitignored, so it reaches nobody through this PR and is named here instead:
   `watcher-scrapes-the-pr-number-out-of-agent-prose-2026-09-11.md`, with its 01:3xZ addendum.
5. **Nothing was armed.** See F3 — that is now a measured decision, not a deferral.
6. **No breadcrumb was archived.** Only one existed at depth 1, it is this station's own from the
   previous hour, and it is already tracked; nothing else was outstanding.

## FINDINGS

### F1 — The watcher takes its PR number by regex from the build agent's free prose. It fails BOTH ways, both were measured on one prompt inside thirty-two minutes, and one of them writes a forged verdict into the corpus RULE 2 reads. ACTIONED, and the code repair ESCALATED.

`extractPrNumber` (`scripts/pr-watcher/index.mjs`) is the only thing that decides which PR a build
produced, and it scrapes stdout: `/github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/`, else
`/(?:PR|pr|pull request)\s*#(\d+)/`. Neither alternative is anchored to anything the agent **did**.

**FALSE POSITIVE — a prose mention adopted an unrelated, already-merged PR.** Build `b` of
`pr-scopecards-s0-plan` (`00:57:51Z`) opened no PR; it declined on the prompt's own prose
`STATUS: HOLD` line. Its stdout said *"My memory … records reviewing **PR #1866 (SLICE-0 scope
cards)** with a MERGE verdict earlier today."* The regex returned **1866** — a PR opened by a second
lane and merged **41 minutes earlier** — and the watcher ran its merge path against it and wrote
`[watcher] merge result for PR #1866: {"ok":true}` into
`processed/pr-scopecards-s0-plan-b-ready.md.log`.

| probe | result |
|---|---|
| `PR #1866` over `processed\pr-*.log` at 00:1xZ (my last run's own measurement) | **0** |
| the same probe at 01:4xZ | **2** |
| POSITIVE control `PR #1850` | **2**, carrying a real `marco:true` |
| NEGATIVE control `PR #999996` | **0** |
| `no-pr-opened/` newest entry | still **2026-09-02T03:47Z** |

So a silent no-op was filed to `processed/` as a completed build, and a PR correctly hand-classified
second lane one hour ago now reads watcher-opened. **§10.1 step 1 says a verdict naming a PR must be
obeyed** — here the verdict was `{"ok":true}` on an already-merged PR and nothing moved, but a scraped
number naming an **open** PR would have had the watcher drive `waitForPolicyMerge` on a PR it never
built, and a scraped `marco:true` would have permanently human-gated an unrelated PR.

**FALSE NEGATIVE — markdown emphasis defeated the match and restaged a duplicate.** Build 3
(`01:25:23Z`) **did** open `#1870` at `01:28:16Z` and reported `PR **#1870** opened and left
unmerged`. `\s*` does not match `**`; `extractPrNumber` returned `null`; **18 seconds later** the
watcher logged `no PR found - attempt 2 (b)` and started a fourth build of the same prompt, authoring
a duplicate of a PR already open. Four builds in thirty-two minutes, `max-turns=240` each.

**Never reported before:** `extractPrNumber` → **0** hits across `docs/pipeline/*.md`,
`docs/pipeline/stations/*.md`, `needs-marco/*.md` and every breadcrumb at depth 1 and in `archive/`;
POSITIVE control `classifyPolicyFiles` in `DOCTRINE.md` → **11**; NEGATIVE control → **0**.

**DISPOSITION: ACTIONED.** Landed in `DOCTRINE.md` §10.1 in this PR, both directions, with the tables,
controls, the source quotation and a falsifying probe, plus the interim cure: trust a verdict only
when the same log also carries that prompt's own `opened PR #<n>` line for the same number, and never
read a lane **into** a PR from a prose mention. The repair is `scripts/pr-watcher/**`, which this
station may not touch — **ESCALATED** to
`needs-marco/watcher-scrapes-the-pr-number-out-of-agent-prose-2026-09-11.md` with RULE 1 options,
(a) resolve the number from the pushed head branch, first.

### F2 — The loop was live and building a duplicate PR. Renamed under the LOOP rule; no fifth build started and `#1870` was left untouched. ACTIONED.

`[start] pr-scopecards-s0-plan` appears **4** times in today's daily clone log (POSITIVE control,
`[start] ` over the same file → **47**; NEGATIVE → **0**). The prompt was armed twice by
`actor=station-00.cowork-0002` — `00:57:09Z` and `01:25:22Z`, the second 40 s after `#1869` merged the
fix to its `STATUS: HOLD` line — and the watcher restaged it twice on the detection bug in F1.

**I did not treat either arm as a mistake.** The re-arm is deliberate and the human is present; §5b is
explicit that a cautious sweep which discards work Marco asked for is not free. What is a defect is
the **restage**, and by `01:28:34Z` the work was done (`#1870` open) while a fourth agent was
authoring it again.

**DISPOSITION: ACTIONED.** `Rename-Item pr-scopecards-s0-plan-b-ready.md →
pr-scopecards-s0-plan-b-LOOPING.md` at `01:29:53Z` — item 2 of this station's own fix set. Read back:
`*-ready.md` → **0**, `*-LOOPING.md` → `pr-scopecards-s0-plan-b-LOOPING.md`. Measured again at
`01:32:34Z`: no fifth `[start]`, and the open board is still **6** PRs with `#1870` the newest — **no
duplicate was created.** ⚠️ The `-LOOPING.md` file is gitignored, so it is named here rather than
carried by this PR.

### F3 — F3 of the 00:11Z run is now ANSWERED: 0 of 9 gate-satisfied HOLDs can enter the tests-docs lane. Still DEFERRED, but measured rather than assumed.

My previous run deferred arming and named the one probe that would change the answer, then said
plainly it had not run it. It has now run. `triage-holds.ps1` (exit 0, both its own controls PASS)
reports **HOLD=40, gates-satisfied=9, still-gated=31, spent=1**. Each of the 9 was parsed with the
**CRLF-explicit** front-matter regex and classified against `NESTED_TEST_PATHS` **read out of
`index.mjs`**, not from prose.

Controls, run separately for the extraction step and the decision step, which is the whole point:

| control | result |
|---|---|
| POS extraction, `pr-brandtheme-s3-…` | **8** scope entries |
| the broken `\s*\n` form on the same file | **0** — the §9.3 trap, reproduced |
| NEG extraction, a key that is not in the file | **0** |
| POS decision `docs/x.md` · `a/__tests__/b.mjs` · `a/b.spec.ts` | TESTS-DOCS ×3 |
| NEG decision `apps/api/x.ts` · a `migrations/` path · empty | REFUSE ×3 |

**TESTS-DOCS ELIGIBLE = 0 of 9.** Every one is refused on a real path — `apps/api/prisma/schema.prisma`
×2, `apps/web/src/lib/contrast.ts`, `apps/api/src/common/permissions/permission-registry.ts`,
`.github/workflows/playwright.yml`, three `apps/api/src/modules/**`, `charge-step-parity.service.ts`.
**Every arm available on this board today lands on Marco**, and five of his six are already waiting.

**DISPOSITION: DEFERRED.** ⚠️ **The trigger is now sharper than "check for one":** the structural
finding — no prompt this queue stages is ever `tests`/`docs`-only, measured 0-of-N on three separate
boards — is already escalated as
`needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md` (*"that lane currently
has no eligible supply"*) and is **not re-filed**. Arming becomes right again when Marco's board
drains below roughly two PRs, or when Station 06 stages a prompt whose `scope:` is confined to
`tests/` or `docs/`.

### F4 — I stood off `#1868` and every one of Marco's five. DEFERRED.

`#1868` is docs-only, green (15 checks, 0 bad, 0 pending), reviewed `VERDICT: MERGE`, and is squarely
in my lane. I did not merge it, and that is a decision rather than an omission: it was **BEHIND** and
would have needed its branch updated, while `actor=station-00.cowork-0002` was arming, opening and
pushing on this board in the same minutes — two arms, two PRs and a branch push between `00:51Z` and
`01:25Z`, and Marco merged `#1850` by hand mid-run. Condition 3 of BOARD DRIVING is the load-bearing
one and it says stop. `#1868` stages two new `-HOLD.md` into a queue that already cannot drain, so
the cost of waiting one cycle is nil.

**DISPOSITION: DEFERRED.** Merge it next cycle if it is green, not BEHIND, and no arm or push has
landed in the preceding few minutes. The other five are not deferrals at all: three carry live watcher
`marco:true` verdicts quoted above, and `#1865` and `#1852` hand-classify outside `tests|docs`.

### F5 — `#1870` opened during this run and is unclassified. DEFERRED to the next cycle.

`docs(plans): land the Scope Cards reconciliation plan (SLICE-0)`, opened `01:28:16Z`, one file
`docs/plans/scope-cards-reconciliation-plan.md` (ADDED, 117 lines), head `slice-0-scope-cards-plan`.
It is inside `^(tests|docs)/` and its prompt is `escalates: false`, so it is **not Marco's** by
`classifyPolicyFiles` — but it was two minutes old with no checks and its `rev-1870` review had only
just been enqueued (`01:30:58Z`).

**DISPOSITION: DEFERRED.** ⚠️ **Classify it with the F1 caveat in hand**: its prompt's log will name
`#1866` as well as `#1870`, so a bare `PR #<n>` search over that log carries a scraped number beside a
real one. Merge it next cycle if the review returns MERGE and checks are green.

### F6 — The Linux workspace has now failed to start on four consecutive runs, so the device-bridge git guard could not be installed. DEFERRED.

Recorded rather than left silent, because PREFLIGHT asks every station to quote the installer's last
line pass or fail and there is no last line to quote. The mount error names a Windows update released
2026-09-08 as the cause. **Exposure this run was zero** — no VM-side call was possible, every `git`
was PowerShell on the host, and both `index.lock` probes read False at the end.

**DISPOSITION: DEFERRED.** Already covered by
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`; a third file would be noise. It
matters on the next run where the bridge IS up and the guard is skipped for a different reason.

## WHAT I DID NOT DO

- **Did not merge any of the five PRs that are Marco's.** `#1850`, `#1845` and `#1823` carry live
  watcher `marco:true` verdicts quoted verbatim above; `#1865` and `#1852` hand-classify outside
  `tests|docs`. **`#1823` carries no label because Marco removed it, and removing `do-not-merge` does
  not clear RULE 2.** He merged `#1850` himself during this run.
- **Did not merge `#1868` or `#1870`** (F4, F5), and did not update either branch.
- **Did not add or remove a label on any PR.** Only Marco removes `do-not-merge`.
- **Did not arm anything** (F3). 40 HOLDs, 9 gate-satisfied, 0 tests-docs eligible, measured.
- **Did not treat either of Marco's two arms of `pr-scopecards-s0-plan` as an error, and did not
  disarm his work.** The rename in F2 was applied to the watcher's *restage*, after the PR it was
  duplicating was already open.
- **Did not fix `extractPrNumber`.** It is `scripts/pr-watcher/**`; the watcher owns its own
  lifecycle and the repair routes to Marco either way.
- **Did not author a merge-approval receipt.** A scheduled run never does.
- **Did not run `restart-watcher-if-wedged.ps1`, and claim no WEDGED/DOWN verdict.** node, wrapper and
  heartbeat all read healthy in the sweep's `[LIVE]` section; an unverified watcher would have been
  reported as unverified.
- **Did not dispatch the clone `dirty=` row to Station 03.** Re-derived from its own source: 3
  untracked review verdicts, `--untracked-files=no` → 0. Known defect, not clone hygiene.
- **Did not `git` the watcher clone beyond reads**, and copied the daily log before reading it because
  the live file is held open.
- **Did not edit `/sot/`, touch Azure / Entra / SharePoint, write production data, commit on `main`,
  or hand-merge anything.**
- **This breadcrumb was written INSIDE this run's PR worktree**, the preferred home in the REPORT
  CONTRACT, so no untracked copy is left in the dev tree to block the next fast-forward.
