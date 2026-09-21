# Station 00 — Supervisor | 2026-09-21T15:09:23Z–2026-09-21T15:5xZ

## GROUND

```
UTC            2026-09-21T15:09:23Z
origin/main    524158cd  (at preflight; d39d5abb after this run merged #2052)
dev tree       main @ 524158cd  C:\ProjectOperations2
doc version    1          (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1          (scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (both `1`). No read-only downgrade — **full authority run.**

🟢 **SIGHTED RUN.** Stated in the first line for the same reason the predecessor stated the
opposite: a blind run and a healthy quiet run both produce "no news." Desktop Commander loaded on
the prescribed keyword `ToolSearch`, `start_process` shell `powershell.exe` returned a live shell
(PID 22728), and every measurement below was taken through it. **The 14:07Z occurrence was blind;
this one, one hour later on the same box, was not** — see F4.

**Freshness of the three binding documents was PROVED, not assumed.** PREFLIGHT step 2 requires
reading them from `git show origin/main:<path>` rather than the working copy. The sound form
(§9.1 — never a piped hash) was used instead, in the dev tree, after an explicit fetch:

```
git fetch origin                                                  -> 524158cd..d39d5abb later; 524158cd at preflight
git rev-parse --short origin/main                                 -> 524158cd
git rev-parse --short HEAD                                        -> 524158cd
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md   -> EMPTY
```

**EMPTY is the real answer**: the working copies are byte-identical to `origin/main`, so the
working-copy reads are sound. All three were then read **in full** — `00-supervisor.md` (1350
lines), `DOCTRINE.md` (2617 lines, §1 through §10.6), `STATION-CAPABILITIES.md` (545 lines).

**Device-bridge git guard installed FIRST, before any VM-side call, last line quoted verbatim as
the contract requires** (exit 0):

```
vm-git-guard installed at /sessions/sweet-stoic-hawking/.local/bin/git - refuses mounted paths
and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

**Install PASSED.** No `git` was run through the device bridge against the Windows `.git` at any
point in this run — every git call went through the Windows shell.

## WHAT I MEASURED

### The sweep, twice — once at preflight and again immediately before the merge

