# Station 00 — Supervisor | 2026-09-21T03:08Z–2026-09-21T03:26Z

## GROUND

```
UTC            2026-09-21T03:09:36Z
origin/main    29abf8d4              (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 29abf8d4       C:\ProjectOperations2
doc version    1                     (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**, so this run is not restricted to read-only by the mismatch
clause. It mutated nothing anyway, for the reason in F-1.

⚠️ The bootstrap's prose still says *"Cadence: every 2 hours"*. [MEASURED] from the scheduled-tasks
MCP: `00-supervisor` `cronExpression 5 * * * *` — **hourly**. This is the drift
`STATION-CAPABILITIES.md` §6 already records ("read the live cron from the MCP, never from here");
the `station_doc_version` fields are what the mismatch clause tests, and those agree. Not re-filed.

## WHAT I MEASURED

**Reachability — this run was SIGHTED.** Desktop Commander tools arrive deferred; loaded by keyword
`ToolSearch` first, then `start_process` shell `powershell.exe` answered on the first call:
`HOST_REACHED=LAPTOP-E6NHU4E4`, `main`, `29abf8d4`. A blind run and a healthy quiet run both produce
"no news" — this was the healthy quiet one, and the difference is stated rather than assumed.

**Device-bridge git guard installed FIRST, before any VM-side call, last line quoted verbatim:**
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(preceded by `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and
mounted cwd, allows everything else (three controls passed)`). No `git` ran through the mount at any
point in this run.

**Binding documents, read in full from content proved identical to `origin/main`.** PREFLIGHT 2 says
read from `origin/main`, never the working copy. [MEASURED] with the sound unpiped form (§9.1 — a
piped `hash-object` is unsound under `powershell.exe`), run in the **dev tree**, never the clone:
`git diff --numstat origin/main -- <path>` returned **EMPTY** for all three of
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md`; `git rev-list --left-right --count HEAD...origin/main` →
`0 0`. So the working copy **is** `origin/main` for these files and reading it is reading `main`.
All three read in full — 1350 + 2616 + 545 lines.

**Sweep — and the first read of it was WRONG, which is why this line exists.** `status-sweep.ps1`
captured to a file and decoded `utf16le` in node (§9.3 — `*>` writes UTF-16LE). My first read, at
24,176 bytes, showed the report ending at section 5 with **no section 6 and no section 7 verdict**.
The available conclusion was *"the sweep returned early and hid its own verdict"* — which is a
documented failure mode and would have been filed as one. It was false: **the sweep was still
writing.** [MEASURED] the file grew 24,176 → 34,570 → 156,994 bytes across three reads, settling at
`LastWriteTimeUtc 03:17:01Z`; final report **935 lines, 8 sections**, ending `SWEEP COMPLETE`.
🔴 **And my own liveness probe for it was self-matching:** `Get-CimInstance Win32_Process |
Where-Object { $_.CommandLine -match 'status-sweep' }` returned **2** with zero sweeps running,
because the probe's own command line contains the string `status-sweep`. Re-measured with
`-match 'status-sweep\.ps1' -and -notmatch 'CimInstance'` → **0**, cross-checked against the file
having stopped growing. **A process probe that matches its own command line is §7's shape**, and the
zero it hides is the one that says "you may now read this file".

**Section 7 verdict, verbatim, from the COMPLETE file:**
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
[MEASURED] `[BROKEN]` **0** and `[STALE]` **0** as tagged rows — all four `[STALE]` string hits and
the one `[BROKEN]` hit are the legend text in the HOW TO READ header, not tagged rows.
🔴 **That verdict was true when printed at 03:13:01Z and FALSE by 03:14:49Z** — see F-1. This is the
`[LIVE]` rule in its cheapest form, met head-on in the one line that authorises acting.

**Section 5 holds no discharge work this cycle.** Every row is `[FILE]`, and all of them read
`cites #N (MERGED) as evidence -- not its premise; does not clear the escalation` — which is the
sweep declining to stale-tag them, not a stale tag. **0 `[STALE]` escalation rows means the
COLLECT-time discharge step has nothing to do this run**, which is worth stating because the station
doc describes a run that found eleven.

