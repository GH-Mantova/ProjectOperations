# Station capabilities - who can call what, and when

**Written 2026-08-24. MEASURED from a live Cowork session unless tagged otherwise.**
This is the one place the capability answer lives. If a station prompt, a skill, or a station doc
disagrees with this file, **measure before believing either** - and fix the loser.

---

## 1. Every station has FIVE layers. Know which one actually governs you.

**Corrected 2026-08-24 by measurement.** This section previously said three, and named the Cowork
account skill as the thin bootstrap. That was wrong for scheduled runs.
**Corrected again 2026-09-03**: it said FOUR and omitted the agent definitions - see the row below
and the incident that row records.

| Layer | Where it lives | Who changes it | Governs a scheduled run? |
|---|---|---|---|
| **The scheduled-task file** | `C:\Users\Marco\Claude\Scheduled\<task>\SKILL.md` on the box | Marco, by pasting | YES - **this is the one** |
| **The agent definition** | `.claude/agents/<NN>-<name>.md` in this repo | any station, by ordinary PR | YES for an agent spawned via the Task tool - it sets `tools:`, `model:`, `isolation:`, `maxTurns:` |
| **The Cowork account skill** | e.g. `supervisor`, in the Skills UI | Marco, in the Skills UI - an agent cannot edit it | **NO - never invoked** |
| **The station doc** | `docs/pipeline/stations/0N-*.md` in this repo | any station, by ordinary docs PR | only if the run reads it |
| **This file** | `docs/pipeline/STATION-CAPABILITIES.md` | any station, by ordinary docs PR | only if the run reads it |

🔴 **`.claude/` is gitignored WHOLESALE (`.gitignore:28`); the agent definitions are force-added
exceptions.** So anything added under `.claude/` in future is invisible to `git status` by default,
and `.claude/agents/pr-tester.md` already exists on disk untracked. Measured 2026-09-03 (Station 04):
`git check-ignore -v .claude/agents/pr-tester.md` -> `.gitignore:28:.claude/`, exit 0, against the
positive control `git ls-files --error-unmatch .claude/agents/pr-fix-reviewer.md` -> found, exit 0.

⚠️ **This omission is not academic - it is why the 2026-09-01 damage went unseen.** PR #1465 rewrote
six agent definitions through a CP1252 double-encoder, putting 203 damaged sequences on `main`. Every
encoding sweep this pipeline runs was pointed at `sot/` and `docs/pipeline/`, because those are the
layers this table named. **A layer that is not in the map does not get swept.** Repaired and gated in
CI on 2026-09-03 (`lint-station.mjs` now scans `.claude/agents/*.md`), but the general lesson is the
reason this row exists: when a layer is added, add it here first.

**MEASURED 2026-08-24, 12 consecutive scheduled runs** (00-supervisor, 04-scanner, 05-sot-keeper),
560 tool calls in total: the `Skill` tool **was advertised in every one of them and invoked ZERO
times.** The scheduled task inlines its own `SKILL.md` verbatim as the opening user turn:

```
<scheduled-task name="04-scanner" file="C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md">
```

