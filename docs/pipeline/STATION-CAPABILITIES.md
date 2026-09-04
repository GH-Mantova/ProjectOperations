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
- ⚠️ Blocked commands include `net`, `sc`, `reg`, `netsh`, `takeown`, `shutdown`.

### The device bridge (`device_bash`, `device_stage_files`, `device_commit_files`)

Runs in the user's local **Linux VM** with mapped folders under `$HOME/mnt/`. Useful as a **fallback
when Desktop Commander is absent**, for read-only checks only.

🔴 **NEVER run `git` through it against the Windows `.git`.** MEASURED, three occurrences: a
cut-short VM-side git call leaves a **0-byte `index.lock` with NO Windows process**, so "zero git
processes" reads true forever, the lock never expires, and `status-sweep.ps1` §7 escalates it to
`DO NOT ACT` - freezing every station.

### GitHub

`gh` CLI via Desktop Commander is the authority. The **GitHub MCP token cannot merge (403)**.
⚠️ Read labels by piping `gh pr view N --json labels` into a JSON parser - **a `--jq` string has its
quotes stripped in transit and prints as `labels=[]`, a broken query that reads as "no labels".**

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

⚠️ The mapping governs the **device bridge only**, not Desktop Commander (§3).

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

00 may merge docs-only and `sot/`-only PRs, queue/staging PRs, and anything not watcher-routed - via
`pipeline-lib`: **`Assert-SmokedOrEscalate` then `Merge-Pr`**, never by hand.
⚠️ The watcher **auto-merges docs PRs itself** under the `tests-docs` policy, so an unmerged docs PR
is not automatically waiting on a human.

---

## 6. When each station should be called

| Station | Cadence | Call it when |
|---|---|---|
| **00 Supervisor** | every 2 h | anything needs deciding, dispatching, arming or merging; and to COLLECT what 03/04/05 reported |
| **01 Code-writer** | no cadence - the watcher invokes it | never called by hand; it is what builds an armed prompt |
| **02 Board-driver** | on dispatch only | merges, rebases, conflicts, reading CI job logs |
| **03 Machine-minder** | 4 h or manual | watcher health, locks, worktrees, clone drift, restarter presence; after any crash or reboot |
| **04 Scanner** | every 4 h | "is anything rotting?" - drift, dead gates, regressions, instruments that lie |
| **05 SoT-keeper** | daily | `/sot/` drift; the only station that may edit it |
| **06 PR Master** | on demand | design and stage new work; never arms, never merges |

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
