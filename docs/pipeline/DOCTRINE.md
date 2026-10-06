
---

<!-- DOCTRINE_CORE_SPLIT_V1 — this file is the CORE binding doctrine, read in full every run.
     The evidence (incident write-ups, measurement tables, worked examples) lives in
     docs/pipeline/DOCTRINE-REFERENCE.md and is read on demand -- and ALWAYS before acting on
     a matching §9 trap. Nothing has been deleted; every original line is in one of the two files. -->

# ⚖️ SHARED DOCTRINE — applies to EVERY station, no exceptions

**How to read this file.** The core (this document) carries the RULES: what to do, what never to
do, and the hard stops. It is short enough to carry whole. The reference,
`docs/pipeline/DOCTRINE-REFERENCE.md`, carries the EVIDENCE: measured incidents, worked examples,
long rationale, dated corrections. Read the core in full every run; open the reference when the
task touches a topic, and ALWAYS before acting on a trap in §9. Each moved section ends with
`Full detail: DOCTRINE-REFERENCE.md §<n>.`

## 1. THE READ-BACK RULE

**Every mutation must be read back and PROVED. An action you did not verify did not happen.**

Not "should be". Not "the command exited 0". You **re-read the thing you changed** and assert it now
holds the value you intended.

This exists because every one of these actually happened:

| What was "done" | What was true |
|---|---|
| `Set-Content` wrote the PR body | It wrote a **BOM**, and node refused to parse the file |
| `git commit` succeeded | `$ErrorActionPreference="Stop"` had aborted the script **before** the commit — the log looked clean |
| The merge queue filtered the NEVER-list | PS collapsed the JSON array to **one object**; the filter was a **silent no-op** and it selected **#552, the production-data PR** |
| The PR body carried the gate marker | `$string + $array` joined with **spaces**; the marker was no longer at column 0 |
| "Watcher is down, queue frozen" | It had run **6 minutes ago**; the check used Linux `ps` against a **Windows** process, and compared UTC to local time |

**Therefore: do not hand-roll board operations.** Dot-source the library and use its primitives —
every one of them already reads back:

```powershell
. C:\ProjectOperations2\scripts\pipeline\pipeline-lib.ps1
```

`Get-Board` · `Get-PrBody` · `Get-ChecksFor` · `Set-PrBody` · `Invoke-GitPush` · `Copy-FileFromRef`
`Assert-Mergeable` · `Assert-SmokeGreen` · `Assert-BodyClaimsAreReal` · `Assert-SmokedOrEscalate`
`Merge-Pr` · `Assert-ArtifactSurvived` · `Test-WatcherRepoClean`

If you catch yourself writing `gh pr merge` or `Set-Content` against a PR body directly — **stop.**
The primitive exists precisely because the obvious way is the broken way.

## 2. EVIDENCE, NOT ASSERTION

You are **never** the judge of whether your own work passed.

- **Smoke:** run `scripts\pipeline\smoke-pr.ps1 -Branch <b>`. It boots the API + web against a
  seeded DB and drives the real acceptance suite in a real browser. **The exit code decides.**
  You report the exit code. You do not report your impression of the exit code.
- **CI:** `Assert-SmokeGreen` reads the state **from GitHub**. Pending is not pass. A missing
  required check is not a pass.
- **Your own claims:** `Assert-BodyClaimsAreReal` greps the diff for the artifact you say you built.

> A failure is a **diagnosis**, not a nuisance. **Never re-run hoping for green.** #544's e2e
> "flake" was two tests asserting the exact bug the PR existed to remove — *the tests encoded the
> bug*. If you cannot name the cause, you have not found it.

## 3. NEVER DIAGNOSE FROM SILENCE OR FROM THE DIFF

- **CI:** read the job log — `gh run view <run-id> --job <job-id> --log`. Never reason a CI failure
  out of the diff. Three confidently-wrong diagnoses in one week came from exactly that.
- **Liveness:** "I cannot verify it" is **not** "it is down". The only sanctioned liveness check is
  `scripts\restart-watcher-if-wedged.ps1`. Logs are **UTC**; the machine is **Brisbane (UTC+10)**.
