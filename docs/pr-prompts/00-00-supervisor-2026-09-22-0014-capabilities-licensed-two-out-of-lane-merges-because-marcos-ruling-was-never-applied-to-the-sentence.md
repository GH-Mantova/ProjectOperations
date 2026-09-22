# Station 00 — Supervisor | 2026-09-22T00:14Z–2026-09-22T00:55Z

## GROUND

```
UTC            2026-09-22T00:14:01Z
origin/main    845e4720              (fetched, then rev-parse)
dev tree       main @ 845e4720       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — this run was not read-only-gated.

**SIGHTED RUN.** Desktop Commander reached the host after the `ToolSearch` load (a validation error
is not blindness; only a failure *after* a successful load is). `start_process` shell
`powershell.exe` → PID 33456, `git rev-parse --abbrev-ref HEAD` → `main`. Not blind. Nothing below
is a GitHub-side substitute for a tree read.

**Preflight read-freshness.** The dev tree was **already at `origin/main`** —
`git rev-list --left-right --count HEAD...origin/main` → `0	0` — and all three binding documents
were proved byte-identical to `origin/main` before being read:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**, which is the real answer (PREFLIGHT step 2; no piped hash on either side, §9.1). Run in
the DEV TREE, never the watcher clone. All three read in full: `00-supervisor.md` 1516 lines,
`DOCTRINE.md` 2722, `STATION-CAPABILITIES.md` 544.

**Git-guard installer, quoted verbatim as the contract requires, pass or fail:**

```
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

It reported PASS. **It is still not in force** in the non-interactive `bash -c` transport a station
actually gets — measured three times across two stations; the fix is `#2065`, green and waiting on
Marco (F3). No `git` was run through the device bridge this run regardless: every `git` call went
through Desktop Commander on the Windows host.

## WHAT I MEASURED

**Sweep.** `scripts\pipeline\status-sweep.ps1`, captured to a file and decoded `utf16le` (§9.3 — the
`*>` redirection writes UTF-16LE, and the script hides its section 7 verdict if it is not captured),
completed `2026-09-22 00:19:30Z`. Section 0 instrument controls: `gh CAN reach GitHub (saw merged PR
#2067)` · `node runs` — **no `[BROKEN]`**. Section 7 verdict: **`SAFE TO ACT`**. Section 5 printed
**zero `[STALE]` rows**, so there were none of mine to discharge this run.

⚠️ The first invocation of `bring-up-to-speed.ps1` was piped through `Select-Object -Last 120`, which
buffers until exit and therefore **dropped the head of the report including its verdict**. It was
re-run as a file capture rather than quoted from. Recorded because a tail-pipe on a script whose
verdict is at the top reads as a complete report.

**Board, re-derived per PR from `gh` rather than quoted from the sweep** (§9.5's
`SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1` — provenance is not correctness), `-R` on every call,
`$LASTEXITCODE` tested before parsing, two fields minimum, never `number` alone (§9.4):

| PR | state | mergeState | labels | checks | files | lane | whose |
|---|---|---|---|---|---|---|---|
| `#2065` | OPEN | CLEAN | none | **15/15 SUCCESS** | `scripts/pipeline/vm-git-guard.sh` | 0 prompt-log hits | **Marco's** — outside `tests\|docs` |
| `#2061` | OPEN | **CLEAN** | **none — released 23:37:38Z** | **15/15 SUCCESS** | 15, incl. **2 migrations** | **1 hit ⇒ watcher-opened** | **Marco's** — live `marco:true` verdict |
| `#2059` | OPEN | CLEAN | none | **15/15 SUCCESS** | `scripts/pipeline/status-sweep.ps1` | 0 prompt-log hits | **Marco's** — outside `tests\|docs` |

