# Station 04 — Scanner | 2026-08-29T22:10:49Z–2026-08-29T22:14:30Z

Sweep this run: **instruction-drift** (rotation position 4 of 4, assigned by `next-sweep.mjs`).

## GROUND

```
UTC            2026-08-29T22:10:49Z
origin/main    5017c6d1            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 5017c6d1     C:\ProjectOperations2   (rev-list --left-right = 0  0)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, full authority this run
```

**SIGHTED run.** `start_process` shell `powershell.exe` succeeded, PID 29316; `git`, `node` and
`gh` all resolved and answered. This was not a quiet blind run.

Freshness of my binding docs was proved by hash, not assumed — `git rev-parse origin/main:<path>`
vs `git hash-object <path>` for all three:

```
docs/pipeline/stations/04-scanner.md      8c24e5b8…  ==  8c24e5b8…   same=True
docs/pipeline/DOCTRINE.md                 ac04e437…  ==  ac04e437…   same=True
docs/pipeline/STATION-CAPABILITIES.md     b3976fe1…  ==  b3976fe1…   same=True
```

`status-sweep.ps1` @2026-08-29T22:11:25Z → **SAFE TO ACT** (no board mutation in progress, no
recent remote activity, no locks).

## WHAT I MEASURED

- **[MEASURED] The scheduled bootstrap I was served is byte-identical to the one on disk.**
  `Get-FileHash -SHA256` of the inlined `…\uploads\SKILL.md` and of
  `C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md` both return
  `2F34D1E53EF51951F823AC39889750947AC8BD2033EC53E30DBB4756A80D4816`, 5276 bytes. The inlining is
  faithful; drift found below is drift in the file itself, not in transit.

- **[MEASURED] `station_doc_version` matches on both sides for all five stations.**
  `00-supervisor 1/1 · 02-board-driver 1/1 · 03-machine-minder 1/1 · 04-scanner 1/1 ·
  05-sot-keeper 1/1`, all MATCH=true.
  ⚠️ **My first instrument lied here** (§7). A PowerShell `Select-String … -join ','` returned
  `bootstrap=[1,1] doc=[1] match=False` for all five — because each bootstrap names the value
  twice (once in the HTML comment, once in prose), not because anything disagreed. Re-run under
  node with de-duplication; the five true readings are the ones above. **Do not quote the
  PowerShell reading.**

- **[MEASURED] `lint-station.mjs` → exit 0, "ADMIT: all 7 docs clean."** One advisory only:
  `04-scanner.md` "names a Windows path outside the known folder map: `C:\po-scan-`" — that string
  sits inside the `# SUPERSEDED 2026-08-24 — do NOT mint a throwaway worktree` comment block, i.e.
  it is a tombstone, not a live instruction. Not a defect; no action.

- **[MEASURED] Path resolution across all 5 bootstraps + DOCTRINE + STATION-CAPABILITIES + all 6
  station docs: 169 refs checked, 164 resolve, 4 dangling.**
  ⚠️ **Second instrument lie, same run.** My first regex ordered the extension alternation
  `…|json|…` *after* `js` and `tsx` after `ts`, so it truncated real filenames and reported **9**
  dangling — five of them phantom (`sot-refs-baseline.js`, `metadata-catalog.js`,
  `relationship-map.js`, `sweep-rotation.js`, `SettingsShell.ts` — all exist with the longer
  extension). Longest-first alternation gives the true count of **4**. Controls run alongside:
  `sot-refs-baseline.json exists=true`, `SettingsShell.tsx exists=true`,
  `docs/pipeline/NO-SUCH-FILE.md exists=false`, and `git ls-tree -r origin/main --
  docs/qa/sot-refs-baseline.json` returned the path (so a git "ABSENT" below is a real absence,
  not a broken binary — DOCTRINE §9.5).

- **[MEASURED] All 5 bootstraps are one shared template.** `Compare-Object` against
  `04-scanner/SKILL.md` returns exactly **16 differing lines (8 per side)** for each of the other
  four, and those 8 are only the station name, lane sentence, cadence, doc path and blob URL.
  **Anything wrong in the shared body is wrong five times and is one fix.**

