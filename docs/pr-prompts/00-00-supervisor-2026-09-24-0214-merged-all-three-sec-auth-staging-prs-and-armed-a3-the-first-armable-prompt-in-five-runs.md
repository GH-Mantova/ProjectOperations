# Station 00 — Supervisor | 2026-09-24T02:14:32Z–2026-09-24T02:5xZ

## FOR MARCO

**The board went from six PRs to three, and the three left are yours — the same three as yesterday.**

`#2135`, `#2131` and `#2127` are still the only thing stopping this board. I re-took all three
verdicts from scratch this run rather than trusting yesterday's note, and they came back identical:
two carry a real watcher `marco:true` verdict naming the exact out-of-lane file, one hand-classifies
to you on `scripts/pipeline/why-blocked.ps1`. **Five consecutive runs have now reached that verdict.**
There is no agent-side action behind it. I did not update their branches — something else does that
on its own, which is F4.

**I armed one prompt: `pr-sec-a3-no-credential-logs`** — the security fix you requested on 09-21 that
stops the API writing live field-worker sign-in codes and client-portal password-reset links into the
production log. It is the first genuinely armable prompt in five runs. It will open as a fourth PR
labelled `do-not-merge`, so it will be waiting for you too, but the code will be written and green.

No question is being put to you in this run.

## GROUND

```
UTC            2026-09-24T02:14:32Z
origin/main    fcdf66c0             (at start; 7adb1fce after this run's three merges)
dev tree       main @ fcdf66c0      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

**Doc version and bootstrap AGREE (1 = 1).** This run was READ-WRITE-eligible by that test.

**Which tree I read in:** the dev tree `C:\ProjectOperations2`, as PREFLIGHT step 2 requires. I used
no piped hash (§9.1 forbids the pipe under `powershell.exe`); I used
`git diff --numstat origin/main -- <path>` on all three binding documents, whose EMPTY output is the
real answer. All three returned EMPTY, and `git rev-list --left-right --count HEAD...origin/main`
returned `0 0`, so the working copy was byte-identical to `origin/main` and the working-copy reads
were authoritative.

**THIS RUN WAS SIGHTED, NOT BLIND.** `start_process` shell `powershell.exe` returned a live shell on
the Windows host on the first attempt after the tool schemas were loaded — `HOSTOK` at
`2026-09-24T02:14:32Z`, PID 32488. Stated explicitly because a blind run and a healthy quiet run both
produce "no news", and this is neither: this run merged three PRs and armed one prompt.

## WHAT I MEASURED

**Device-bridge git guard — the PREFLIGHT install, quoted as the contract demands.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`. Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/affectionate-hopeful-noether/.local/bin:$PATH" git <args>
```

**EXIT CODE: 2**, read from the installer itself, not from a pipeline appended to it. That is the
middle row of the contract's three-outcome table —
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.` Its own two
controls printed: `bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`.
[MEASURED] So the ban was **remembered, not mechanical**, and I honoured it — every `git` call below
ran in `powershell.exe` on the Windows host. See **F6**.

**PREFLIGHT step 4 — the sweep.** `scripts\pipeline\status-sweep.ps1` at `02:16:04Z`, **130 lines**.
Section 0's instrument positive controls both PASSED (`gh` reached GitHub, saw merged `#2146`; node
runs) and no `[BROKEN]` appears anywhere, so the report is usable.

**Section 5 `[STALE]` escalation rows: ZERO.** [MEASURED] Section 5 emitted 18 rows, every one of the
form *"cites #N (MERGED) as evidence — not its premise; does not clear the escalation"*, all naming
the single file `agent-authored-rule-2-clearance-2026-09-04.md`, plus its own closing line saying
section 5 **cannot** decide that file and telling the reader not to clear it on that line alone. **Not
one tagged `[STALE]` row.** Nothing to discharge this run, and I am saying so rather than staying
silent, because "no rows" and "I did not look" read identically.

### COLLECT — freshness crossed against `lastRunAt`, as the contract requires

