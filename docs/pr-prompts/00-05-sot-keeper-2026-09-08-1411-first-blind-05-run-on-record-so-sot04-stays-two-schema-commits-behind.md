# Station 05 — SoT Keeper | 2026-09-08T14:11Z–2026-09-08T14:47Z

## GROUND

```
UTC            2026-09-08T14:11Z
origin/main    533604dc            (read from .git/refs/remotes/origin/main; cross-checked against GitHub)
dev tree       main @ 533604dc     C:\ProjectOperations2  (read through the Cowork mount)
doc version    1                   (station_doc_version, docs/pipeline/stations/05-sot-keeper.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE.

🔴🔴 **BLIND RUN. I could not reach the Windows box, and this is the FIRST blind Station 05 run on
record.** `[MEASURED]` The tool schema was loaded first, exactly as the contract demands — four
`ToolSearch` calls, keyword `desktop-commander` among them — and the server answered
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
after 30000ms"`. **No `start_process`, no `interact_with_process`, no `read_file`, no tool of that
family was offered at all.** This is a failure AFTER the load, which the contract calls blindness.
`[MEASURED]` Every one of the 15 prior `00-05-*` breadcrumbs in `docs/pr-prompts/archive/` declares
itself sighted (POSITIVE control: 14 of 15 mention `sot/04`; NEGATIVE control, freshly minted needle
`zzQq05Needle20260908T1440`, 0). **There is no precedent in this station's own record for what a
blind 05 run should produce, which is why the run-level finding below is filed rather than assumed.**

`[MEASURED]` **VM git guard installed FIRST, before any other VM-side call**, per the preflight.
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` last line:
`vm-git-guard installed at /sessions/zealous-awesome-lamport/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)` — followed by
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`. **PASS.**
No `git` was run against the Windows `.git` at any point in this run.

`[MEASURED]` **The three binding documents were read in full from the mount** — `DOCTRINE.md` (1751
lines, four chunks), `STATION-CAPABILITIES.md`, and this station's doc. `[INFERRED]` They are
`origin/main`'s content: the dev tree's `.git/refs/heads/main`, `.git/refs/remotes/origin/main` and
the first line of `.git/FETCH_HEAD` all read
`533604dcc888bc379fb9e405bd3690721e9a86a9`, and GitHub's `main` head reads the same SHA. The sound
`git diff --numstat origin/main -- <path>` form is `[CANNOT MEASURE]` on a blind run and I did not
substitute the piped-hash form, which DOCTRINE §9.2 records as unsound.

`[MEASURED]` **No missed occurrence — nothing is owed.** `check-breadcrumb.mjs --freshness` is
unavailable (it shells `git ls-tree` against the mount, which the guard correctly refuses), so the
age was read from the breadcrumb corpus directly: the newest `00-05-*` is
`00-05-sot-keeper-2026-09-07-1412-...`, and this run started `2026-09-08T14:11Z` — **23h 59m, exactly
one cadence.** Read as the AGE, never as an `ok` verdict.

## WHAT I MEASURED

### The mount is live, and it is eleven folders, not one

`[MEASURED]` `ls /sessions/<id>/mnt/` → **13 entries**, 11 of them project folders
(`ProjectOperations2`, `po-fix923`, `po-fix933`, `po-preserve`, `po-sec-fix`, `po-smoke`,
`po-sup-fix`, `po-sup-fix-scripts`, `po-watcher`, `po-watcher-worktrees`, `po-worktrees`) plus
`outputs` and `uploads`. This is the falsifying probe `STATION-CAPABILITIES.md` §3's
`BLIND_RUN_OTHER_MOUNTS_V1` paragraph asks for, and it **passes**: the paragraph is not wrong.

`[MEASURED]` Through the `po-watcher` mount, the newest daily-named log in the clone
(`…\scripts\pr-watcher\logs\2026-09-07.log`) carries as its last line
`[2026-09-08T14:10:11.065Z] [review] verdict-archive sweep: archived=0 kept=3 skipped=0 tracked=107`
— **3.4 minutes old**, taken from log CONTENT and never from a mount `stat`, per §3's host-local
warning. ⚠️ **This is a QUOTATION, not a liveness verdict.** A blind run may not claim one.

⚠️ **The daily log named `2026-09-07.log` is carrying `2026-09-08` lines.** That is the open dispatch
to Station 03 — *"name the daily log in UTC"* — still reproducing, and DOCTRINE §9.5's
`2026-09-06T23:0xZ` correction predicts it exactly. Corroboration of an existing item, not a new one.