- **[MEASURED] Board is quiet and consistent with the standing OAuth brake.** `ARMED=0`
  (`pr-*-ready.md` at depth 1), `gh pr list --state open --json number` → `[]` (raw string read,
  not a `.Count`), no `docs/qa/.qa-run.lock`.

- **[MEASURED] `CDN lags` / `raw CDN` is absent from `sot/` (0 hits) — with a positive control**:
  the same pattern returns **2 hits** across `docs/pipeline/`, both in `STATION-CAPABILITIES.md:39`
  where it is recorded as disproved. The grep can match; `sot/` is genuinely clean. (My first
  attempt used `CLAUDE.md` as the control, which also returns 0 and therefore proved nothing —
  discarded.)

- **[MEASURED] Untracked in the queue root, for 00's awareness, no action taken:**
  `docs/pr-prompts/pr-doctrine-s9-four-false-traps-LOOPING.md`. Suffix is `-LOOPING`, not
  `-ready`, so it matches no watcher glob and is not armed. Also untracked: `.arming-log.txt`,
  `.queue-sync-ledger.txt(.bak)`, `queue-watch-state.md`, two `docs/pr-reviews/pr-134x-review.md`.
  The 19 untracked twins that blocked the dev-tree ff at 20:09Z are **gone**; that cure held.