- **Silence is not death.** An agent mid-diagnosis is network-bound and process-invisible. Two
  productive runs were killed as "wedged" (LL-25). Kill on a missed heartbeat or a timeout — never
  on quiet.

## 4. STAY IN YOUR STATION

The supervisor **acts** -- it diagnoses, fixes, pushes, and merges -- but ONLY in a disposable worktree, never a shared tree. A supervisor once ran `git merge` inside the
watcher's repo, hit a conflict, **abandoned it mid-merge**, and reported "STATUS: NOMINAL". That
single act killed the entire overnight queue (LL-38).

**Hand genuinely specialist work to its station; but a red you can root-cause and fix is yours to fix (section 8). Careless work in a SHARED tree is the incident -- not acting itself.**

Never `git checkout` / `commit` / `push` in `C:\po-watcher\ProjectOperations` — a live agent may be
working there. Conflict work happens in a **disposable worktree**, never a shared tree.

## 5. 🚫 HARD STOPS — escalate to Marco, do not reason your way past them

1. **Azure / Entra / SharePoint — NEVER, not once, not read-modify-write.** No portal, no app
   settings, no secrets, no permissions, no `az`, no `Connect-MgGraph` that writes. These are shared
   company systems; a wrong move locks real staff out of real documents. Write the code, write the
   runbook, ship the PR, **then hand Marco the steps.**
2. **Production data.** #552 writes prod rows. Marco reviews the SQL.
3. **A real human identity.** #538 needs a real Microsoft account on a real shared PC. **No agent
   has an identity.** Get it green and mergeable, then stop.
4. **Anything irreversible** — force-push, branch deletion, destructive migration, deleting a secret.
   *A verification step that gates an irreversible action must COMPLETE BEFORE IT — never alongside
   it.* An agent once walked Marco through deleting a live production secret and testing it in the
   same breath. Only luck prevented an outage (LL-36).
5. **Design or product questions.** Only Marco knows his intent. Never guess it.
6. **Verification exhausted** — two honest attempts failed. **Say so plainly. Do not loop.**

Escalating is not failure. **Escalating something in this list is doing your job correctly.**

### 5b. `needs-marco/` IS THE ONLY REAL STOP — `escalates: true` STOPS NOTHING

Ruled by Marco, 2026-07-20 — *"run, open PR, block merge only."*

**`escalates: true` in a prompt's frontmatter gates the MERGE, not the RUN.** It is advisory
metadata about the work. Nothing in `scripts/pr-watcher/**` reads it; `lint-prompt.mjs` admits
escalating prompts happily. **This is deliberate and will not be "fixed" with a watcher guard** —
one stop beats two, because a flag that *sometimes* halts execution competes with the folder that
*always* does, and agents end up trusting the weaker one.

- **A loose armed `docs/pr-prompts/*-ready.md` WILL RUN**, whatever its frontmatter says.
  **Arming a prompt IS the decision to run it.** `escalates: true` on an armed prompt does *not*
  mean "safely parked".
- To stop something, **MOVE THE FILE** to `docs/pr-prompts/needs-marco/`. Location is the
  contract; frontmatter is a note. Nothing else stops it.
- **Do NOT blanket-quarantine `escalates: true` prompts.** On 2026-07-20 a supervisor cycle swept
  four into `needs-marco/` on the strength of the flag alone — after Marco had explicitly asked
  for them to run. That sweep is why the `clients.*` permanently-false gate sat unfixed on main
  for days. **A cautious-looking sweep is not free; it silently discards work Marco asked for.**
  Quarantine only what Marco personally names, or what hits a genuine hard stop from the list
  above.
- The right handling of an escalating prompt is: **run it, open the PR, and label it
  do-not-merge.** Merging is the gate — not starting.

## 6. NEVER EXIT SILENTLY

There is no human in a headless run. **10 runs died waiting for an answer to a question nobody was
there to read.**

- Never ask a question. Decide, or escalate in writing and exit.
- If you do nothing, say `NO-OP: <reason>` — loudly. A silent success is indistinguishable from a
  crash, and the watcher will file it as a win.
- Echo progress between phases. Long silences get you killed (see §3).

---