**Consequence: editing a Cowork account skill changes nothing about a scheduled station.** Account
skills apply only when a human invokes them in an interactive chat. To change a scheduled station's
behaviour you must edit its file under `C:\Users\Marco\Claude\Scheduled\`, or the repo station doc
that file tells it to read.

**Which layer to fix when they disagree:** prefer the repo doc - it is the only layer an agent can
change, and it is versioned. Then report the drift so Marco can update the scheduled-task file. Never
assume the two agree.

**All layers drift independently, and a stale instruction reads exactly like a current one.** Measured
the same day: four account skills carried "web_fetch the blob URL; the raw CDN lags" - advice this
pipeline had already disproved and removed from `sot/` in PRs #1298/#1299. The `machine-minder` skill
named the wrong watcher launcher and called it "the REAL launcher path". Neither observation carries a date; re-measure before repeating either.

**Measure a bootstrap's currency — never quote this file for it.**
`(Get-Item "C:\Users\Marco\Claude\Scheduled\<task>\SKILL.md").LastWriteTimeUtc`
This paragraph used to end *"and `02-board-driver`'s scheduled file has not been touched since
2026-07-14"*. MEASURED 2026-08-31 (Station 04): all five bootstraps were rewritten in ONE batch at
`2026-08-24T22:54:22Z`, so that line was six weeks stale — inside the very paragraph warning that a
stale instruction reads exactly like a current one. **Instructions live here; state does not.**


---

## 2. Reachability - CHECK IT, never assume it

🔴 **A station's toolset depends on HOW it was launched, not on what it is called.**

| Launch type | Reaches the Windows box? | Visible in `list_triggers`? | Project memory? |
|---|---|---|---|
| **Device task** (desktop app) | YES - Desktop Commander present | **NO** | ⚠️ **may be ABSENT** |
| **Cloud task** | **NO - structurally blind** | **YES** | yes |
| **Interactive chat** | usually yes | n/a | yes |

🔴 **There is no diagnostic short of trying.** An earlier version of this section said *"if a
station appears in `list_triggers`, it is cloud-fired and **will be blind**."* **That is REFUTED,
in both directions.** MEASURED 2026-08-28/29: Station 03 filed a complete breadcrumb at 23:02Z
**while blind**, and Station 00's 02:08Z run appeared in the scheduled-task listing **and had
Desktop Commander**. Blindness is **intermittent** - roughly 40% of Station 00's recent runs - and
**its cause is not known**. The listing predicts nothing, in either direction.

**So the only test is the call itself:** run `start_process` with shell `powershell.exe` and report
what happened. Never infer blindness from the listing, from the task name, or from a quiet result -
and never let a blind run go unreported because you assumed it was expected.

**First action, every scheduled run:** prove you can reach the host (`start_process`, shell
`powershell.exe`). If absent, **say so in one paragraph and STOP.** Do NOT substitute GitHub-side
reads and present them as coverage - `origin/main` is not the tree the watcher globs. **A blind run
and a healthy quiet run both produce "no news"** - report blindness as loudly as a defect.

⚠️ A device task may have **no project-memory tool** (Station 03 currently does not). If so, say so:
its chat report plus a breadcrumb are then the only channels, and Station 00 must not expect memory.

---

## 3. Tooling inventory

### Desktop Commander - the primary instrument for anything on the box

`start_process` (shell `powershell.exe`), `interact_with_process`, `read_process_output`,
`read_file`, `write_file`, `edit_block`, `start_search`, `list_sessions`.

- 🔴 **NOT limited to the session's mapped folders.** MEASURED: `allowedDirectories` is `[]` =
  unrestricted; it reads `C:\Windows`, `C:\Users`, the watcher clone and Scheduled Tasks regardless
  of what Cowork has mapped. **One mapped folder is enough for a station to do its job.**
- 🔴 **The shell traps live in DOCTRINE §9.1. Read them there; this file must not restate them.**
  Two restatements that sat here drifted away from §9.1 and were caught 2026-08-30 by Station 04:
  this file said `$` is **STRIPPED** from a `-Command "..."` string, when §9.1 measured it
  **EXPANDED** — and expansion is the worse failure, because a stripped token dies as a loud parser
  error while an expanded one can produce a **valid command carrying a value you never wrote, exit
  0**. 04 reproduced it first-hand in its own opening call: `$PSVersionTable.PSVersion.ToString()`
  came back as `System.Collections.Hashtable.PSVersion.ToString()` — the token replaced by its
  value, not removed. This file also asserted that streamed output **pauses on lines starting with
  `#`**, a mechanism §9.1 records as **not reproduced** on Desktop Commander 0.2.47; the real effect
  is an early return with output still pending, seen on a line with no `#`. Both restatements sent a
  reader looking for the wrong signature, and because the bootstraps prescribe reading this file
  **after** DOCTRINE, the weaker version was the one read last. **§9.1 is inside a hash-gated
  canonical block and cannot drift; a paraphrase here can. So: no paraphrase.** The operative rules
  remain — anything containing `$` goes in a `.ps1` run with `-File`, and you keep calling
  `read_process_output` with explicit offsets until it reports `0 remaining`.
🔴 **The no-paraphrase rule is scoped to EVERY shell, `git`, `gh` or CLI trap in this file, not
  only the two under this heading.** The GitHub bullet below was a THIRD restatement, and it sat
  four sections beneath the rule that forbids restating traps, under a different heading, which is
  presumably why the earlier no-paraphrase sweep missed it. A trap belongs in DOCTRINE §9, and is
  POINTED to from here.
- ⚠️ Blocked commands include `net`, `sc`, `reg`, `netsh`, `takeown`, `shutdown`.

