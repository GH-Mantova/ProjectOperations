# Station 00 — Supervisor | 2026-09-03T20:09Z–2026-09-03T20:2xZ

## GROUND

```
UTC            2026-09-03T20:09:04Z
origin/main    054dccd4            (fetch --prune first, then rev-parse)
dev tree       main @ 054dccd4      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Versions agree — this run had full authority. **SIGHTED**, not blind: `start_process`
(`powershell.exe`) returned PID 30020 on the first attempt. The three binding docs were confirmed
identical between `HEAD` and `origin/main` (`git diff --stat HEAD origin/main -- <the three>` →
empty), so the working copies read this run are `origin/main`'s.

## WHAT I MEASURED

- **[MEASURED] Board — 4 open PRs, unchanged from the 19:09Z run.**
  `gh pr list --state open --json number,title,headRefName,labels,mergeStateStatus --limit 50`
  → `#1544` UNKNOWN `[]` · `#1543` CLEAN `[]` · `#1541` CLEAN `[]` · `#1536` BLOCKED `[do-not-merge]`.
- **[MEASURED] RULE 2, per PR, against the LIVE probe tree**
  (`C:\ProjectOperations2\docs\pr-prompts\processed`), matching `PR #<n>` in each log BODY:
  `#1536` ← `pr-wbsshift-s2-api-pricing-reads-shift-ready.md.log` **marco:true=True** ·
  `#1541` ← `pr-visualreview-s2-keep-the-screenshots-ready.md.log` **True** ·
  `#1543` ← `pr-visualreview-s3-design-ref-frontmatter-ready.md.log` **True** ·
  `#1544` → **NO LOG**. **Positive control on the method:** `#1552` — this station's own docs PR,
  merged 19:18:48Z and demonstrably not watcher-opened — also returns **NO LOG**, so `NO LOG` means
  *second lane* (DOCTRINE §10) and not *probe broken*.
  ⇒ `#1544` hand-classified by `classifyPolicyFiles`: `.claude/agents/**` and `scripts/pipeline/**`
  are both outside `^(tests|docs)/` ⇒ **MARCO'S**. Recorded `[NO LANE VERDICT — hand-classified]`.
  **All four PRs are Marco's. armed=0, merged=0, and that is correct.**
- 🔴 **[MEASURED] The RULE-2 probe directory resolves in TWO trees and the dead one passes the
  positive control.** See FINDING 1 — this is the run's substantive finding.
- **[MEASURED] Station 05 is NOT a stopped station — three instruments, crossed.**
  `check-breadcrumb.mjs --freshness` → `05 last 2026-09-01T14:11:00Z 54.0h ago (cadence 24h) SILENT`,
  exit 2. But `list_scheduled_tasks` → `05 lastRunAt 2026-09-03T14:11:26Z` (~6 h ago), and the
  session directory carries a matching `CreationTimeUtc` of `2026-09-03T14:11:26Z`. Reading the
  transcript names the cause outright: the first and only assistant turn is
  `API Error: 529 Overloaded`. Zero instructions ran, a breadcrumb was impossible, `lastRunAt`
  updated anyway. **Table row 2: "it started and died."** Do not report 05 as stopped.
- **[MEASURED] 05 has now lost TWO of its last three occurrences.** 09-02 fell inside the
  already-escalated 17.8 h all-stations hole — re-confirmed this run: the session directories for
  09-02 run `00:08:06Z … 06:10:27Z` and then jump to `23:58:18Z`, with nothing at 05's ~14:11 slot.
  09-03 was the 529 above. `nextRunAt` is `2026-09-04T14:10:37Z`.
- **[MEASURED] `/sot/` unkept for 53.6 h and rising.** `git log -1 --format=%cI origin/main -- sot/`
  → `2026-09-02T00:36:51+10:00` = `2026-09-01T14:36:51Z`. At 05's next fire that is **~71.6 h**.
- **[MEASURED] `03` next fires `2026-09-03T23:00:45Z`, ~2.9 h from this run.** `--freshness` prints
  `03 … 45.1h ago (cadence 24h) ok` while `lastRunAt` is `2026-09-01T23:01:43Z` — one whole missed
  occurrence hidden by the `2×` rule, exactly as escalation #23 describes. **A second consecutive
  miss tonight makes 03 genuinely stopped; that is the probe that falsifies this.**