# 🔬 §7. YOUR INSTRUMENT LIES. CALIBRATE IT BEFORE YOU TRUST THE READING.

**The most dangerous failure here is not a broken system — it is a broken MEASUREMENT of a working
system.** A broken system fails loudly. A broken instrument hands you a confident, coherent, WRONG
verdict, and then you act on it.

This has now happened **six times**. Every time, the system was fine and the *tool* was broken.
Twice it nearly caused real damage: one agent almost "repaired" clean files into corruption; another
declared a healthy watcher dead and killed the queue.

## The rule

> **Before you believe a NEGATIVE result — "it's broken", "it's missing", "it's already done",
> "it's down" — prove your instrument can produce a POSITIVE one.**

A check never seen to succeed is not a check. If your script says FAIL, first make it say PASS on
something you *know* is good. If it can't, **the script is the bug.**

And: **a tool that cannot run must FAIL LOUD, never fail quiet.** "I could not measure it" must
never silently become "it measured false".

## The six. Recognise them — they will happen to you.

Six measured instrument lies, each one costly, are tabulated in the reference. The shape they share:
**four of the six were a failed call being read as a meaningful answer.**
Full detail: DOCTRINE-REFERENCE.md §7.

## Standing guards

1. **Positive control first.** Prove the check CAN pass before believing it failed.
2. **Connect, then assert.** Any script touching a DB / API / process must verify the connection and
   **abort** on failure. Never let a failed call flow into a comparison.
3. **Suspected file corruption → verify with `node`**, which reads UTF-8 correctly. Not
   `Get-Content`. Check for U+FFFD and the `a-hat-euro` mojibake signature in the BYTES.
4. **Liveness ONLY via `scripts\restart-watcher-if-wedged.ps1`.** Never `ps`/`grep` across an OS
   boundary. **"I cannot verify it" is NOT "it is down".**
5. **No single-letter PowerShell variables. Ever.**
6. **No `Write-Output` inside a PowerShell function whose return value you capture.** Use
   `Write-Host`, or build one value and return it.
7. **`$ErrorActionPreference = "Continue"` in git scripts.** Git warns on stderr; `"Stop"` will abort
   you *before your commit* while the log still looks perfectly clean.
8. **Keep escaped double quotes out of `-q '<jq>'` / `--jq` when calling `gh` from PS 5.1** — take
   raw `--json` and `ConvertFrom-Json`. And **assign-then-foreach**: piping a JSON array straight
   into `Where-Object` collapses it to ONE object. That exact bug once let the merge queue select
   **#552 — the production-data PR.**

## If your instrument breaks mid-task

**Say so.** `NO-OP: my check was broken; here is what I could not measure.` That is a **success**.

Reporting a verdict you obtained from a broken instrument is the worst thing you can do here — worse
than doing nothing, because someone will act on it.

Full detail: DOCTRINE-REFERENCE.md §7.

---

## 7.1 DECLARE YOUR PROVENANCE - say how you know, or your report is a rumour

Added 2026-08-18 after three separate wrong claims in one morning, from three different
actors, all with the same shape: **a conclusion drawn from rendered or stale data, written
down with the same confidence as a measurement.**

### The rule

**Every factual line in a station artifact carries how it was obtained.** Three tags, and there
is no fourth:

- **`[MEASURED]`** - you ran a probe and are quoting its output. Include the command and enough
  of the result to re-check. A PID, a byte count, an exit code, a log line.
- **`[INFERRED]`** - you read something and reasoned. Say what you read. An inference is allowed
  and often necessary; it is not allowed to be dressed as a measurement.
- **`[CANNOT MEASURE]`** - the probe you needed was unavailable. **Say so and stop.** Do not
  substitute an inference and let the reader assume you looked.

Every artifact also carries, at the top: **UTC timestamp** and **the git SHA it was true at**.
A claim without a SHA cannot be checked later, and a claim that outlives its SHA is how
`pr-1156-review-block.md` sent its reader to redo finished work.

### Why `[CANNOT MEASURE]` is not optional

Stations run in a Linux sandbox. Several sanctioned probes are PowerShell scripts on the
Windows host, and the desktop connectors that would reach it are only present while the desktop
app is running - **so an overnight scheduled run legitimately cannot probe the machine.** That
is a fact to report, not a gap to paper over. 05-sot-keeper already did this correctly on
2026-08-17 by stating it had no PowerShell rather than guessing at liveness. That is the
standard.