`[MEASURED]` `status-sweep.ps1` captured with `*>` and decoded `utf16le` in node (§9.3 — the
all-streams redirect is the same UTF-16LE trap as `>`, and the preflight's own cure walks into it):
`ENC=utf16le BYTES=157706`, ten sections present, exit 0. Section 0 positive controls both
`[LIVE]`: `gh CAN reach GitHub`, `node runs`. **No `[BROKEN]`.**

**§7 verdict, preflight 15:09:23Z:** `[LIVE] SAFE TO ACT`.
**§7 verdict, re-run at 15:1xZ immediately before the merge:** `[LIVE] SAFE TO ACT`, with
`index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`,
`no PR touched on GitHub in the last 2 min`. **BOARD DRIVING condition 3 was satisfied at the
moment of acting, not at the moment of reading** — `[LIVE]` means "true when measured", and the
merge followed the second reading by under two minutes.

🔴 **ZERO `[STALE]` escalation rows this run.** Section 5 returned only `[FILE]` rows of the form
*"cites #N (MERGED) as evidence — not its premise; does not clear the escalation"*, which is the
sweep explicitly declining to discharge. **There was no `needs-marco/` discharge work to do**, and I
did not manufacture any. (`needs-marco/` census: **63**, unchanged.)

### The board — six open PRs, and the lane verdict was RE-TAKEN, never carried forward

`[MEASURED]` §10.1 makes a lane verdict **non-monotonic and valid only as of the minute it was
taken**, so the predecessor's *"all four open PRs are Marco's"* was treated as a lead and re-run.
Step-1 probe: `Select-String -Path 'docs\pr-prompts\processed\pr-*.log' -Pattern 'PR #<n>\b'`
(prompt logs only, `rev-*` excluded per §9.5), NEGATIVE control `PR #999997` → **0**:

| PR | merge state | checks | labels | prompt-log hits | lane |
|---|---|---|---|---|---|
| **#2052** | CLEAN | 10 pass / 0 fail | — | **0** | second lane — **Station 05 `sot/` doc-reconcile** |
| #2051 | BLOCKED | 13 / 2 | `do-not-merge` | 2 | watcher — **`marco:true`** |
| #2049 | UNKNOWN | 15 / 0 | — | 1 | watcher — **`marco:true`** |
| #2047 | BLOCKED | 13 / 2 | `do-not-merge` | 2 | watcher — **`marco:true`** |
| #2044 | BLOCKED | 13 / 2 | `do-not-merge` | 2 | watcher — **`marco:true`** |
| #2042 | CLEAN | 15 / 0 | — | 3 | watcher — **`marco:true`** |

Every verdict line was cross-checked against **its own log's prompt**, per §10.1's
`PRNUMBER_SCRAPED_FROM_PROSE_V1` rule — a verdict is trustworthy only if the log carrying it also
carries that prompt's own opened-PR line for the same number. All five do, or (for #2049) the log
filename is the prompt's own slug and matches the head branch exactly. **None is a prose scrape.**
Verbatim, the two shapes:

```
[watcher] merge result for PR #2044: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
[watcher] merge result for PR #2042: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ClientQuotesPanel.tsx"}
```

🔴 **The three "RED" PRs are PARKED BY DESIGN, not work.** All three carry `do-not-merge`, and
13 pass / 2 fail is exactly the §9.4 signature: `approval-receipt-check.mjs` runs twice — as the
required check `Approval receipt (CP-26)` and as a step inside `PR gates — diff checks` — so one
label produces two reds. **Only Marco removes that label.** There is no agent-side action behind
them and I did not treat them as reds to chase.

### #2052 — the one PR on this board that is not Marco's, and the merge of it

`[MEASURED]` `gh pr view 2052 --json files` → exactly three paths: `sot/02-roadmap-and-status.md`,
`sot/04-data-model.md`, and 05's own breadcrumb under `docs/pr-prompts/`. **CP-24 clean by
construction** — `sot/` + `docs/` only, no `scripts/`, no `apps/`. Its body **names its lane in as
many words** — *"Lane: 05 → `sot/`"* — which is exactly what §10.1 step 3 requires for a station-lane
PR to be checkable by the next reader. `STATION-CAPABILITIES.md` §5: *"00 may merge docs-only and
`sot/`-only PRs, queue/staging PRs, and anything not watcher-routed."*

`[MEASURED]` `gh pr checks 2052` — 15 rows, **every one SUCCESS or SKIPPED**, zero pending. The
three `$Required` gates are present and SKIPPED by the changed-path filter, which is the correct
state for an `sot/`-only diff and satisfies §9.4's *"an absent gate is not a passed gate"* without
weakening it: they were not absent, they were correctly skipped.

**Merged through the sanctioned path only** — `Assert-SmokedOrEscalate` → `Merge-Pr`, never a raw
`gh pr merge`, never a hand `git merge`:

```
ASSERT_SMOKED=True
Merge-Pr -PR 2052  ->  True
```

**Independent read-back** (§1 — an action you did not verify did not happen):

```
gh pr view 2052 --json number,state,mergedAt,mergeCommit
  {"mergeCommit":{"oid":"d39d5abb54cd340b8810367f49bfd0889bdf0347"},
   "mergedAt":"2026-09-21T15:19:59Z","number":2052,"state":"MERGED"}
git fetch origin  ->  524158cd..d39d5abb  main -> origin/main
git log origin/main -1  ->  d39d5abb docs(sot): re-merge sot/04 generated section (297 models) …
```

**It reached `main`.** I did not stop at "auto-merge enabled"; `-Auto` was not used.

### COLLECT — two breadcrumbs since the last run, every finding dispositioned below

`[MEASURED]` `node scripts/pipeline/check-breadcrumb.mjs --freshness`, exit **0**, `CLEAN`:

```
structure: 4 checked, 0 malformed, 0 skipped as pre-contract
00  last 2026-09-21T14:07:00Z  1.1h ago  (cadence 2h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-21T00:21:00Z  14.9h ago  (cadence 24h)  ok
04  last 2026-09-21T14:10:00Z  1.1h ago  (cadence 4h)  ok
05  last 2026-09-21T14:11:00Z  1.1h ago  (cadence 24h)  ok
```

**No station is SILENT.** ⚠️ **But `ok` for `00` is a weaker statement than for any other row**, and
I am not reporting it as an all-clear: `check-breadcrumb.mjs` still carries `const CADENCE = { '00': 2, … }`
while the live cron is `5 * * * *`, so `00` cannot read SILENT until **three** consecutive missed
hourly runs. Crossed against the third instrument the contract requires — `list_scheduled_tasks` —
which the defect does not touch:

| task | cron | `lastRunAt` (UTC) | enabled |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | **2026-09-21T15:07:56Z** *(this run)* | true |
| `04-scanner` | `0 */4 * * *` | 2026-09-21T14:09:34Z | true |
| `05-sot-keeper` | `10 0 * * *` | 2026-09-21T14:10:40Z | true |
| `03-machine-minder` | `0 9 * * *` | 2026-09-21T00:20:35Z | true |
| `weekly-security-audit` | `30 7 * * 1` | 2026-09-06T21:32:44Z | **false** |

`lastRunAt` and newest breadcrumb are fresh and aligned for every enabled station. **Four enabled
tasks**, which is `STATION-CAPABILITIES.md` §1's 2026-09-15 correction still current.

Both breadcrumbs since my predecessor's collect were read **in full**:
`00-00-supervisor-…-1407-…` (blind run, 4 findings) and `00-04-scanner-…-1410-…`
(instrument-honesty sweep, 4 findings). All eight carry a disposition below.

### Queue triage — 20 HOLDs, 0 armed, and the one genuine candidate is not mine to build

`[MEASURED]` `triage-holds.ps1`, exit 0. `HOLD=20, ready=0, LOOPING=0`. SPENT control **PASS**
(lint emitted exit 3 on the fixture, so the SPENT bucket is measurable and its emptiness is real).
`spent=0 gates-satisfied=4 still-gated=16 unreadable=0`.

Of the four gate-satisfied prompts, **three are duplicates of an open PR** and were confirmed, not
assumed, on the §10.6 marker test rather than the head branch:
`pr-crmvis-s8-comms-threads-HOLD` (3 of 3 vs **#2044**), `pr-lintstation-contract-version-compare-HOLD`
(9 of 9 vs **#2049**), `pr-permission-role-reconciler-HOLD` (7 of 7 vs **#2047**). §10.6's headline
— *the premise dies on MERGE, not on OPEN* — is precisely why all three still lint ADMIT while being
unarmable. **Arming any of them opens a second PR for work already open.**

The fourth, `pr-queue-layout-sot-entry-HOLD.md`, is a real candidate and is dispatched in F6.

### Station 04's `sweep-rotation.json` advance, and the consumed prompt

`[MEASURED]` `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2`. Station
04 advances it and may not commit it; **00 commits it**, and this PR does.
`[MEASURED]` `git diff --numstat origin/main -- docs/pr-prompts/pr-ops-m2b-tipping-tab-reminder-HOLD.md`
→ `0 140` — the watcher consumed it building **#2051** and the deletion had not been landed. This
was checked against `origin/main`, not from `git status`, per §9.2's behind-HEAD bullet.
`[MEASURED]` `git diff --cached --name-status` → **EMPTY** before every commit: no other chat had
anything staged in the shared dev-tree index.

## WHAT CHANGED

**One merge, one PR opened, three documents edited, nothing armed.**

1. **#2052 MERGED** — `d39d5abb`, `2026-09-21T15:19:59Z`, read back MERGED and confirmed on
   `origin/main`. Station 05's `sot/` doc-reconcile.
2. **A board PR opened from a clean isolated worktree off `origin/main` `d39d5abb`**
   (`C:\po-wt\board-20260921-1509`, branch `docs/station00-collect-2026-09-21-1509`), carrying:
   - `docs/pipeline/DOCTRINE.md` — §9.3 new bullet (04's F3), §9.5 correction (04's F1 and F4), and
     §8.5's last first-class raw line citation converted to a symbol anchor.
   - `docs/pipeline/stations/_canonical-blocks.json` — `instruments` sha re-recorded
     `4ec846e680a7bed0` → `10ec46a02e70a2b3` via `lint-station.mjs --write-canonical`.
     ⚠️ **Control that the re-record blessed only my edit:** `station-contract` came back
     `954c7f49160daa71`, **byte-identical to before**. Nothing else was silently blessed.
   - `docs/pipeline/sweep-rotation.json` — Station 04's advance, committed on its behalf.
   - the two untracked breadcrumbs (00's 14:07Z, 04's 14:10Z) and **this one**.
   - the deletion of `docs/pr-prompts/pr-ops-m2b-tipping-tab-reminder-HOLD.md`, consumed by #2051.
3. **Every DOCTRINE edit asserted its own BYTE DELTA**, per §9.3's node trap — no replacement
   *string* was passed to `String.replace` anywhere; every edit is slice-concatenation:

   ```
   splice before "## 9.4 GitHub"                                    -> +2280 bytes
   splice after  "…Found by Station 04 2026-09-21T00:0xZ (F2)…"     -> +5379 bytes
   swap          "`index.mjs:3545` calls"                           ->   +26 bytes
   BYTES 206579 -> 214264  (delta 7685 == 2280 + 5379 + 26)
   ```

   **Exact.** A read-back that only looks for what you wrote cannot see what you spilled; this one
   can. Each anchor was also asserted **unique** before splicing.
4. **`node scripts/pipeline/lint-station.mjs` → exit 0, `ADMIT: all 8 docs clean`** after the edit.
5. **`node scripts/pipeline/check-breadcrumb.mjs` → exit 0** on this breadcrumb. `lint-prompt.mjs`
   was **not** run on it and would be meaningless in either direction (§ REPORT CONTRACT).

**Nothing else.** No prompt armed, disarmed, renamed, moved or staged. No `do-not-merge` label added
or removed. No `sot/` file edited by me. No watcher restart. No production data. No Azure / Entra /
SharePoint surface touched. No commit on `main` in the dev tree.

## FINDINGS

### F1 — The prescribed citation regex matches CLOCK TIMES, so the gate Marco is being asked to build is born crying wolf (S3)

`CITATION_REGEX_MATCHES_TIMESTAMPS_V1` · `CITATION_PREDICTION_OMITS_FOUR_STATION_DOCS_V1`

Station 04's F1 and F4, dispatched to me. `[MEASURED]` by 04 at `524158cd`: the dotfile-tolerant
regex §9.5 prescribes matches `2026-09-06T23:04` and `14:10` as citations, because `2026-09-06T23`
and `14` both satisfy `[A-Za-z0-9_.\-/]+`. Whole corpus: extension-keyed **17**, dotfile-tolerant
**136**. `DOCTRINE.md` alone: **88**, of which **56** are clock times. Negative control, fresh needle
→ 0 files; positive control, 13 files carry a real `.gitignore:<N>`.

This is not cosmetic: `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` **ITEM
2** asks Marco for a `lint-station.mjs` check built from that exact regex, and a gate that fails
scores of times on its first run is disabled by its first reader — leaving the class it exists to
catch no better protected than today. 04 additionally found the per-document prediction omits `01`,
`02`, `06`, the four bootstraps and one first-class raw citation in `DOCTRINE.md` itself, so a run
rebuilding the probe has this very subsection's *"if a NEW raw line citation ever appears"* sentence
to hand and re-opens closed work.

**DISPOSITION: ACTIONED.** Landed in this PR. The tightened regex (a `/`-or-`.` requirement plus a
`(?<!\d{2})(?<!T\d)` guard) is written into §9.5 with both real classes shown surviving it
(`.gitignore:28`, `start-watcher.ps1:160`); the prediction is restated as a claim about **truth**
rather than about **counts**, which cannot rot when a document joins the corpus; and `index.mjs:3545`
in §8.5 is converted to its `fsWatch(PROMPT_DIR` symbol anchor, which discharges it permanently.
**Verified:** the byte-delta assertion above, `lint-station.mjs` exit 0, canonical sha re-recorded
with `station-contract` proved unchanged. ⚠️ Marco still needs ITEM 2's text amended before he
builds the check — carried in F3.

### F2 — `Select-Object -ExpandProperty Filename -Unique` collapses a same-named corpus to one, at exit 0 (S3)

`FILENAME_UNIQUE_COLLAPSES_SAME_NAMED_CORPUS_V1`

Station 04's F3, dispatched to me. `Select-String`'s `Filename` is the **basename**. Over
`C:\Users\Marco\Claude\Scheduled\**\SKILL.md` — 11 files, every one named `SKILL.md` — the failing
form answers **1** where the truth is **7**, at exit 0, nothing empty and nothing warning, so §9.6
cannot fire. It fired live on §9.1's own double-backslash probe, whose available write-up was *"only
one bootstrap still names the working copy"* — a false drift finding against four healthy files,
caught only because node counted per path and answered 3 in each of four.

**DISPOSITION: ACTIONED.** Landed in this PR as a new §9.3 bullet with the four-row table as its
falsifying probe and the cure stated positively (`-ExpandProperty Path -Unique`, never `Filename`,
wherever a corpus can hold repeated basenames). **Verified** by the same byte-delta and lint checks
as F1.

### F3 — `.gitignore:107-111` is still wrong in all four enabled bootstraps, 15 days on, and it is now two pastes not one (S3)

Station 04's F2, carried. `[MEASURED]` by 04 at `524158cd`: `.gitignore` 107-111 are
`Claude Design` rules; the five Overnight-QA sinks moved to **115-119** (net +8, cause #1573/#1576).
The stale citation sits in all four enabled bootstraps — **including the one that opened this run**,
which told me *"Never one of the five gitignored sinks named at `.gitignore:107-111`"*. Every
repo-side citation resolves correctly; only the bootstraps do not, and the bootstrap layer is the
one an agent cannot edit.

**DISPOSITION: ESCALATED** — Marco. Not a new question; a **merged** one. The open file is
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, and F1 has now changed what
its ITEM 2 should say. Options, complete-and-additive first (RULE 1):

- **(A) Paste both at once: ITEM 1's corrected sinks citation into the four enabled bootstraps, and
  ITEM 2's regex replaced by the tightened form now in §9.5.** *Complete and additive* — it fixes
  the live stale citation **and** stops the gate being born broken, it destroys nothing, and it is a
  single sitting. Passes both halves. **Recommended.**
- **(B) Paste ITEM 1 only and leave ITEM 2 as written.** Fixes the immediate half, fails the future
  half: the check then ships against the un-tightened regex and is disabled by its first reader.
- **(C) Drop the line-number citation from the bootstraps entirely and name the five files inline.**
  Additive and it cannot rot — but it fails the future half for every *other* citation class, and it
  abandons the gate that would have caught this one. Worth doing **as well as** (A), never instead.

### F4 — Station 00 went blind at 14:07Z and sighted at 15:07Z on the same box, one hour apart (S2)

Carried from my predecessor's F1 and **advanced by one measurement, not merely repeated**: this run
is the sighted half of the pair. `[MEASURED]` `lastRunAt` shows both occurrences fired
(`14:07:55Z`, `15:07:56Z`); the 14:07Z run recorded Desktop Commander absent at `CONNECT_TIMEOUT`
after the prescribed keyword load returned zero tools, and this run loaded it on the first try. With
04's record of blind 00 runs at 07:10Z and 10:09Z, that is **at least three blind occurrences inside
nine hours, interleaved with sighted ones on the same machine** — `STATION-CAPABILITIES.md` §2's
*intermittent, cause unknown*, and the scheduler is demonstrably healthy either way.

The cost is specific rather than general: **00 is the only channel that closes a finding**, so every
blind occurrence is an hour in which F3, F5 and F6 below cannot move.

**DISPOSITION: ESCALATED** — Marco, carried unchanged. The question is not *"did a run go blind"*
(measured) but **which half do you want fixed**, since the cause is unknown and the rate is now
material:

- **(A) Make blindness self-reporting and self-retrying** — have the bootstrap retry the Desktop
  Commander load a few times across the first minute before declaring blind, and emit a
  machine-countable marker either way. *Complete and additive*: it recovers the occurrences where
  the server is merely slow to answer a 30 s timeout, changes nothing when the shell is present,
  destroys nothing, and makes the rate **countable** — which is the precondition for diagnosing a
  cause nobody has. Passes both halves. **Recommended.**
- **(B) Diagnose the connect timeout directly.** Right target, fails the immediate half: unattributed
  after at least three occurrences, so there is nothing to act on today. Best done **after** (A).
- **(C) Accept it and rely on the next sighted run.** Cheapest; fails the future half outright, and
  it is the status quo that has left F6 unanswered for seven days.

### F5 — The two vanished arming-log rows have still not returned, and no new arm has been lost (S2)

Carried, and **re-measured sighted this run rather than quoted**. `[MEASURED]` in the dev tree:
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → **EMPTY**, i.e. disk and
`origin/main` agree exactly; the newest row is still
`2026-09-21T13:19:01Z ARMED pr-ops-m2b-tipping-tab-reminder`. The two rows the 13:08Z run found
missing — `permission-role-reconciler` and `lintstation-contract-version-compare` — are still absent,
and the predecessor's falsifying probe (*"if the row ever returns, this finding is wrong"*) has now
failed to falsify twice. **The benign reading is excluded on its own stated terms.** No *further*
rows have been lost, because no arm has happened since 13:19Z.

The cost stands unchanged: `.arming-log.txt` is the only clock that dates an arm, so **#2047 and
#2049 have no arm age at all** — not a stale one, none — and both §10.3's lane corroboration and
§9.5's kill-loop discriminator lose one of their two instruments on those PRs. I did **not**
reconstruct either row: I never observed those bytes, and forging an audit row converts a visible
gap into an invisible fabrication.

**DISPOSITION: ESCALATED** — Marco, carried. **(A)** make `arm-prompt.ps1` commit its own row on a
branch, so the row is durable the moment it is written — complete and additive, and the only option
that closes the loop; it is a `scripts/` change and therefore **yours to merge, not a station's**.
**(B)** a discipline in a document fails the future half (the last two rows were lost *with* the
discipline in place). **(C)** relying on `processed/*.log` fails the immediate half — it dates the
build, not the arm.

### F6 — `pr-queue-layout-sot-entry-HOLD.md` is gate-cleared and armable, and arming it would put Station 01 inside `sot/` (S3)

`[MEASURED]` `triage-holds.ps1` lists it under **GATES SATISFIED**, un-annotated — the only one of
the four that is not a duplicate of an open PR. Its front matter: `premise: '! grep -rq "QUEUE_LAYOUT_V1" sot/'`,
`scope: [sot/02-roadmap-and-status.md]`, `escalates: false`, `station: '05'`,
`requires_on_main: 'docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1'` — released. Its body says, in
as many words, **"Station 05 only. `sot/` belongs to the SoT Keeper and to nobody else."**

🔴 **So the arming decision and the authority decision point in opposite directions, and the linter
cannot see it.** `lint-prompt.mjs` ADMITs it — that is a statement about the premise, not about the
lane. Arming a `-ready.md` hands it to the **watcher**, which builds with Station 01, whose authority
row for *Edit `/sot/`* is **❌**. This is exactly §9.5's *"ADMIT is NECESSARY, NOT SUFFICIENT — a
prose human gate is invisible to the linter"*, with the prose gate being a lane assignment rather
than a stop.

**DISPOSITION: DISPATCHED — Station 05 (SoT Keeper).** 05 wakes daily (`10 0 * * *`, next
`2026-09-22T14:10Z`) and reads breadcrumbs, and it is the one station whose authority row for
`sot/` is ✅ and whose lane is gated in CI by CP-24. **What 05 should do:** execute
`pr-queue-layout-sot-entry-HOLD.md` directly as a doc-reconcile PR — the wording is fully specified
in the prompt body, its premise is live at `d39d5abb`, and its `done_when`
(`lint-station.mjs && grep -rq "QUEUE_LAYOUT_V1" sot/ && grep -rq "QUEUE-LAYOUT.md" sot/`) is
runnable as written — then retire the prompt to `superseded/` in the same PR. **I did not arm it**,
and the reason is in the prompt's own body rather than my judgement.

### F7 — Five of six open PRs are `marco:true`, and this is the throughput constraint, not a backlog (S2)

`[MEASURED]` this run, from the table above: of six open PRs, **five carry a live watcher
`marco:true` verdict** and three of those also carry `do-not-merge`. The sixth was #2052, which I
merged. **Armed prompts: 0. Gate-cleared HOLDs that are not duplicates: 1, and it is 05's.**

This is not a queue that faster arming would drain. Every PR touching anything outside `tests/` or
`docs/` stops at the same place by design, and RULE 2 forbids any station from clearing it. The
board therefore grows monotonically until Marco merges — which is why **I armed nothing this run**
even though the sweep said SAFE TO ACT and the interactive lane had been quiet since 13:19Z, more
than two full cadences. Adding a seventh Marco-blocked PR is motion, not progress.

**DISPOSITION: ESCALATED** — Marco, and it is one question with a number attached: **#2042, #2044,
#2047, #2049 and #2051 are all waiting only on you.** #2042 and #2049 are **green and CLEAN/UNKNOWN
with zero failing checks** and carry no label — they need a merge, nothing else. #2044, #2047 and
#2051 are green apart from the two CP-26 reds their own `do-not-merge` label creates, so **removing
the label is the entire remaining action** on each, and only you can do it. I am not asking which to
merge — that is your call — only noting that four of the five need no work from anyone before they
can move.

### F8 — The fv2 cluster question is SEVEN days old and is the oldest unanswered thing on this board (S2)

Carried from 04 and from three prior 00 runs, and **re-measured sighted at the new head** rather
than quoted. `[MEASURED]` at `origin/main` `d39d5abb`:
`git cat-file -e origin/main:apps/api/src/modules/forms/ai-form-import.service.ts` → **exit 128,
`fatal: path … does not exist in 'origin/main'`**; POSITIVE control on
`apps/api/src/modules/forms/forms.service.ts` → **exit 0**. The gate file is genuinely absent and
the probe genuinely discriminates.

`pr-fv2-ai-digests-HOLD.md` is gated on that file; every prompt that could produce it sits in
`superseded/`; the gate cannot release, and it masks `pr-fv2-output-channels-HOLD.md` behind it.
Both are still among the 20 HOLDs at depth 1, and both are in the `still-gated=16` bucket, so
`triage-holds.ps1` will keep reporting them as blocked for as long as nothing decides them.

**DISPOSITION: ESCALATED** — Marco. One question, unchanged since 2026-09-15: **is the fv2
AI-import / digests / output-channels cluster still wanted?**

- **(A) Retire all three to `superseded/` in a board PR.** *Complete and additive* — it ends the
  masking, destroys nothing (retiring is a move, never a delete), is recoverable in one command, and
  leaves the decision reversible if the cluster is revived. Passes both halves. **Recommended.**
- **(B) Re-stage a producer for `ai-form-import.service.ts` and leave both gates as they are.**
  Complete *only if* the cluster is genuinely wanted; fails the immediate half either way, because
  the masking survives until the producer merges.
- **(C) Repoint the gate at a file that already exists.** Fails the future half outright — it arms a
  prompt against the very question being asked, and buries the question where the next reader will
  not find it. **Not recommended.**

## WHAT I DID NOT DO

- **Merged nothing but #2052.** The other five open PRs all carry a live, cross-checked watcher
  `marco:true` verdict, and RULE 2 binds absolutely — *"not overridden by green, unlabelled, or a
  verified diff — only by an explicit instruction from Marco naming that PR."* #2042 and #2049 are
  green, clean and unlabelled, and I still did not merge them, because "green" is not the gate.
- **Removed no `do-not-merge` label, from #2044, #2047 or #2051 or any other PR.** Only Marco does.
  I also did not treat their two CP-26 reds as failures to chase (§9.4 — `[LABEL_PRESENT]` is parked
  by design), and I did not enable auto-merge on anything.
- **Armed nothing** — 0 prompts, deliberately, for the two separate reasons in F6 and F7. Three of
  the four gate-cleared HOLDs are open-PR duplicates under §10.6; the fourth is Station 05's lane.
  I also did not stage the sweep's `ready=1` backlog item (`rates-11c-blocked-consumers`), which is
  06's to stage and carries a live never-arm denylist entry besides.
- **Did no 03/04/05 work.** The orphaned worktree `C:/PR-Master/worktrees/po-vg`
  (`fix/no-rebase-while-checks-run`, **dirty=1, age ~24,900 min — it holds uncommitted work and a
  `--force` prune would discard it**) and the registry escapee `C:\po-worktrees\po-fix-2005` are
  **Station 03's** and were left untouched, not even inspected for pruning. I ran no `sot/` edit —
  the `sot/` change that landed this run was 05's own PR, which I merged rather than authored.
- **Did not act on the sweep's `watcher clone: branch=main dirty=5` line.** It is a known false
  alarm (§9.5): that flag counts untracked files while `start-watcher.ps1` explicitly ignores them,
  and a tracked-dirty clone auto-stashes rather than refusing. Thirteen verbatim quotations of that
  line already sit in `archive/` as mis-routed dispatches; I did not add a fourteenth.
- **Ran no `git` against the Windows `.git` through the device bridge**, and installed the guard
  before any VM-side call rather than after. Used no `git checkout`, `checkout -- <path>`,
  `reset --hard`, `stash pop` or `git clean` anywhere, at any point, in any tree.
- **Touched git in the watcher clone only through `gh`.** `Merge-Pr` runs `gh pr merge` from
  `C:\po-watcher\ProjectOperations`, which is an API call; no `git checkout`, `merge`, `rebase`,
  `commit`, `push` or `pull` was run there.
- **Did not reconstruct the two missing arming-log rows** (F5), and did not discharge any
  `needs-marco/` file — the sweep tagged **zero** `[STALE]` rows this run, and discharging on
  anything weaker than that tag plus a per-PR `gh pr view --json state,mergedAt` re-ask is how a
  live escalation gets retired.
- **Wrote to no gitignored sink.** Nothing went to `docs/qa/qa-findings.md`, `qa-checklist.md`,
  `qa-test-data-registry.md`, `.qa-run.lock` or `qa-run-*.md`. This breadcrumb was written **inside
  this run's own PR worktree** — cure 1 of the station doc's post-merge fast-forward rule — so no
  untracked copy is left in the dev tree to block the next fast-forward.
- **Touched no Azure / Entra / SharePoint surface and wrote no production data.** No `az`, no
  `Connect-MgGraph`, no portal, no migration, no seed.