- **[MEASURED] Machinery SAFE.** `status-sweep.ps1` §7 → `SAFE TO ACT: no board mutation in
  progress, no recent remote activity, no live station worktrees`. No `index.lock` in either tree.
  Watcher node `24744` up since `2026-09-03T08:55:05Z`. `git worktree list` → 4 (this run's own,
  plus the 3 known orphans).
- **[MEASURED] COLLECT: no new breadcrumbs since the 19:09Z run.** `--freshness` structure pass
  lists exactly two, `00-00-supervisor-…-1909-…` and `00-04-scanner-…-1810-…`, both already
  dispositioned last run. `structure: 2 checked, 0 malformed`.

## WHAT CHANGED

- **`docs/pipeline/DOCTRINE.md` §9.5** — added one bullet recording the dead-decoy trap, its two
  measured directory readings, and the two controls that separate them. Edited with node
  (`readFileSync`/`writeFileSync`, utf8) per §9.3, never PowerShell. Read back: `50830 → 52667`
  bytes, `U+FFFD` **0**, and the `â€` double-encoding signature **2 → 2** — i.e. the file's two
  pre-existing sequences survived untouched and I introduced none (baseline measured off
  `git show origin/main:docs/pipeline/DOCTRINE.md`, not off the working copy).
- **`docs/pipeline/stations/_canonical-blocks.json`** — re-recorded. The bullet lands inside the
  hash-gated `instruments v2` block, so `lint-station.mjs` correctly returned `REJECT: 1 of 8`
  first; `--write-canonical` then wrote `instruments v2 91f565a0fa8fdeb8` /
  `station-contract v2 73ad6cc7ef1a2dd5` and the lint returned clean. The `REJECT 1 of 8` is the
  expected shape for a §9-only edit and is not a defect.
- **This breadcrumb**, carried inside its own PR — the home the contract prefers, so nobody has to
  sweep it up.
- **Nothing else.** No arm, no merge, no label, no dispatch to the watcher, no `/sot/` edit.

## FINDINGS

### FINDING 1 — RULE 2's only probe has a dead decoy whose positive control passes, and it fails OPEN

`marco:true` in `docs/pr-prompts/processed/*.log` is the single live probe behind RULE 2 — the rule
that stops an agent merging a PR the watcher routed to Marco. That path resolves in two trees, and
this run measured both at `054dccd4`:

| tree | logs | newest log | `marco.:true` |
|---|---|---|---|
| `C:\ProjectOperations2\docs\pr-prompts\processed` | **1864** | `2026-09-03T17:20:00Z` | **606** |
| `C:\po-watcher\ProjectOperations\docs\pr-prompts\processed` | **21** | **`2026-08-17T14:28:09Z`** | **10** |

The clone's copy has not been written to in **seventeen days**. It is not empty, and that is the
whole problem: it answers `POS=10, NEG=0` — **it passes the positive/negative control the standing
rule mandates** — and then returns *no verdict* for every PR opened since 17 August. Probed against
today's board it reports that `#1536`, `#1541`, `#1543` and `#1544` carry no Marco routing, when
three of them demonstrably do. **RULE 2 fails OPEN, on the one gate whose entire job is to fail
closed.**

I reached the decoy myself, on this run, with a `Test-Path`-with-fallback that preferred the clone.
It is not a typo — it is a reasonable-looking path expression that silently selects the corpse, and
the mandated control does not catch it. What separates the two directories is **log age**, which no
existing instruction asks for.

**Cure, complete and additive** (RULE 1: fixes it now and in future, and removes no capability): pin
the tree in the doctrine every station reads, and add the age assertion and the second-lane control
that make the query self-checking. Also recorded: the log is keyed by **prompt name, not PR number**,
so the match must run over the log BODY for `PR #<n>` — a filename search returns a uniform zero,
which is how this run's first per-PR attempt produced four confident false negatives before the
`#1552` control exposed it.

**DISPOSITION: ACTIONED.** Written into DOCTRINE §9.5 and shipped in this run's PR; canonical hash
re-recorded; `lint-station.mjs` exits 0. Verified by re-running the per-PR probe against the live
tree, with `#1552` as the negative-lane control.

### FINDING 2 — a 529 on a daily station costs a full day, and 05 has now lost two of three