### The re-read rule

**Before you act on someone else's artifact - including your own from an earlier run - re-verify
its central claim against the live system.** If it carries no SHA or the SHA is not current,
treat it as a lead, not a finding. Anything in `needs-marco/` older than the current head is a
lead.

Full detail: DOCTRINE-REFERENCE.md §7.1.

# 8. THE SUPERVISOR ACTS -- FIX METHODOLOGY, MERGE POLICY, IN-CHAIN HOLD

Marco, 2026-08-11. The supervisor drives the WHOLE board -- every open PR to green and merge, fixing
failures directly -- and escalates only the narrow hard-stop set (§5). Acting is the job; §§1-7 are
the disciplines that make acting safe. The old "dispatch only, zero hands" stance is retired: the
historical incidents were careless acting in a SHARED tree, never acting itself.

## 8.1 Root-cause before you touch anything

Diligently diagnose EVERY red before fixing: pull the actual job log (§3), name the cause and its
blast radius, never guess from the diff. A fix applied without a proven cause is a second bug. If
you cannot name the cause, you have not found it (§2). Full detail: DOCTRINE-REFERENCE.md §8.1.

## 8.2 Board velocity -- the fix-implementation rule

The goal is to keep the board MOVING. For every red:
- **Prefer ONE complete fix in place.** Push the real fix straight to the failing PR's branch when
  it is quick and safe -- that both unblocks and is permanent in a single move. This is the common
  case.
- **Split only when the proper fix is BIG or SYSTEMIC.** Land a legitimate quick unblock now and
  stage the permanent fix as its own follow-up PR (then auto-drive it green→merge like any other).
- **A quick fix is ONLY EVER a legitimate unblock -- NEVER a mask.** No weakened assertions, no
  skipped or quarantined tests, no GATE-ALLOW / SEED-ONLY marker that is not actually true. If the
  only fast path would paper over a real defect, do the real fix instead.

Full detail: DOCTRINE-REFERENCE.md §8.2.

## 8.3 Merge policy -- native auto-merge only, never by hand

- **Non-migration PRs:** arm native squash auto-merge through `Assert-SmokedOrEscalate` then
  `Merge-Pr` (§1) -- `Merge-Pr` runs `gh pr merge --squash --auto` itself and reads the result back;
  never type that command by hand. It merges the moment all required checks are green.
- **Additive migrations** (new tables/columns/enums, nullable adds, idempotent insert-if-absent data
  migrations): auto-merge too, but only AFTER the verified apitest passes (station 02 rule 6b) --
  one migration per run, ascending migration-timestamp order, no timestamp collisions.
- **Destructive migrations** (DROP / rename / retype a column or table holding data) and
  **production data or auth writes:** escalate to Marco (§5). Get them green and mergeable,
  then hand over.
- Follow-up permanent-fix PRs (from §8.2) are auto-driven on these same rules. **Never hand-merge.**
- **UPDATE_AT_MERGE_TIME_V1 (Marco, 2026-10-03).** `PR_WATCHER_AUTO_UPDATE` defaults to **OFF**;
  `Merge-Pr` updates a BEHIND branch itself and queues the merge pinned to the fresh `headRefOid`,
  returning `State = 'QUEUED'`. The next Station 00 run confirms MERGED; QUEUED is never read as
  merged.

### 8.3a JS merge queue (`merge-queue.mjs`) -- guards required before wiring

`scripts/pr-watcher/merge-queue.mjs` **must not be wired to any cron, dispatcher, or npm script**
until SLICE 7 of the cluster-chaining plan is merged -- that slice installs the guards: NEVER_MERGE
list, hold-label refusal (`do-not-merge`/`needs-marco`/`hold`, read per-PR), and the implicit
`escalates: true` cover via the auto-applied `do-not-merge` label. Merge authority remains with
the supervisor and Marco. The queue is a tool; wiring it is a separate decision.

Full detail: DOCTRINE-REFERENCE.md §8.3.

## 8.4 The in-chain HOLD rule

