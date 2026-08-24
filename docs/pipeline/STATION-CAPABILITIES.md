# Station capabilities - who can call what, and when

**Written 2026-08-24. MEASURED from a live Cowork session unless tagged otherwise.**
This is the one place the capability answer lives. If a station prompt, a skill, or a station doc
disagrees with this file, **measure before believing either** - and fix the loser.

---

## 1. Every station has THREE layers. Know which one you are reading.

| Layer | Where it lives | Who changes it |
|---|---|---|
| **The task prompt** | the scheduled task's message (device or cloud) | Marco, by pasting |
| **The skill** | a Cowork account skill, e.g. `supervisor`. A **thin bootstrap** | Marco, in the Skills UI - **an agent cannot edit it** |
| **The station doc** | `docs/pipeline/stations/0N-*.md` in this repo | any station, by ordinary docs PR |

**The skill's own words: "the station's single source of behaviour lives in the repo."** So the
station doc is the real content, and it is the layer an agent CAN fix. When you find a contradiction,
prefer fixing the repo doc and report the other two to Marco.

🔴 **All three drift independently.** Measured 2026-08-24: four skills carried "web_fetch the blob
URL; the raw CDN lags" - advice this pipeline had already proved wrong and removed from `sot/` in
PRs #1298/#1299. The `machine-minder` skill named the wrong watcher launcher and called it "the REAL
launcher path". **A stale instruction reads exactly like a current one.**

---

## 2. Reachability - CHECK IT, never assume it

🔴 **A station's toolset depends on HOW it was launched, not on what it is called.**

| Launch type | Reaches the Windows box? | Visible in `list_triggers`? | Project memory? |
|---|---|---|---|
| **Device task** (desktop app) | YES - Desktop Commander present | **NO** | ⚠️ **may be ABSENT** |
| **Cloud task** | **NO - structurally blind** | **YES** | yes |
| **Interactive chat** | usually yes | n/a | yes |

**The diagnostic:** if a station appears in `list_triggers`, it is cloud-fired and **will be blind**.
Station 03 ran blind three times before this was found; the name "(local)" was not evidence, the
listing was.

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
- ⚠️ **`$` is STRIPPED from any `-Command "..."` string.** Anything with `$` goes in a `.ps1` run
  with `-File`.
- ⚠️ Streamed output **PAUSES on lines starting with `#`** - not a hang; keep reading with explicit
  offsets until `0 remaining`.
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
`C:\po-sup-fix-scripts` (scratch `.ps1`) · `C:\po-worktrees`, `C:\po-wt`, `C:\po-wt-h`,
`C:\po-watcher-worktrees` · plus several `po-*` fix trees.

⚠️ The mapping governs the **device bridge only**, not Desktop Commander (§3).

---

## 5. Authority matrix - who may do what

| | 00 Supervisor | 02 Board-driver | 03 Machine-minder | 04 Scanner | 05 SoT-keeper | 06 PR Master |
|---|---|---|---|---|---|---|
| **Arm a prompt** | ✅ **only 00** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Merge a PR** | ✅ (limits below) | ✅ dispatched | ❌ | ❌ | ❌ | ❌ |
| **Create a PR** | ❌ | ✅ | ❌ | ❌ | ✅ doc-reconcile only | ✅ staging only |
| **Edit `/sot/`** | ❌ | ❌ | ❌ | ❌ | ✅ **only 05** | ❌ |
| **Repair the machines** | ❌ dispatches 03 | ❌ | ⚠️ **report-only** | ❌ | ❌ | ❌ |
| **Mutate the board** | ✅ | ✅ dispatched | ❌ | ❌ read-only | ❌ | stage `-HOLD` only |
| **Azure / Entra / SharePoint** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ **absolute, all stations** |

**Stations 02 and 03 have NO schedule of their own** - they run only when 00 dispatches them. That is
deliberate: two things independently mutating git and the queue is the collision LL-38 records.

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
| `docs/qa/qa-findings.md` | 🔴 **GITIGNORED (`.gitignore:107`)** - anything found only there is UNREPORTED. It swallowed a released gate for nine days |
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