**COLLECT — freshness, then the cross-check the breadcrumb cannot do alone.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 3 checked, 0 malformed`,
`CLEAN`, **exit 0**; `00` 0.6h · `03` 2.9h · `04` 1.1h · `05` 3.2h, all `ok`.
⚠️ `--freshness` reads `00`'s cadence as **2h** from its own `CADENCE` map while the live cron is
hourly, so a green `ok` is a weaker statement about `00` than about any other station — the defect
`STATION-CAPABILITIES.md` §6 records. Crossed against `lastRunAt` from the scheduled-tasks MCP,
which that defect does not touch:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | 2026-09-21T03:08:28Z (**this run**) | 02:35Z | fresh and aligned |
| `03` | 2026-09-21T00:20:35Z | 00:21Z | fresh and aligned |
| `04` | 2026-09-21T02:10:07Z | 02:10Z | fresh and aligned |
| `05` | 2026-09-21T00:04:02Z | 00:04Z | fresh and aligned |

**No station is SILENT and none needs a transcript read.** [MEASURED] the live ENABLED task set is
**four** — `00` `5 * * * *`, `03` `0 9 * * *`, `04` `0 */4 * * *`, `05` `10 0 * * *` — with
`weekly-security-audit` `enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`). That is the corpus
stated as a rule, not as a count, per `STATION-CAPABILITIES.md` §1.

**Board — Q1, verbatim, and it changed twice while I watched.** At 03:13:01Z the sweep read
`OPEN PRs: 1`. [MEASURED] at 03:20Z, `gh pr list -R GH-Mantova/ProjectOperations --state open
--json number,title,mergeStateStatus,isDraft,headRefName,labels`, exit 0:

| PR | mergeStateStatus | labels | created | lane |
|---|---|---|---|---|
| `#2017` | BLOCKED | `do-not-merge` | 09-17T19:32:53Z | watcher (verdict on file) |
| `#2026` | CLEAN | none | **03:14:49Z** | second lane |
| `#2027` | BLOCKED→green | none | **03:19:09Z** | second lane |

**DIRTY = 0**, so no PR has frozen CI and the board is not conflict-blocked (Q1's real question).
`#2027` read BLOCKED at 03:21Z and that was checks-pending on a two-minute-old PR: re-read at
03:24Z, **every check passes or skips on both**, CP-26 `pass` on each.
⚠️ Per §9.4 a `pass` on CP-26 for a never-labelled PR is `NEVER_ESCALATED` — *a statement about a
release that never happened*, not a merge clearance. I did not read it as one.

**Lane identification, §10.1, with both controls.** [MEASURED]
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` (prompt logs only,
`rev-*` excluded, §9.5): `#2026` → **0**, `#2027` → **0**; POSITIVE control `#2017` → **1**,
NEGATIVE control `PR #999412` → **0**. So neither came through the watcher.
**Authoring identity, read per-commit from the PR's own commit list (§10.2.1 — the squash commit is
all `main` retains):** both author as **`PR Supervisor <supervisor@local>`**, which that section's
corrected table says names the **dev tree `C:\ProjectOperations2` and every worktree sharing its
`.git/config`** — a tree, not an actor. The actor is named in the commit body of `#2027`:
*"Marco ruled option (b) in chat, 2026-09-21"*. **That is the supervised Station 00 lane of §10.2.1,
with Marco live in the chat directing it.**

**Trunk — re-derived from its own source, not carried from the sweep (§9.5: provenance is not
correctness).** [MEASURED] `gh run list -R GH-Mantova/ProjectOperations --commit
29abf8d4986af9be42d01d4597988af892327aa8 --json workflowName,event,status,conclusion,attempt` (full
40-char SHA per §9.4), exit 0, 4 runs: `CI`/push, `Tendering Browser Smoke`/push, `Deploy`/push,
`CodeQL`/dynamic — **all `success`, all attempt 1**. Applying `TRUNK_VERDICT_SCOPED_V1`'s denylist:
`trunkOnly=4 trunkFailures=0`. NEGATIVE control, `--commit 000…0` → `[]`, exit 0.
**Trunk is green, and unlike the previous two cycles it is green on attempt 1** — the WebKit flake
that cost the 02:08Z and 02:10Z runs a finding each has not recurred.

**Watcher — the sanctioned probe, never `ps`, never my own reasoning.**
`scripts\restart-watcher-if-wedged.ps1` (no `-Fix`): `watcher process: ALIVE (pid 9744)`,
`restart churn: 0 cycle(s) in 20 min`, `queue last moved: 47 min ago`, `heartbeat last write: 0 min
ago`, **`VERDICT: HEALTHY - no action.`** The sweep's own `[LIVE]` line agrees (pid 9744, wrapper
alive). An idle watcher against an empty prompt queue is correct, not wedged.