### Rule Zero — local PASS, and CI agrees everywhere I can read it

`[MEASURED]` Local: `node scripts/data-model/build-relationship-map.mjs --check` →
`OK: generator ran cleanly against schema.prisma (296 models, 69 enums, 493 edges).` exit 0.

`[MEASURED]` CI, `Data model — generator sanity (schema.prisma parses cleanly)`, on all three open
PRs: **`#1820` success · `#1821` no checks created yet · `#1822` success.**
`#1822`'s `Approval receipt (CP-26)` and `PR gates — diff checks` both read **failure**, from the one
cause — it carries `do-not-merge` — which DOCTRINE §9.4 records as **parked by design, not work.**

`[CANNOT MEASURE]` **main's own push-CI conclusion for that job.** The authority is
`gh api repos/.../commits/<40-char-sha>/check-runs` through Desktop Commander, which is absent, and
the GitHub MCP exposes check-runs only per pull request. I did not substitute the PR readings and
present them as main's.

**No ENVIRONMENT DISAGREEMENT observed.** Local PASS and CI PASS point the same way on every commit I
could read. ⚠️ This is a **weaker** Rule Zero pass than a sighted run's, and it is weaker in the exact
place Rule Zero exists for — the LF-vs-CRLF divergence is caught by comparing local against *main's*
CI, and main's is the one reading I could not take.

### Audit 2 — catalog validity: VALID

`[MEASURED]` `node -e "JSON.parse(readFileSync('docs/data-model/metadata-catalog.json','utf8'))"` →
`CATALOG_OK bytes=690682 topkeys=4`, exit 0. The 2026-08 unterminated-string defect has not returned.
⚠️ The byte count differs from yesterday's reading; `#1796`'s own commit message records that it
**grew by 18 purely additive lines**, and the number is state, not a finding.

### Audit 6 — model ↔ migration ↔ code: 0 mismatches, and my positive control failed first

`[MEASURED]` 296 models against **245** migration directories, 301 distinct `CREATE TABLE` names:
`models with NO backing CREATE TABLE` → **0**. `created-not-dropped tables with NO live model` → **1:
the literal token `IF`**, which is my own regex capturing the `IF` of `CREATE TABLE IF NOT EXISTS`,
not a table.

🔴 **My POSITIVE control returned FALSE on the first pass and the instrument was fine.** I asked
whether `tender_reminder_policies` had a `CREATE TABLE` and got `false`. The real `@@map` names are
**`tender_reminder_policy`** and **`tender_reminder_log`** (singular), and both are created in
`apps/api/prisma/migrations/20260907100000_tr1_reminder_policy_and_log/migration.sql`. **The needle
was wrong, not the world** — the same shape as yesterday's `ScopeCard` false positive, on the same
audit step, two runs running. Recording it because a run that stopped at the first reading files
*"the two newest models have no migration"*, which is a confident, coherent, wrong finding.

### Audit 7 — module registry: unchanged, deliberately not re-filed

`[MEASURED]` `apps/api/src` holds **6** top-level directories, **0** absent from
`sot/01-charter-and-architecture.md`. One level deeper, **30 of 81** feature modules under
`apps/api/src/modules/` are absent from `sot/01`. That count was **31** on 2026-08-26 (F5) and **32**
on 2026-09-05. It is the same long-standing finding, already filed three times and DEFERRED; the
number is recorded here as movement, and it is **not** re-filed.

### The primary housekeeping obligation is discharged and stayed discharged

`[MEASURED]` `node scripts/pipeline/check-sot-refs.mjs` →
`total=276  dangling=0  exempt=20  baselined=0  excluded=2` · *"All sot/ references resolve."* exit 0.
`docs/qa/sot-refs-baseline.json` → **`entries.length = 0`**. Nothing left to burn down. The ratchet
still earns its keep by refusing new entries — and it is the reason the sot/01 finding below matters:
`#1817` hit that gate live.

### Board context, read-only

`[MEASURED]` Three PRs open: `#1820` (brandtheme S0, unlabelled, 15 checks all success), `#1821`
(rates consumers S3, no checks created 113 min after open), `#1822` (TFM-S11, `do-not-merge`).
`docs/pr-prompts/` holds **2088** `*.log` under `processed/`; the newest by mtime is
`rev-1822-ready.md.log`, whose CONTENT reads `Ended: 2026-09-08T13:31:54.893Z`. Armed prompts at
depth 1: **0**. `.arming-log.txt` is 71 lines, newest `2026-09-08T12:29:41Z ARMED
pr-tfm-s11-copy-recursive-preserve`.