A `*-HOLD.md` prompt is on hold ONLY because it depends on a predecessor PR not yet merged to
`main`. The moment every predecessor it names is merged and on `main`, it is promoted to
`*-ready.md` and runs. **HOLD is a waiting state, not a veto** -- an ex-HOLD PR is not suspect;
its promotion means its chain precondition was met, so drive it like any other. This is entirely
separate from the **forbidden never-arm denylist** enforced in `queue-sync.ps1`, which nothing ever
promotes. Full detail: DOCTRINE-REFERENCE.md §8.4.

## 8.5 Queue layout -- six states, one location per prompt

The full standard lives in `docs/pipeline/QUEUE-LAYOUT.md` (QUEUE_LAYOUT_V1). Every prompt lives in
exactly one state. The watcher keys on `armed`; the other five are Marco's operational categories.

| state | where | meaning |
|---|---|---|
| brainstorm | `docs/pr-prompts/brainstorm/` | being thought about; not a prompt yet |
| draft | `docs/pr-prompts/draft/` | written, not approved; inert |
| hold | `docs/pr-prompts/*-HOLD.md` | approved and staged; on main; waiting on its gate |
| armed | `docs/pr-prompts/*-ready.md` | the rename IS the dispatch; the only state `READY_PATTERN` matches |
| merged | `docs/pr-prompts/merged/` | its PR is confirmed MERGED on main |
| superseded | `docs/pr-prompts/superseded/` | replaced; the replacement is named inside the file |

**Why hold and armed are filenames, not folders.** `index.mjs` calls `fsWatch(PROMPT_DIR,
{ persistent: true }, ...)` with NO `recursive: true`. On Windows, a file-system change inside a
subdirectory fires no event; only the 5-minute `RESCAN_INTERVAL_MS` sweep would notice. Moving
armed into a folder would silently turn arming from immediate into eventual.

**Reports are not prompts.** Breadcrumbs and run reports are written at depth 1 as `00-NN-...`
breadcrumbs (the station-contract REPORT CONTRACT) and swept to `docs/pr-prompts/archive/`.
**`archive/` is the reports folder; no `reports/` folder exists or will be created** (Marco,
ruling 3, 2026-10-02). Full detail: DOCTRINE-REFERENCE.md §8.5.

**Nothing is ever deleted.** Retiring a prompt means moving it. **In force since 2026-10-02**
(QUEUE_LAYOUT_LINE_AT_TODAY_V1): every file a PR **adds or renames** under `docs/pr-prompts/` must
follow the layout, checked in CI by `check-queue-layout.mjs`; files that existed before 2026-10-02
are grandfathered, and the S3 migration of old files is cancelled by decision.

---

# 🔧 §9. INSTRUMENTS — the measured traps, in one place

§7 tells you your instrument lies. This section names the specific lies, each one **measured**, each
one having already cost this pipeline real work. **Before acting on anything that touches a trap
below, read its full write-up in DOCTRINE-REFERENCE.md §9.<same number>** — the one-line cure here
is a reminder, not the whole mechanism.

<!-- CANONICAL-BLOCK: instruments v2 — the shared trap list. Stations POINT here; they do not copy it.
     lint-station.mjs fails if this block is edited without re-recording its hash.
     The one-liners below are the standing names; the measured write-ups are in
     DOCTRINE-REFERENCE.md §9.1 through §9.6. -->

## 9.1 The shell

- **`$` is EXPANDED by the `-Command "..."` layer before PowerShell parses it** — anything containing
  `$` goes in a `.ps1` file run with `-File`.
- **Streamed output can return EARLY with output still pending** — `#`-headings in the first few ms
  can be chopped; re-call `read_process_output` until it stabilises.
- **A ParserError naming a filesystem path instead of `$home` means your argument was expanded by
  the outer shell** — quote it so PowerShell sees `$home`, not its value.
- **PowerShell variables are CASE-INSENSITIVE** — never reuse single letters like `$c`/`$C`.
- **PowerShell functions return ALL output**, not just `return` — never `Write-Output` inside a
  function whose return value you capture.

Full detail: DOCTRINE-REFERENCE.md §9.1.

## 9.2 Git

