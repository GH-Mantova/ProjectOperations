# Station 04 — Scanner | 2026-09-08T06:10:38Z–2026-09-08T06:2xZ

Sweep this run: **instruction-drift** (rotation position 4 of 4, assigned by
`scripts/pipeline/next-sweep.mjs`; previous run 2026-09-08T02:10:37Z).

## GROUND

```
UTC            2026-09-08T06:10:38Z
origin/main    4252db5b            (git fetch origin --prune, then rev-parse --short)
dev tree       main @ e4ba60a9     C:\ProjectOperations2   (2 behind, 0 ahead)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — this run is not read-only on that account.

**Sighted run.** `ToolSearch` for `desktop-commander` loaded the toolkit, then
`start_process` (shell `powershell.exe`) returned pid 5412 and a live prompt at
`C:\ProjectOperations2`. This was **not** a blind run.

**vm-git-guard installed.** Last line, quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(exit 0; the installer also printed
`vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`).

⚠️ **Provenance caveat on the binding documents.** The PREFLIGHT tells me to read the three
binding docs from `git show origin/main:<path>`. I read them from the working copy and then
proved the working copy is not stale by the sanctioned probe, which is the same answer without
the pipe (§9.1): `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**. Same probe over
`docs/pipeline/stations/` as a whole → **EMPTY**. So all three were read at `origin/main` content
even though the dev tree's HEAD is 2 commits behind.

## WHAT I MEASURED

**Fresh needles minted this run, both now SPENT by appearing here** (§9.6): `zQq04Needle20260908T0610`
and `zQq04Ctl20260908T0612`. Neither is usable again.

### The corpus is the ENABLED task list, not "the five"

Per `STATION-CAPABILITIES.md` §1. [MEASURED] from the scheduled-tasks MCP at 06:1xZ:

| task | cron | enabled | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | 🔴 **false** | 2026-09-08T05:08:37.966Z | **absent** |
| `04-scanner` | `0 */4 * * *` | true | 2026-09-08T06:10:18.069Z | 2026-09-08T10:09:31Z |
| `05-sot-keeper` | `10 0 * * *` | true | 2026-09-07T14:11:15.657Z | 2026-09-08T14:10:37Z |
| `weekly-security-audit` | `30 7 * * 1` | true | 2026-09-06T21:32:44.637Z | 2026-09-13T21:32:17Z |
| `03-machine-minder` | `0 9 * * *` | true | 2026-09-07T23:01:27.917Z | 2026-09-08T23:00:45Z |

**Discriminating control that `enabled: false` is a real reading and not a field wearing an
answer's clothes:** every `enabled: true` row carries a `nextRunAt`; the `00-supervisor` row
carries none. Two independent fields, same conclusion. [MEASURED] Filesystem corroboration below.

`C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` — six under live top-level folders
(`00-supervisor`, `02-board-driver`, `03-machine-minder`, `04-scanner`, `05-sot-keeper`,
`weekly-security-audit`) and five under `_retired-2026-08-18`. All five station bootstraps were
last written `2026-09-01T00:07:44Z`; `weekly-security-audit` `2026-08-17T06:37:17Z`.
⚠️ **§1's "11 SKILL.md files" figure is right but reads as alarming** — five of the eleven are
explicitly retired. The live corpus is six files, five enabled tasks, of which four are stations.

### Version parity — CLEAN

[MEASURED] every station bootstrap declares `station_doc_version: 1`; every repo station doc
declares `station_doc_version: 1` and `contract_version: 1`. Seven docs on the repo side
(`00`,`01`,`02`,`03`,`04`,`05`,`06`), five bootstraps on the scheduled side. **No mismatch.**
⚠️ `weekly-security-audit`'s bootstrap declares **no** `station_doc_version` and names no station
doc — correct, it is not a station. (Instrument note: my first loop printed `bootstrap_ver=1` for
it because `$v` carried over from the previous iteration; the true reading is that the pattern
matched **nothing**. Corrected before use — §7.)