`[MEASURED]` **I did not run the RULE 2 `marco:true` probe and did not need it.** This run merges
nothing and opens nothing, so there is no merge decision for it to gate. Saying so rather than
reporting a number I had no use for.

## WHAT CHANGED

**Nothing. Not one byte, in any tree.**

No PR was opened, no file under `sot/` was edited, no generator artifact was written, no prompt was
staged, nothing was armed and nothing was merged. The only write this run made anywhere is **this
breadcrumb**, at `C:\ProjectOperations2\docs\pr-prompts\`, and the git guard shim in the disposable
Linux VM.

⚠️ **This breadcrumb is UNTRACKED and stays untracked until a sighted run sweeps it into a board PR.**
A blind run cannot commit it — the GitHub MCP token is write-403 by design
(`STATION-CAPABILITIES.md` §3) and there is no shell. Station 00 collects.

## FINDINGS

### F1 — the first blind Station 05 run on record produced ZERO of its lane's output, because every sanctioned output of this station is a PR

`[MEASURED]` Desktop Commander was absent (`CONNECT_TIMEOUT`, quoted in the ground block above), and
all 15 prior `00-05-*` breadcrumbs declare themselves sighted.

🔴 **The asymmetry is the finding.** `STATION-CAPABILITIES.md` §3's 2026-09-05 correction — *"a blind
run is not a dead run … it COLLECTS first"* — was measured and written by **Station 00**, whose value
is largely COLLECT. It transfers to 04 and 03 for the same reason. **It does not transfer to 05.**
This station's entire allowlisted output is *"ONE doc-reconcile PR per run"*, and the blind-run
ceiling in that same section says a blind run may not mutate the board and cannot open a PR instead.
So a blind 05 run collects an audit it is structurally unable to act on: F2 and F3 below are both
deterministic, both inside my lane, both would have shipped in a sighted run, and both stay open.
At an intermittency of roughly 40% of scheduled runs, that is not a rare event — it is a large
fraction of this station's daily throughput, silently converted into a report.

**Options, RULE 1 order — complete-and-additive first:**

**(a)** Let a blind 05 run stage its reconcile as an **unarmed `-HOLD.md` prompt** in
`docs/pr-prompts/`, with the generator command, the section-scoped re-merge boundary and the S2–S6
safeguards written out as an executable premise, for a sighted lane to arm. **Passes both halves:**
the day's work survives instead of evaporating, and it damages nothing — a `-HOLD.md` matches no
watcher glob, so staging is not arming, and the resulting PR is `sot/`-only, so CP-24 is satisfied by
construction. Cost: it needs a ruling that writing a prompt file is not the *"mutate the board"* the
blind ceiling forbids, and that is not mine to make. **I did NOT do this today**, precisely because
the ceiling as written says a blind run acts on nothing.

**(b)** Let a blind 05 run write the reconcile into the dev-tree working copy uncommitted, for a
sighted run to commit. **Fails the "without damaging" half** — the dev tree's index is shared between
concurrent chats (DOCTRINE §9.2), so an uncommitted `sot/` edit can be swept into someone else's
commit, and CP-24 hard-blocks the mix it would then be in.

**(c)** Leave it as today: report and lose the day. **Fails the "completely" half** — it is the
current behaviour and it is what produced this finding.

**DISPOSITION: DISPATCHED → Station 00.** It owns pipeline methodology and it is the station that
authored the blind-run COLLECT correction, so extending that correction to a station whose only
output is a PR belongs in the same hand. This is **not** a Marco question: it is a question about
what a station may write, and §5's escalation list does not cover it. The falsifying probe is trivial
— if a future blind 05 run ships anything at all, this finding is resolved.

### F2 — sot/04's generated section is TWO schema commits behind main, and the two missing models are the ones that landed since yesterday's re-merge

`[MEASURED]` `sot/04-data-model.md:15` reads
`- Models: 294 | Enums: 69 | FK edges: 491 | Domains: 23`, stamped `2026-09-07 14:17 UTC` against
schema sha `1c87e9c6ca95`. A generator run against `origin/main`'s `schema.prisma` in the mount
reports **`296 models, 69 enums, 493 edges`** at schema sha `ad5bc3b0931c`.

`[MEASURED]` Diffing the 296 schema model names against the text between
`SOT04-GENERATED:BEGIN` and `SOT04-GENERATED:END`, the missing pair is
**`TenderReminderPolicy`** and **`TenderReminderLog`** (POSITIVE control `ScopeOperationalCostLine`
present, NEGATIVE control `zzQq05Needle20260908T1420` absent). Both landed in **`#1767`**
(`2026-09-07T23:58:23Z`), tables `tender_reminder_policy` / `tender_reminder_log`.

