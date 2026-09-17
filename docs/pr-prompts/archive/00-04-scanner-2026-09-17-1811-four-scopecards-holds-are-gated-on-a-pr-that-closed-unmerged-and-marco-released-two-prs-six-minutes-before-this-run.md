# Station 04 — Scanner | 2026-09-17T18:11:02Z–2026-09-17T18:24:00Z

## GROUND

```
UTC            2026-09-17T18:11:02Z
origin/main    4c8c6868            (fetched first, then rev-parse)
dev tree       main @ 4c8c6868      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                    (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. Run proceeded at full authority — which for 04 is read-only on
the board.

Sweep this run: **gate-liveness** (rotation position 1 of 4), from
`node scripts/pipeline/next-sweep.mjs`. Previous run of this sweep: `2026-09-17T14:10:24Z`.

## WHAT I MEASURED

**Reachability — NOT a blind run.** `[MEASURED]` Desktop Commander ids were loaded by keyword
`ToolSearch` for `desktop-commander` before any call. `start_process` shell `powershell.exe` →
`C:\ProjectOperations2`, `main`, `4c8c6868`, PS **5.1.26100.9444**, `UTC_START=2026-09-17T18:11:02Z`.

**Device-bridge git guard.** `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
last line quoted verbatim: `persistence controls passed: .bashrc byte-identical on re-run; login shell
resolves shim`, preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted
paths and mounted cwd, allows everything else (three controls passed)`. **Install PASSED.** No `git`
was run against the Windows `.git` through the bridge at any point in this run.

**Freshness of my own instructions.** `[MEASURED]` after
`git fetch origin +refs/heads/main:refs/remotes/origin/main` in the **dev tree**:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY**. Per the station contract, empty `--numstat` is the real answer; no piped `hash-object`
was taken or compared (§9.1). So the three working copies I read in full ARE `origin/main`'s blobs at
`4c8c6868`.

**§9.1 fired on me in my second call, and the cure worked.** `[MEASURED]` A `start_process` command of
the form `powershell.exe -NoLogo -NoProfile -Command "…$PSVersionTable…require('fs')…"` — the **nested
`-Command`** form §9.1's 2026-09-14 correction names — died with
`Method invocation failed because [System.String] does not contain a method named 'readFileSync'`:
`require('fs')` had been expanded before the child parsed. Re-sent **direct** to a bare
`powershell.exe` shell via `interact_with_process`, the identical statements returned
`CTRL=5.1.26100.9444`. Every subsequent measurement in this run used the direct transport. **This is
the trap reproducing exactly as written, through the transport the 2026-09-14 correction identifies —
nothing to re-measure.**

**PREFLIGHT step 4 — the sweep, and its verdict is REAL.** `[MEASURED]` `status-sweep.ps1` captured
with `*>` to `C:\po-sup-fix-scripts\sweep-04-20260917T1811.txt` (148,156 bytes) and decoded
`utf16le` by node — the byte-order mark was checked, not assumed (`ENC=utf16le`, 429 lines), per
§9.3.

- section 0 instrument positive controls: `gh CAN reach GitHub (saw merged PR #2013)` · `node runs`.
  **No `[BROKEN]`.**
- section 3: `[LIVE] git index.lock  interactive/clone: False / False`. **No lock in either tree, so
  there is no lock age or byte size to adjudicate this run.**
- section 7: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
  station worktrees.`
- section 2: `watcher node: RUNNING pid 24032`; `watcher clone: branch=main dirty=3 <-- … the watcher
  may refuse to start`. That warning is the **known false one** — §9.5's 2026-09-10 bullet measures
  the flag as untracked-inclusive while `start-watcher.ps1` counts tracked only, and a tracked-dirty
  clone auto-stashes rather than refusing. **Not reported as a finding, not dispatched to 03.**
- section 4: `armed (*-ready.md): 0` · `needs-marco/: 58` · `no-pr-opened/: 109` · `failed/: 52` ·
  `blocked/: 141`.

**Board trap (station doc, AUTHORITY).** `[MEASURED]` `Get-ChildItem docs\pr-prompts -Filter '*-ready.md' -File`
→ **0**; `-Filter '*-HOLD.md' -File` → **27**. Counted with the §9.4 null guard
(`@(… | Where-Object { $null -ne $_ }).Count`), not a bare `@(…).Count`. **No tracked ready-file at
depth 1. No board-trap defect this run.**

**The corpus, and the premise result.** `[MEASURED]` `triage-holds.ps1` (read-only; `--dequeue`
never passed), captured to `C:\po-sup-fix-scripts\triage-04-20260917T1811.txt` and decoded `utf16le`:

```
GIT control:   PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (204041 chars)
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture
=== TOTALS  spent=0 of 27 evaluated  gates-satisfied=1  still-gated=26  unreadable=0
    0 spent behind a REJECT, 26 still needed, 0 UNMEASURABLE
```

**So the first half of this sweep's brief returns clean: NO finished work is sitting on the board.**
And that zero is load-bearing rather than vacuous — both controls passed, and the script states that
`SPENT BEHIND A REJECT` was proved reachable by fixture, so its 0 means *none*, not *cannot say*.

**Every dependency gate on all 27 HOLDs, resolved against `origin/main:4c8c6868`.** `[MEASURED]` via
`git show <full-40-sha>:<path>` per gate, needle counted in the blob text. Instrument controls:
POSITIVE `docs/approvals/README.md` → readable; NEGATIVE `docs/zzQq04NoSuchFile20260917.md` → absent;
needle NEGATIVE `zzQq04Needle20260917T1811` over a file known present → **0**.

| gate class | count | state |
|---|---|---|
| `requires_on_main` **SATISFIED** | 4 | company-manage-s2 · ea-s2 · queue-layout-sot-entry · tipid-s3 (1 of its 3) |
| `requires_on_main` **UNRELEASED** | 9 | crmvis s6/s7/s8 · scopecards s4a/s4b/s5/s6 · tipid-s3 (2 of its 3) |
| `requires_merged` **SATISFIED** | 3 | #1361 MERGED · #1317 MERGED · #1111 MERGED |
| `requires_file_on_main` **UNRELEASED — Marco-approval class** | 5 | pr-524 · rates-s11c · retire-tenderclientnote-s2 · siteid-notnull-backfill · tenant-mt4-s2 |
| `requires_file_on_main` **UNRELEASED — fv2 chain** | 2 | fv2-ai-digests · fv2-output-channels |
| **no dependency gate** | 6 | devtree-sync-ff-only-guard · fv2-formrule-contract · nav-jobs-projects-merge · ops-m2b-tipping-tab-reminder · permission-role-reconciler · vendor-invoice-ocr |

**The five Marco-approval gates are ABSENT by design and I repaired none of them.** `[MEASURED]` all
five `docs/approvals/*-approved-by-marco.md` blobs absent at `4c8c6868`, positive control
`docs/approvals/README.md` present. Two of the five (`pr-524-rates-b-slice2-canonical`,
`pr-rates-s11c-drop-legacy-tables`) drop database tables and a third
(`pr-tenant-mt4-s2-ownership-migration`) writes production data — the exact class this sweep's own
brief says to report and repair nothing on.

**Six prompts are gate-clear and parked purely on a human or design decision** — every dependency
gate satisfied, rejected by lint for a reason that is not a gate. `[MEASURED]` from the triage
capture: `pr-dns-s5-checker-flip-to-fail` `[HUMAN_GATE_PRESENT]` · `pr-e2e-container-s2-swap-required-job`
`[HUMAN_GATE_PRESENT]` · `pr-ea-s2-dashboard-preset` `[HUMAN_GATE_PRESENT]` ·
`pr-company-manage-s2-retire-adminonly` `[UI_PROMPT_NEEDS_DESIGN_REF]` ·
`pr-unified-api-key-vault-slice4c-retire-old-screens` `[UI_PROMPT_NEEDS_DESIGN_REF]` · and the single
ADMIT, `pr-queue-layout-sot-entry`. **This is not a defect — it is the shape of the board: the work is
ready and the decision is not.**

**The single ADMIT is 05-owned and is already dispatched — NOT re-filed here.** `[MEASURED]`
`pr-queue-layout-sot-entry-HOLD.md` carries `station: '05'` and `scope: sot/02-roadmap-and-status.md`;
its gate `docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` reads **NEEDLE_PRESENT ⇒ SATISFIED** at
`4c8c6868`, and its premise is alive: `git grep -c QUEUE_LAYOUT_V1 origin/main -- sot/` → **exit 1**,
against the positive control `git grep -c QUEUE_LAYOUT_V1 origin/main -- docs/pipeline/QUEUE-LAYOUT.md`
→ **1**. Station 00's `…-1707-…` breadcrumb F-1 already records this as dispatched to 05 three times
(12:19Z, 13:16Z, 17:07Z) and unread across 05's `14:10:38Z` occurrence. **Re-verified, surfaced to 05,
and deliberately not filed as a new finding** — a fourth copy of a live dispatch is noise, and 04
stages nothing 05-owned.

**Lane verdicts on all three PRs this run touches, cross-checked against the §10.1 prose-scrape
bullet.** `[MEASURED]` `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'`
(prompt logs only, `rev-*` excluded), NEGATIVE control `PR #999997` → **0**:

| PR | hits | verdict line | own `opened PR` line in the SAME log? |
|---|---|---|---|
| #1998 | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | **yes** — `pr-crmvis-s5-followups-ready.md.log` |
| #2005 | 2 | the same shape, same reason | **yes** — `pr-scopecards-s3-line-markup-all-types-ready.md.log` |
| #2002 | 2 | the same shape, same reason | **yes** — `pr-transport-capacity-column-order-ready.md.log` |

All three are **genuine policy routings, not §10.3 timeouts and not §10.1 prose scrapes** — each
verdict sits in the log of the prompt that opened that PR, for the same number, with a scope that
matches. I had begun to write #1998 up as the §10.3 CI-latency timeout on the strength of its age and
a pending check; **the `reason` string refuted that before it reached a finding.**

**Required-status-check set: `[CANNOT MEASURE]`.** `gh api repos/<R>/branches/main/protection` →
`Branch not protected (HTTP 404)`; `gh api repos/<R>/rulesets` → one active ruleset,
`id=15532058 name=Main enforcement=active`, and the per-ruleset detail call **returned no rules at
all**. I am not inferring the required set from an empty result (§9.6). What is measured is the
observable, and it is in F3.

**A near-miss of my own, recorded because the shape is the point.** `[MEASURED]` My first gate
extraction grepped front matter with `^(requires_on_main|requires_merged|…)` and read
`pr-tipid-s3-…-HOLD.md`'s gate as `requires_on_main:` with **nothing after it** — which I was one step
from filing as a malformed, permanently-unsatisfiable gate. Re-measured through the linter's own
exported `parseFrontMatter`, the value is a **three-element list** —
`scripts/rates/backfill-waste-map-location-ids.mjs :: NO MATCH` ·
`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO` ·
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED` — of which the
first is SATISFIED and two are UNRELEASED. POSITIVE control `pr-crmvis-s6` → scalar value returned
intact; NEGATIVE control, a minted key name → `false`. **A `^key` grep over YAML front matter is
structurally blind to every list-form value, and its zero is byte-identical to an empty key.** See F5.

## WHAT CHANGED

**Nothing on the board.** No prompt armed, disarmed, renamed, moved, deleted or edited. No gate
repaired. No PR merged, labelled, closed or commented. No `/sot/` file touched. No Azure / Entra /
SharePoint call of any kind. No `git` through the device bridge against the Windows `.git`. No
throwaway worktree minted.

Three writes, all outside the board:

1. **`docs/pipeline/sweep-rotation.json` — ADVANCED and LEFT DIRTY.** `[MEASURED]`
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-17T18:11:02Z` → exit 0,
   `advanced: last_index=0 last_run_utc=2026-09-17T18:11:02Z`, and the script's own closing line
   `LEFT DIRTY: name this file in your breadcrumb.` Read back:
   `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → **`2  2`**, and
   `last_index=0 last_run_utc=2026-09-17T18:11:02Z next=instrument-honesty`.
   🔴 **Station 00: this file is uncommitted in the dev tree and I may not commit it.** Carry it in
   the next board PR. If it is dropped, the next 04 run repeats gate-liveness and the rotation stops
   turning.
2. **This breadcrumb**, at `docs/pr-prompts/00-04-scanner-2026-09-17-1811-…md` — a tracked directory,
   untracked file, written UTF-8 by the native `Write` tool (not `Set-Content`, not `>` — §9.3).
   Station 00 sweeps it up.
3. Two scratch captures under `C:\po-sup-fix-scripts\` (`sweep-04-…txt`, `triage-04-…txt`). Outside
   both repos; nothing reads them after this run.

## FINDINGS

### F1 — Four scopecards HOLDs are gated on a marker whose only producer PR closed UNMERGED, and the open escalation does not name them

`pr-scopecards-s4a-push-by-destination-api-HOLD.md` declares
`requires_on_main: apps/api/src/modules/tendering/scope-redesign.service.ts :: SCOPE_LINE_MARKUP_ALL_TYPES_V1`.

`[MEASURED]` at `4c8c6868`: the file is **PRESENT** and the needle count is **0** (positive control
`docs/pipeline/QUEUE-LAYOUT.md :: QUEUE_LAYOUT_V1` → 1; negative control, a needle minted this run →
0). So the gate is unreleased. The question this sweep exists to answer is whether it is *waiting* or
*dead*, and the producer decides:

| probe | result |
|---|---|
| producer prompt, searched across the whole `docs/pr-prompts` tree | `processed\pr-scopecards-s3-line-markup-all-types-ready.md` — **consumed** |
| the same slug at depth 1 of the queue | **0 files** |
| armed `*-ready.md` at depth 1 | **0** |
| `gh pr view 2005 --json state,mergedAt,closedAt,headRefName` | **`CLOSED`**, `mergedAt` **empty**, `closedAt` `2026-09-17T17:25:24Z`, head `feat/scopecards-s3-line-markup-all-types` |
| open board, `gh pr list --state open` (`$LASTEXITCODE`=0, `-R` passed) | **2** — `#2002` (rates transport column order) and `#1998` (crmvis s5). **Neither carries the marker.** |

**So the gate is DEAD, not waiting: the prompt that would satisfy it has been consumed, its PR is
closed unmerged, and nothing on the board will produce the needle.** And it is not one prompt — the
chain is four deep, each link gated on the previous link's marker, every one measured UNRELEASED at
`4c8c6868`:

```
s4a  <- scope-redesign.service.ts :: SCOPE_LINE_MARKUP_ALL_TYPES_V1   NEEDLE_ABSENT   (#2005, closed unmerged)
s4b  <- quote-push.service.ts :: QUOTE_PUSH_BY_DESTINATION_V1         FILE_ABSENT     (s4a would create it)
s5   <- ClientQuotesPanel.tsx :: QUOTE_PUSH_PANEL_V1                  NEEDLE_ABSENT   (s4b)
s6   <- charge-step-pricing.service.ts :: CHARGE_STEPS_PRICE_CUTTING_V1 FILE_ABSENT   (s5)
```

**This is DOCTRINE §8.5's `processed/` blind spot, third measured instance.** §8.5 records it in as
many words — *"A prompt could sit there while its PR was still open, closed unmerged, or merged, with
nothing distinguishing the three"* — and names `ratescol-s4` and `scopecards-s2b` lost to it on
2026-09-16. `merged/` is the fix and §8.5 says it is *"written in S1 and enforced in S4"*, i.e. not
yet. `pr-scopecards-s3-line-markup-all-types-ready.md` is in `processed/` today with a closed-unmerged
PR behind it, which is precisely the state §8.5 says nothing distinguishes.

**What is NEW here, and it is the whole finding.**
`needs-marco/pr-2005-closed-unmerged-one-second-after-a-board-merge-2026-09-17.md` is already open,
already thorough, and already asks Marco the right question. `[MEASURED]`
`grep -n "s4a\|s4b\|scopecards-s4\|scopecards-s5\|scopecards-s6\|chain\|gated\|HOLD"` over that file
→ **no output**. Its option (c) costs the close as *"the slice is silently lost from the board while
its prompt is already consumed"* — **one** slice. The measured cost is **five**: s3 plus four
dependents that can never lint past their gate until s3's work is on `main`. That materially changes
which option RULE 1 selects, and it is the kind of blast radius a reader will not re-derive.

**I repaired nothing, deliberately, and the brief is why.** Repairing s4a's gate would mean editing a
prompt that carries `gate_allow: migrations` and `escalates: true` — and the gate is the *only* thing
holding it, so a repair would arm a migration slice whose predecessor is not on `main`. That is the
`docs/approvals/README.md` failure this sweep's brief names, in the arming direction. 04 is read-only
on the board regardless (authority matrix: *Mutate the board: NO*).

**DISPOSITION: DISPATCHED** — to **Station 00**. Two asks, neither of which is a merge: (1) fold this
blast radius into the existing `pr-2005-…` escalation so Marco's option (c) is priced at five slices
and not one; (2) when he answers, the reopen path in option (a) also releases the four HOLDs, and the
re-stage path in option (b) needs s3 re-staged *before* any of the four can be armed. Nothing here is
actionable by 04 and nothing should be armed on it.

### F2 — Marco released #1998 and #2002 six and five minutes before this run started, neither has a receipt, and #1998 is the sole gate on three more HOLDs

`[MEASURED]` `gh api repos/<R>/issues/<n>/events` (exit 0, 5 events on #1998):

| PR | event | label | at | actor |
|---|---|---|---|---|
| #1998 | `labeled` | `do-not-merge` | 2026-09-17T09:06:21Z | GH-Mantova |
| #1998 | **`unlabeled`** | `do-not-merge` | **2026-09-17T18:04:49Z** | GH-Mantova |
| #2002 | `labeled` | `do-not-merge` | 2026-09-17T09:42:38Z | GH-Mantova |
| #2002 | **`unlabeled`** | `do-not-merge` | **2026-09-17T18:05:19Z** | GH-Mantova |

Current labels, read **per-PR** (LL-47, never from a board listing): `#1998 state=OPEN labels=[]` ·
`#2002 state=OPEN labels=[]`. **Only Marco removes that label** (CP-26 gate 1,
`STATION-CAPABILITIES.md` §5), so both PRs are released — 6m13s and 5m43s before my `UTC_START` of
`18:11:02Z`.

`[MEASURED]` receipts on `origin/main`: `docs/decisions/merge-approvals/1998.md` **ABSENT** ·
`2002.md` **ABSENT** · `2005.md` **ABSENT**; positive control, the directory itself, **present**. So
both releases match the standing open escalation
`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` exactly, and
`#1998`'s `Approval receipt (CP-26)` still reads **SUCCESS** — a rollup captured at `09:0xZ`, nine
hours before the label came off. Per §9.4 the pass/fail count is not the answer and the verdict token
is; I could not pull the token this run (see F3's `[CANNOT MEASURE]` note on the ruleset), so **I am
not claiming `[RELEASED_NO_RECEIPT]`** — only that the check has not re-run since the release and
therefore says nothing about it.

**Why this belongs in a gate-liveness report at all:** `#1998` carries
`CRM_PARITY_FOLLOWUPS_V1`, and that marker is the gate on **three** HOLD prompts —
`pr-crmvis-s6-bulk-link` ← `s7-comms-inbox` ← `s8-comms-threads`. `[MEASURED]` `#1998 state=OPEN`,
head `feat/crmvis-s5-followups`. **This is the exact opposite case to F1 and the contrast is the
useful part: same observable (needle absent at `origin/main`), opposite cause.** F1's producer is
closed unmerged, so its gate is dead. F2's producer is open and now released, so its gate is *waiting*
— and one merge releases three prompts.

**DISPOSITION: DISPATCHED** — to **Station 00**, whose lane merging is, via
`Assert-SmokedOrEscalate` → `Merge-Pr`, never by hand. 00's next occurrence is at `:05`. Two things
it needs that were not true an hour ago: both PRs are unlabelled and released, and neither has a
receipt. **04 merged nothing and asserts no merge verdict** — F3 is the reason a merge may not be
available yet.

### F3 — #1998 is 14-of-15 green with one check that has neither a conclusion nor a state, and `mergeStateStatus` is BLOCKED

`[MEASURED]` `gh pr view 1998 --json statusCheckRollup,mergeStateStatus,createdAt` (exit 0):
`created=2026-09-17T09:05:20Z`, `mergeState=BLOCKED`. Fourteen entries read `SUCCESS` — `CI`'s web,
API, data-model, e2e-marker and raw-error-envelope jobs, `PR gates — diff checks`, both `Pipeline`
jobs, `Approval receipt (CP-26)`, `CodeQL`, both `Analyze` jobs and both `Changed-path filter` jobs.
**One entry, `tendering-e2e`, has an EMPTY conclusion AND an empty state.**

`[CANNOT MEASURE]` whether `tendering-e2e` is a *required* check: classic protection returns
`Branch not protected (HTTP 404)` and the active ruleset's detail call returned **no rules**, so I
have no required-context list. I am not inferring one from an empty result — that is §9.6, and
inferring it in the reassuring direction ("not required, so the PR can merge") is the dangerous half.

What can be said without that list: a check with no state is **not** `SUCCESS`, `index.mjs`'s
`allGreen` requires `checks.length > 0 && checks.every(SUCCESS|NEUTRAL|SKIPPED)` (anchor:
`const allGreen`), and `mergeStateStatus` is `BLOCKED`. **So #1998 is not merge-ready on this
reading, and F2's three-HOLD release is behind it.** Note also that the routing verdict on #1998 is a
genuine `escalates:true` policy routing, **not** the §10.3 timeout — so the 90-minute
`MERGE_TIMEOUT_MS` mechanism is not what is happening here and must not be reached for.

**DISPOSITION: DISPATCHED** — to **Station 00**. It owns the merge path and can pull the required
context list and the CP-26 verdict token from column 3 of the job log (§9.1: split on the tab, search
the LAST column — column 1 is the job name and matches every line). The concrete question is whether
`tendering-e2e` is required and was never created, or is not required and `BLOCKED` has another cause.
**04 does not diagnose a red it cannot reach the log for, and does not guess a required-check set.**

### F4 — The fv2 file gate is still dead nine days on, and the 2026-09-15 ESCALATED disposition produced no escalation file

`[MEASURED]` re-verified at `4c8c6868`, per DOCTRINE §7.1's re-read rule:
`apps/api/src/modules/forms/ai-form-import.service.ts` → **ABSENT** on `origin/main`;
`apps/api/src/modules/forms/form-digests.service.ts` → **ABSENT**. Producer search across the whole
prompt tree: the producing prompts are `superseded\pr-fv2-ai-describe-HOLD.md`,
`superseded\pr-fv2-ai-import-HOLD.md`, `superseded\pr-fv2-import-s1-docx-and-persona-HOLD.md`, with
`no-pr-opened\pr-fv2-ai-describe-ready.md.log` recording a build that opened nothing. **Retired
producers, dead gate, two prompts parked** — `pr-fv2-ai-digests-HOLD.md` and, behind it,
`pr-fv2-output-channels-HOLD.md`.

**This is a KNOWN finding and I am not re-filing it.** `[MEASURED]`
`archive\00-04-scanner-2026-09-15-1010-a-file-gate-outlived-the-prompt-that-was-retired-for-being-stale.md`
F1 states it in the same terms and closes **`DISPOSITION: ESCALATED` — Marco: is the fv2 AI-import /
digests / output-channels cluster still wanted?**

What is new is that the escalation never arrived. `[MEASURED]`
`ls needs-marco/ | grep -i "fv2\|digest"` → **no match** (the same command returns
`pr-2005-…` and `scopecards-s2b-…` for its other terms, so the search works). `needs-marco/` holds
**58** files and none of them is this question. Two days and roughly twelve 04 occurrences after an
`ESCALATED` disposition, **Marco has not been asked**, and `status-sweep.ps1` section 5 — which
surfaces `needs-marco/` to every run — therefore cannot surface it.

⚠️ I did not write the file myself. My hard rules permit tracked-file writes only for staged prompts
and the five gitignored `docs/qa/` state entries, and `needs-marco/` is 00's escalation channel, not
04's output. Filing it myself would also be the second actor writing into that folder, which is the
collision the lane rules exist to prevent.

**DISPOSITION: DISPATCHED** — to **Station 00**, which owns the only channel that closes: carry
2026-09-15 F1's question into `needs-marco/` so it reaches Marco, and note that the ESCALATED
disposition is currently a dead end. ⚠️ This generalises past fv2 — an `ESCALATED` finding that
produces no `needs-marco/` artifact is indistinguishable, to every later run, from one that was
answered.

### F5 — A `^key` grep over YAML front matter is blind to every list-form gate, and its zero reads exactly like an empty key

`[MEASURED]` this run, on `pr-tipid-s3-retire-the-name-guard-for-an-id-check-HOLD.md`. A
front-matter filter of the form
`/^(requires_merged|requires_on_main|requires_file_on_main|premise|size|…)\b/` printed the line
`requires_on_main:` with **nothing after it** — the signature of a malformed, permanently
unsatisfiable gate, and I was one step from filing it as one. Through the linter's own exported
`parseFrontMatter` the value is a **three-element list**: one gate SATISFIED
(`backfill-waste-map-location-ids.mjs :: NO MATCH`) and two UNRELEASED
(`docs/audits/waste-map-location-backfill.md :: BACKFILL_UNMATCHED_ZERO`,
`docs/data-model/rates-migration/STEP-11C-DONE.md :: ESTIMATE_WASTE_RATES_DROPPED`). Controls:
POSITIVE, `pr-crmvis-s6`'s scalar value returned intact; NEGATIVE, a minted key name → `false`.

**The polarity is the reason this is worth a report line.** The wrong reading was *"this prompt's
gate is malformed and does nothing"*, which for a prompt transitively gated behind
`pr-rates-s11c-drop-legacy-tables` — a table drop waiting on a Marco approval file that is ABSENT —
argues toward treating a live three-gate chain as no gate at all. The grep and the parser answer
different questions, and only one of them is reading the gate.

🔧 **Resolve a gate through `parseFrontMatter` from `lint-prompt.mjs`, never through a `^key` grep**,
and control any front-matter extraction against a prompt whose gate you know is list-form **and** one
you know is scalar. A scalar-only control passes on both instruments and hides this completely.

**DISPOSITION: ACTIONED** — caught and corrected inside this run; every gate reading in WHAT I
MEASURED and in F1–F4 above was taken through `parseFrontMatter`, not the grep, and both controls are
quoted. Recorded rather than silently fixed because the next sweep in the rotation is
**instrument-honesty**, this is an instrument that lies, and DOCTRINE §9.3 already carries the
CRLF-blind front-matter parser bullet that this one sits beside. ⚠️ **Falsifying probe:** run both
forms over `pr-tipid-s3-…-HOLD.md`; if the `^key` grep ever returns three values, this line is wrong.

## WHAT I DID NOT DO

- **Armed nothing, and staged no prompt.** The board carried exactly one ADMIT and it is 05-owned;
  04 stages nothing 05-owned, and arming is 00's on Marco's authority. `armed (*-ready.md)` was 0 at
  the start of this run and 0 at the end.
- **Repaired no dead gate.** F1's gate is the only thing holding a `gate_allow: migrations`,
  `escalates: true` prompt, and the five approval-class gates guard two table drops and a
  production-data migration. The brief says report and repair nothing on exactly this class, and the
  authority matrix forbids it regardless.
- **Merged nothing and asserted no merge verdict**, on #1998, #2002 or anything else — including the
  two PRs Marco released minutes before this run. I ran no `smoke-pr.ps1`, so I hold no smoke result
  and could not merge honestly even in a lane that allowed it.
- **Did not clear, annotate or discharge any `needs-marco/` file**, including the two whose questions
  F1 and F4 bear on. Section 5 of the sweep flagged 40-odd escalations it *cannot* decide staleness
  for; deciding them is 00's collect, and `QUARANTINED`/`[FILE]` lines are not authority.
- **Did not run Part 2 (live-site regression + visual patrol) or the Dependabot pass.** The station
  doc takes ONE named sweep per run and covers it completely; a shallow pass over everything is why
  findings rot. Dependabot last appears in
  `needs-marco/dependabot-updater-has-failed-nine-times-and-fifteen-alerts-are-open-2026-09-10.md`,
  still open, and nothing this run touched it.
- **Did not touch Azure, Entra or SharePoint** in any form — no portal, no App Service setting, no
  `az`, no `Connect-MgGraph`. Absolute, and not an escalation category to reason past.
- **Did not mint a worktree** to get a clean read, and ran no `git` through the device bridge against
  the Windows `.git`. Every `origin/main` read was `git show <full-40-sha>:<path>` in the dev tree
  through Desktop Commander.
- **Did not write to `docs/qa/qa-findings.md` or `qa-checklist.md`.** Both are gitignored by their own
  literal lines; a finding that lives only there is unreported, and that sink swallowed a released
  gate for nine days. Everything found this run is in this tracked-path breadcrumb.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** It is advanced and dirty in the dev tree by
  design; 04 may not commit to `main`. It is named in WHAT CHANGED for Station 00.
- **Did not quote any count from a prior run as current.** Every number above was measured at
  `4c8c6868` this run, and the queue/escalation counts are state — re-measure them, never quote them.