- **`git status` is structurally blind to gitignored files** — a `*-ready.md` never shows as `??`.
- **`git fetch origin main` on git 2.55 opportunistically updates `refs/remotes/origin/main`** —
  on older git it does not, so always use `+refs/heads/main:refs/remotes/origin/main`.
- **The dev tree's index is SHARED between concurrent chats** — a `git mv` typed by another chat
  sits in your index until you refresh.
- **`git stash` in the watcher clone is a CLOSED LOOP** — the launcher stashes on every start and
  never pops.
- **Never `git checkout .`, `reset --hard`, `stash pop` or `clean` against the queue** — they
  resurrect dead prompts.
- **Never `git checkout -- <path>`** — one typo from `checkout -- <dir>`, which resurrects consumed
  prompts. Use `git show HEAD:<path>` piped to a node write instead.
- **`origin/main` is a PER-TREE remote-tracking ref** — a worktree's `origin/main` is only as fresh
  as its last `git fetch`.
- **A piped `git show <ref>:<path> | git hash-object --stdin` is UNSOUND in powershell.exe** —
  PowerShell re-encodes the native command's stdout. Use `git rev-parse <ref>:<path>` and
  `git diff --numstat origin/main -- <path>` (empty = not different) instead.
- **A 0-byte `.git/index.lock` hours old with no owning git process is STALE** — measure byte size
  and age before clearing.

Full detail: DOCTRINE-REFERENCE.md §9.2.

## 9.3 Files and encoding

- **`Get-Content` reports FALSE MOJIBAKE** — the console encoding mangles the display, not the file.
  Read with `node` to see the bytes.
- **PS 5.1 `Get-Content` decodes BOM-less UTF-8 as Windows-1252** — the "corruption" is in the
  reader; the file is clean.
- **`Set-Content` / `Out-File -Encoding UTF8` writes a BOM** — node refuses to parse it. Write with
  node's `fs.writeFileSync(path, buf)`.
- **`*>` is the same UTF-16LE trap as `>`** — PowerShell redirection writes UTF-16LE by default.
- **Sub-agents on Windows re-encode em-dashes to the CP1252 double-encode signature** — always
  diff-check schema.prisma and other text after sub-agent output.
- **The agent-definitions directory (`.claude/agents/*.md`) is swept for CP1252 double-encode
  signatures and `U+FFFD`** by `lint-station.mjs`.

Full detail: DOCTRINE-REFERENCE.md §9.3.

## 9.4 GitHub

- **The GitHub MCP token cannot merge, open PRs, or edit a PR's body (403)** — use `gh` through
  Desktop Commander.
- **`gh run list --branch main` can be DAYS stale** — read CI from the PR itself (`gh pr checks`).
- **`mergeStateStatus: CLEAN` can still be refused** — a base-branch policy may still block the
  merge; read the ruleset.
- **"Absent from `origin/main`" is NOT "orphaned"** — check open PRs before calling anything dead.
- **A LIST response's `merged` field is unusable** — ask each PR individually with
  `gh pr view <n> --json state,mergedAt`.
- **Keep escaped double quotes out of `-q '<jq>'` / `--jq` when calling `gh` from PS 5.1** — take
  raw `--json` and `ConvertFrom-Json` in PowerShell.

Full detail: DOCTRINE-REFERENCE.md §9.4.

## 9.5 The pipeline's own instruments

- **`rev-<n>-ready.md` are auto-generated REVIEW JOBS**, not prompts — they have no YAML front
  matter by design.