### `lint-station.mjs` — exit 0, ADMIT all 8

Command: `node C:\ProjectOperations2\scripts\pipeline\lint-station.mjs`. Verdict line:
`ADMIT: all 8 docs clean`, `.claude/agents/*.md (9 agent definitions, encoding clean)`. Its only
warnings are Windows paths quoted **as documentation** inside DOCTRINE §9 and 04's superseded
worktree block — none is a broken reference. Its standing `NOTE` that "contract is v3; these
declare station_doc_version v1" is the already-filed `lint-station.mjs` version-field question,
not new.

### Path resolution in the bootstraps — CLEAN

The bootstraps are the one layer no CI gate reaches, so I checked them directly.
`C:\po-sup-fix-scripts\scan-bootstrap-paths-04-20260908.mjs` extracted every Windows-absolute and
every repo-relative path from all six live bootstraps and tested each with `existsSync`:
**53 checked, 5 unresolved — and all five are the same false positive**, the breadcrumb filename
*template* `docs/pr-prompts/00-0N-` truncated at the `<station>` placeholder by my own regex.
**Zero real unresolved paths.** POSITIVE control `existsSync(DOCTRINE.md)` → true; NEGATIVE
control on a minted path → false.

### The line-number citation that does NOT resolve

[MEASURED] `.gitignore` is 150 lines. Lines **107-111** are
`!Claude Design/docs/` … `!Claude Design/proposed/`. The five QA sinks are at **115-119**
(`docs/qa/qa-checklist.md`, `qa-findings.md`, `qa-test-data-registry.md`, `.qa-run.lock`,
`qa-run-*.md`), under the `# Overnight-QA scheduled task` comment at line 113. All five station
bootstraps cite `.gitignore:107-111`. POSITIVE control: the *repo* station doc's other citation,
`.gitignore:76-83`, still resolves exactly — lines 76-83 are `processed/` through
`no-pr-opened/`. NEGATIVE control, minted needle over `.gitignore` → 0.
🟢 **Already on file and still open** — `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`
(mtime 2026-09-06T07:42:48Z, 108 lines) records the same measurement and the correct replacement
range. **Re-confirmed, not re-raised.**

### The PREFLIGHT rules that exist in the repo layer and in no bootstrap

Union grep over the six live bootstraps, against the same needles over the seven repo station docs.
POSITIVE control `STEP 1` → 5 bootstraps; NEGATIVE control (minted) → 0.

| needle | hits in bootstraps | hits in repo station docs |
|---|---|---|
| `ToolSearch` | **0** | 18 |
| `tool schema` | **0** | — |
| `InputValidationError` | **0** | — |
| `vm-git-guard` | **0** | 14 |
| `git show origin/main` | **0** | 15 |
| `Stamp the ground` / `GROUND` | **0** / **0** | 7 |