- **[INFERRED] `metadata-catalog.json` shows ` M` in `git status`.** Standing note says this is a
  pure CRLF stat artifact. I did not touch it and did not re-measure it — out of this sweep.

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json` — advanced.** `next-sweep.mjs --advance --utc
   2026-08-29T22:11:25Z`, exit 0, `advanced: last_index=3 last_run_utc=2026-08-29T22:11:25Z`.
   Read back via `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`.
   **The dev-tree index was EMPTY before I ran this** (`git diff --cached --name-status` printed
   nothing), so nothing of another chat's is entangled with it.
   🔴 **This file and this breadcrumb both need Station 00 to commit them into its next board PR.**
   If they are not committed, the next Station 04 run repeats `instruction-drift` and the rotation
   silently stops — the same way #1395 had to carry the previous advance.

2. **This breadcrumb**, written to the tracked path `docs/pr-prompts/` (untracked on disk until 00
   commits it). Nothing else. No prompt staged, armed, renamed, moved or deleted. No PR touched.

3. Two scratch scripts written to `C:\po-sup-fix-scripts\` (`scan-2210-instruction-drift.mjs`,
   `scan-2210-paths.mjs`). Outside the repo; nothing to commit.

## FINDINGS

### F1 — 🔴 All five scheduled bootstraps still carry a rule `origin/main` records as REFUTED, in their STOP paragraph — RE-CONFIRMED, and the fix has been waiting on one word since 10:13Z today

🔴 **This is NOT a new finding and I am not claiming it as one.** Station 00's 10:08Z run
(`project_supervisor_2026_08_29_1008_the_bootstraps_are_writable.md`, #1391) and Station 04's
06:10Z run both recorded it. **What is new is (a) a decisive live counter-example, (b) that it is
still unfixed ~12 h after the fix was written, and (c) that it is still true 4 days after the 06:10Z
run named the bootstraps "the only stale layer."**

**Evidence.** Line 25 of every one of the five files under `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`
reads:

> "If this station appears in the scheduled-task listing, it is cloud-fired and structurally cannot
> reach the box. That is Marco's to fix, not yours to work around."

`STATION-CAPABILITIES.md` §2 — byte-identical to `origin/main`, verified above — says of exactly
this rule: *"That is REFUTED, in both directions… Blindness is intermittent… its cause is not
known. The listing predicts nothing, in either direction."* `04-scanner.md` repeats the refutation
and adds *"There is no diagnostic short of trying."*

**This run is the counter-example, measured.** `list_scheduled_tasks` returns
`taskId: "04-scanner"`, `lastRunAt: 2026-08-29T22:10:25Z` — **this run** — and this run reached the
box (PID 29316). The station appeared in the listing **and** was not blind. The document telling
the agent otherwise is the document the agent was handed first.

**Why it matters, precisely.** It is not a stale footnote; it is the second half of the **STOP**
instruction. An agent that trusts it can (a) abort a run that would have worked, or (b) report
"blind, cloud-fired" without ever calling `start_process` — and DOCTRINE's own warning is that *a
blind run and a healthy quiet run both produce "no news."* That failure is invisible downstream.

**Blast radius: 5 files, 1 shared template, 1 edit** (measured: 16 differing lines between any two
bootstraps, none of them this one).

**A second false claim rides in the same file.** Line 84 of all five: *"Never `docs/qa/` -
gitignored at `.gitignore:107`."* The `docs/qa/` **directory is tracked** — `sot-refs-baseline.json`
lives there and CI ratchets against it — and `04-scanner.md` says so explicitly: *"it is those five
files, not the folder, that swallow findings."* The repo half of this correction landed in #1383;
the bootstrap half never did. Same file, same paste, no extra work.

🔴 **CORRECTION TO MY OWN FIRST WRITE-UP OF THIS FINDING, made before this breadcrumb was
committed.** I initially wrote that `fix-station-bootstraps.mjs` "does not exist", having searched
only `scripts/pipeline/*station*` (which returns `lint-station.mjs` only). **That was a wrong
negative from a too-narrow instrument** — §9.6, an empty result is not an empty world. The script
**exists at `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`, 4405 bytes, mtime
2026-08-29T10:13:19Z**, written and dry-run-proven by 00's 10:08Z run, which recorded *"DO NOT
RE-AUTHOR IT"*. Do not re-author it.

**So the honest shape of this escalation is not "needs a fix" — the fix is written and has been
sitting on a one-word yes/no for ~12 hours**, while every station run in that window was handed the
refuted STOP rule. **Why I am not running it myself:** the bootstraps sit outside the repo, so no
repo PR reaches them; `STATION-CAPABILITIES.md` §1 names their only editor as *"Marco, by pasting"*;
I am 04, read-only on the board; and 00 has already put the exact question to Marco. Fold this in —
do not open a third escalation.

**Options for Marco (RULE 1 — complete-and-additive first):**

- **(A) COMPLETE + ADDITIVE — passes both halves.** Delete the refuted sentence from the shared
  template and re-paste all five; **and** check the canonical bootstrap text into the repo at
  `docs/pipeline/bootstraps/<station>.md`, with each station's PREFLIGHT step 2 hashing the
  bootstrap it was actually served against that canonical copy and reporting any difference as a
  finding. Fixes it now, and every future paste-drift is caught by the next run of *any* station.
  Purely additive — new tracked files plus one read-only check; touches no data entry.
  *Note the design constraint honestly:* CI cannot see `C:\Users\Marco\Claude\Scheduled`, so this
  guard has to live in the station preflight, not in `pr-gates`. That is what makes it durable
  rather than a one-off correction.
- **(B) Re-paste the five, no guard.** Fixes it immediately; fails the *future* half of RULE 1 —
  this is the same drift that `STATION-CAPABILITIES.md` §1 already recorded once ("four account
  skills carried advice this pipeline had already disproved"), so leaving it ungated is choosing
  to find it again by hand.
- **(C) Say yes to 00's existing question — let 00 run `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`.**
  Fastest by far; the script is written and dry-run-proven, and it fixes both false claims (L25 and
  L84) in one pass. Fails neither RULE-1 half on content, and it is reversible (five text files,
  backed up). It is an **authorisation grant**, which is why it is Marco's to give — but note it is
  the *same* grant already pending, not a new one. **(C) then (A) is the strongest combination:
  unblock today, guard it tomorrow.**

**DISPOSITION: ESCALATED**

### F2 — 🔴 `docs/pr-prompts/AWAITING-MARCO-DECISION.md` has never existed, and it is Station 02's escalation channel

**Evidence.** `02-board-driver.md:249` — *"Escalate = leave open, write
`docs/pr-prompts/needs-marco/pr-{n}-{reason}.md`, and list it on `AWAITING-MARCO-DECISION.md`"* —
and `:311` rule 6c — *"Overwrite `docs/pr-prompts/AWAITING-MARCO-DECISION.md` each run… If empty,
write 'None…'"*. The file is **ABSENT from `origin/main`** (`git ls-tree -r origin/main --
docs/pr-prompts/AWAITING-MARCO-DECISION.md` → empty, with the positive control above proving the
query works) and **absent from disk**. It is **not gitignored** (`git check-ignore -v` →
not-ignored), so absence is real absence, not the `docs/qa/` invisibility trap.

**Shape of the defect.** This is the `qa-findings.md` failure class: a documented channel by which
a station tells Marco a PR needs him, which has never carried a byte. 02 is dispatch-only and its
scheduled file has not been touched since 2026-07-14, so this has cost nothing *yet* — but the
instruction is live and the next dispatched 02 run will write to a sink no one reads.
Two coherent fixes, and choosing between them is a design call, not a measurement:
either create and track the file, or delete rule 6c and let `needs-marco/` be the single channel
(consistent with DOCTRINE §5b: *"`needs-marco/` IS THE ONLY REAL STOP"*). I lean to the latter —
one stop beats two, by 02's own doctrine — but 02's doc is not mine to rewrite.

**DISPOSITION: DISPATCHED** — to Station 06 (PR Master), which stages doc work; 00 to confirm the
direction if 06 wants a ruling. Not escalated: this needs a station with authoring authority, not
Marco.

### F3 — ⚠️ Station 00 retired `triage-state.md`; Station 03 still depends on it in five places

**Evidence.** `00-supervisor.md:371` — *"~~docs/pr-prompts/triage-state.md~~ - REMOVED: this file
does not exist on main (checked 2026-08-24)."* Meanwhile `03-machine-minder.md` names it at
`:167, :176, :177, :180, :184` as a live state file it must diff against, record known-patterns
in, **park usage-limit batches in** ("limit-parked until `<time>`"), and append a run block to,
keeping a "## For Marco" section at the top. Confirmed absent from `origin/main` and from disk;
not gitignored.

**Why this is more than a broken link.** 03's usage-limit recovery logic is *stateful across runs*
— it decides whether to restage a canary based on whether the previous run limit-failed. That
state has no store. 03's instruction says "create if absent", so it would create an untracked
local file; 00 has formally declared the file non-existent and will never read it. So 03's
handover to Marco lands somewhere 00 has decided is not real. 03 last ran 2026-08-28T23:01Z and is
next due ~2026-08-29T23:00Z, i.e. **within the hour** — so this is worth closing before it is
exercised, though nothing is on fire today.

**DISPOSITION: DISPATCHED** — to Station 06, same PR as F2 (both are `docs/pipeline/stations/*`
edits, no `sot/`, so no CP-24 exposure). 00 to arbitrate which side wins: restore a tracked
`triage-state.md`, or strip 03's five references and give it a durable store 00 agrees to read.

### F4 — ⚠️ The Cowork project-instruction block still carries advice `sot/` removed as disproved

**Evidence.** The project instructions inlined into this session say *"Use web_fetch on that blob
URL (the raw CDN lags)."* `STATION-CAPABILITIES.md:39` records that exact string as *"advice this
pipeline had already disproved and removed from `sot/` in PRs #1298/#1299."* Measured: **0 hits**
for `CDN lags|raw CDN` across `sot/`, against a **positive control of 2 hits** in
`docs/pipeline/` — so the removal is real and this is a sixth surviving copy, in a layer only
Marco edits. Low cost today (the advice is merely unnecessary, not harmful), but it is the same
class as F1 and should ride along with whatever F1 resolves to.

**DISPOSITION: ESCALATED** — bundle with F1; do not spend a separate cycle on it.

### F5 — 🟢 `docs/qa/qa-github-audit.md` and `Master-QA-and-Consolidation-Program-Plan.md` — checked, not defects

Both surfaced as dangling and both are **already correctly handled in `04-scanner.md`**:
the Program Plan is an explicit tombstone (*"deleted in the 2026-08-17 cleanup and never
restored… the old instruction was an unrunnable rebuild from a file that does not exist"*), and
`qa-github-audit.md` is a self-creating marker (*"create if absent"*). Recording them so the next
instruction-drift sweep does not re-file them as new. **This is the model the other three should
follow:** a retired path documented in place costs one line and stops recurring.

**DISPOSITION: DEFERRED** — would become urgent only if a run ever reports the Program Plan as a
readable source, which would mean something recreated it.

### F6 — 🟡 Status of the three items dispatched to Station 06, measured rather than assumed

The 18:10Z run's headline was *"the dispatches are not closing."* Checking them is cheap and in
lane, so I did — and the answer is **not** the pessimistic one, but it is not "done" either.

| # | Dispatched item | Measured status |
|---|---|---|
| 1 | canonical `station-contract v1` block should name **where** the breadcrumb is written | 🔴 **NOT LANDED.** `disposable worktree` → **0 hits** in `04-scanner.md`; positive control `END-CANONICAL-BLOCK` → 1 hit, so the grep works. |
| 2 | `check-sot-refs.mjs` `exempt=` bucket | 🟡 **HALF LANDED — and this is the one worth knowing.** The mechanism shipped (`exempt` appears 18× in the script) and the run is green: `total=274 dangling=0 exempt=0 baselined=17 excluded=2`, exit 0. But **`exempt=0`** — the bucket is **built and empty**. Baseline went 23 → 17 by burn-down, not by bucketing, so **the 8 gitignored-by-design refs are still counted as baselined** and the floor-of-8 problem is intact inside the 17. Whoever picks this up: the remaining work is *populating* the bucket, not building it. |
| 3 | `check-breadcrumb.mjs` `git ls-files` → `git ls-tree -r origin/main` | 🟢 **LANDED.** `:90` now probes **both** — `git ls-tree -r --name-only origin/main -- <DIR>` and `git ls-files <DIR>` — with the DOCTRINE §9.2 `-r`-is-mandatory rationale in a comment at `:85`. |

**On the `NAME_RE` half of item 3, I am deliberately not calling it:** `:40` reads
`/^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/`. It matches my filename,
and this run checked **106** breadcrumbs where 20:09Z checked 98 — but I cannot tell from a count
alone whether the extra 8 are newly-widened matches or simply new files, and I did not enumerate
the six that were reported hidden. **[CANNOT MEASURE] with what I ran** — recorded as a lead, not
a finding, exactly so the next reader does not inherit a guess.

**DISPOSITION: DISPATCHED** — back to Station 06 with item 2 re-specified (populate the bucket) and
item 1 unchanged; item 3's `ls-tree` half closed with thanks.

## WHAT I DID NOT DO

- **Did not touch the five bootstrap files.** Physically possible (Desktop Commander is
  unrestricted) and deliberately not done — F1 is an authorisation question with an escalation
  already open on it.
- **Did not commit anything.** 04 cannot create a PR (authority matrix). `sweep-rotation.json` and
  this breadcrumb are left in the working tree for 00.
- **Did not run PART 0 / PART 1 / PART 2 of the station brief** (static cross-layer audit, GitHub
  reconciliation, live-site visual patrol). The station doc's newer contract binds over the older
  brief: *"Take ONE named sweep this run and cover it completely… which one is NOT your choice."*
  `next-sweep.mjs` assigned **instruction-drift**; a shallow pass over everything is the failure
  that contract exists to prevent. `gate-liveness`, `instrument-honesty` and `repo-hygiene` were
  covered by the 14:09/18:10 runs and rotate back around.
- **Did not re-measure the OAuth brake, the watcher process, or the dev-tree ff.** All are 00's
  20:09Z readings from ~2 h ago and outside this sweep; I did not re-verify them and am not
  restating them as current. `ARMED=0` / `OPEN=0` above are my own fresh measurements, not 00's.
- **Did not "fix" ` M docs/data-model/metadata-catalog.json`.** Standing note says it is a CRLF
  stat artifact.
- **Did not clear the `[STALE]` escalation files** `status-sweep.ps1` listed (references to #1337,
  #1340, #1342–#1344, #1158, #727 — all settled). Clearing them mutates the board; that is 00's.
  Reporting them here only so 00 sees the list is still growing.