**Queue — Q3, counted by my own hands, not quoted from a note.** [MEASURED]
`Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → **1**: `rev-2026-ready.md`.
`*-HOLD.md` → **28**. `*-LOOPING.md` → **0**.
🔴 **The real armed-prompt count is 0.** `rev-<n>-ready.md` is an auto-generated REVIEW JOB, not a
prompt (§9.5) — `restart-watcher-if-wedged.ps1` prints `armed prompts waiting: 1` counting it, and
that number must not be read as armed work. See F-4 for what that particular review job is.

## WHAT CHANGED

**Nothing.** No PR merged, opened, updated, labelled or closed. No prompt armed, disarmed, renamed,
moved or staged. No branch, worktree, stash, lock or label touched. No commit, in any tree. `/sot/`
untouched. No Azure, Entra or SharePoint call of any kind.

**One write, and it is deliberately not a commit:** this breadcrumb, written to
`C:\ProjectOperations2\docs\pr-prompts\` and left **UNTRACKED**. [MEASURED] immediately before
writing: `git diff --cached --name-status` → **EMPTY** and `git diff --numstat` → **EMPTY**, so
nothing another actor staged is at risk, and I added nothing to the index.

🔴 **This breadcrumb needs sweeping up and says so.** The station contract prefers writing it inside
this run's own PR worktree — I did not open one, because opening and merging a board PR is the board
mutation F-1 rules out. It is therefore untracked in the dev tree until
`scripts/pipeline/sweep-breadcrumbs.ps1` or a later run's board PR commits it. **Until then this
report reaches nobody who does not read the dev tree**, and that is the price of the F-1 decision,
stated rather than hidden.

## FINDINGS

### F-1 — A supervised lane with Marco in it opened two PRs mid-run, so BOARD DRIVING condition 3 fails and I mutated nothing

The sweep's section 7 said `SAFE TO ACT … no recent remote activity` at **03:13:01Z**. `#2026` was
created at **03:14:49Z** and `#2027` at **03:19:09Z**; at 03:21:00Z `#2027` read
`updated 1.9 min ago`. **Condition 3 names exactly this** — *"a PR touched in the last ~2 min … If
something else is acting, STOP: that is the LL-38 collision."*

Both PRs are second lane by the §10.1 step-1 probe with both controls passing, both author as the
dev tree's identity, and `#2027`'s commit body transcribes a ruling Marco gave **in chat today**.
That is the §10.2.1 supervised lane, which may merge PRs Marco releases to it live. It is not a
rogue actor and it is not a defect — it is the one lane that has an input I do not: Marco, present.

**So the merge I might otherwise have made is the wrong move, not merely the cautious one.** `#2026`
is docs-only and CLEAN — squarely inside my lane on paper, and I could have merged it through
`Assert-SmokedOrEscalate` → `Merge-Pr` without breaking a single written rule about *what* I may
merge. It would still have been a collision: that PR is another actor's in-flight work, being
directed turn by turn by Marco, and the pipeline's founding incident (LL-38) is two actors mutating
shared state without knowing about each other. **Condition 3 is the load-bearing one precisely
because the PR it stops you touching usually looks mergeable.**

I also did not fast-forward the dev tree, and that matters more than it looks: the supervised lane
commits with the dev tree's `git config`, so it is using that tree's `.git` while I run.

**DISPOSITION: ACTIONED** — measured, identified by lane and by actor, and the board left alone.
Verified at the end of the run: `git diff --cached --name-status` EMPTY, `git diff --numstat` EMPTY,
`.git/index.lock` absent, `git.exe` processes **0**, `git worktree list` unchanged (dev tree +
`po-vg` only). **The falsifying probe for the lane attribution is `#2027`'s authoring commit** —
`gh pr view 2027 --json commits`, read per-commit; if it ever authors as
`Marco <marco@initialservices.net>` it is a watcher build and this finding is wrong.

### F-2 — 04's cycle is fully collected; the one hand-over addressed to this run is deferred, and the reason is not the slot

The 02:35Z addendum collected all nine of 04's 02:10Z findings and dispositioned each. I re-read
both and confirm there is no uncollected finding: F1→DEFERRED+DISPATCHED, F2→ACTIONED (three
stale-remote-head escalations consolidated into one, none deleted, banners asserted by byte delta),
F3→ACTIONED, F4→ACTIONED, F5→DISPATCHED to 03, F6→DEFERRED, F7→DEFERRED, F8→DEFERRED, F9→ACTIONED.
**Nothing from 04 is outstanding to me.**