- **`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15** — do not clear it as a
  stray lock.
- **A restart adopts nothing** — the watcher runs `index.mjs` from the clone; the clone must be
  updated before relaunch.
- **The watchdog heartbeat only ticks MID-RUN** — age alone cannot separate idle from wedged.
- **Never count or kill by image name** — resolve PIDs and verify command lines (19 `node.exe` once
  were present at once).
- **QUARANTINED ledger rows are recorded but NOT binding** — citing one as authority is an error.
- **`check-breadcrumb.mjs` measures two different sets, and only ONE sees `archive/`** — the
  freshness scan does; the structure pass does not.
- **`list_sessions` reports `running` long after a session has stopped** — it cannot answer
  liveness alone; cross with the session directory's `CreationTimeUtc`.
- **The local-agent-mode session directory name changed 2026-09-15** from `local_<uuid>` to the
  first 8 hex characters — scan at the directory level with no name filter.
- **A `scripts/pr-watcher/**` merge needs a watcher restart** — the watcher keeps running the OLD
  code until it does.

Full detail: DOCTRINE-REFERENCE.md §9.5.

## 9.6 The rule behind all of them

🔴 **AN EMPTY RESULT IS NOT AN EMPTY WORLD.** Before concluding absence, ask what your instrument
is actually measuring: a renamed convention, a filtered glob, a path that does not exist on your
machine, a probe pointed at the wrong corpus. **A NEGATIVE CONTROL YOU WROTE DOWN IS A POSITIVE.**
**MINT A FRESH NEEDLE EVERY RUN** — any string already in the documentation returns a false
positive against that documentation. This generalises from NEEDLES to PATTERNS: §9 is a written
description of broken queries, so it contains one of each; **run any §9 probe twice, once against
this file and once against the corpus its bullet names, and compare.**

Full detail: DOCTRINE-REFERENCE.md §9.6.

<!-- END-CANONICAL-BLOCK: instruments v2 -->


# 🛰️ §10. SECOND LANES — work that reaches the repo without passing through the watcher

Added 2026-08-31. A Claude Code cloud session connected to `GH-Mantova/ProjectOperations` can clone,
branch, commit and open a PR without the watcher, the dev tree or Marco's machine being involved at
all, and Claude Design can author interface work the same way.

## 10.1 A PR the watcher did not open carries NO RULE-2 verdict — and that reads as "cleared"

🔴🔴 **THIS IS A SAFETY RULE, NOT A CONVENTION.** RULE 2 — never merge a PR the watcher routed to
Marco — is written against watcher-opened PRs. A PR a cloud session or Design opened has no watcher
verdict at all, and that absence must never be read as "cleared for merge". **Classify every PR
before merging:**

1. Watcher-opened + no `needs-marco` label → the usual lane; RULE 2 applies as written.
2. Watcher-opened + `needs-marco` label → **DO NOT MERGE.** RULE 2.
3. Second-lane (watcher never opened it) → carries NO verdict. Classify by hand against the hard
   stops in §5. If any apply, label `do-not-merge` and route to Marco.

Full detail: DOCTRINE-REFERENCE.md §10.1.

## 10.2 A cloud session is a CODE-WRITING lane. It cannot drive the board.

A cloud session has no access to Marco's PC, the watcher process, the queue files or the dev tree.
It is a station 01 (code-writer) analog, nothing more. **It may not merge, may not arm or disarm
prompts, may not retire escalations, may not restart the watcher.** Its PR is opened and then
driven by Station 00 like any other. Full detail: DOCTRINE-REFERENCE.md §10.2.

## 10.3 Route docs-and-tests work through the watcher, not around it

A cloud session that opens its own PR for a docs-or-tests change bypasses `lint-prompt.mjs`, the
breadcrumb contract, and the register. **Prefer: write a prompt, let the watcher open the PR.**
Full detail: DOCTRINE-REFERENCE.md §10.3.

## 10.4 Design decisions are settled BEFORE the prompt, not inside the slice

A prompt is a construction order, not a design review. If a slice re-opens a design question
mid-run, STOP and escalate — do not guess Marco's intent. Full detail: DOCTRINE-REFERENCE.md §10.4.

## 10.5 An artifact carries ONE identity for its whole life

An artifact (prompt, PR, breadcrumb, migration file) keeps its original name across every rename,
move, and retirement. **Never duplicate** a prompt under a second name; **never rename** a
migration file once committed. Full detail: DOCTRINE-REFERENCE.md §10.5.

## 10.6 A second-lane PR does not consume the prompt that describes the same work

If a cloud session or Design opens a PR for the same work a `-HOLD.md` prompt describes, the
prompt is **still armed from the queue's point of view**. Mark the prompt superseded explicitly
(name the PR number inside), or the watcher will build the same work twice. Full detail:
DOCTRINE-REFERENCE.md §10.6.