`[MEASURED]` `sot/04` was last touched on main by **`#1783`** at `2026-09-07T15:19:41Z` — yesterday's
own re-merge — so main's copy carries `294 | 69 | 491` and the drift is on main, not a local smudge.
`schema.prisma` has moved twice since: `#1767`, then `#1796` (`2026-09-08T01:23:22Z`, SOR-S9a).

⚠️ **A clean `--check` did not and could not catch this**, and it did not today either: `--check`
returns before writing and only proves `schema.prisma` parses. It was green locally and green on both
open PRs that ran it, while `sot/04` was a day stale. That correction is in this station's own doc and
it held for the second consecutive run.

**DISPOSITION: DEFERRED.** This is squarely inside the auto-fix allowlist and would have been
ACTIONED by a sighted run — a generator run plus a section-scoped re-merge under S1–S7. A blind run
cannot open the PR. **It becomes urgent the moment a third schema commit lands**, because the
re-merge is cheapest one schema-commit at a time and this is already two. Next sighted 05 run takes
it; the falsifying probe is the header line itself.

### F3 — sot/01 still tells its reader that NAV-5 is unshipped, ninety lines below the reconcile that shipped it, and that stale line is blocking a prompt retirement

`[MEASURED]` `sot/01-charter-and-architecture.md:452-458` reads: *"**Groups 1-6 and FIELD are NOT yet
reconciled** — they still describe the pre-NAV-1 sidebar (the group is named "ESTIMATING", there is
no CRM group). That reconcile is NAV-5, staged at
`docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md`"*.

`[MEASURED]` **Every clause of that paragraph is refuted by the section above it in the same file.**
The group list in SECTION 9 now runs **1–8**, not 1–7: `2. TENDERING (renamed from "Estimating" —
NAV-1, 2026-08-14)` and `3. CRM (new top-level group — NAV-1, 2026-08-14; gate: crm.view)`.
POSITIVE control `^3. CRM` → **1** occurrence. `^2. ESTIMATING` → **0**. NEGATIVE control
`zzQq05Needle20260908T1425` → **0**.

`[MEASURED]` The reconcile landed in **`#1810`**, whose diff rewrites exactly that SECTION 9 block
(`sot/01-charter-and-architecture.md`, +32 −17) and whose merge-approval receipt records Marco
approving it on `2026-09-08T05:15:31Z`.

🔴 **This is not cosmetic — it has a live cost, and the cost was already handed to my lane.**
`#1817`'s second commit message says so in as many words: retiring the consumed
`pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` into `superseded/` made `sot/01:457` dangle,
`check-sot-refs.mjs` failed the branch, and the retirement was backed out. Its author wrote that
repointing the line *"is a sot/ edit and belongs in Station 05's doc-reconcile lane"*. `[MEASURED]`
the prompt is therefore still at depth 1 in `docs/pr-prompts/` and still offering itself as an arming
candidate for work that shipped 9 hours ago — the stays-armable-forever shape, with a `sot/` line as
the thing pinning it.

**DISPOSITION: DEFERRED.** A dispatch was received and could not be executed: the fix is three lines
of curated `sot/` prose (say the reconcile shipped in `#1810`, drop the "NOT yet reconciled" claim,
repoint or remove the prompt citation) and no other station may touch `sot/`. A blind run cannot open
the PR. **It becomes urgent the moment anyone re-arms that prompt** — it lints ADMIT and its premise
reads fresh, so nothing else stops a duplicate build of merged work. The falsifying probe is
`grep -n 'NOT yet' sot/01-charter-and-architecture.md` returning nothing.

### F4 — sot/02's In-PR snapshot rotted again, and today is the first day nobody refreshed it