⚠️ `device bridge` → 5 in the bootstraps, but every hit is the *hard stop* ("never run `git`
through the device bridge against the Windows `.git`"), not an offer of it as a transport. That is
consistent with `STATION-CAPABILITIES.md` §3 "No second transport" and is **not** drift.
⚠️ Disproved advice checked for and **absent**: `raw CDN` → 0, `web_fetch` → 0 across all six.
The refuted *"in the listing ⇒ cloud-fired ⇒ blind"* rule is present in all five bootstraps in its
**corrected** form. So the specific rot this sweep was created for is not present; what is present
is the reverse — corrections that never propagated *out* of the repo.

### Session-directory corroboration for the disabled task

[MEASURED] 1444 `local_*` session directories under
`…\Roaming\Claude\local-agent-mode-sessions\`. Station 00 fired on the hour at `:08` without a gap
through **2026-09-08T05:08:37Z** (that run wrote until 05:53:01Z). There is **no 06:08 directory**;
the newest directory before mine is 05:08. My own run is 06:10:18Z. POSITIVE control that an absent
directory is a real absence and not retention: every consecutive 00 hour from 2026-09-07T15:08Z to
2026-09-08T05:08Z is still on disk, as are 04's 02:10 and 06:10 directories.
🔧 **So 00 was disabled between 05:08:37Z and 06:08Z.** [CANNOT MEASURE] by whom or why — the
scheduled-tasks layer records no actor.

### `check-breadcrumb.mjs` cadence map — still wrong for 00

[MEASURED] anchor `const CADENCE =` →
`{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`. NEGATIVE control (minted) → 0. Unchanged
since it was filed.

🔴 **And the instrument reports the switched-off station as healthy.** [MEASURED] the same run,
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`, and:

```
  00  last 2026-09-08T05:37:00Z  0.7h ago  (cadence 2h)  ok
  03  last 2026-09-07T23:03:00Z  7.3h ago  (cadence 24h)  ok
  04  last 2026-09-08T06:10:00Z  0.2h ago  (cadence 4h)  ok
  05  last 2026-09-07T14:12:00Z  16.2h ago  (cadence 24h)  ok
```

`00` reads **`ok`** while the task is `enabled: false` with no `nextRunAt`. This is not a bug in
the freshness probe — it answers *"how long since the last breadcrumb"*, and 00's last breadcrumb
is 40 minutes old because it ran normally at 05:08Z before being switched off. It is §7's shape:
a working instrument answering a question adjacent to the one a reader will take it for. **A green
`--freshness` is not evidence that a station is scheduled to run again.** The only field that
answers that is `enabled` / `nextRunAt` from the scheduled-tasks MCP.

## WHAT CHANGED

1. **`docs/pipeline/sweep-rotation.json` — advanced and LEFT DIRTY.**
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-08T06:18:43Z` →
   `advanced: last_index=3 last_run_utc=2026-09-08T06:18:43Z`. Read back:
   `git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`, and
   `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` — a **real**
   uncommitted change, not the behind-HEAD artefact §9.2 warns about. **Station 00 must commit
   this file; Station 04 may not commit to the shared dev tree.**
2. **This breadcrumb**, untracked at `docs/pr-prompts/`.
3. **One scratch file outside the repo**, `C:\po-sup-fix-scripts\scan-bootstrap-paths-04-20260908.mjs`,
   and one sweep capture, `C:\po-sup-fix-scripts\sweep-04-20260908-0610.txt`.

Nothing else. No board mutation, no arm, no merge, no label, no prompt staged, no `sot/` edit.

`status-sweep.ps1` (captured to a file, because it returns early and hides its own §7 verdict)
printed, verbatim:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
It also carries `[STALE] pr-1777-is-green-and-its-only-review-verdict-is-stale-2026-09-07.md
references #1777 which is MERGED`. I did not act on that line — clearing it is not 04's, and a
`[STALE]` line must not be acted on without reading the file.

## FINDINGS

### F1 — Station 00 is DISABLED. The only channel that closes findings is off, and nothing on the board arms, merges or collects. [S1]

[MEASURED] above, two independent fields from the scheduled-tasks MCP (`enabled: false`, and the
only row with no `nextRunAt`) plus the missing 06:08 session directory against fourteen consecutive
hourly predecessors.

**Why this is S1 rather than a scheduling curiosity.** `STATION-CAPABILITIES.md` §5 gives 00 the
**only** ✅ in the "Arm a prompt" row and the primary ✅ in "Merge a PR"; §7 makes 00 the sole
collector — *"Stations do not read each other's chats. Station 00 collects, every run."* The station
contract every station doc carries ends *"If you are not 00, your job ends at writing the
breadcrumb."* With 00 off:

- **no breadcrumb is dispositioned** — mine included, and 03's and 05's after theirs;
- **`sweep-rotation.json` is not committed**, because 00 is the station that commits it, so the
  rotation advance I just made survives only as long as the working copy does;
- **nothing arms**, so the queue cannot move even where gates are satisfied;
- **the dispatch backlog has no recipient** — F2 below is a four-day-old DISPATCH to 00.

**The detector for this condition is 00 itself, which is the circularity already on file.**
`check-breadcrumb.mjs --freshness` is the prescribed probe and it holds `'00': 2`, so it would not
call 00 SILENT for four hours even if something ran it — and the only scheduled run that runs it is
00's own. `needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md` is the open
escalation; this is its first instance where the missed run is **indefinite**, not a single
occurrence.

⚠️ **This may be deliberate and I must not assume it is not.** Marco has been hand-driving this
board — `#1767`, `#1775` and `#1796` were merged by hand in the GitHub web UI, and
`needs-marco/station-00-overruns-its-hourly-slot-and-eats-the-next-occurrence-2026-09-07.md` was
raised the previous day asking him to choose between an overlap guard, a 2-hour cadence, and a
split. **Disabling 00 is not any of those three options**, but it is a coherent response to that
escalation, and re-enabling it would put an automated arming-and-merging actor back onto a board he
is driving by hand. That is DOCTRINE §5.5 — *only Marco knows his intent, never guess it* — and §5.3,
an authorization decision.

**The question for Marco, with RULE 1 applied.**

- **(a) Say whether 00 is off on purpose, and if it is, name the successor for COLLECT.**
  *Complete*: it fixes the condition now **and** removes the standing ambiguity, because whichever
  answer he gives becomes a written fact a future run can read instead of re-deriving — which is
  exactly the failure `DOCTRINE.md` §10.2.1 records costing five consecutive runs. *Additive*:
  nothing is enabled, disabled or merged by an agent on the strength of a guess; no in-flight work
  is discarded. **This is the option that passes both halves.**
- **(b) Re-enable `00-supervisor` now and ask afterwards.** Fails *additive*: it puts an actor that
  arms and merges onto a board Marco is hand-driving, and DOCTRINE §5.3 forbids an agent granting
  that authorization to itself. Passes *complete*.
- **(c) Leave it and let the next 04/03/05 run notice.** Fails *complete* — the breadcrumbs pile up
  undispositioned and the rotation advance is lost on the next tree operation. Passes *additive*.

**DISPOSITION: ESCALATED** → Marco, as `docs/pr-prompts/needs-marco/station-00-is-disabled-and-nothing-collects-2026-09-08.md`.
⚠️ **The subject is outside the repo** (the scheduled-tasks layer), so a chat report alone would be
escalated to nobody; the `needs-marco/` file is the escalation.
**Falsifying probe:** read `enabled` and `nextRunAt` for `00-supervisor` from the scheduled-tasks
MCP, and group the `local_*` session directories by hour. If a 00 directory appears for any hour
after 05:08Z, this finding is dead.

### F2 — The bootstrap PREFLIGHT is missing FOUR of the repo contract's load-bearing preconditions, not one — and the four-day-old dispatch that would have fixed it is addressed to the station now switched off. [S2]

On 2026-09-04 this station filed **F4** in
`docs/pr-prompts/archive/00-04-scanner-2026-09-04-0610-the-mandated-freshness-probe-returns-a-sha-that-matches-nothing.md`:
the *"Load the tool schema FIRST — a validation error is not blindness"* correction lives only in
the repo station doc, which the bootstrap tells the agent to read at STEP 2, **after** the STEP 1
stop it would have prevented. It was **DISPATCHED to Station 00**. Four days on it has not landed,
and this run measures that the gap is wider than that finding recorded:

| repo contract requires, at STEP 1 or STEP 2 | in any bootstrap? |
|---|---|
| load the DC tool schema before calling it; `InputValidationError` ≠ blindness | **no (0 hits)** |
| install `scripts/pipeline/vm-git-guard.sh` before any VM-side call | **no (0 hits)** |
| read the three binding docs from `git show origin/main:<path>`, **never** the working copy | **no (0 hits)** |
| stamp the four-line ground block | **no (0 hits)** |

**The third row is live today, in this run.** Every bootstrap's STEP 2 names
`C:\ProjectOperations2\docs\pipeline\…` — the working copy — and my dev tree is **2 commits behind
`origin/main`**. It happened to be content-identical for the three files that matter (proved by
`--numstat`, in the ground block), but the bootstrap gives no instruction to check that, and the
canonical block exists because *"two stations in one day were served a superseded copy of their own
binding instructions."* A run following the bootstrap literally has no reason to run the probe that
saved this one.

**The second row means the guard the contract calls "FIRST, before any VM-side call" is skipped by
every run that reads only its bootstrap** — and the failure it prevents is a 0-byte `index.lock`
with no owning process, which DOCTRINE §9.2 records as freezing every station, three times in two
days.

⚠️ **No CI gate reaches this layer.** `lint-station.mjs` lints the repo docs and `.claude/agents/`
and exits 0 — it did today — while the drift lives entirely outside the repo. That asymmetry is why
a correction can be right in the repo for four days and absent from the layer that actually governs
STEP 1.

**RULE 1 on the remedy.** The complete-and-additive option is **(a) make the repo layer the only
stop authority and have `lint-station.mjs` assert any bootstrap it can see names `ToolSearch`,
`vm-git-guard` and `origin/main`** — complete because it fails loudly on the *next* divergence
rather than on this one, additive because it adds an assertion and removes no instruction. It still
needs one hand on Marco's machine to paste the corrected bootstraps, which is the half no PR can
reach. **(b) paste the corrected bootstraps only** fails the *complete* half — it fixes today's four
omissions and nothing detects the fifth. **(c) leave the bootstraps thin and accept the STEP 1 stop**
fails both halves: it is the status quo that produced a false blindness call.

**DISPOSITION: ESCALATED** → Marco, in the same `needs-marco/` file as F1, because the two share a
cause — a finding correctly dispatched to Station 00 has no owner while Station 00 is off, and this
one has now waited four days. **Deliberately not re-dispatched to 00.** Not folded into the 09-04
F4: that finding is about one omission and its ordering; this is that the gap is four wide, that one
of the four is live in this very run's dev tree, and that its recipient is switched off.
**Falsifying probe:** re-run the union grep table above. If any bootstrap names `ToolSearch`,
`vm-git-guard` or `origin/main`, that row is fixed.

### F3 — `.gitignore:107-111` in all five bootstraps now points at the Claude Design allowlist. Re-confirmed, already open, NOT re-raised. [S3]

Measured above with both controls; the five sinks are at 115-119. This is
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, unanswered since
2026-09-06T07:42Z, and it already records the correct range. Two days of drift added, no new
information. ⚠️ Worth noting only that it is the **same layer and the same cause as F2** — a
line-number citation in the one layer nothing lints — and that the repo station doc's equivalent
reference uses an *anchor* (`the five files listed under the "# Overnight-QA scheduled task"
comment`) and therefore did not rot. §9.5's *anchor by symbol, never by line number* rule is being
followed inside the repo and not outside it.

**DISPOSITION: DEFERRED** — real, on file, and not urgent on its own. What would make it urgent:
Marco touching the bootstraps for F2, at which point this is a one-line fix to make in the same
pass rather than a separate errand.

### F4 — Two bootstrap cadence lines still contradict their live crons. Re-confirmed, both already open. [S3]

[MEASURED] `00-supervisor` bootstrap line 8: *"Cadence: every 2 hours"* against cron `5 * * * *`
(hourly) — and `check-breadcrumb.mjs`'s `CADENCE` map holds `'00': 2` to match the wrong figure.
`03-machine-minder` bootstrap line 8: *"every 4 hours, or manually after any crash or reboot"*
against cron `0 9 * * *` (daily). `04` (`0 */4 * * *`), `05` (`10 0 * * *`) and `02`
("no schedule of your own") all agree with their layers.

Both are already recorded in `STATION-CAPABILITIES.md` §6 and open with Marco. The one thing this
run adds: with 00 **disabled**, the `'00': 2` map is no longer merely 2× too lenient — the
freshness detector can now never fire for 00 at all, because the only scheduled run that calls it
is 00's.

**DISPOSITION: DEFERRED** — the cron and the bootstrap are Marco's layer, the `CADENCE` map is a
`scripts/` change outside 04's read-only lane, and all three are already filed. What would make it
urgent: Marco choosing to leave 00 disabled, which turns the `'00': 2` entry from a stale number
into a permanently dead alarm and makes fixing it pointless rather than overdue.

### F5 — An uncommitted deletion of a HOLD prompt is sitting in the dev tree, and it is REAL, not the behind-HEAD artefact. [S3, outside this run's sweep]

`git status --porcelain` shows ` D docs/pr-prompts/pr-stationcaps-blind-run-names-one-mount-HOLD.md`.
§9.2's newest bullet says a ` D` on a tree that is behind `origin/main` is **not** evidence of
uncommitted work, so I ran the prescribed probe rather than believing the status line.
[MEASURED] `git diff --numstat origin/main -- <that path>` → **`0 103`** — the file is 103 lines on
`origin/main` and gone from the working tree, so this is a genuine uncommitted deletion.
POSITIVE control on a file known to differ, `sweep-rotation.json` → `2 2`; the EMPTY case is what a
behind-HEAD artefact looks like and this is not it.

**Why it matters:** the file is still **tracked on `origin/main`**, which is the board trap — any
`git checkout .`, `reset --hard`, `stash pop` or `git clean` in this tree restores a prompt whose
work was already consumed. Nothing about it is urgent while nobody runs those commands, and the
station contract forbids me running them.

**DISPOSITION: DEFERRED** — this belongs to the **repo-hygiene** sweep, not instruction-drift, and
committing the deletion is Station 00's (04 may not commit to the shared dev tree). Recorded here
because I met it while reading tree state and a lead met in passing still has to be written down.
What would make it urgent: any station needing a clean read of this tree, at which point the cure is
`git show HEAD:<path>` piped to a write, never a checkout.

## WHAT I DID NOT DO

- **I did not re-enable `00-supervisor`.** It is an authorization decision (DOCTRINE §5.3) about an
  actor that arms and merges, on a board Marco is currently driving by hand. Guessing his intent is
  §5.5. The `mcp__scheduled-tasks__update_scheduled_task` tool was available and deliberately not
  called.
- **I did not commit `docs/pipeline/sweep-rotation.json`.** 04 is read-only on the board, the dev
  tree is on `main`, and nobody commits to `main` directly. Named above for 00 — with the caveat that
  00 is off, so it may sit until Marco or a later run collects it.
- **I did not fast-forward the dev tree** (2 behind). A `merge --ff-only` in the shared dev tree is
  a mutation other concurrent chats would inherit, and I did not need it: the numstat probe proved
  the three binding documents were already at `origin/main` content.
- **I did not stage a fix prompt.** F2's remedy is already covered by an existing finding note
  (09-04 F4), which the staging rules exclude, and the half that matters is outside the repo.
- **I did not act on the `[STALE]` line** in `status-sweep.ps1` §5 about `#1777`, and did not clear
  the escalation it names. Not 04's, and a `[STALE]` line is never acted on without reading the file.
- **I did not touch the board, the queue, any label, any PR, `/sot/`, or Azure / Entra / SharePoint.**
- **I did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** The station doc
  gives one named sweep per run and `next-sweep.mjs` assigned instruction-drift; spreading thin is
  the failure the rotation exists to prevent.
- ⚠️ **This breadcrumb is UNTRACKED** until a board PR commits it — and Station 00, the station that
  sweeps breadcrumbs up, is the subject of F1. **If nobody re-enables 00, this file does not reach
  `origin/main`.** That is stated here rather than assumed.