The one item addressed to *this* run is that addendum's own F-B: *"The next run with slot should
stage it as a `-HOLD.md` carrying option (a) whole — the `reports/` move and the
`check-breadcrumb.mjs` structure-pass widening in one diff."* That is the DOCTRINE §8.5 contradiction
04 found: §8.5 sends breadcrumbs to `docs/pr-prompts/reports/`, which does not exist and has 0
tracked paths, while the `station-contract` canonical block mandates depth 1 and
`check-breadcrumb.mjs`'s structure pass reads `readdirSync(DIR)` — depth 1 only.

**I am not staging it this run, and not because I ran out of slot.** Staging writes a file into
`docs/pr-prompts/` — the directory the supervised lane is actively working in, in a tree it is
committing from — and lands it by a PR and a dev-tree fast-forward. Every step of that is the
mutation F-1 rules out. Doing the write anyway "because it is only one file" is how condition 3 gets
reasoned past.

**DISPOSITION: DEFERRED** — to the next 00 occurrence (`2026-09-21T04:07:52Z`), with the trigger
unchanged from the addendum: it becomes urgent **the moment anyone implements S4**, which is the
first point at which the contradiction has an effect rather than being latent. The next run should
check condition 3 first and, if the lane has gone quiet, stage option (a) **whole** — the `reports/`
move *and* the validator widening in one diff. Taking only the half that fits my merge lane is how a
complete fix becomes a partial one permanently.

### F-3 — `#2017` is still one label away from releasing a three-slice CRM chain

[MEASURED] `#2017` carries `do-not-merge`, described by the label itself as
`escalates:true - Marco merges this, not automation (DOCTRINE 5b)`. Its **only** two failing checks
are `Approval receipt (CP-26)` and `PR gates — diff checks`, which is §9.4's documented shape: one
cause, two reds, **parked by design**. Thirteen checks pass. `mergeStateStatus BLOCKED`, `DIRTY 0`.
Open since 2026-09-17T19:32:53Z — **3.3 days**.

Only Marco removes that label; there is no agent-side action behind `[LABEL_PRESENT]`, and a run
that meets it has finished. This is the same escalation the 01:10Z and 02:08Z runs raised.

**DISPOSITION: ESCALATED** — Marco, as one line and not a chase: *`#2017` is green on all thirteen
real checks; the only two reds are the CP-26 pair, which is the `do-not-merge` label itself.
Removing it releases a three-slice CRM chain that is otherwise idle.* ⚠️ **And he is in a chat right
now** (F-1) — this is the cheapest moment in three days to ask him, which is the one genuinely new
thing about restating it.

### F-4 — The review lane has just enqueued a review for a second-lane PR, which nothing will ever read

[MEASURED] `rev-2026-ready.md` is armed (mtime 03:17:12Z, 3360 B) — a review job for `#2026`, which
the §10.1 probe puts in the **second lane** (0 prompt-log hits, POSITIVE control `#2017` → 1,
NEGATIVE → 0). DOCTRINE §10.3's `REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1` records that
`verdictApproves` has exactly **one** call site, inside `waitForPolicyMerge`, which runs only for
watcher-opened PRs. **So this review's verdict is unread by construction**, and the job occupies the
single worker lane for the length of a full review.

This is not a new defect and I am deliberately not filing it as one: it is a fresh instance of
`needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`, whose own subject
is whether the review lane should skip PRs the watcher did not open — Marco's call, because a human
may well want those reviews even though no machine reads them. Recording the instance matters
because the lane occupancy it causes is the same occupancy named as the starvation cause in
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`.

**DISPOSITION: DEFERRED** — to that existing escalation, not re-filed. It becomes urgent if a
watcher-opened `tests-docs` PR times out on its merge window while a second-lane review holds the
lane; the probe that would show it is the `opened PR #<n>` line for the starved PR against the
`rev-` job's start time in the newest daily clone log (selected by **name shape then mtime**, never
constructed from a date).

### F-5 — The `sot` prompt is still unreachable, still ADMIT, and this is its fifth undelivered dispatch