Lane probe = `Select-String docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` (§10.1 step 1,
prompt logs only, `rev-*` excluded, live dev tree never the clone's stale decoy). **POSITIVE
control** `PR #2040` → **1** hit carrying a real `marco:true` verdict. **NEGATIVE control**, a
freshly minted needle `PR #999871` → **0**. Corpus **940** logs, newest
`pr-scopecards-s5-charge-steps-price-cutting-ready.md.log` at **2026-09-21T20:25:00Z**.

⚠️ **Freshness precondition, applied per PR rather than assumed** (§10.3's one-directional rule).
`#2059` was created `19:26:57Z`, **before** the newest prompt log, so its `0` is a valid second-lane
reading. `#2065` was created `22:24:11Z`, **after** it, so its `0` is `[CANNOT MEASURE]` for lane —
not proof of second lane. The disposition is unchanged either way: second lane ⇒ outside
`tests|docs` ⇒ Marco's; watcher lane ⇒ a `scripts/` diff `classifyPolicyFiles` refuses anyway.

**`#2061`'s verdict is REAL, not a prose scrape** (§10.1's `PRNUMBER_SCRAPED_FROM_PROSE_V1`). The
verdict line sits in the log of the prompt that built it and the three identifiers agree:

```
[pr-scopecards-s5-charge-steps-price-cutting-ready.md.log]
[watcher] merge result for PR #2061: {"ok":false,"marco":true,"fixLane":false,
                                      "reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

prompt slug `pr-scopecards-s5-charge-steps-price-cutting` · PR head `feat/scopecards-s5-charge-steps-price`
· `.arming-log.txt` arm `2026-09-21T19:31:53Z`, PR created `20:24:25Z` — **inside the window**. A
verdict appearing only in prose would satisfy none of those.

**`main` CI on `845e4720`: 4 success / 0 failed — trunk green**, with the 1 non-trunk run
(`Pipeline heartbeat`) excluded from the verdict, which is the scoping `#1852` landed.

**Watcher.** node pid **9744** RUNNING, auto-restart wrapper alive (1), heartbeat age **47 min**
against `armed: 0` — idle, **not wedged**; the heartbeat only ticks mid-run. Liveness taken from the
sweep's process table, never from `ps` across an OS boundary (§7 guard 4).

**Queue.** `armed: 0` · `-HOLD.md` **16** · `needs-marco/` 61 · `no-pr-opened/` 109 · `failed/` 59 ·
`blocked/` 150.

**Triage of the 16 HOLDs.** `scripts\pipeline\triage-holds.ps1`, READ-ONLY, exit 0:
**gates-satisfied = 0**, spent = 0 of 16, still-gated = 16, unreadable = 0. Reject codes:
`HUMAN_GATE_PRESENT` **11** · `FILE_GATE_NOT_RELEASED` **4** · `GATE_NOT_RELEASED` **1**.
**There is nothing to arm.** See F4 for why the script's own SUSPECT banner is a false alarm and how
that is now settled by an instrument the script runs itself.

**Breadcrumb freshness, and the cross-check the breadcrumb alone cannot do.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit **0**;
`structure: 1 checked, 0 malformed`. Crossed against `lastRunAt` from the scheduled-tasks MCP,
because `--freshness` compares breadcrumb dates and nothing else:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | `2026-09-22T00:14:01Z` (this run) | `2026-09-21T23:20Z` | aligned — one hourly cadence |
| `03` | `2026-09-21T23:02:53Z` | `23:04Z` | aligned |
| `04` | `2026-09-21T22:09:38Z` | `22:10Z` | aligned |
| `05` | `2026-09-21T14:10:40Z` | `14:11Z` | aligned |

**Both fresh and aligned on all four — healthy, nothing further.** No station is SILENT and none
shows the "fresh `lastRunAt`, no breadcrumb" shape that means a run started and died, so no
transcript read was needed. `weekly-security-audit` remains `enabled: false`, which **agrees with**
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction — the live enabled count is four, so there is
no drift to report there.

⚠️ **`00`'s freshness row is still the weak one and always will be until the `CADENCE` map is
fixed** — `check-breadcrumb.mjs` holds `'00': 2` against a live cron of `5 * * * *`, so `00` does
not read SILENT until three consecutive hourly runs are missed (STATION-CAPABILITIES §6). The
`lastRunAt` cross above is what actually covers it, and it is clean.

**COLLECT — the tracked set was asked, not the dev tree** (`git ls-tree -r origin/main`, matched by
basename, because a dev-tree `git status` answers about the dev tree). **Exactly one breadcrumb sits
at depth 1**, my own `…-2026-09-21-2320-…`, and it is **TRACKED** (landed by `#2067`), so it is not
an unreported finding and not an FF blocker. Every finding in it already carries a disposition, so
it is archived in this PR.

🔴 **There are NO new station breadcrumbs to collect this cycle.** Newest per station — `03` 23:04Z,
`04` 22:10Z, `05` 14:11Z — all **predate** my last run at 23:20Z and were dispositioned and archived
by it or by `#2066`. This is stated rather than left as silence, because a collect run that found
nothing and a collect run that did not look produce the same empty section.

## WHAT CHANGED

1. **`docs/pipeline/STATION-CAPABILITIES.md` §5 narrowed** — the clause *"and anything not
   watcher-routed"* removed and replaced with the measured correction
   `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`. Edited with **node**, never PowerShell
   (§9.3), by **concatenation** and never a replacement string (`$` in a replacement is a
   substitution pattern), with the byte delta asserted on both passes:
   `actual=2221 expected=2221 MATCH=true` and `actual=3 expected=3 MATCH=true`. Read-backs:
   `oldGone=true` · `markerPresent=true` · `bareLF=0` (571 LF, 571 CRLF — no mixed-EOL left behind)
   · `node scripts/pipeline/lint-station.mjs` → **ADMIT: all 8 docs clean, exit 0**.
2. **This board PR**, carrying that correction, this breadcrumb, and the `git mv` of the
   `…-2320-…` breadcrumb into `docs/pr-prompts/archive/`.

**Not changed:** no prompt armed or disarmed, **no label added or removed**, no PR merged but this
board PR, no watcher restarted, no process killed, no worktree pruned, `/sot/` untouched, Azure /
Entra / SharePoint untouched.

## FINDINGS

### F1 — `STATION-CAPABILITIES` §5 licensed two out-of-lane merges, because Marco's 2026-09-04 ruling was applied to DOCTRINE and never to the sentence that conflicted with it

`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`

§5 read: *"00 may merge docs-only and `sot/`-only PRs, queue/staging PRs, **and anything not
watcher-routed**."* DOCTRINE §10.1 step 2 — tagged *"THIS IS A SAFETY RULE, NOT A CONVENTION"* —
says the opposite for the same PR: no watcher log names it ⇒ hand-classify with
`classifyPolicyFiles` ⇒ **any path outside `tests|docs` is Marco's.**

**This exact conflict was found and escalated on 2026-09-03** (breadcrumb `…-2238-…`, F2, on `#1554`)
and **Marco ruled on 09-04**. The ruling exists: it is §10.1 step 3's KNOWN STATION LANE exception,
which classifies a station acting inside its own recorded lane by this matrix. **What was never
done is narrowing §5's sentence to match**, so the permissive half survived eighteen days — in the
file whose own opening line says it is *"the one place the capability answer lives"*.

**It is not hypothetical: it had two live instances on today's board at once.** [MEASURED] at
`845e4720`, `#2065` (`scripts/pipeline/vm-git-guard.sh`) and `#2059`
(`scripts/pipeline/status-sweep.ps1`) were both OPEN, CLEAN, **15/15 green**, **unlabelled**, and
returned **0** prompt-log hits with the probe's positive control at 1 and a freshly minted negative
at 0. Read through §5 both are mergeable by me; read through §10.1 step 2 both are Marco's. Neither
is a station-lane PR, so step 3's exception does not rescue them.

🔴 **The polarity is the dangerous one, and the reading order makes it worse.** The error licenses a
**merge**, not a refusal — and every station bootstrap prescribes reading `DOCTRINE.md` **then**
`STATION-CAPABILITIES.md`, so the permissive version is the one read **last**. The two PRs it would
have cleared are the two that repair this pipeline's own instruments, i.e. precisely the class a
station is most tempted to merge itself.

**DISPOSITION: ACTIONED.** §5 now states that "not watcher-routed" is a necessary and not a
sufficient condition, names the two live instances with their controls, and carries a falsifying
probe. **This narrows this station's own authority rather than widening it**, which is the safe
direction and the reason it was taken rather than escalated: widening 00's authority would be the
shape of change a reader should distrust, and transcribing a ruling Marco has already given is not
the same act. `STATION-CAPABILITIES.md` is `docs/`, inside 00's own lane. **Hand-landed rather than
armed, deliberately** — the station doc's own instruction for binding law that must be exact.

### F2 — `#2061` was released by Marco five minutes after my last run, is 15/15 green, and no scheduled station may finish it — a supervised interactive lane is mid-flight on it

`RELEASED_WATCHER_ROUTED_PR_HAS_NO_SCHEDULED_OWNER_V1`

The single most important change on the board since 23:20Z, and the run's main judgement call.

[MEASURED] `gh api repos/<owner>/<repo>/issues/2061/events`:

```
2026-09-21T20:24:55Z  labeled    'do-not-merge'  by=GH-Mantova   <- the watcher, on escalates:true
2026-09-21T23:37:38Z  unlabeled  'do-not-merge'  by=GH-Mantova   <- the release
```

`mergeStateStatus` **CLEAN**, **15/15 SUCCESS**, `autoMergeRequest` **NONE**, and the branch now
carries `docs/decisions/merge-approvals/2061.md`. The authoring identities on the PR's own commit
list — read per-commit, never from the squash (§10.2.1) — name the actor:

```
2f504a98  station-00.interactive-0004 <marco@initialservices.net>  docs(merge-approvals): receipt for #2061 - Marco released by label re…
953a550b  station-00.interactive-0004 <marco@initialservices.net>  fix(rates): cutting-mm keeps the High-Freq x1.25 the S5 prompt specifies
afbf78ae  station-00.interactive-0004 <marco@initialservices.net>  test(tendering): pass the 4th TenderRateSetService ctor arg in its spec
fbe15374  Marco <marco@initialservices.net>                        feat(rates): charge steps price cutting - scopecards S5
```

`station-00.interactive-000N` is §10.2.1's **supervised interactive lane** — the sixth identity row,
whose `user.name` is the lane id while the email stays Marco's, so **attribution by email alone
would read these as watcher builds.** That lane wrote the receipt, fixed two specs and a pricing
rule, and the label came off minutes later.

**I did not merge it, and four independent things each forbid it on their own:**

1. My bootstrap's hard-stop list, which binds *"regardless of what any document says"*:
   **never merge a watcher-routed PR.** `#2061` is watcher-routed — the verdict, the prompt slug,
   the head branch and the arming-log window all agree (WHAT I MEASURED).
2. §10.1 step 1: a verdict names the PR ⇒ **obey it**; `marco:true` ⇒ RULE 2 applies. The verdict is
   live and a provably-weak routing reason does not clear a verdict.
3. YOUR LIMITS 1: an `escalates: true` PR is opened and driven green, **the merge left for Marco**.
   Removing the label does not make the prompt stop escalating.
4. §8.3 and `classifyPolicyFiles`: the diff carries **two migration files**, which are refused on
   their own clause, and I have run no apitest.

🔴 **And condition 3 of BOARD DRIVING is the one that would have made it an incident rather than a
rule-break.** A live second actor is mid-mutation on that PR. Merging under it is exactly the LL-38
collision the single-actor design exists to prevent.

**DISPOSITION: DEFERRED.** The PR is green, released, receipted and actively owned — there is
nothing for a scheduled station to do but stay off it, and saying so is the deliverable.
⚠️ **What would make it urgent:** `#2061` still OPEN, still green, still released, with **no new
commit from `station-00.interactive-*`** at a later run. That is a handoff the interactive lane
dropped, and it leaves a fully-released PR with no actor that may finish it — at which point it
belongs on the standing escalation in F3 rather than here.
⚠️ **Falsifying probe: the events call and the commit-identity list above.** If the label ever reads
re-applied, or the newest authoring identity on that branch is not `station-00.interactive-*`, this
finding does not describe the PR any more and must be re-measured.

### F3 — The board is entirely Marco's for the third consecutive run, and two of the three PRs repair the instruments the stations run on

`BOARD_IS_ENTIRELY_MARCOS_V1`

Not a new mechanism — `needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`
already names it. Three open PRs, three different routes, **zero** mergeable by any scheduled
station:

1. **`#2065`** — CLEAN, 15/15 green, unlabelled. `scripts/pipeline/vm-git-guard.sh`: the fix for a
   guard **every station is instructed to install at the top of every run and that has now been
   measured inert three times, across two stations.** Its failure mode is silent — it certifies
   success while doing nothing — so the cost of leaving it is not "no guard" but "a guard every
   station believes in". This run installed it and quoted its five passing controls, exactly as the
   contract requires, and it is still not in force.
2. **`#2059`** — CLEAN, 15/15 green, unlabelled. `scripts/pipeline/status-sweep.ps1`: stops §4C
   quoting a state summary older than three days. **The sweep is still today quoting
   `queue-watch-state.md` from 2026-08-31 — 22 days stale — as its "freshest station summary"**,
   eleven `[FILE]` lines of it, in a report every station is told to read first.
3. **`#2061`** — released and lane-owned; F2.

**DISPOSITION: ESCALATED** — folded onto the existing open file, **not a new one**, because
`needs-marco/` is 61 deep and a 62nd copy of a known question is noise. One fact is added that was
not there on 09-10 and is not a restatement: **both instrument-repair PRs have now been green and
CLEAN across three consecutive supervisor runs**, so the only thing between them and `main` is a
human clicking merge, and each additional run pays the cost of the instrument they fix.

### F4 — `triage-holds.ps1` again declared its own clean result SUSPECT, and the script now ships the control that refutes it

`TRIAGE_SUSPECT_HEURISTIC_COUNTS_TOP_LEVEL_BUCKETS_V1`

The run ended, as last run's F4 recorded, with `!!! SUSPECT: every prompt landed in ONE bucket …
the signature of a broken probe`. It is a **false alarm** again, and this run can settle it without
the hand-rolled controls the previous one needed, because **the script now runs a fixture control
itself and printed it on line 2**:

```
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture, so the SPENT bucket is measurable.
```

A fixture whose truth is known by construction is the strongest form of the §7 positive control, and
it proves the probe can reach and report a premise. The failure-direction argument stands
independently: §9.5 records that a missing `git` makes `readFromOriginMain` fail **SAFE** for binning
and **OPEN** for arming, so a broken probe manufactures **ADMITs**. This run has **zero** ADMITs and
**16** REJECTs carrying **three distinct codes** (11 · 4 · 1). A broken probe cannot discriminate
three codes. The heuristic counts **top-level buckets** and is structurally blind to discrimination
inside one.

**DISPOSITION: DEFERRED**, unchanged from last run but now better evidenced. The warning's polarity
is safe — it over-warns, and over-warning costs one control — so it does not earn a `scripts/` PR
onto a board where three PRs already wait on Marco.
⚠️ **What would make it urgent:** a run that meets this banner and responds by filing the board as
instrument-broken, or by re-arming from a stale ADMIT list.
⚠️ **Falsifying probe: the bucket-code census plus the script's own `SPENT control` line.** If
`triage-holds.ps1` ever prints SUSPECT while the REJECT codes are genuinely uniform, **or while its
own SPENT control prints FAIL**, the warning should be believed and this finding does not apply.

## WHAT I DID NOT DO

- **Merged nothing but this board PR.** All three open PRs are Marco's by three different routes
  (F2, F3), and `#2061` additionally has a live second actor on it.
- **Did not remove, or re-apply, a `do-not-merge` label.** Only Marco does, absolutely. `#2061`'s
  label was already off when this run started; I read the event timeline rather than inferring it.
- **Did not touch `#2061`'s branch, comment on it, or arm auto-merge on it.** A supervised
  interactive lane is mid-flight there and condition 3 says stop.
- **Armed nothing.** `gates-satisfied = 0` of 16, measured and controlled (F4). Arming onto a board
  where every open PR waits on a human lengthens the queue rather than shortening it.
- **Did not restart the watcher.** pid 9744 running, wrapper alive (1), heartbeat 47 min against
  `armed: 0` — idle, not wedged, and the heartbeat only ticks mid-run. No `scripts/pr-watcher/**`
  merge has landed, so the FIX-LANE restart rule does not fire either.
- **Did not re-diagnose the sweep's `watcher clone: dirty=7` line.** Already recorded in DOCTRINE
  §9.5: `git status --short` counts untracked files and `start-watcher.ps1` does not, and a
  tracked-dirty clone auto-stashes rather than refusing. Re-deriving a recorded defect is the cost
  this pipeline keeps paying.
- **Did not clear any `needs-marco/` file.** Section 5 of the sweep printed **zero** `[STALE]` rows,
  so there were none to discharge; 61 remain and none was opened on a tag alone.
- **Did not touch the 14 untracked `docs/pr-reviews/pr-20xx-review.md` files in the dev tree.** They
  are review verdicts the `rev-<N>` job writes by design (§9.5's three-homes bullet).
- **Did not widen this station's authority.** F1 narrows §5; the one edit that would have widened it
  — giving 00 the worktree prune that last run's F2 found has no owner — was left with Marco, where
  last run put it.
- **Left `/sot/` alone** (Station 05's, CP-24) and **did not go near Azure, Entra or SharePoint**,
  which is absolute.
- **Did not run `git` through the device bridge.** Every `git` call went through Desktop Commander
  on the Windows host; the VM-side guard was installed first regardless, and its output is quoted in
  GROUND.
