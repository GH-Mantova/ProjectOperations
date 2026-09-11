# Station 00 — Supervisor | 2026-09-11T02:09:18Z–2026-09-11T03:0xZ

## GROUND

```
UTC            2026-09-11T02:09:18Z
origin/main    922b0f2e  (at start)  ->  58f0de4e  (after merging #1868 and #1870)
dev tree       main @ 2d31827d       C:\ProjectOperations2   (3 behind at start, 0 0 at 02:30Z)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. This run was NOT read-only-forced.

**Sighted run.** Desktop Commander was loaded by keyword `ToolSearch` first, never by hard-coded id,
then `start_process` shell `powershell.exe` succeeded (pid 23452). Every probe below ran on the
Windows host through that shell.

**Which tree I read in.** The dev tree, `C:\ProjectOperations2`, after
`git fetch origin --prune`. `git diff --numstat origin/main` over the three binding documents
returned EMPTY for `00-supervisor.md` and `STATION-CAPABILITIES.md` and `0 110` for `DOCTRINE.md`,
so **DOCTRINE was read from `git show origin/main:` and not from the working copy**; no piped hash
was taken.

⚠️ **PARTIAL READ, DECLARED.** `DOCTRINE.md` at `origin/main` is **360,856 bytes / 2,298 lines**.
I read sections 1–8 in full, 9.1, 9.2, 9.6 and 10.1 in full, and the section index for the rest;
9.3, 9.4, 9.5 and 10.2–10.6 were **not** read line-by-line this run, and the subsections I edited
(9.1, 9.4, 9.5) were each read in full around the edit. Station 04's 02:11Z run re-probed the whole
of section 9 the same hour and its table is carried below. **Saying so is the point** — a station
that claims a full read it did not perform is the failure this document exists to stop.

**vm-git-guard install: FAILED — no VM-side call was made, so exposure was zero.** The Linux
workspace would not start: *"failed to mount … is under Plan9 share \"c\" which is not mounted"*.
**There is no installer last line to quote because the installer never ran.** Fifth consecutive run
with this error; already filed as `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`
and `linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`, not re-filed. Every `git`
call this run was PowerShell on the Windows host; both `index.lock` probes read `False`.

**Negative controls minted for this run** (each spent the moment this file is tracked):
`zzQq00N20260911T0218`, and Station 04's `zzQq04Needle20260911T0213`. Mine returned **0** over
`docs/pr-prompts/processed/*.log`.

## WHAT I MEASURED

**status-sweep.ps1 ran twice; section 0 controls PASSED both times and section 7 said SAFE TO ACT
both times.** Captured with `*>` to a file (141,874 B / 415 lines) because the script returns early
and hides its own section 7 otherwise. Generated `02:10:37Z`, then again `02:15:40Z` immediately
before the first merge.

**Section 5 carries ZERO `[STALE]` escalation rows.** A filter for `[STALE]` over the report returned
**4** hits and all four are the report's own legend, header, footer, or a `[FILE]` line quoting the
word. POSITIVE control `[LIVE]` over the same file → 98+; NEGATIVE → 0. The 09-10T21:1xZ discharge of
eleven dead escalations is still holding. Nothing to clear during COLLECT.

**Freshness CLEAN, and it crosses cleanly against the newest breadcrumbs.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`,
`structure: 2 checked, 0 malformed`: `00` 1.1h (cadence 2h) ok · `03` 3.1h (24h) ok · `04` 4.1h (4h)
ok · `05` 12.0h (24h) ok. No station SILENT, so no transcript read was needed.

**COLLECT — Station 04 reported DURING this run and was collected.**
`00-04-scanner-2026-09-11-0211-…` was written to the dev tree at **02:24:35Z**, untracked. It is
carried by this PR and every one of its findings is dispositioned below. The two `00-00-supervisor`
breadcrumbs at depth 1 were already tracked and are archived by this PR.

**RULE 2 probe, pinned to the LIVE tree, with both controls.** Over
`C:\ProjectOperations2\docs\pr-prompts\processed` and never the watcher clone: **2130** logs, newest
`2026-09-11T01:14:01Z`. Written without a quote character as the regex form.

| needle | hits | reading |
|---|---|---|
| `PR #1870` | **0** | no watcher verdict — and see the caveat below |
| `PR #1868` | **1** | `rev-1868-ready.md.log`, a REVIEW job's `Verdict: **MERGE**` line — **not** a `[watcher] merge result` verdict |
| `PR #1850` (POSITIVE control) | **2** | a real `opened PR #1850` line AND `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` |
| `PR #999997` (NEGATIVE) | **0** | |
| `zzQq00N20260911T0218` (NEGATIVE) | **0** | |

⚠️ **`#1870`'s zero is the 09-11 `extractPrNumber` bullet firing, not an absent lane.** The watcher
DID build and open `#1870`; its agent reported `PR **#1870**` and `\s*` does not match `**`, so no
`opened PR` line and no verdict were ever written. A literal `PR #1870` search therefore returns 0
for a PR the watcher opened. **The lane was established from the arming log and the daily build log,
not from the absence.** Either way the hand-classification is the same.

**Lane and classification for the two PRs I merged**, by `classifyPolicyFiles` read out of
`index.mjs`, not from prose:

| PR | files | labels | classification |
|---|---|---|---|
| `#1868` | `docs/pr-prompts/pr-draftpanel-s1-rates-lock-gate-HOLD.md`, `…-s2-finish-this-draft-HOLD.md` | **none** | both inside `^(tests\|docs)/` ⇒ **TESTS-DOCS, not Marco's** |
| `#1870` | `docs/plans/scope-cards-reconciliation-plan.md` | **none** | inside `^(tests\|docs)/` ⇒ **TESTS-DOCS, not Marco's** |

**Q1 — DIRTY count is ZERO.** No open PR was conflicted at any point this run, so no PR has frozen
CI and the board is not blocked on a conflict. The three PRs left open are Marco's: `#1865`
(dependabot, `apps/web/package.json` + `pnpm-lock.yaml` — outside `tests|docs`), `#1852`
(`scripts/pipeline/status-sweep.ps1` — outside), `#1823` (five `apps/api/**` files, live watcher
verdict `escalates:true - held for Marco, labelled do-not-merge`). **`#1823` carries no label
because Marco removed it, and removing `do-not-merge` does not clear RULE 2.**

**Q3 — I counted the armed prompts myself.** `Get-ChildItem docs\pr-prompts -Filter '*-ready.md'`:
**0** at 02:10Z and 02:15Z (the sweep agreed), **1** at 02:30Z —
`pr-company-manage-s1-permission-and-grant-ready.md`, armed by another actor, see F1. POSITIVE
control that the glob works: **41** `*-HOLD.md` at the same level.

**The spent prompt was proved spent, with the instrument proved in both directions.**
`lint-prompt.mjs` on `pr-scopecards-s0-plan-HOLD.md` taken from `origin/main`:

| form | result |
|---|---|
| dumped with PowerShell `>` (UTF-16LE) | `REJECT [NO_FRONT_MATTER]`, exit 1 — **and the positive control rejected identically**, so the instrument was broken |
| dumped with `node` (bytes preserved), BEFORE `#1870` merged | `ADMIT`, exit 0 — premise still true |
| same, AFTER `#1870` merged | **`STALE`, exit 3** — *"The Scope Cards reconciliation plan does not exist on main"*, premise now false |
| NEGATIVE control, `pr-draftpanel-s1-rates-lock-gate-HOLD.md` (landed by `#1868` minutes earlier) | `ADMIT`, exit 0 |

**Watcher liveness — taken from the sweep's `[LIVE]` process read, not re-derived.** node pid
**18228** running, auto-restart wrapper alive (1), heartbeat 33 min at 02:10Z and 38.6 min at 02:15Z
with no build in flight. `restart-watcher-if-wedged.ps1` was **NOT** run and **no WEDGED/DOWN verdict
is claimed** — nothing in this run's signals suggested one.

**Queue and escalation census at 02:10Z.** `-HOLD.md` at depth 1 **41** (40 + the two `#1868`
staged, minus the one retired); `needs-marco/` **51**; `no-pr-opened/` **109**, newest entry still
`2026-09-02T03:47Z` — no new silent no-op this run; `failed/` **45**; `blocked/` **132**.

## WHAT CHANGED

1. **`#1868` MERGED** — `docs(pr-prompts): stage the draftpanel cluster`. `gh pr update-branch 1868`
   → `✓ PR branch updated`, head `6d59397a`; CI went 15 checks 0 bad 0 pending; then
   `Assert-SmokedOrEscalate -PR 1868` → `True` and `Merge-Pr -PR 1868` → `True`. Read back from
   GitHub: `state=MERGED`, `mergedAt=2026-09-11T02:21:38Z`, `mergeCommit=6d100f8e`.
2. **`#1870` MERGED** — `docs(plans): land the Scope Cards reconciliation plan (SLICE-0)`.
   `gh pr update-branch 1870` → `✓ PR branch updated`, head `0007f7bb`; CI green; then the same two
   primitives → `True`, `True`. Read back: `state=MERGED`, `mergedAt=2026-09-11T02:29:34Z`,
   `mergeCommit=58f0de4e`; then `git fetch origin +refs/heads/main:refs/remotes/origin/main` and
   `git rev-parse --short origin/main` → **`58f0de4e`**.
3. **The dev tree was converged to `origin/main`, and `.arming-log.txt` was treated as append-only.**
   Local copy saved (11,825 B / 79 lines) → restored to `HEAD` with `git show HEAD:<path>` piped to a
   node write, never `git checkout -- <path>` → `git merge --ff-only origin/main` → **two** local-only
   lines re-appended. Read-backs: `git rev-list --left-right --count HEAD...origin/main` → **`0 0`**,
   final bytes **11,825 = the original local byte count**, both reapplied lines present.
4. **`DOCTRINE.md` gained FOUR clauses in section 9**, all four dispatched to me by Station 04 this
   hour. Spliced in node by **concatenation** — never `String.replace` with a replacement string —
   anchor uniqueness asserted at 1 before each splice and the byte delta asserted EXACT after each:
   180,427 → 182,259 (+1,832) → 183,621 (+1,362) → 184,818 (+1,197) → **185,984** (+1,166). Each new
   marker present exactly once. `U+FFFD` → **0**; the `a-hat-euro` double-encode signature unchanged
   at **2**, both pre-existing on `main` (my inserted text is ASCII-only and contributes 0).
5. **The `instruments v2` canonical hash was re-recorded.** `lint-station.mjs` before the re-record:
   **`REJECT: 1 of 8 docs failed`** — the signature that a section 9 edit costs ONE document, not
   seven. `lint-station.mjs --write-canonical` → `instruments v2 1be813e2a176e2a5`,
   `station-contract v3 954c7f49160daa71`. Re-lint → **`ADMIT: all 8 docs clean`, exit 0**.
6. **One spent prompt retired.** `git mv docs/pr-prompts/pr-scopecards-s0-plan-HOLD.md
   docs/pr-prompts/superseded/` — it lints `STALE` exit 3 now that `#1870` is on `main`, so leaving
   it tracked is the stays-armable-forever defect with a live instance attached.
7. **Two breadcrumbs archived** (`00-00-supervisor-…-0011-…`, `…-0108-…`) and **one collected**
   (Station 04's `…-0211-…`, previously untracked), all in this PR.
8. **Station 04's `sweep-rotation.json` advance is carried by this PR** — `last_index` 0 → 1,
   `last_run_utc` → `2026-09-11T02:11:09Z`. 04 may not commit it; that hand-off is mine.
9. **Nothing was armed by me, no label was added or removed, no watcher-routed PR was merged.**

## FINDINGS

### F1 — A second actor armed an `escalates: true` prompt THIRTY SECONDS after my second merge, and Marco hand-merged `#1852` inside the window my own safe-to-act gate called quiet. DEFERRED, and the board is now stood off.

`ACTOR_COLLISION_WINDOW_V1`

[MEASURED] from `docs/pr-prompts/.arming-log.txt`, which is the only instrument that names the actor:

```
2026-09-11T01:25:22Z  ARMED  pr-scopecards-s0-plan                      escalates=false  actor=station-00.cowork-0002  pid=25780
2026-09-11T02:30:04Z  ARMED  pr-company-manage-s1-permission-and-grant  escalates=true   actor=station-00.cowork-0002  pid=12340
```

My `Merge-Pr -PR 1870` read back `mergedAt=2026-09-11T02:29:34Z`. The arm is **30 seconds** later.

Independently, Station 04's 02:11Z run recorded `origin/main` moving `922b0f2e` → `ec7dd590` and the
**dev tree being fast-forwarded by another actor at 02:13Z** — neither was me; I fast-forwarded at
02:30Z. The commits `ec7dd590` gained were `docs/decisions/merge-approvals/1852.md` and
`scripts/pipeline/status-sweep.ps1`, i.e. **`#1852` was merged by hand at about 02:12Z** — three
minutes before my 02:15:40Z sweep printed `no PR touched on GitHub in the last 2 min` and
`SAFE TO ACT`.

**This is BOARD DRIVING condition 3 reading green on a board that had a live human on it**, and it is
worth stating exactly: the gate is a 2-minute window, the collision it guards against is LL-38, and a
hand-merge 3 minutes earlier clears it by 60 seconds. Nothing was damaged — my two merges were
`update-branch` + native squash through the primitives, both read back MERGED, and the other actor's
arms are in a file I treated as append-only precisely because of the 2026-09-06 measurement where a
restore silently deleted a concurrent actor's line. But the gate did not tell me what was true.

**DISPOSITION: DEFERRED, with the board stood off for the rest of this run.** I stopped mutating the
board the moment I read the 02:30:04Z line: no further merge, no arm, and this PR is opened and left
for the next cycle rather than merged into a board another actor is building on. What would make this
urgent: a run that merges while `cowork-0002` is mid-build. The remedy — widening the safe-to-act
window, or having the gate read `.arming-log.txt`'s tail as a mutation signal — is a
`scripts/pipeline/status-sweep.ps1` change and therefore Marco's lane, so I am not filing a
`needs-marco/` file for a gate that has not yet cost anything; the measurement is here, and the next
occurrence has a name to cite.

### F2 — Station 04's four section-9 dispatches are LANDED, in this PR, with the canonical hash re-recorded. ACTIONED.

04's 02:11Z `instrument-honesty` sweep re-ran twenty-three section 9 and section 10 traps against the
corpus each bullet names, and dispatched four clause edits to me. All four are in this PR:

| 04's finding | what it measured | what landed |
|---|---|---|
| **F1** `FIXTURE_B_NEEDS_ZERO_FILES_V1` | the 09-10 wildcard correction names a falsifying probe that **cannot fail** — fixture B as specified returns exactly the `2` and `3` the bullet nominates as its own refutation, because the mechanism needs **zero files of any kind** at depth 1, not zero *matching* files | a corrected three-fixture table (A/B/C) and one clause: **fixture B must hold no files at all at depth 1**. Every rule above it is unchanged |
| **F2** `COMMAND_LAYER_EXPANSION_NOT_REPRODUCED_V1` | the `$`-expansion trap did **not** reproduce through `start_process -Command` — `$CTRL=42` printed `CTRL-literal-is:42` and `$home` reached PowerShell intact | a dated, transport-stamped **non-reproduction**, cure left unconditional. Desktop Commander version: **[CANNOT MEASURE] — not stamped**, `get_config` was not called this run; the next sweep must stamp it |
| **F4** `ANCHOR_PROBE_PER_DOCUMENT_V1` | the anchor-scoping clause **did** land, but its probe returns 7 against a predicted 1, because four of the seven are DOCTRINE quoting the citations it retired | the prediction restated **per document** (`03`→0, `05`→0, `CLAUDE.md`→0, `STATION-CAPABILITIES.md`→0, `DOCTRINE.md`→its `start-watcher.ps1:160` uses only) |
| **F6** `NULL_COUNT_IS_IN_THE_COUNTER_V1` | `@($null).Count` is `1` **in the counter**, not in `gh` — it turned four independent truths of 0 into a uniform, plausible `1` inside 04's own probe | the clause generalised beyond `gh`, with the null-guarded counter stated as the rule wherever you count at all |

**DISPOSITION: ACTIONED.** Evidence it worked: byte deltas EXACT on all four splices, each marker
present exactly once, `U+FFFD` 0, and `lint-station.mjs` moving from `REJECT: 1 of 8` to
**`ADMIT: all 8 docs clean`** after `--write-canonical`. ⚠️ One gap is carried forward deliberately:
04's F2 asked for the Desktop Commander version to be stamped and I did not stamp it.

### F3 — 04's F5 (24 remote-tracking refs no refspec owns, including a NEW `staleprobe/*` family) belongs to Station 03. DISPATCHED.

[MEASURED] by Station 04 at `ec7dd590` immediately after `git fetch origin --prune`: `git branch -r`
= **38** against `git ls-remote --heads origin` = **14**, all 14 real heads matching. The 24 extras
are thirteen `pr/NNNN` refs, `pr1273`, and **nine `staleprobe/*` refs**, four of which are
`*verdict-home-resolver*` variants from the kill-loop episode. Section 9.2's conclusion is untouched —
`--prune` cannot remove refs `remote.origin.fetch` does not cover — but the `staleprobe/*` family is
new and more than doubles the undercount.

**DISPOSITION: DISPATCHED** → Station 03, folded into its open clone-hygiene dispatch rather than
opened as a new one. 03 owns ref deletion; 04 may not, and I have no reason to reach into the clone
for cosmetic refs. It becomes real the moment someone crosses `branch -r` against the API, which
section 9.2 records as having already happened once at 54-against-21.

### F4 — 04's F3 re-ran the CADENCE falsifying probe at a current SHA and it has still not landed. DEFERRED.

[MEASURED] at `ec7dd590`, anchor `const CADENCE =`, still at line 36:
`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };` while 00's live cron is
`5 * * * *`. `--freshness` — the probe COLLECT is told to START with — will not call 00 SILENT until
**4 h**, i.e. after **three** consecutive missed hourly runs.

**DISPOSITION: DEFERRED.** Already filed, correctly, with options, at
`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`; it is a `scripts/`
change and therefore outside my merge lane, so it is escalated to somebody rather than to nobody. A
third file would be noise. What would make it urgent: a missed 00 occurrence that `--freshness`
reports `ok`.

### F5 — The Linux workspace has now failed to start on five consecutive runs. DEFERRED.

Recorded rather than left silent, because PREFLIGHT asks every station to quote the installer's last
line pass or fail and there is none to quote. Station 04 met the identical error at 02:11Z and quoted
it verbatim, naming a Windows update released 2026-09-08. **Exposure this run was zero** — no VM-side
transport existed at all, so the hazard the guard removes could not occur; both `index.lock` probes
read `False` and `git processes touching our trees` read `0`.

**DISPOSITION: DEFERRED.** Covered by the two existing `needs-marco/` files named in GROUND. What
would make it urgent, and this is 04's sharpening rather than mine: a run that is blind to Desktop
Commander **and** the mount on the same day, which would cost that run its entire COLLECT — the
blind-run path in `STATION-CAPABILITIES.md` section 3 depends on the mount being there.

### F6 — `#1870` merged with no independent review, because the review job was never created. DEFERRED.

`docs/pr-reviews/pr-1870-review.md` does not exist in the dev tree, the watcher clone, or on `main`,
and `docs/pr-prompts/processed/rev-1870*` does not exist either — POSITIVE control, `rev-1868` exists
and carries `Verdict: **MERGE**`. The cause is already recorded: `extractPrNumber` returned `null` on
`PR **#1870**`, so nothing ever knew which PR to enqueue a review for.

I merged it anyway and that is a decision, not an oversight. `Assert-SmokedOrEscalate` does not
require a review and never has; the content was independently compared against its duplicate `#1871`
by the 01:08Z run (13,587 chars against 7,457, both satisfying the prompt's `done_when`, `#1870` the
fuller and earlier); it is one added file under `docs/plans/`; and it was green on 15 checks.

**DISPOSITION: DEFERRED.** The general defect — a prose-scrape failure silently removes a PR from the
review lane — is already escalated as
`needs-marco/watcher-scrapes-the-pr-number-out-of-agent-prose-2026-09-11.md`, filed by the 01:08Z run
with RULE 1 options and (a) *resolve the number from the pushed head branch* first. This finding adds
one consequence that file does not yet name: **the same bug also suppresses the review, so a
second-lane-looking PR arrives unreviewed and the absence looks like an ordinary second lane.**

## WHAT I DID NOT DO

- **Did not merge any of the three PRs that are Marco's.** `#1823` carries a live watcher
  `marco:true` verdict; `#1865` and `#1852` hand-classify outside `tests|docs`. `#1852` he merged
  himself at about 02:12Z.
- **Did not merge this PR.** F1 — a second actor armed an `escalates: true` prompt 30 s after my last
  merge and is building on this board now. Condition 3 says stop, and it says so for board mutations
  I control, which includes my own.
- **Did not arm anything, and did not touch the other actor's arm.** `pr-company-manage-s1-permission-and-grant-ready.md`
  is loose and armed and WILL run; section 5b is explicit that a cautious sweep which quarantines work
  Marco asked for is not free. I ran no arming triage at all: 41 HOLDs, and the 01:08Z run measured
  0 of 9 gate-satisfied HOLDs eligible for the `tests-docs` lane, so every arm available today lands
  on Marco.
- **Did not add or remove a label on any PR.** Only Marco removes `do-not-merge`.
- **Did not author a merge-approval receipt.** A scheduled run never does.
- **Did not run `restart-watcher-if-wedged.ps1`, and claim no WEDGED/DOWN verdict.** node, wrapper and
  heartbeat all read healthy in both sweeps.
- **Did not commit the ` D` on `pr-company-manage-s1-permission-and-grant-HOLD.md`.** That is the other
  actor's in-flight arm, not a spent prompt; retiring it would disarm live work. Only
  `pr-scopecards-s0-plan-HOLD.md`, proved `STALE` exit 3 against a landed `#1870`, was retired.
- **Did not `git` the watcher clone at all**, beyond listing its `docs/pr-reviews/` directory.
- **Did not prune `C:\po-vg`** (orphaned 9737 min, **holds 1 uncommitted file**), `C:\po-worktrees\pr1823`,
  or the registry escapee `C:\po-worktrees\v1823`. All Station 03's, and the sweep says so.
- **Did not stamp the Desktop Commander version** that 04's F2 asked for — named in F2 above so the
  next `instrument-honesty` sweep does not have to rediscover the gap.
- **Did not edit `/sot/`, touch Azure / Entra / SharePoint, write production data, commit on `main`,
  or hand-merge anything.**
- **Two untracked files in the dev tree are named here because they can reach nobody else:**
  `docs/pr-prompts/pr-scopecards-s0-plan-b-LOOPING.md` (gitignored, the 01:29:53Z LOOP rename) and
  `docs/pr-prompts/.queue-sync-ledger.txt`.
- **This breadcrumb was written INSIDE this run's PR worktree**, the preferred home in the REPORT
  CONTRACT, so no untracked copy is left in the dev tree to block the next fast-forward.

- **HANDOVER — this PR plants a known fast-forward blocker, deliberately.** Station 04's breadcrumb
  exists UNTRACKED in the dev tree at `docs/pr-prompts/00-04-scanner-2026-09-11-0211-…md` and this PR
  adds it as a TRACKED file at that same path. When PR 1873 merges, `git merge --ff-only` in
  `C:\ProjectOperations2` will refuse with *"untracked working tree files would be overwritten"*
  while `git diff --numstat` reads EMPTY — the cause documented in this station's own
  delete-the-disk-copy section. **The cure, in order:** prove the disk copy is byte-identical to the
  committed blob (`git rev-parse origin/main:<path>` against `git hash-object <path>`, never a
  piped hash), `Remove-Item` it, fast-forward, restore it from the NEW `HEAD` with
  `git show HEAD:<path>` piped to a write, and read back all three of `0 0`, `--numstat` EMPTY and
  `--cached --name-status` EMPTY. `.arming-log.txt` will need the append-only save/restore/reapply
  cycle again if the other actor has armed anything further by then.