`[MEASURED]` `sot/02-roadmap-and-status.md` §2 is headed `In-PR — open right now (4)` and names
`#1777 #1775 #1774 #1767`. **All four are merged.** The three genuinely open PRs — `#1820 #1821
#1822` — appear nowhere in the file. Its own provenance line reads `2026-09-07T14:21Z, origin/main
f9815d11`, which is yesterday's refresh: **the table survived less than 24 hours, again.**

🔴 **The new datum is not the rot; it is that the treadmill has now actually failed.** Thirteen
consecutive 05 breadcrumbs have spent a run on this table, twelve of them refreshing it by hand.
Yesterday's run ACTIONED the rot and DISPATCHED the loop to Station 00 with option (a) — put the
table inside `SOT02-INPR:BEGIN/END` markers, generate it from `gh pr list`, and wire a `--check` mode
into the existing `pipeline-tests` job so CI fails when it drifts. That option was reasoned from the
table being *"false for most of each day"*. **It is now stronger than that: the hand-refresh is not
merely late, it is conditional on this station being sighted, and today it was not.** A generated
block with a CI check would have been correct today with nobody present at all.

**DISPOSITION: DEFERRED — the loop remains DISPATCHED → Station 00 from 2026-09-07 and is not
re-dispatched here.** Today's rot is not ACTIONED because a blind run cannot open the PR. This is
explicitly **not** a new roadmap escalation: 2026-09-05 escalated the semantics question, Marco ruled
the boundary on 2026-09-06, and nothing in `needs-marco/` is reopened by this entry.

### F5 — the `github-projectops` MCP failed to connect this session, and its symptom is the one a PAT lapse will wear

`[MEASURED]` This session's MCP status reports
`plugin:github-projectops:github-projectops (400): "Error POSTing to endpoint: bad request:
Authorization header is badly formatted"`. The second, generic GitHub MCP connected and served every
read this run used, so GitHub access as such is fine.

⚠️ **Recorded because the failure mode is pre-labelled.** The project's own notes carry a standing
warning that the `cowork-projectops` PAT expires **2026-09-30** and that *"its lapse will look like a
mystery outage"*. This is 22 days early and the message is a header-format error rather than an
expiry, so **I am not claiming they are the same thing** — only that the next reader should not
diagnose one as the other without checking.

**DISPOSITION: DEFERRED.** One observation, one session, and an alternative transport worked, so it
does not yet meet the bar for a credential escalation — and a credential question is category 4 on
§5's list, which needs Marco and a `needs-marco/` file this blind run cannot write. **Falsifying
probe: whether the same server connects on the next scheduled run.** If it fails twice, it needs
`needs-marco/github-projectops-mcp-auth-header-rejected-2026-09-08.md` and Marco's eyes, and a
sighted run should write that file rather than leave it escalated to nobody.

## WHAT I DID NOT DO

- **I did not substitute GitHub-side reads for host access and call it coverage.** Where a probe
  needed the box, it is stamped `[CANNOT MEASURE]` — main's push-CI conclusion, and the
  `git diff --numstat origin/main` freshness proof for the three binding documents.
- **I did not run any `.ps1`.** No `status-sweep.ps1`, so **no SAFE-TO-ACT verdict, no liveness
  verdict, no smoke and no merge verdict is claimed anywhere in this report.** The watcher log line
  quoted above is a quotation, not a verdict.
- **I did not run `git` against the Windows `.git`**, through the guard or around it. The guard
  refused `check-breadcrumb.mjs --freshness` for exactly that reason and I read the age off the
  breadcrumb corpus instead rather than reach past it.
- **I did not attempt a write through the GitHub MCP.** The token is write-403 by design and the
  blind ceiling says a blind run cannot open a PR "instead". Trying it would be a board mutation
  attempt, not a measurement.
- **I did not stage a prompt, arm anything, or write into any `sot/` file.** Option (a) under F1 is
  offered as a question, not taken as a licence.
- **I did not re-file the 30-of-81 module-registry gap** (three prior filings, DEFERRED) **or reopen
  the sot/02 roadmap-semantics escalation** (ruled by Marco 2026-09-06). Both are recorded as
  movement only.
- **I did not touch the three open PRs.** None is a `sot/` reconcile, none is mine, and `#1822`'s two
  reds are CP-26's `do-not-merge` pairing, which is parked by design.
- **I did not write `docs/data-model/sweeps/2026-09-08.md`.** The station brief still orders it and
  the canonical contract above it in the same file replaced it with this breadcrumb; that conflict is
  the 2026-09-07 run's F3, still DEFERRED, and writing both would resolve it by duplication.