Station 05 fired at `2026-09-03T14:11:26Z` and died on `API Error: 529 Overloaded` on its first
assistant turn, before STEP 1. Combined with the 09-02 outage occurrence, `/sot/` will have gone
**~71.6 h** unkept by the time 05 next runs, and no instrument in the pipeline reports this as
anything but `SILENT` — a word that also means "the station is broken", which it is not.

This is the measured consequence half of open escalation **#23**, and it sharpens it: the existing
options there address *detection*. Nothing addresses *recovery*. A cron that does not retry means one
transient upstream error deletes 24 h of source-of-truth upkeep, silently, with no defect anywhere to
find. **Options for Marco, complete-and-additive first:**

- **(a) Give 05 a second daily occurrence** (e.g. a catch-up cron some hours after the first) whose
  first act is to exit as a NO-OP if a breadcrumb for the current day already exists. *Complete* — a
  single 529 can no longer cost a day — and *additive*: it adds a run, changes no existing behaviour,
  and touches no data. **This is the RULE-1 option.**
- **(b) Detect-only** — land the `#23` cadence fix so a lost occurrence is at least *reported*
  truthfully. Fails the *complete* half: it names the loss, it does not recover it.
- **(c) Do nothing** and accept that `/sot/` upkeep is best-effort. Fails *complete*; does not damage
  data, so it passes the second half.

⚠️ Caveat Marco should weigh against (a): `scheduled-tasks.json` is rewritten from memory when Claude
Desktop exits, so a schedule change made through the MCP may not survive a crash — which is how 00
came back enabled on 09-03. That argues for moving station scheduling somewhere durable rather than
adding a second entry to the same fragile store.

**DISPOSITION: ESCALATED** — amends `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`
(#23) with the recovery half. **Not discharged, and not a new escalation.**

### FINDING 3 — station 03's next occurrence is the falsifying probe for the #23 cadence claim

`03` reads `ok` at 45.1 h against a 24 h cadence while having missed its 09-02 occurrence outright.
It fires again at `2026-09-03T23:00:45Z`. If that occurrence also fails to produce a breadcrumb, 03
is genuinely stopped and the reading changes from "detector is blind" to "station is dead" — two very
different responses. **DISPOSITION: DEFERRED** — it becomes urgent at `2026-09-03T23:00:45Z` plus one
cadence. The 22:09Z and 00:0xZ supervisor runs should check it and say which it was.

### FINDING 4 — the board is fully human-gated and arming would make it worse

Four open PRs, four Marco's, verified per-PR above. `status-sweep.ps1` §6 states the constraint
exactly: *"the board grows monotonically until Marco merges. Arming faster makes the queue longer,
not shorter."* Compounding it, escalation #21's `tests-docs` deadlock means a watcher-opened docs-only
PR times out and is written `marco:true` byte-identically to a genuine routing — so arming even a
docs-only prompt manufactures a fifth Marco PR. **DISPOSITION: DEFERRED** — armed=0 is deliberate and
should stay 0 until Marco clears the board or #21 lands. Re-open the moment either happens.

## WHAT I DID NOT DO

- **Merged nothing, and armed nothing.** All four open PRs are Marco's under RULE 2 — three by live
  watcher verdict, `#1544` by hand-classification for want of one. RULE 2 is cleared by Marco in
  chat, for that batch only, and he was not present.
- **Did not arm `pr-lint-requires-merged-gate-unevaluated-HOLD.md`** (Station 04's still-open F2).
  It is `ADMIT (size 3)` and tracked on main, but arming it opens a `scripts/` PR — Marco's fifth
  queued PR. The question *"arm it, or leave it staged?"* stays banked for him, unchanged.
- **Did not change any station's schedule.** Adding 05's catch-up occurrence is FINDING 2's option
  (a) and it is a design decision — DOCTRINE §5.5 — so it goes to Marco as a question, not an act.
- **Did not clear the `[STALE]` escalation lines** `status-sweep.ps1` §5 flagged across
  `needs-marco/`. They live in Marco's own gitignored escalation files; editing his queue is not
  this station's call, and the sweep's own instruction is a recommendation to a human reader.
- **Did not re-derive DOCTRINE §10, the discharged #20/#18 threads, or 04's three dispositioned
  gate-liveness findings.** All are recorded as closed; re-deriving them bills a run to relearn
  something already written down.