### No second transport

Desktop Commander is the only transport that can **RUN** anything on the Windows host — no shell, no
PowerShell script, no `gh`, no `git`, no liveness probe, no smoke, no merge, no arm. Earlier revisions of this file
offered a Linux-VM "device bridge" as a fallback when Desktop Commander was absent; MEASURED
2026-09-04T06:1xZ from inside a live scheduled Cowork session, none of the tools that bridge
exposed is offered in that environment's inventory. **A fallback that does not exist is not a
fallback** — a station that reaches for one because the primary is absent is a station presenting
no-coverage as coverage, which the contract forbids. When Desktop Commander cannot be reached the
run is **blind** and stops (§2, and the PREFLIGHT block in every station doc). Do not invent a
replacement.

🔴 **THE STOP STANDS. WHAT IS FALSE IS "A BLIND RUN CAN SEE NOTHING" — and that error costs every
blind run its COLLECT.** MEASURED 2026-09-05T05:1xZ by Station 00, twice on two consecutive runs
(04:0xZ blind, 05:1xZ sighted): the Cowork workspace mount `/sessions/<session-id>/mnt/ProjectOperations2/`
**IS the live dev tree** — not a copy, not a checkout of `origin/main`.

**Controls, from the sighted run, which is the one that can cross-check both sides.** The Windows
dev tree was fast-forwarded to `472ae67c` through Desktop Commander; the mount's
`.git/refs/heads/main` then read `472ae67c8ac6607f87e9599a5c3e2087f6108bcf` — the same commit, read
by a different transport. A file written to `C:\po-sup-fix-scripts\` through Desktop Commander
appeared under `/sessions/<id>/mnt/po-sup-fix-scripts/` in the same minute. The blind 04:0xZ run had
already reached the same conclusion from the other side, by finding its own predecessor's breadcrumb
and the matching ref in the mount with no Desktop Commander at all.

**So a blind run is not a dead run.** Through the mount it can read the working tree, the queue,
`docs/pr-prompts/processed/*.log` (the RULE 2 probe), `.arming-log.txt`, every station breadcrumb,
and the three binding documents — which is the whole of COLLECT and most of PHASE 1.

**The ceiling, and it is why the stop is still correct.** Through the mount a run may NOT:

- run `git` against the Windows `.git` — DOCTRINE §9.2, a cut-short call leaves a 0-byte
  `index.lock` with no Windows process and freezes every station;
- run any `.ps1` — so no `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
  `restart-watcher-if-wedged.ps1`, no `smoke-pr.ps1`, no `arm-prompt.ps1`, no `pipeline-lib.ps1`;
- therefore claim ANY liveness, smoke, safe-to-act or merge verdict;
- mutate the board. The GitHub MCP token is write-403 (§3, GitHub), so a blind run cannot open a PR
  "instead" — its breadcrumb stays untracked in the dev tree until a sighted run sweeps it up, and
  it must say so.

🔧 **A blind run therefore reports blindness as loudly as ever, and stops before acting — but it
COLLECTS first, and says which of the two it did.** "I was blind, so I did nothing" and "I was
blind, so I read everything readable and acted on none of it" are different reports, and until this
correction the second one was unavailable.

### GitHub

`gh` CLI via Desktop Commander is the authority. The **GitHub MCP token cannot merge (403)**.
⚠️ Label- and `--jq`-reading traps live in **DOCTRINE §9.4 — read them there; this file must
not restate them.**

🔴 **The bullet that stood here was REFUTED, with both controls, on 2026-09-05 by Station 04,
and its polarity was the dangerous one.** It read *"a `--jq` string has its quotes stripped in
transit and prints as `labels=[]`, a broken query that reads as no labels"* — which teaches a
reader to distrust a **correct** label reading, and to read a genuine empty as a broken
instrument. Labels are the `do-not-merge` / CP-26 gate, so the reading it taught you to mistrust
is the one that stops an agent merging Marco's work.

[MEASURED] 2026-09-05, through `-Command`: `gh pr view 1369 --json labels --jq '.labels[].name'`
printed `do-not-merge` — POSITIVE control, #1369 genuinely carries that label. The same query
against #1640, which genuinely has none, printed nothing — also correct. Escaped double quotes
fail **LOUDLY** (`unknown arguments`), never silently. The correction has been on `origin/main` in
DOCTRINE §9.4 since 2026-08-26 and was never applied here: it is the third paraphrase in this
file to drift away from §9, which is why the rule above is now scoped to all of them.

### Other connectors on this account

`Microsoft_365` (Outlook/SharePoint), `Microsoft_Learn`, `Context7` (library docs), `claude-in-chrome`,
`Jotform`, `Mobbin`, `visualize`, `zapier`, `claude-code-remote` (scheduled tasks).

🔴 **None of these are for the pipeline stations.** In particular **Microsoft_365 / SharePoint sits
behind the absolute Azure/Entra/SharePoint hard stop** - a station may write code, a migration and a
runbook, then STOP and hand them to Marco. `claude-in-chrome` is available but no station currently
needs it; a UI click-through pass is Marco's or a dedicated session's.

### Skills

Station skills: `supervisor`, `machine-minder`, `scanner`, `sot-keeper`, `pr-master`.
Board helpers: `board-status`, `queue-inspect`, `team-sync`, `morning`.
General: `docx`, `pdf`, `pptx`, `xlsx`, `skill-creator`, `mcp-builder`, `learn`, `import-memory`.

**A station invokes its OWN skill and no other station's.** Calling another station's skill is how
lane discipline breaks (LL-38).

---

## 4. Folders mapped to Cowork sessions

`C:\ProjectOperations2` (dev tree / QUEUE - the tree the watcher globs) ·
`C:\po-watcher` and `C:\po-watcher\ProjectOperations` (build CLONE - where builds run) ·
`C:\po-sup-fix-scripts` (scratch `.ps1`) · `C:\po-worktrees`, `C:\po-wt`,
`C:\po-watcher-worktrees` · plus several `po-*` fix trees.

⚠️ Desktop Commander is not restricted by this mapping — see §3, "NOT limited to the session's
mapped folders". The mapping only describes which folders a Cowork session lists as its own.

---

## 5. Authority matrix - who may do what

| | 00 Supervisor | 01 Code-writer | 02 Board-driver | 03 Machine-minder | 04 Scanner | 05 SoT-keeper | 06 PR Master |
|---|---|---|---|---|---|---|---|
| **Arm a prompt** | ✅ **only 00** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Merge a PR** | ✅ (limits below) | ❌ | ✅ dispatched | ❌ | ❌ | ❌ | ❌ |
| **Create a PR** | ✅ board PRs | ✅ its own build only | ✅ | ❌ | ❌ | ✅ doc-reconcile only | ✅ staging only |
| **Edit `/sot/`** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ **only 05** | ❌ |
| **Repair the machines** | ❌ dispatches 03 | ❌ | ❌ | ⚠️ **report-only** | ❌ | ❌ | ❌ |
| **Mutate the board** | ✅ | ❌ | ✅ dispatched | ❌ | ❌ read-only | ❌ | stage `-HOLD` only |
| **Azure / Entra / SharePoint** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **absolute, all stations** |

**Station 01 was missing from this matrix until 2026-09-03**, although it has a contract-linted
station doc (`docs/pipeline/stations/01-code-writer.md`, `station_doc_version: 1`), is named on
`origin/main` by `00-supervisor.md`, `sot/README.md` and `scripts/pr-watcher/index.mjs`, and the
canonical-block comment in every station doc says *"ship all seven together"* - seven docs against
six columns. 01 runs **only** as the watcher's code-writer, inside its own disposable worktree, on an
armed prompt. It never arms, never merges, and never touches `/sot/`.

⚠️ **The 00 "Create a PR" cell read ❌ until 2026-09-03 and was wrong in practice for seven weeks.**
Station 02 was folded into 00 on 2026-09-02, and 00 had already been opening its own board PRs long
before that (#1535, #1538, #1539, #1540, #1542 are all 00's). Corrected here rather than left to be
re-derived: this file is the one that is supposed to settle a capability dispute.

**Station 01 has NO schedule of its own** - it runs only when the watcher builds an armed prompt,
inside its own disposable worktree.

**Station 02 has NO schedule of its own** - it runs only when 00 dispatches it. That is deliberate:
two things independently mutating git and the queue is the collision LL-38 records - and since
2026-09-02 02's contract is folded into 00 anyway. MEASURED 2026-09-03 from the scheduled-tasks MCP:
a `02-board-driver` folder exists under `Scheduled\` and there is **no live task behind it** -
which is section 1's rule that a folder is not a task.

🔴 **Station 03 IS self-scheduled. This sentence read "02 and 03" until 2026-09-03, and half of it
was refuted.** MEASURED the same run: `03-machine-minder` is **enabled** in the MCP, and its 23:01Z
run fired from that schedule with **no dispatch from 00**. Half-true is the worst shape a binding
line can take - a reader who checks 02 confirms it and generalises to 03. ⚠️ **03's live cron and its
own bootstrap disagree about the cadence** (the bootstrap says every 4 hours; the cron does not), and
which one is right is open with Marco - so read 03's cadence from the MCP, never from this file, that
bootstrap, or the table in section 6.

### Merging - two independent gates, both binding on 00

1. The **`do-not-merge` label** (CP-26 / `escalates: true`) - **only Marco removes it.**
2. The **watcher's routing**: `[merge] <prompt>: PR #N stays for Marco (outside tests/ or docs/)` is
   a human-review gate, separate from the label. Not overridden by green, unlabelled, or a verified
   diff - only by an explicit instruction from Marco naming that PR.


**This table is the classifier for a station-lane PR.** `DOCTRINE.md` section 10.1 step 3 defers to
it by name: a PR opened by a station inside its own recorded authority is classified HERE, not by
`classifyPolicyFiles`. The two documents contradicted each other from 2026-08-31 (when 10.1 was
written) until 2026-09-04, and PR #1554 sat open on the difference. If you change this row, change
10.1 in the same PR - and note that adding a NEW lane outside `tests|docs` requires a CI gate
proving the lane's boundary, the way CP-24 proves 05's.

00 may merge docs-only and `sot/`-only PRs, queue/staging PRs, and anything not watcher-routed - via
`pipeline-lib`: **`Assert-SmokedOrEscalate` then `Merge-Pr`**, never by hand.
⚠️ The watcher **auto-merges docs PRs itself** under the `tests-docs` policy, so an unmerged docs PR
is not automatically waiting on a human.

---


### Station 00 has TWO modes, and the matrix row above covers both

🔴 **Recorded 2026-09-05 by the supervised cloud lane itself — see the disclosure in `DOCTRINE.md`
section 10.2.1 before relying on this.**

| | **00 scheduled** (headless, on the box) | **00 supervised** (interactive / cloud, Marco directing) |
|---|---|---|
| Arm a prompt | ✅ `arm-prompt.ps1` | ❌ — does not have the script |
| Merge a PR | ✅ `Assert-SmokedOrEscalate` → `Merge-Pr` | ✅ **only PRs Marco released in chat**, receipt required |
| Create a PR | ✅ board PRs | ✅ board PRs **and** code PRs he directs |
| Write `docs/pr-prompts/` | ✅ | ✅ — he directs the prompt in the same turn |
| Remove `do-not-merge` | ❌ **only Marco** | ❌ **only Marco** |
| Edit `/sot/` | ❌ | ❌ |
| Clear a watcher `marco:true` | ❌ | ❌ |
| Azure / Entra / SharePoint | ❌ | ❌ **absolute** |

The two modes differ in **instruments and supervision**, not in authority: the supervised lane has no
PowerShell and no queue, and gets its release decisions from Marco live instead of from the label
timeline. Its boundary is proved in CI by the required check **`Approval receipt (CP-26)`**, which
fails `RELEASED_NO_RECEIPT` on a released PR carrying no receipt — so a merge by this lane that
leaves no signature cannot reach `main`. That is the CI gate section 5's own proviso asks for.

⚠️ **A supervised-lane PR names its lane in the receipt, not only in the body.** `mergedBy` reads
`GH-Mantova` for every merge on this board, agent and human alike, so the receipt is the only
durable signature. A scheduled run finding an unattributed merge should read that as a **defect in
this lane**, not as an unknown actor.

## 6. When each station should be called

| Station | Cadence | Call it when |
|---|---|---|
| **00 Supervisor** | **hourly** — read it from the MCP | anything needs deciding, dispatching, arming or merging; and to COLLECT what 03/04/05 reported |
| **01 Code-writer** | no cadence - the watcher invokes it | never called by hand; it is what builds an armed prompt |
| **02 Board-driver** | on dispatch only | merges, rebases, conflicts, reading CI job logs |
| **03 Machine-minder** | 4 h or manual | watcher health, locks, worktrees, clone drift, restarter presence; after any crash or reboot |
| **04 Scanner** | every 4 h | "is anything rotting?" - drift, dead gates, regressions, instruments that lie |
| **05 SoT-keeper** | daily | `/sot/` drift; the only station that may edit it |
| **06 PR Master** | on demand | design and stage new work; never arms, never merges |

🔴 **A CADENCE IN THIS TABLE IS STATE, AND TWO ROWS HAVE ALREADY ROTTED. READ THE LIVE CRON FROM THE
SCHEDULED-TASKS MCP, NEVER FROM HERE.** [MEASURED] 2026-09-05T14:1xZ by Station 04: `00-supervisor`
runs `5 * * * *` — **hourly**, not the "every 2 h" both this table and its bootstrap claimed, an
error of 2x *in the direction of not noticing a missed run*, which is open escalation #23's exact
failure mode. `03-machine-minder` runs `0 9 * * *` — daily, against a bootstrap that says 4 h; that
half is already open with Marco (§5). `04` (`0 */4 * * *`) and `05` (`10 0 * * *`) agree with their
layers.

⚠️ **And the three-stations-at-once collision has a cause: cron is evaluated in Brisbane local time,
and 00 (`:05` hourly), 04 (`:00` every 4 h) and 05 (`00:10` daily) all land within ten minutes of
MIDNIGHT LOCAL, every night.** [MEASURED] the same run, `lastRunAt`: 00 `14:08:04Z`, 04 `14:09:43Z`,
05 `14:10:49Z` — three stations inside **165 seconds**. The open cron-offset escalation therefore
needs an offset of **at least ten minutes**, and the one that must move is **05**, whose slot is the
fixed one. The cron changes are Marco's — they live in the scheduled-tasks layer, not this repo.

🔴 **AND THE CADENCE IS STORED IN A THIRD PLACE THAT THE CORRECTION DID NOT REACH.**
`scripts/pipeline/check-breadcrumb.mjs` keeps its own `CADENCE` map, and `00` in it still reads
**2**. [MEASURED] 2026-09-05T15:1xZ at `52232fec`, anchor `const CADENCE =`:
`{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`; NEGATIVE control `zzzNoSuchNeedleZzz` over
the same file -> **0**. The table row above was corrected in **#1670** twenty-four minutes earlier
and the instrument was not, so `--freshness` -- the probe the COLLECT step is told to *start* with
-- will not call `00` **SILENT** until **4 h**, i.e. only after **three** consecutive missed hourly
runs. `03` (`24`) and `04` (`4`) match their live crons; `00` is the only wrong row.

⚠️ **So a green `ok` from `--freshness` is a weaker statement about `00` than about any other
station**, and it is weak in escalation #23's exact direction -- toward not noticing a missed run.
Cross it against `lastRunAt` from the scheduled-tasks MCP, which the COLLECT step already requires
and which this defect does not touch. 🔧 The fix is one character (`'00': 1`), but it is a
`scripts/` change and therefore outside Station 00's recorded lane to merge; it is filed for Marco
in the needs-marco queue alongside the `lint-station.mjs` version-field question. **Do not read this
paragraph as the fix having landed** -- the falsifying probe is the `const CADENCE =` line itself.

---

## 7. The reporting chain - and its one working channel

Stations do not read each other's chats. **Station 00 collects, every run**, and gives each finding
one of exactly four dispositions: **ACTIONED / DISPATCHED / ESCALATED / DEFERRED**.

| Channel | Status |
|---|---|
| **Project memory** | ✅ **primary** - the only one that reliably survives. ⚠️ may be absent in a device task |
| `docs/pr-prompts/00-*.md` breadcrumbs | ✅ tracked on main as of #1300 (before that: 20 on disk, **0 tracked**) |
| `docs/qa/qa-findings.md` | 🔴 **GITIGNORED (`.gitignore:108`)** - anything found only there is UNREPORTED. It swallowed a released gate for nine days |
| Chat | ❌ not durable; no other agent can read it |

---

## 8. Escalate to Marco - bring a question, not a status update

Open design/product questions · irreversible or destructive actions · authorization grants ·
production auth/secrets/deploy config you cannot verify · anything needing a real human identity ·
verification exhausted after two honest attempts.

**RULE 1, applied to every option you present:** *"always lean towards what solves the issue
completely (immediately and future) without damaging existing and/or future data entry."* Two tests,
both must pass. **Put the complete-and-additive option FIRST and say which half each alternative
fails.**