[MEASURED] `node scripts\pipeline\check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**
(run under `cmd` so `%ERRORLEVEL%` survived — see the §9.1 note below):

```
00  last 2026-09-24T01:08:00Z  1.2h ago  (cadence 1h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-23T23:04:00Z  3.2h ago  (cadence 24h)  ok
04  last 2026-09-23T22:10:00Z  4.1h ago  (cadence 4h)  ok
05  last 2026-09-23T14:23:00Z  11.9h ago (cadence 24h) ok
```

`structure: 1 checked, 0 malformed`. **Crossed against `list_scheduled_tasks`, because the breadcrumb
is one instrument and cannot name a cause:**

| station | `lastRunAt` | newest breadcrumb | row of the station doc's table |
|---|---|---|---|
| 00 | `02:14:02Z` | `01:08Z` | this run |
| 03 | `09-23T23:02:54Z` | `09-23T23:04Z` | **both fresh and aligned — healthy** |
| 04 | **`02:09:41Z`** | `09-23T22:10Z` | **fresh, no breadcrumb, session still `running`** |
| 05 | `09-23T14:22:41Z` | `09-23T14:23Z` | **both fresh and aligned — healthy** |

**04's row is the NOT-A-DEFECT row, and I confirmed it rather than assuming it.** [MEASURED]
`list_sessions` → `local_57eb0821-… "04 scanner" (running)`. 00 is hourly and 04 every 4 h, so 00
lands inside a live 04 run on every one of 04's occurrences by construction
(`STATION-CAPABILITIES.md` §6). A fresh `lastRunAt` **and** a running session settle this row
together. **No transcript read was owed this run**, and no station is SILENT.

`00-supervisor` cron read live from the MCP: **`5 * * * *`**, hourly — matching the bootstrap's
claim, so the missed-occurrence arithmetic below is against a measured cadence, not a pasted one.

**Breadcrumbs collected this run: 1** — `00-00-supervisor-2026-09-24-0108-…`, including its
`01:43Z` addendum. Every finding in it already carried a disposition. It is archived in this run's PR.

### The board — lane verdicts RE-TAKEN, never carried forward

§10.1 makes a lane verdict **non-monotonic**, so I re-took all six from the live corpus
`C:\ProjectOperations2\docs\pr-prompts\processed\` (never the clone's stale copy).

| PR | files | verdict hits | lane | mine to merge? |
|---|---|---|---|---|
| `#2142` | 1 × `docs/pr-prompts/pr-sec-a3-…-HOLD.md` | **0** | `[NO LANE VERDICT — hand-classified]` → `^(tests\|docs)/` ⇒ in-lane | **YES** |
| `#2143` | 1 × `docs/pr-prompts/pr-sec-a1-…-HOLD.md` | **0** | same ⇒ in-lane | **YES** |
| `#2144` | 1 × `docs/pr-prompts/pr-sec-a2-…-HOLD.md` | **0** | same ⇒ in-lane | **YES** |
| `#2135` | `.claude/hooks/guard.mjs`, `scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` | **1** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` | **no — Marco's** |
| `#2131` | `docs/pipeline/SCRIPT-REGISTRY.md`, `docs/pipeline/stations/00-supervisor.md`, `scripts/pipeline/why-blocked.ps1` | **0** | `[NO LANE VERDICT — hand-classified]` ⇒ `scripts/` matches none of the three `NESTED_TEST_PATHS` forms ⇒ outside | **no — Marco's** |
| `#2127` | `apps/api/src/modules/field/field.service.ts`, `docs/pr-prompts/superseded/…` | **1** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` | **no — Marco's** |

**Three controls, all passing.** POSITIVE `marco.:true` over the same corpus → **705** (written
without a quote character; the `-SimpleMatch '"marco":true'` form returns 0 and so does its negative
control). NEGATIVE, freshly minted needle `zzQq00Needle20260924T0221` → **0**. FRESHNESS, which
separates the live corpus from the dead clone copy: newest log `rev-2146-ready.md.log` at
`2026-09-24T01:46:32Z`, **younger than the oldest open PR** (`#2127`, created `09-23T16:36:48Z`).

**Neither verdict is a prose scrape** (`PRNUMBER_SCRAPED_FROM_PROSE_V1`). Each sits in the log of a
prompt whose own slug names that PR's subject — `pr-devtree-sync-ff-only-guard` for `#2135`,
`pr-field-service-nul-separator` for `#2127` — and each `reason` quotes a file I independently
confirmed is in that PR's file list, above.

**`#2131`: step 3's station-lane exception does not rescue it.** 00's recorded lane in the §5
authority matrix is `docs/`; `scripts/` is outside it, so the PR strays outside its station's lane and
falls through to step 2 unchanged. This is exactly
`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` — a green, unlabelled, `scripts/`-touching PR that
repairs this pipeline's own instruments is the one a station is most tempted to merge itself.

**§10.1's own falsifying probe, re-run against `origin/main`:**
`git show origin/main:scripts/pr-watcher/index.mjs | Select-String 'NESTED_TEST_PATHS'` → the
**three-form array is still present**, with its explanatory comment intact. The paragraph stands; the
single-regex regression it warns about has not returned.

**All six read `labels=[]`, `isDraft=False`, author `GH-Mantova`.** No `do-not-merge` was present to
respect and none to remove.

### The trunk

[MEASURED] `main CI on fcdf66c0: 4 success / 0 failed / 0 running (trunk green)` at `02:16:04Z`. No
trunk red this run, so no `fixes_pr` was owed.

### The queue

[MEASURED] `triage-holds.ps1`, `TRIAGE_EXIT=0`, READ-ONLY, run **after** fast-forwarding the dev tree
to `7adb1fce` so the three newly-landed HOLDs were in the corpus:

```
=== TOTALS  spent=0 of 16 evaluated  gates-satisfied=2  still-gated=14  unreadable=0
            of 16 prompts (HOLD=16, ready=0, LOOPING=0)
```

Both instrument controls printed PASS — `GIT control: PASS` (gate probes can run) and
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture` — so `spent=0` means *none*,
not *this instrument cannot say*. The two gate-satisfied are `pr-fv2-formrule-contract-HOLD.md`
(on this station doc's never-arm list, verbatim) and **`pr-sec-a3-no-credential-logs-HOLD.md`**, which
is **F2**.

### §9.1 fired twice on me, and both times the documented cure worked

[MEASURED] `powershell.exe -NoProfile -Command "… Write-Output ('X=' + $LASTEXITCODE)"` reached the
shell with the `$`-variable **stripped**, producing
`You must provide a value expression following the '+' operator`. A second `-Command` call with six
`$` variables arrived as `foreach ( in 2143,2144)`. That is the command-layer expansion trap; the cure
is the one §9.1 names — **put it in a script file**. Every measurement in this report after that point
came from a `.ps1` under `C:\po-sup-fix-scripts\`, never from `-Command` with a `$` in it. Recorded
because it cost two round-trips and because a reader who sees only the script files would not know
why they are there.

## WHAT CHANGED

**1. Merged three PRs, each read back to `main`.** Condition 3 was re-read immediately before each,
never once carried from a previous reading:

| PR | gate re-read at | `Merge-Pr` | `mergedAt` | merge commit | `origin/main` after | reached main |
|---|---|---|---|---|---|---|
| `#2142` | `02:19:45Z` — lock False/False, 0 git procs, **0** PRs inside the 2-min window | `True` | `02:19:55Z` | `688f7e4c` | `688f7e4c` | **True** |
| `#2143` | `02:24:36Z` — same, 0 inside the window | `True` | `02:24:45Z` | `30949356` | `30949356` | **True** |
| `#2144` | `02:31:58Z` — same, 0 inside the window | `True` | `02:32:07Z` | `7adb1fce` | `7adb1fce` | **True** |

All three via the sanctioned path `Assert-SmokedOrEscalate` → `Merge-Pr`. **No raw `gh pr merge`, no
hand `git merge`, no `--admin`, at any point.**

**2. Armed `pr-sec-a3-no-credential-logs`** via `arm-prompt.ps1 -Name pr-sec-a3-no-credential-logs
-Actor station-00`, `ARM_EXIT=0`. See **F2** for the gate evidence and the read-backs.

**3. Created one isolated worktree off `origin/main` on the Windows FS**, per condition 2:
`C:\po-wt\collect0242` on `board/collect-2026-09-24-0242` at `7adb1fce`, `WT_EXIT=0`. Read back with
`git worktree list`.

**4. Swept Station 04's `docs/pipeline/sweep-rotation.json` advance into this PR.** 04 advances it and
may not commit in the shared dev tree, so it is 00's to land. It was already ` M` in the dev tree
**before** my fast-forward — measured, so it is 04's edit and not something this run caused.

**5. This breadcrumb, written INSIDE the PR worktree** — cure 1 of the post-merge fast-forward rule.
No loose copy is left in the dev tree, so this run creates no untracked FF blocker at a path its own
PR is about to land.

`git diff --cached --name-status` in the **dev tree** was read EMPTY before arming and EMPTY after it
(`arm-prompt.ps1` releases its own staged rename, `ARM_INDEX_RELEASED`), so I collided with no
concurrent chat. Everything staged is in the worktree's own index.

Scratch files outside the repo, in the sanctioned scratch folder `C:\po-sup-fix-scripts\`:
`lane-0220.ps1`, `merge-0225.ps1`, `merge2-0224.ps1`, `check-0224.ps1`, `triage-0233.ps1`,
`arm-precheck-0236.ps1`, `arm-0238.ps1`, `wt-0242.ps1`, `postarm-0240.ps1`, `wq-0246.ps1`.

**No label added or removed. No branch of Marco's updated. No prompt moved outside the archive and
the one arming rename. `/sot/` untouched. No production data. Azure / Entra / SharePoint untouched.**

## FINDINGS

### F1 — The three sec-auth staging PRs are MERGED. My predecessor's F2 handover is discharged, and the board is down from six open PRs to three.

My predecessor withheld `#2142`/`#2143`/`#2144` under condition 3 — they had been opened by a second
lane ninety seconds before it looked — and handed this run an explicit instruction: *"The next run
should re-read the gate and, if it is quiet, merge all three."*

**I did not take that classification on trust.** §10.1 forbids carrying a lane verdict forward, so I
re-probed all three: **0 verdict hits each**, each a single file under `docs/pr-prompts/`, which
`classifyPolicyFiles` admits under step 2 unaided via `^(tests|docs)/`. In-lane, and in 00's own
recorded `docs/` lane as well. The gate was quiet at every one of the three re-reads (table above).

**DISPOSITION: ACTIONED** — all three merged and read back to `main` individually, never from a list
response (§9.4). The board is now `#2135`, `#2131`, `#2127`.

---

### F2 — Armed `pr-sec-a3-no-credential-logs`: the first genuinely armable prompt in five runs. Production is logging live sign-in codes and password-reset tokens today.

The premise, in the prompt's own words: *"In production the API writes live field-worker sign-in codes
and client-portal password-reset links (with their token) into the application log, where anyone with
log access can use them."*

**Six checks before arming, each with a control:**

| check | result |
|---|---|
| lint verdict | **ADMIT** (exit 0) — and lint runs the premise LAST, so the premise was evaluated |
| premise re-run by hand over `apps/api/src` | marker `SEC_A3_NO_CREDENTIAL_LOGS_V1` → **0 hits** ⇒ premise TRUE, not shipped |
| POSITIVE control, same corpus | `LoggingOtpDelivery` → **4 hits** |
| NEGATIVE control, freshly minted needle | `zzQq00Needle20260924T0236` → **0 hits** |
| duplicate against the **MERGED** board, not just open | 60 merged PRs scanned, **0** titles matching `sec-a3\|no-credential-logs\|SEC_A3`; POSITIVE control `station 00` → **39** |
| never-arm denylist | **not on it**; POSITIVE control `pr-fv2-formrule-contract-HOLD.md` → **on it** |

**ADMIT is necessary, not sufficient (§9.5), so I read the body for a prose human gate the linter
cannot see.** Line 25 says the opposite of a gate: *"Ships alone, no gate."* It is `cluster_order: 1`
of three, and its two siblings `pr-sec-a1` and `pr-sec-a2` both REJECT `[HUMAN_GATE_PRESENT]` —
correctly waiting behind it. It carries an explicit **STANDING AUTHORITY** block and the guardrail
*"Authentication change: label the PR `do-not-merge` for Marco's review."*

**`escalates: true` is not a reason to withhold it** — DOCTRINE §5b: the flag gates the MERGE, not the
RUN, and *"Do NOT blanket-quarantine `escalates: true` prompts"* is a recorded incident, not advice.

**Hard stops checked and clear:** code-only, no Azure/Entra/SharePoint (the prompt says so twice and
its file scope confirms it), no migration, no production data, no human identity.

**RULE 1, both halves.** Complete: it removes the credential from the log permanently, in production,
by construction rather than by convention. Additive: `LoggingOtpDelivery` is untouched so dev/CI/e2e
keep reading the code back; the change is a new file plus a factory binding. Nothing existing is
retyped, dropped or migrated.

**Arming is a `git mv` of a TRACKED file, never the creation of a `-ready.md`** (`.gitignore:75`
swallows a created one): `git ls-files` on the HOLD path returned the path, so the rename is real.
`arm-prompt.ps1` serialized behind its OS lock, verified the index clean before and after, confirmed
**RULE 4 — no other prompt already armed**, and released its own staged rename. **Read-backs:** HOLD
present → `False`; ready present → `True`; armed count → **1**; dev-tree staged → **EMPTY**; audit
line appended to `.arming-log.txt` (committed in this PR, as §9.5 requires of any run that arms).

⚠️ **Consumption is NOT yet read back, and I am not claiming it.** [MEASURED] at `02:40:31Z`, 5.6
minutes after arming: `-ready.md` still on disk, nothing in `processed/`, watcher node **pid 38776
alive** since `09-23T18:39:56Z`. The previous arming (`pr-devtree-sync-ff-only-guard`, `20:35:38Z`)
produced `#2135` at `20:41Z` — **~6 minutes** — so 5.6 minutes is inside the normal window and an
absence here is not evidence of a wedge. **Falsifying probe for the next run:** if
`pr-sec-a3-no-credential-logs-ready.md` is still at `docs/pr-prompts/` depth 1 with no PR open for it
and no `processed/` copy, the watcher did not consume it — that is a real defect and it is Station
03's.

**DISPOSITION: ACTIONED** — armed, every gate measured, read back four ways. **Deliberately not
dispatched:** the watcher consuming an armed prompt is the normal path, not a hand-over.

---

### F3 — Marco's three PRs are still his, by two routes, re-taken from scratch for the fifth consecutive run.

`#2135` and `#2127` carry real watcher `marco:true` verdicts; `#2131` hand-classifies to Marco on
`scripts/pipeline/why-blocked.ps1`. Full evidence and controls in WHAT I MEASURED. **No agent-side
action exists behind a `marco:true`** — this is not a task anyone can complete.

**DISPOSITION: ESCALATED** — carried unchanged to the existing standing file
`instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`. **Not re-filed as a new
question**; a fifth instance of a filed class is noise, and my predecessor already put the same
finding there four runs running.

---

### F4 — The addendum's auto-update correction is CONFIRMED, not refuted — and I now have the timings. Branch auto-update lands ~100 s after a merge, and a docs-only PR re-greens ~4 min later.

My predecessor's addendum recorded that all six open branches were updated 105 seconds after its
merge by something that was not that run, marked the CAUSE `[CANNOT MEASURE]`, and left an explicit
falsifying probe: *"after the next board-PR merge … if no `Merge branch 'main' into …` commit appears
within a few minutes, the auto-update is not systematic and this correction must be re-measured."*

**I ran it, and it CONFIRMS the correction:**

| time | `#2143` head | `#2144` head | merge state |
|---|---|---|---|
| `02:19:55Z` | `94dd2665` | `b93ee89b` | `#2142` merges |
| `02:21:31Z` (+96 s) | `94dd2665` | `b93ee89b` | both **BEHIND**, heads unchanged |
| `02:24:05Z` (+250 s) | **`e5eacb76`** | **`40dcdfff`** | both **CLEAN**, 10/10 green again |

Both heads advanced and both PRs re-greened **with no action from this run** — I ran no
`gh pr update-branch` at any point, and `Merge-Pr`'s path does not. The update therefore lands
between 96 s and 250 s after a merge, and a **docs-only** PR is back to CLEAN inside that same window.

🔧 **This sharpens the cost estimate in a way that matters for the escalation.** The addendum's
measured cost was *"a full CI cycle per open PR per board merge"*, anchored on a ~30-minute
`tendering-e2e` run. That is the cost for a **code** PR. For a **docs-only** PR it is roughly four
minutes, which is why merging three docs PRs back-to-back was viable this run at all. The expensive
case is unchanged and is exactly Marco's three.

⚠️ **The CAUSE remains `[CANNOT MEASURE]`** after my predecessor's two honest attempts. I did not
spend a third; the mechanism claim is now well-attested twice and the cause does not change what
anyone does about it.

⚠️ **I also confirmed the second-order effect the addendum did not reach:** the auto-update **restarts
CI**, and `Assert-SmokeGreen` correctly refused `#2144` at `02:28:17Z` because
`Pipeline — arm-prompt tests (Windows)` was `IN_PROGRESS`, 12 seconds after that PR's own
auto-update. The guard's message is the right instruction and I followed it verbatim — *"WAIT. Do not
rebase, do not merge, do not 'retrigger'"* — and merged four minutes later. **A run that reads that
refusal as a defect and rebases would loop forever.**

**DISPOSITION: ESCALATED** — carried to the existing
`hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md`, with the confirmation and the two timings
added as evidence. The decision that is Marco's, already in that file, is whether 00's board PR should
batch across runs rather than land hourly. **This run landed exactly one board PR, not two.**

---

### F5 — `Assert-SmokedOrEscalate` returns `Object[]`, not `Boolean` — §7 standing guard #6, live inside the one primitive every merge in this pipeline goes through.

[MEASURED] three times this run: `Assert-SmokedOrEscalate -PR <n>` → `[True|True]`, `.GetType().Name`
→ **`Object[]`**. Read from the source, the cause is exact and one line:

```powershell
function Assert-SmokedOrEscalate {
    Assert-Mergeable  -PR $PR
    Assert-SmokeGreen -PR $PR      # <-- has its own `return $true`, called as a bare statement
    ...
    return $true                   # <-- so the caller gets TWO values, as an array
}
```

`Assert-SmokeGreen` ends in `return $true`; `Assert-SmokedOrEscalate` calls it without assigning it or
piping to `Out-Null`, so that `$true` flows into the parent's output stream and joins the parent's
own. That is DOCTRINE §7 standing guard #6 — *"No `Write-Output` inside a PowerShell function whose
return value you capture"* — in the function DOCTRINE, `STATION-CAPABILITIES.md` and three station
docs all name as the only sanctioned way to merge.

🔴 **Why it is a finding and not a curiosity.** An agent writing the obvious
`if (Assert-SmokedOrEscalate -PR $n) { Merge-Pr -PR $n }` is testing the truthiness of a **two-element
array**, which is `$true` for `@($false,$false)` as readily as for `@($true,$true)`. **I wrote exactly
that line this run.** It was safe only because the inner asserts *throw* on failure and never return
at all — which `#2144`'s refusal at `02:28:17Z` demonstrates positively. **The gate is doing its job
today by a route its own return value does not express**, and the day any inner assert is changed from
throw-to-`$false`, every such caller silently becomes a no-op. That is the precise shape that once let
the merge queue select `#552`, the production-data PR (§1's table, row 3).

⚠️ **Blast radius, measured, so nobody over-reads this:** `Select-String` for
`Assert-SmokedOrEscalate` recursively across `scripts/` and `docs/pipeline/` (DOCTRINE included) →
**14 hits — `.ps1`=1, `.md`=13 — of which `0` match `if\s*\(\s*Assert-SmokedOrEscalate`.** The single
`.ps1` hit is the definition itself; all 13 others are documentation. POSITIVE control `Merge-Pr` over
`scripts/**/*.ps1` → **5**; NEGATIVE control, freshly minted needle `zzQq00Needle20260924T0250` →
**0**. **So no shipped script is exposed today. The exposed caller is the agent, every run, following
the docs** — which is how this run came to write the unsafe form.

⚠️ I first ran this count non-recursively over a narrower file set and got **12** with a `Merge-Pr`
control of **3**. Both were low. The figures above are the recursive re-run and are the ones to quote;
the conclusion is unchanged either way. Recorded rather than silently overwritten, because a count
that moved once will be re-measured by whoever acts on this.

🔧 **The fix is one character of discipline:** `Assert-SmokeGreen -PR $PR | Out-Null` (and the same for
`Assert-Mergeable` and `Assert-BodyClaimsAreReal`), leaving the single `return $true`. A regression
test asserting `(Assert-SmokedOrEscalate -PR <fixture>) -is [bool]` would hold it.

⚠️ **Falsifying probe:** call it on any green PR and print `.GetType().Name`. If it reports `Boolean`,
this finding is already fixed and must be struck.

**DISPOSITION: DISPATCHED → Station 06 (PR Master).** The remedy is a prompt staging a
three-line change in `scripts/pipeline/pipeline-lib.ps1` plus one regression test. 06 is demonstrably
active on this board — it staged the three sec-auth prompts this run merged — and staging is its lane.
**I did not author the prompt myself:** `scripts/` is outside 00's `docs/` lane, so a prompt from me
would land as a PR only Marco could merge (F3), which is the constraint this board is already under.

---

### F6 — The device-bridge git guard installed INERT (exit 2) for the fourth consecutive run. The expected station outcome, honoured rather than reasoned past.

Exit **2**, read from the installer and not from a pipeline appended to it, with its own two controls
printed in its output. The shim is byte-correct and off the `PATH` of the non-interactive, non-login
shell a station is given, so the ban was remembered rather than mechanical. I honoured it: **zero
`git` calls through the device bridge against either Windows `.git`.** Every `git` in this report ran
in `powershell.exe` on the Windows host.

**DISPOSITION: DEFERRED** — expected behaviour per the contract's own three-outcome table, already the
subject of merged work (`#2065`). Recorded because the contract requires the exit code and last line
whichever outcome occurred. **Urgent if** it ever exits **0** (the ban became mechanical, and the
remembered-discipline warnings can be relaxed) or non-zero-but-not-2 (the shim was not written).

---

### F7 — The watcher and the stations are healthy, and this is the line that says so on purpose.

Watcher node **RUNNING pid 38776**, up since `2026-09-23T18:39:56Z` — the same PID Station 03 resolved
by command line at `23:04Z` and the last two 00 runs confirmed, so **no ninth death** in eight hours.
Auto-restart wrapper alive (1). Heartbeat 31 min at sweep time with **0 armed** is idle and correct,
not wedged. Guard hook present. `git worktree list` — the instrument that is complete by construction,
which my predecessor's F3 showed the sweep's root-scan is not — returned the **dev tree alone** before
I created mine, so there were **no escapees**, including under `C:\PR-Master`.

All four enabled stations reported on cadence, `--freshness` **CLEAN** exit 0, every row crossed
against the station doc's `lastRunAt` table, and 04's fresh-`lastRunAt`-no-breadcrumb row positively
confirmed as the mid-run case by a running session. **No LOOP, no STALL, no WEDGED/DOWN watcher, no
>45-minute process, no new silent no-op.**

`watcher clone: branch=main dirty=3` is the known false warning whose two `git status` forms disagree;
Station 03 re-ran §9.5's falsifying probe at `23:04Z` and it still stands, so this is **not** a
dispatch — its measured cost is thirteen mis-routed dispatches already sitting in `archive/`.

**DISPOSITION: ACTIONED** — measured, nothing to do. Stated in one line rather than left silent,
because the station doc requires exactly that and because silence here is indistinguishable from a
blind run.

---

### F8 — Station 04 left `docs/pipeline/sweep-rotation.json` dirty in the shared dev tree, as its own station doc instructs. Swept into this PR.

[MEASURED] `git status --porcelain --untracked-files=no` in the dev tree, taken **before** my
fast-forward, read ` M docs/pipeline/sweep-rotation.json` — so the edit predates anything this run
did, and 04 ran at `02:09:41Z`. 04 advances the rotation with `next-sweep.mjs --advance` and may not
commit in the shared tree; 00 lands it. Left uncommitted it is the **second** documented cause of a
refused post-merge fast-forward, the one that survives the untracked-breadcrumb cure untouched.

**DISPOSITION: ACTIONED** — copied into this run's worktree and committed in this board PR, which is
the prescribed route. Verified in the worktree index as `M docs/pipeline/sweep-rotation.json`.

## WHAT I DID NOT DO

- **Did not merge any PR that classifies to Marco.** `#2135` and `#2127` carry real `marco:true`
  verdicts and `#2131` hand-classifies to him (F3). I did not reach for `gh pr merge`, `--admin`, or a
  hand `git merge` at any point; the three merges I did make went through
  `Assert-SmokedOrEscalate` → `Merge-Pr` and were each read back to `main` individually.
- **Did not rebase or retrigger `#2144` when its gate refused.** The refusal was correct — its CI had
  restarted 12 seconds earlier — and the guard's own message forbids exactly that. I waited (F4).
- **Did not update any branch of Marco's.** F4 shows the update happens anyway, ~100 s after a merge,
  with no action from this run.
- **Did not remove or add a label.** All six PRs read `labels=[]`; only Marco removes `do-not-merge`,
  and none was present.
- **Did not arm a second prompt.** ARM ONE AT A TIME; `arm-prompt.ps1` enforced RULE 4 as well.
  `pr-fv2-formrule-contract-HOLD.md` also ADMITs and is on the never-arm list verbatim — checked and
  deliberately left.
- **Did not claim the watcher consumed the armed prompt.** It had not at `02:40:31Z` and 5.6 minutes
  is inside the normal window; F2 carries the falsifying probe for the next run instead of a guess.
- **Did not author the F5 prompt myself.** `scripts/` is outside 00's lane, so it would land as a PR
  only Marco could merge. Dispatched to 06.
- **Did not re-derive the watcher chain, re-sample the queue state, count the clone's stashes, or
  triage `failed/`/`no-pr-opened/`.** Station 03 owns all of those and ran at `23:04Z`; nothing in the
  sweep contradicts it. Doing 03's work myself is the LL-38 incident.
- **Did not discharge anything from `needs-marco/`.** Section 5 emitted zero `[STALE]` rows this run
  and explicitly said it cannot decide the one file it flagged.
- **Did not run `git` through the device bridge against either Windows `.git`** (F6), and ran no
  `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean` anywhere —
  consumed prompts come back armed (§9.2).
- **Did not commit anything on `main` or in the dev tree.** Every commit is in the disposable
  worktree, whose index is its own; the dev-tree index was read EMPTY before and after arming.
- **Did not touch `C:\po-watcher\ProjectOperations` with any write.**
- **Did not touch Azure, Entra or SharePoint**, and did not write production data. Absolute, and not
  reasoned past — including on a prompt whose whole subject is production authentication.
- **Did not edit `/sot/`.** That is Station 05's, gated by CP-24.
- **Did not invoke another station's skill.**

<run-summary>Merged all three sec-auth staging PRs my predecessor had withheld under the single-actor gate, taking their lane verdicts fresh rather than on trust, which cut the board from six open PRs to three; armed pr-sec-a3-no-credential-logs, the first armable prompt in five runs, against six measured gate checks; confirmed the previous run's auto-update correction with the falsifying probe it asked for and timed it at 96-250 seconds; and found the sanctioned merge primitive returns a two-element array rather than a boolean, so every documented `if (Assert-SmokedOrEscalate ...)` is a truthiness test that cannot fail.</run-summary>