`pr-queue-layout-sot-entry-HOLD.md` is one of only two gate-satisfied ADMITs and is **structurally
un-armable**: it carries `station: '05'` and `scope: sot/02-roadmap-and-status.md`, and `sot/` is an
absolute stop for every station but 05. Arming it hands a `sot/` edit to Station 01 in the watcher's
lane; the 01:10Z run measured that nothing mechanical prevents this — `sot/` occurs **0** times in
`lint-prompt.mjs` and **0** times in `index.mjs`, and a `sot/`-only PR from Station 01 passes CP-24
green. **The matrix's "Edit `/sot/` — only 05" is enforced at the arming boundary by judgement
alone.**

The 01:10Z run measured it dispatched to 05 **four times** on 2026-09-17, with 05 having run twice
since and `queue-layout` appearing **0** times in either of 05's breadcrumbs. Elapsed is now ~4.0
days. This is the fourth instance of
`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`.

**DISPOSITION: DEFERRED** — not re-dispatched, because a fifth dispatch through the channel measured
not to arrive is the failure mode, not the remedy. 05's next occurrence is
`2026-09-21T14:10:37Z`. The trigger that changes this: Marco choosing between option (a) — a
file-backed dispatch register the sweep prints in a `[LIVE]` section — and option (b), which that
escalation itself scores as failing RULE 1's *complete* half.

### F-6 — The controlled green: trunk, watcher, queue and board integrity all clean, and the zeros are controlled

Recorded so the next run does not re-derive them, and separated from the findings above because a
clean reading is only worth anything with its controls attached: trunk **4 of 4 success on attempt
1** at `29abf8d4` (negative control `[]`); watcher **HEALTHY** from the sanctioned script, pid 9744,
heartbeat 0 min, churn 0; **0** real armed prompts (the one `*-ready.md` is a review job, §9.5);
**0** `*-LOOPING.md`; **DIRTY 0** across the whole open board; `[BROKEN]` **0** and `[STALE]` **0**
as tagged rows in a **complete** 935-line sweep; dev-tree index EMPTY on both probes; **0** `git.exe`
processes; no `index.lock` in either tree.

**DISPOSITION: ACTIONED** — measured, controlled and stated; nothing outstanding.

## WHAT I DID NOT DO

- **Did not merge `#2026` or `#2027`**, though both are fully green and `#2026` is docs-only and
  CLEAN. They are the supervised lane's in-flight work with Marco directing it live, and condition 3
  fails (F-1). Merging them is the collision, not the service.
- **Did not merge, label, close or touch `#2017`** in any way. Only Marco removes `do-not-merge`.
- **Did not arm anything.** Real armed count stays **0**. In particular I did not arm
  `pr-crmvis-s6-bulk-link-HOLD.md` (it is `#2017`'s own prompt — arming it builds a duplicate of an
  open PR, §10.6) or `pr-queue-layout-sot-entry-HOLD.md` (F-5).
- **Did not stage the §8.5 `reports/` prompt** the previous run handed to me, and said why in F-2
  rather than leaving it implied. The reason is condition 3, not the slot.
- **Did not open a board PR and did not fast-forward the dev tree.** This breadcrumb is untracked in
  `C:\ProjectOperations2\docs\pr-prompts\` and needs sweeping up — named under WHAT CHANGED.
- **Did not commit anything, in any tree, and did not touch the index.** Verified EMPTY on both
  probes before writing and after.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard was installed
  before any VM-side call and its last line is quoted in GROUND.
- **Did not `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean`**,
  did not commit on `main`, did not edit `/sot/`, did not write production data, and made no Azure,
  Entra or SharePoint call of any kind.
- **Did not restart, kill or `-Fix` the watcher.** The sanctioned verdict was HEALTHY; an idle
  watcher against an empty prompt queue is correct.
- **Did not prune `C:\po-worktrees\po-fix-2005` or `C:/PR-Master/worktrees/po-vg`**, and did not
  `--force` anything. Both are Station 03's, dispatched by the 02:08Z and 02:35Z runs, and `po-vg`
  holds an untracked file whose blob differs from main's.
- **Did not discharge any `needs-marco/` file.** Section 5 produced **0** `[STALE]` rows this cycle,
  so there was nothing to discharge — stated because the station doc describes a run that found
  eleven, and "I found none" and "I did not look" are different reports.
- **Did not re-file any subject an open escalation already owns** — the dispatch register, the
  unread `rev-` reviews, the stale remote heads, the clone fast-forward and the `sot`-arming boundary
  are all deferred to their existing files.
- **Did not read section 5 of the sweep in full** (lines 129–778, every row `[FILE]`). I read enough
  to establish that no row is `[STALE]`-tagged, which is the question COLLECT asks of it.
