
---

# ⚖️ SHARED DOCTRINE — applies to EVERY station, no exceptions

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

| # | The lie it told | The truth | Why |
|---|---|---|---|
| 1 | "WATCHER IS DOWN — QUEUE FROZEN" | It had run **6 minutes ago** | `ps aux \| grep` in a **Linux sandbox** against a **Windows** process. Then compared a UTC log line to a local clock. **Logs are UTC; the machine is Brisbane (UTC+10).** |
| 2 | "sot/ files are corrupted — em-dashes eaten, `?` everywhere" | Files were **clean UTF-8**, zero replacement chars | **PS 5.1 `Get-Content` decodes BOM-less UTF-8 as Windows-1252.** The mojibake was in the READER. The "fix" (an `-Encoding ascii` patch) would have caused the corruption **for real**. |
| 3 | "premise satisfied — work already done" → **BINNED THE PROMPT** | The premise never **ran** | `shell: "/bin/bash"` — **Windows has no /bin/bash.** Spawn failure gives `err.status === undefined` -> `-1`, which wasn't in the broken-list, so it was misread as "premise false". It would have **silently discarded the entire backlog** while printing green. |
| 4 | "NOT IDEMPOTENT / ADMIN EDIT OVERWRITTEN" | The migration was perfectly idempotent | Wrong DB role. **Every query failed**, and the empty strings compared unequal. A connection failure wearing a finding's clothes. |
| 5 | "No such container: 35" | The container was fine | **PowerShell variables are CASE-INSENSITIVE.** A local `$c` (column count) silently clobbered `$C` (container name). |
| 6 | "NOT IDEMPOTENT" — while printing two IDENTICAL row counts | It was idempotent | **A PowerShell function returns ALL its output**, not just `return`. `Write-Output` inside the function got captured into the return value. |

Note the shape: **four of the six were a failed call being read as a meaningful answer.**

## Standing guards

1. **Positive control first.** Prove the check CAN pass before believing it failed. (#3, #4)
2. **Connect, then assert.** Any script touching a DB / API / process must verify the connection and
   **abort** on failure. Never let a failed call flow into a comparison. (#4)
3. **Suspected file corruption -> verify with `node`**, which reads UTF-8 correctly. Not
   `Get-Content`. Check for U+FFFD and the `a-hat-euro` mojibake signature in the BYTES. (#2)
4. **Liveness ONLY via `scripts\restart-watcher-if-wedged.ps1`.** Never `ps`/`grep` across an OS
   boundary. **"I cannot verify it" is NOT "it is down".** (#1)
5. **No single-letter PowerShell variables. Ever.** (#5)
6. **No `Write-Output` inside a PowerShell function whose return value you capture.** Use
   `Write-Host`, or build one value and return it. (#6)
7. **`$ErrorActionPreference = "Continue"` in git scripts.** Git warns on stderr; `"Stop"` will abort
   you *before your commit* while the log still looks perfectly clean.
8. **Never pass `-q '<jq>'` to `gh` from PS 5.1** — it re-splits the quoted expression on spaces.
   Take raw `--json` and `ConvertFrom-Json`. And **assign-then-foreach**: piping a JSON array
   straight into `Where-Object` collapses it to ONE object. That exact bug once let the merge queue
   select **#552 — the production-data PR.**

## If your instrument breaks mid-task

**Say so.** `NO-OP: my check was broken; here is what I could not measure.` That is a **success**.

Reporting a verdict you obtained from a broken instrument is the worst thing you can do here — worse
than doing nothing, because someone will act on it.


---

## 7.1 DECLARE YOUR PROVENANCE - say how you know, or your report is a rumour

Added 2026-08-18 after three separate wrong claims in one morning, from three different
actors, all with the same shape: **a conclusion drawn from rendered or stale data, written
down with the same confidence as a measurement.**

- `needs-marco/pr-1156-review-block.md` asserted PR #1156's merge commit deleted
  `LocationProvider.ts` and two other files and told the reader to re-fire the prompt on a
  clean branch. The PR's actual file list was **9 files, all added or modified, ZERO
  deletions**. The block had been true against an older head and was never re-stamped.
- A CP-11 "undeclared migrations" failure was diagnosed as a malformed `GATE-ALLOW` marker
  wrapped in backticks. The backticks were **an artefact of how one API client renders JSON**.
  The raw body was correct. The real cause was that **the gate run itself was stale**.
- "#1162 is deployed" and "#1162 was never deployed" were both written the same morning.
  Both were true when sampled. Neither said when, or against which SHA.

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

# 8. THE SUPERVISOR ACTS -- FIX METHODOLOGY, MERGE POLICY, IN-CHAIN HOLD

Marco, 2026-08-11. The supervisor drives the WHOLE board -- every open PR to green and merge, fixing
failures directly -- and escalates only the narrow hard-stop set (section 5). Acting is the job;
sections 1-7 are the disciplines that make acting safe. The old "dispatch only, zero hands" stance is
retired: the historical incidents were careless acting in a SHARED tree, never acting itself.

## 8.1 Root-cause before you touch anything
Diligently diagnose EVERY red before fixing: pull the actual job log (section 3), name the cause and
its blast radius, never guess from the diff. A fix applied without a proven cause is a second bug. If
you cannot name the cause, you have not found it (section 2).

## 8.2 Board velocity -- the fix-implementation rule
The goal is to keep the board MOVING. For every red:
- **Prefer ONE complete fix in place.** Push the real fix straight to the failing PR's branch when it
  is quick and safe -- that both unblocks and is permanent in a single move. This is the common case.
- **Split only when the proper fix is BIG or SYSTEMIC.** Land a legitimate quick unblock now and
  stage the permanent fix as its own follow-up PR (then auto-drive it green->merge like any other).
  Example: route around a flaky shared util now, fix the util properly in a trailing PR.
- **A quick fix is ONLY EVER a legitimate unblock -- NEVER a mask.** No weakened assertions, no
  skipped or quarantined tests, no GATE-ALLOW / SEED-ONLY marker that is not actually true. If the
  only fast path would paper over a real defect, do the real fix instead, even if slower -- that
  becomes the unblock. (Cf. CP-23: the answer to seed-without-migration is an idempotent
  insert-if-absent migration, never a false marker.)

## 8.3 Merge policy -- native auto-merge only, never by hand
- **Non-migration PRs:** arm native squash auto-merge (`gh pr merge <n> --auto --squash`); it merges
  itself the moment all required checks are green.
- **Additive migrations** (new tables/columns/enums, nullable adds, idempotent insert-if-absent data
  migrations): auto-merge too, but only AFTER the verified apitest passes (station 02 rule 6b) --
  one migration per run, ascending migration-timestamp order, no timestamp collisions.
- **Destructive migrations** (DROP / rename / retype a column or table holding data) and
  **production data or auth writes:** escalate to Marco (section 5). Get them green and mergeable,
  then hand over.
- Follow-up permanent-fix PRs (from 8.2) are auto-driven on these same rules. **Never hand-merge.**

### 8.3a JS merge queue (`merge-queue.mjs`) -- guards required before wiring

`scripts/pr-watcher/merge-queue.mjs` is the sequential PR merger used by the supervisor.
It **must not be wired to any cron, dispatcher, or npm script** until SLICE 7 of the
cluster-chaining plan is merged -- that slice installs the guards below.

Once SLICE 7 is on `main`, the queue enforces:

1. **NEVER_MERGE list.** Any PR whose number appears in `NEVER_MERGE` is refused before
   any network call. Default list: empty (PRs #552 and #538 were both discharged; see the
   NEVER_MERGE comment in `merge-queue.mjs` for history). Override via env
   `PR_WATCHER_NEVER_MERGE=<comma-separated>` for testing.

2. **Hold labels.** A PR carrying `do-not-merge`, `needs-marco`, or `hold` is refused.
   Labels are read per-PR with `gh pr view --json labels` -- NOT from a board listing
   (LL-47). A label-read failure is a REFUSAL, not a pass.

3. **`escalates: true` prompts.** The watcher (`index.mjs`) applies `do-not-merge` to
   every PR opened for an escalating prompt. Rule 2 above catches that case. There is no
   separate escalates check -- no reliable PR-to-prompt mapping exists, and a guard that
   overstates what it verifies is worse than an absent one. This is documented in the
   source (`merge-queue.mjs` header) so the next reader stops looking.

Merge authority remains with the supervisor and Marco. The queue is a tool; wiring it
is a separate decision.

## 8.4 The in-chain HOLD rule
A `*-HOLD.md` prompt is on hold ONLY because it depends on a predecessor PR not yet merged to `main`.
The moment every predecessor it names is merged and on `main`, it is promoted to `*-ready.md` and
runs (station 02 step 2). **HOLD is a waiting state, not a veto** -- an ex-HOLD PR is not suspect;
its promotion means its chain precondition was met, so drive it like any other. This is entirely
separate from the **forbidden never-arm denylist** enforced in `queue-sync.ps1` (rates-s11c,
site-dissolution, B-P0a-4-ii..8, B-SD), which nothing ever promotes.

---

# 🔧 §9. INSTRUMENTS — the measured traps, in one place

<!-- CANONICAL-BLOCK: instruments v2 — the shared trap list. Stations POINT here; they do not copy it.
     lint-station.mjs fails if this block is edited without re-recording its hash. -->

§7 tells you your instrument lies. This section names the specific lies, each one **measured**, each
one having already cost this pipeline real work. Before 2026-08-24 these lived scattered across five
pasted scheduled-task files where they drifted independently and could not be reviewed. They live
here now because they are true for **every** station.

## 9.1 The shell

- ⚠️ **`$` is EXPANDED by the `-Command "..."` layer before PowerShell parses it** —
  `$true`→`True`, `$PID`→the new process’s PID, undefined and `$env:` forms→empty. Usually this
  dies as a parser error that looks like a syntax mistake; **sometimes it produces a VALID command
  carrying a value you never wrote, and exits 0** — the silent-wrong-value case is the dangerous one.
  `interact_with_process` does NOT do this (measured 2026-08-29, control `CTRL=42`).
  **Anything containing `$` goes in a `.ps1` file run with `-File`.**
  🔴 **AND THE CURE HIDES THE TRAP FROM ITS OWN CONTROL — run the discriminating control through
  `-Command`, NEVER through `-File`.** MEASURED 2026-09-04T15:1xZ by Station 00, both forms minutes
  apart inside ONE scheduled Cowork session, same machine, same shell, control `$CTRL=42` (undefined
  at expansion time, so it MUST print empty if a pre-expansion layer exists):
  `start_process` with **`-File <script.ps1>`** → `CTRL-literal-is:42` — **no expansion**;
  `start_process` with **`-Command "..."`** → the assignment arrives as bare `=42`
  (`CommandNotFoundException`), `$env:USERNAME` arrives already substituted as `Marco`, and `$true`
  as `True` — **expansion, exactly as this bullet describes.** Only the invocation differs.
  ⚠️ **So a station that follows the cure and then measures the cure reports "the trap does not
  reproduce".** That is what Station 04 reported on 2026-09-04T14:09Z (breadcrumb
  `00-04-scanner-2026-09-04-1409-doctrine-s9-anchors-have-drifted-ninety-lines-under-the-arming-markers.md`,
  finding F3, dispatched to 00 as a possible retirement). **It is a measurement of the cure working,
  not a non-reproduction: this bullet stands UNQUALIFIED.**
- ⚠️ **Streamed output can return EARLY with output still pending.** The `#`-heading cause did
  **not** reproduce on Desktop Commander 0.2.47 (measured 2026-08-29: a `#`/`##` fixture returned in
  the first read), but early returns are real — one was observed the same run on a line with no `#`.
  This is not a hang. Keep calling `read_process_output` with explicit offsets until it
  reports `0 remaining`.
- ⚠️ Blocked commands: `net`, `sc`, `reg`, `netsh`, `takeown`, `shutdown`.

## 9.2 Git

- 🔴 **`git ls-tree --name-only <ref> -- <dir>` returns exactly the level you asked for.** With
  **no trailing slash** it returns the tree entry itself — **ONE line**, not its contents — and any
  filter over that reports **zero**, which reads as "nothing is there." That produced a false
  "0 tracked ready-files" against a truth of 9, asserted into a live station prompt. With a
  **trailing slash** (`-- <dir>/`) it returns that directory’s **direct children**, which is correct
  for a depth-1 filter and **ZERO for anything deeper** (measured 2026-08-31 at `b19f3db9`:
  `-- docs/pr-prompts/superseded` returns **1** without `-r` and **252** with it). **Always `-r`
  unless you deliberately want one level, and always control the query against a file you know is
  tracked.**
- 🔴 **`git ls-tree` has NO glob pathspec, and it does not tell you.** Any `*` form returns **0**
  silently at exit 0: `-- 'docs/pr-prompts/superseded/*.md'` returns 0 *with* `-r` and *without*
  it — and so does the positive control `-- 'docs/pr-prompts/*.md'`, against a truth of **85**
  tracked files. The only glob form that fails loudly is the explicit magic:
  `:(glob)docs/pr-prompts/superseded/**/*.md` → `fatal: pathspec magic not supported by this
  command: 'glob'`. **So `-r` never rescues a zero-result glob** — it returns the same zero, and now
  you believe it. `ls-tree` takes literal path prefixes; filter the result, don't glob the pathspec.
  (Until 2026-08-31 the bullet above used `superseded/*.md` as its worked example, claiming 0
  without `-r` and 247 with it — a contrast that query form cannot produce in either direction.
  Found by Station 04 on 2026-08-30, re-measured with the failing control by Station 00 on
  2026-08-31. The headline rule was never wrong; its illustration was.)
- ⚠️ **`git status` is structurally blind to gitignored files.** A `*-ready.md` never shows as `??`.
  Use `git ls-files --others --ignored --exclude-standard`, or `git check-ignore -v` **on a FILE**.
  🔴 `git check-ignore -v` on a **directory** prints nothing and exits 1 — "not ignored" — even when a
  rule ignores its contents (measured 2026-08-29 on `docs/pr-prompts/processed`, with and without a
  trailing slash; the same query on a file **inside** it returns `.gitignore:76`). §9.6’s own failure,
  sitting inside this cure.
  🔴 **And that silence is BYTE-IDENTICAL to a true negative, so it carries no information at all.**
  Measured 2026-08-31 with the control the earlier note lacked: `git check-ignore -v
  docs/pr-prompts/processed` → exit 1, empty; `git check-ignore -v CLAUDE.md` — a tracked file that
  genuinely is not ignored → **exit 1, empty**; the same query on a file *inside* the directory →
  exit 0, `.gitignore:76`. Opposite truths, identical results. **Only the file form answers.**
- ⚠️ **On git 2.55 a plain `git fetch origin main` DOES opportunistically update
  `refs/remotes/origin/main`**, because `origin` has a configured fetch refspec. The explicit
  `git fetch origin +refs/heads/main:refs/remotes/origin/main` form is still the one to write — it
  is correct on every git version and does not depend on the remote's config — but a stale
  `origin/main` after a plain fetch is no longer the expected failure and should be investigated,
  not assumed.
- 🔴 **Never `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean` in the
  dev tree** to "get a clean read". Consumed prompts retired into gitignored folders come back armed.
  **To recover ONE file without tripping it: `git show HEAD:<path>` piped to a write.**
- 🔴 **Never run `git` through the device bridge against the Windows `.git`.** A cut-short VM-side call
  leaves a **0-byte `index.lock` with no Windows process**, so "zero git processes" reads true forever,
  the lock never expires, and `status-sweep.ps1` §7 escalates it to DO NOT ACT — freezing every
  station. **Three occurrences in two days.**
- ⚠️ **The dev tree's index is SHARED between concurrent chats.** A `git mv` typed by another chat sits
  staged and your commit will carry it. **Check `git diff --cached --name-status` before every commit**,
  and commit with a pathspec (`git commit -- <path>`) when anything else is staged. Two collisions in
  two sessions, both caught by eye rather than by a guard.
- ⚠️ **`git stash` in the watcher clone is a CLOSED LOOP** — the launcher's preflight stashes on every
  start, and nothing ever pops. Report the count and its growth. `git stash drop`, **never `pop`**.

- 🔴 **`git branch -r` reads the LOCAL remote-tracking cache, not the remote.** `git fetch`
  without `--prune` never deletes a tracking ref, so branches GitHub deleted on merge live on
  locally forever — **54 reported against 21 real, measured 2026-08-29.** Cross-referencing that
  list against the GitHub API inherits the error and dresses it as a finding. **Ask the remote:
  `git ls-remote --heads origin`.** 🔴 **AND `--prune` DOES NOT CURE IT — `refs/remotes/` can hold
  refs NO REFSPEC OWNS.** Measured 2026-09-03 immediately after `git fetch origin --prune`:
  `git branch -r` = **12** against `git ls-remote --heads origin` = **7**, and prune had worked
  perfectly — all seven `origin/*` heads matched the remote exactly. The five extras were
  `refs/remotes/pr/1477`, `pr/1478`, `pr/1483`, `pr/1487` and `pr1273`, hand-made by
  `git fetch origin pull/N/head:refs/remotes/pr/N`. `remote.origin.fetch =
  refs/heads/*:refs/remotes/origin/*` does not cover them, so **`--prune` can never remove them,
  and a pruned cache is still not authoritative.** Ask the remote, pruned or not. Separately, `git branch -r --merged origin/main` is blind to
  squash merges, which is every merge in this repo, and `gh pr list --limit N` silently TRUNCATES
  at N — `--limit 600` returned 600 rows and a different, wrong answer from `--limit 2000`.

## 9.3 Files and encoding

- ⚠️ **`Get-Content` reports FALSE MOJIBAKE.** The console encoding mangles the display, not the file.
  **Check the bytes before calling anything corrupt** — decode strictly and look for `U+FFFD`.
- 🔴 **But real double-encoding exists too, and it is invisible to a validity check.** A file read as
  CP1252 and rewritten as UTF-8 is *valid* UTF-8 with zero `U+FFFD` — the wrong characters, faithfully
  encoded. Its signature is `U+00E2 U+20AC U+201D` (`â€"` for an em dash). 133 sequences were found
  and repaired across five station docs on 2026-08-24. **Distinguish the two by decoding, not by
  looking.**
- 🔴 **EDIT DOCS AND PROMPTS WITH NODE** (`readFileSync` / `writeFileSync`, utf8), **not PowerShell.**
  The double-encoder is **`Set-Content -Encoding UTF8`** and **`Out-File -Encoding utf8`**: PS 5.1 has
  already decoded the file as CP1252, so re-encoding adds a **BOM** and the `â€”` signature — that is how
  the 133 damaged sequences above were made. **Plain `Set-Content` is byte-lossless for content**
  (measured 2026-08-29: em dash intact, +2 bytes of CRLF only), so do **not** "fix" it by adding
  `-Encoding UTF8` — that adds the actual cause. Neither form is a safe way to edit a doc, because
  plain `Set-Content` still rewrites line endings. A `--numstat` reading far larger than your
  intended change is the symptom; check it before you commit.

- 🔴 **...AND NODE HAS ITS OWN TRAP IN THE CURE: `String.replace()` READS `$` IN THE REPLACEMENT AS A
  SUBSTITUTION PATTERN.** `$&`, `` $` ``, `$'`, `$1` and `$$` are all live in a replacement **string**,
  and `` $` `` means *"insert everything before the match"*. MEASURED 2026-09-04T19:2xZ by Station 00,
  editing the project-memory index: a replacement whose text ended `...[cm]?[jt]sx?$` immediately
  followed by a closing backtick — a regex being **quoted as documentation**, which is the likely way
  to meet this — injected **7,734 bytes**, the entire preceding file, into the middle of one line. The
  file went 24.9 KB → **33,801 B**, and the escalation header, a section heading and a whole open
  escalation were silently duplicated.
  🔴 **EVERY READ-BACK PASSED.** `old_text_gone=true`, `new_text_present=true`, negative control `0` —
  all three true, all three worthless, because none of them asks *"is anything ELSE now in the file?"*
  This is §9.6 inverted: not an empty result read as an empty world, but a **fuller** result read as a
  correct one. It was found only by measuring the file's byte size, then its per-line sizes.
  🔧 **The cure is unconditional: never pass a replacement STRING. Pass a FUNCTION** —
  `s.replace(OLD, () => NEW)` — which disables `$` handling entirely, **or build the result by
  concatenation** (`pre + NEW + suf`), which is what the repair used.
  🔧 **And assert the BYTE DELTA on every doc edit:** `after - before` must equal
  `NEW.length - OLD.length` ± the change you intended. A read-back that only looks for what you wrote
  cannot see what you spilled. The same assertion catches the `Set-Content` line-ending rewrite in the
  bullet above, which is why `--numstat` is named there — this is the node-side half of the same rule.
- 🔴 **PowerShell's `>` redirection writes UTF-16LE in PS 5.1.** `git show <ref>:<path> > file`
  produces a file **twice the size**, starting `FF FE`, that no byte-wise or hash comparison will
  ever match the UTF-8 original — while `git diff` correctly reports no difference. Measured
  2026-08-30 on `docs/pipeline/stations/03-machine-minder.md`: 20489 bytes → **40980**, and
  `Compare-Object` over the two returned **100 differences** on a 285-line file, while
  `git diff --stat origin/main -- <path>` returned **empty**. **`Compare-Object` was NOT the liar
  here** — it returns **0** on a genuinely byte-identical pair (measured the same run, `Copy-Item`
  control, matching `git hash-object`). Same family as the `Set-Content -Encoding UTF8` bullet
  above, and it corrupts a grep, a line count, a hash or a node read just as readily. **To dump a
  blob, write it with node (`readFileSync`/`writeFileSync`, utf8) — never `>` or `Out-File`. To
  decide whether two files differ, use `git diff`, `git hash-object`, or `Buffer.compare` in node.**
- 🔴 **AND THE CURE ABOVE HAS ITS OWN READ-BACK TRAP: NEVER COMPARE FILE *LENGTHS* ACROSS A
  `git show` / WORKING-COPY BOUNDARY.** MEASURED 2026-09-05T10:1xZ by Station 04, comparing the
  watcher clone's `scripts/pr-watcher/index.mjs` against `origin/main`'s. **Two independent errors
  stack, both exit 0, both look like measurements**, and together they compose into *"the clone runs
  different code"* — while the blob hashes were `901ea012…` on both sides the whole time.
  **(i) A blob is stored LF; a Windows working copy is CRLF**, so the two differ by exactly the
  file's line count — the measured delta was **3326**, equal to the blob's LF count.
  **(ii) JavaScript `String.length` counts UTF-16 CODE UNITS, not bytes**, so
  `readFileSync(p, "utf8").length` under-reports every non-ASCII file — here by **564** on each
  side. Neither error is visible in the number, and both survive the bullet above: *"read it with
  node"* is the right cure for the `>` trap, and **comparing lengths is the wrong next step after
  it.** This is §9.6 in its quietest form — not an empty result read as an empty world, but two
  well-formed integers that were never measuring the same thing.
  🔧 **Compare CONTENT, never SIZE, and never across the boundary.** The sound forms, and there
  is no fourth: `git rev-parse <ref>:<path>` against `git hash-object <path>` (no pipe — §9.1);
  `git diff --numstat <ref> -- <path>`, where EMPTY output is the real answer; or
  `Buffer.compare(readFileSync(a), readFileSync(b))` on two files that are on the **same** side of
  the boundary. If you genuinely want a byte count, read a **Buffer** (`readFileSync(p).length`),
  never a decoded string. ⚠️ **A size comparison that AGREES proves nothing either** — the two
  errors push in opposite directions and can cancel, so a matching length is not a match. Found by
  Station 04 2026-09-05T10:10Z (F4), dispatched to 00, deferred by 00's 10:35Z run for a PR of its
  own, landed here.
- 🔴 **`Select-String -SimpleMatch` takes a LITERAL, so `[regex]::Escape()` must NEVER be applied
  to its pattern.** The escaped form `reminder-policy\.service\.ts` is searched *with the
  backslashes*, matches nothing, and exits 0 — an absent-needle reading that is really an unusable
  query. Measured 2026-08-30: it reported **6 of 7** gate producers absent, and the only 2 needles
  it got right were the only 2 with no `.` in them; written up as-is that would have been six
  confident, coherent, wrong findings. **Control every literal search against a needle you know is
  present AND one you know is not** — a dotless control passes while every dotted query silently
  fails.


## 9.4 GitHub

- ⚠️ **The GitHub MCP token cannot merge, and cannot open PRs (403).** Use `gh` through Desktop
  Commander.
- 🔴 **A `--jq` expression survives the `-Command` layer intact — spaces included — but escaped
  double quotes DO NOT.** `join(\",\")` arrives as `join(,\)` and jq fails LOUDLY with
  `failed to parse jq expression`. Keep double quotes out of jq expressions, or use `--json` plus
  `ConvertFrom-Json`. Separately, and still true: **assign-then-foreach**, because piping a JSON
  array straight into `Where-Object` collapses it to ONE object. That exact bug once let the merge
  queue select **#552 — the production-data PR.**
- 🔴 **`@(ConvertFrom-Json …).Count` answers `1` for an EMPTY array and `1` for a
  forty-element one.** PS 5.1 emits a parsed JSON array as a **single object**, so an array
  subexpression wrapping the call — inline or piped — counts one item regardless of length.
  Measured 2026-09-03 on 5.1.26100.9168: `@(ConvertFrom-Json '[]').Count` → **1** (truth 0)
  and `@(ConvertFrom-Json '[{..}x4]').Count` → **1** (truth 4); the pipeline form gives 1 and 1
  too. **Always assign first, then count:** `$rows = ConvertFrom-Json $raw; @($rows).Count`
  → **0** and **4**, correct in both directions. This is the counting twin of the
  `Where-Object` collapse above, and it is worse, because it silently *refutes* a true finding:
  it turned `gh run list --commit <short>` → `[]` and `--commit <full>` → 4 runs into the
  identical reading `1 / 1`, i.e. "§9.4’s short-SHA trap no longer reproduces."
- ⚠️ **`gh run list --branch main` can be DAYS stale** and falsely reads as "main CI is dead". Read CI
  **per-commit**.
- 🔴 **...and `gh run list --commit <SHA>` answers `[]` for a SHORT sha, exit 0.** Measured
  2026-08-30 with controls on gh 2.90.0: `--commit 62fd27f1` returned `[]`, while
  `--commit 62fd27f1527e963165bfa37962a5476bbaf36d7d` returned that same commit’s **four** runs
  (Push on main / CI / Deploy / Tendering Browser Smoke, all `success`). The short form does not
  error and does not warn — so the per-commit cure for the bullet above hands you an empty list that
  reads as *"no CI ran on this commit"*, which is the same false negative in a new costume. **Pass the
  full 40-char SHA** (`git rev-parse origin/main`), and control the query against a commit you know
  has runs.
- ⚠️ **`mergeStateStatus: CLEAN` can still be refused** — "the base branch policy prohibits the merge"
  is policy evaluation lagging the rollup. Use `gh pr merge --auto`; never reach for `--admin`.
- ⚠️ **"Absent from `origin/main`" is NOT "orphaned"** — check open PRs before calling anything dead.

## 9.5 The pipeline's own instruments

- 🔴 **ANCHOR BY SYMBOL, NEVER BY LINE NUMBER — and this section violated its own rule sixteen
  times.** MEASURED 2026-09-04T14:1xZ by Station 04 against `origin/main:scripts/pipeline/lint-prompt.mjs`
  (now 1824 lines): **16 of 17** line-number citations in this section were wrong, all drifting the
  same ~90 lines, consistent with ONE insertion above the first of them. `:728`/`:730`/`:732` — the
  three arming markers RULE 4's detector is built on — held `try {`, `} catch (_) {` and `}`. Nobody
  edited a claim; the file moved underneath every claim at once, silently, which is the §7 shape.
  **The available conclusion was wrong in the dangerous direction** (*"the linter does not gate
  arming"*), and that reasoning ends in arming a never-arm prompt. Every citation below is now a
  **symbol or fixed-comment anchor**, which cannot rot the same way. The reasoning in this section
  was verified sound by symbol at the same time and needed no correction. 🔧 **A line number into a
  file outside this document is invalidated by any edit above it — if you find yourself writing one,
  write the symbol instead.**

- 🔴 **`lint-prompt.mjs` does NOT reject when `git` is missing or broken — the binary is `git`, NOT
  `gh`.** `readFromOriginMain` (anchor: `function readFromOriginMain`) runs
  `execFileSync(process.env.LINT_GIT_BIN || "git", ["show", "origin/main:<path>"])` and on failure
  `return null; // git broken - skip check, fail SAFE`, and it feeds all five gate probes (anchor: the five
  `readFromOriginMain(` call sites). **The five GATE probes use `git` only**, so the old advice — *"confirm `gh`
  resolves"* — proves nothing about them. 🔴 **But `gh` is NOT absent from the file, and this
  bullet said it was until 2026-08-31.** `lint-prompt.mjs` reads
  `process.env.LINT_GH_BIN || "gh"` (anchor: `LINT_GH_BIN`) and shells `gh pr view <n> --json state` inside
  `ghFetchPrState`, reached from the exported `checkFixesPrTargetOpen` (the comment
  `// Cheaper than the premise (single gh call, no shell subprocess), so run` above the
  `checkFixesPrTargetOpen({ fixesPr, fetchState: fetch })` call site names it that). **A `fixes_pr`
  verdict therefore DOES depend on `gh`** — confirm it resolves before trusting one. (Found by
  Station 04 2026-08-31T14:1xZ; re-measured by 00 the same hour — `Select-String LINT_GH_BIN`
  returns exactly one hit.) **A line-number citation into a file outside this document
  is invalidated by any edit above it — prefer a symbol name or a fixed comment string as the
  anchor.** **Confirm `git` resolves AND read its stderr before believing any ADMIT.** And "fail
  SAFE" is safe only against wrongly *binning* a prompt: with respect to **arming** it fails
  **OPEN**, because a skipped gate reads as an ADMIT — including for prompts that drop database
  tables.
- 🔴 **`lint-prompt.mjs` ADMIT is NECESSARY, NOT SUFFICIENT.** The linter *does* now see **three**
  literal markers — `DO_NOT_ARM_COMMENT` (anchor: `DO_NOT_ARM_COMMENT =`, case-insensitive),
  `DO_NOT_ARM_CAPS` (anchor: `DO_NOT_ARM_CAPS =`, case-**sensitive**), and 🔴 **`ARM_ONLY` = `/Arm ONLY/` (anchor: `ARM_ONLY =`,
  conditional arming), which this bullet omitted until 2026-08-31** — and reports
  `HUMAN_GATE_PRESENT: line N contains` at its three report sites (anchor: `HUMAN_GATE_PRESENT: line`). **RULE 4's arming detector
  greps the union of these markers as its second instrument, so a two-marker grep under-reports
  which prompts the linter actually gates** (Station 04, 2026-08-31; re-measured by 00 the same
  hour, with the control that `"Arm ONLY"` occurred 0 times in this document). **The advice survives the fix:** a **prose** human gate matches neither regex,
  and exactly that burned an arm on 2026-08-28T14:09Z — so still read the BODY before arming.
  Measured 2026-08-30 over the 59 depth-1 `-HOLD`/`-ready` on `origin/main`: the two markers cover
  **7 distinct prompts**; `## STANDING AUTHORITY` appears on **51 of 59** and is boilerplate, not a
  gate; and `pr-dns-s5-checker-flip-to-fail-HOLD` carried **neither** marker until #1400
  (2026-08-30) put `<!-- watcher: do-not-arm -->` on it — `lint-prompt.mjs` now REJECTs it
  `[HUMAN_GATE_PRESENT]` at exit 1. **Adding the literal marker is the cure for any future
  never-arm prompt**, and it fires at the `DO_NOT_ARM_COMMENT` test before the premise is ever evaluated. The general
  warning stands: a **prose** human gate matches neither regex and is invisible to both the
  linter and any grep built on them.
- 🟢 **LANDED 2026-08-31T01:21:53Z — `parseFrontMatter` now FOLDS block scalars, so the LL-29 rollback
  gate is real again.** PR **#1414** (`1a62c86d`) added `foldBlockScalar` for `>`, `>-`, `>+`, `|`, `|-`,
  `|+` with correct chomping. Measured on `origin/main` at `6e105076`:
  `git grep -c foldBlockScalar origin/main -- scripts/pipeline/lint-prompt.mjs` → **2**, with the
  negative control `zzzNoSuchTokenZzz` → exit 1. **The three instructions this bullet used to carry
  are RETIRED — do not follow them:** a block scalar in front matter is now read, a `">-"` in lint
  output is no longer the expected symptom, and a migration-scoped ADMIT no longer needs
  `rollback_strategy` checked by eye.
  **What is still worth knowing.** From 2026-08-19 to 2026-08-31 the parser stored the literal two
  characters `">-"` and silently dropped the indented body, so **every presence check passed on
  content nobody wrote.** Across the 61 depth-1 `-HOLD`/`-ready` prompts on main at the
  time, that was `rollback_strategy` **10** · `premise_means` 19 · `done_when` 12; re-measured by
  Station 04 on 2026-08-31T14:1xZ over the **59** that survive, it is **8 · 14 · 10**, the drop being
  the prompts retired in #1448/#1449. ⚠️ **Those are counts, i.e. state: re-measure, never quote.**
  The 10 included two irreversible
  table drops (`pr-524-rates-b-slice2-canonical`, `pr-rates-s11c-drop-legacy-tables`) and
  `pr-siteid-notnull-backfill`. 🔴 **Those prompts have never been linted by a working rollback
  gate — RE-LINT any of them before arming.** `premise`, `scope`, `fixes_pr` and the `requires_*`
  family measured **0** on all three occasions this was found, which is the only reason nothing was
  ever mis-binned. The watcher was never affected — `scripts/pr-watcher/index.mjs` has always had
  its own extractor that folds correctly.
  ⚠️ **This bullet went on asserting "the fix is staged as
  `pr-lint-frontmatter-block-scalar-collapse-HOLD.md` (ADMIT)" for thirteen hours after that file had
  been armed, consumed and merged.** Four station runs read this block in full inside that window and
  none caught it. **A hash-gated canonical block is protected against being EDITED, not against going
  STALE.** So: any claim here about a fix that has not yet landed must name the probe that would
  falsify it — as this replacement does — or it will outlive its own truth in the one document every
  station is told it can trust.

- 🔴 **AN ARMED `-ready.md`'s mtime DATES ITS AUTHORSHIP, NOT ITS ARMING — `git mv` preserves mtime.**
  The only clock that dates an arm is the arming log `.arming-log.txt` in the queue folder.
  🔴 **CORRECTED 2026-09-04: that log is TRACKED, and has been since #1512 (2026-09-02,
  "track the arming log"). This bullet asserted it was UNTRACKED and that a clone, CI and any
  cloud-fired station "must not infer arm age at all" — both halves are false.** It also already
  carries the actor fields escalation #22 asks for: `by=`, `pid=` and `caller=<parent cmdline>`
  on every row, so that half of #22's option (A) is built and merged, not open.
  🔴 **What IS true is worse, because it wears the same symptom: NOTHING COMMITS IT.**
  [MEASURED] 2026-09-04T12:2xZ at `6c7e94c5`, with controls (`git ls-files --error-unmatch` on the
  log → exit 0; on a nonexistent path → exit 1): `git show origin/main:docs/pr-prompts/.arming-log.txt`
  🟢 **THE GAP IS CLOSED AND THE "13 ARMS PUBLISHED NOWHERE" FIGURE IS RETIRED — do not quote it
  again.** It was [MEASURED] 2026-09-04T12:2xZ at `6c7e94c5` as `origin/main` **37** lines against a
  **50**-line working copy. Station 04 re-ran this bullet's own falsifying probe at 14:1xZ and
  Station 00 confirmed it at 15:2xZ: **both sides are 50 lines** and end on the identical row
  `2026-09-04T11:29:24Z ARMED pr-lint-gate-path-space ... by=Marco@ pid=31616`. Controls unchanged
  (`git ls-files --error-unmatch` on the log → exit 0, on a nonexistent path → exit 1).
  🔴 **The DEFECT is untouched and it is the half that matters: NOTHING COMMITS THE LOG ON
  PURPOSE.** The only commits that have ever carried it were board PRs that happened to sweep it in,
  so the gap closes and re-opens by luck. When it is open a clone reads a STALE arm history rather
  than none, which is the more dangerous shape: it answers, and its answer can be a day and a half old.
  🔧 **The falsifying probe for this bullet is that two-line-count comparison — re-run it before
  quoting either half.** Until the counts agree: any run that arms something MUST commit the arming
  log in its board PR, and an arm age read from `origin/main` is a LOWER bound, never the answer.
  The 2026-08-31 measurement below still stands as written; only the tracked/untracked claim changed.
  Measured 2026-08-31 by
  Station 04: at 18:14Z `pr-lint-not-a-prompt-ready.md` sat on disk with mtime **2026-08-28T08:12:35Z**
  — 3.4 days old — while the arming log recorded `2026-08-31T18:13:56Z ARMED pr-lint-not-a-prompt`,
  **two minutes earlier.** The file is gitignored at `.gitignore:75`, so `git status` shows only the
  ` D` of the vanished `-HOLD.md`, and a sweep run 177 seconds before the arm had already printed
  `armed: 0`. Read together, those three readings compose into *"a prompt has been armed and unseen
  since 28 August"* — a confident, coherent, wrong S2 that 04 nearly filed. **Never infer arm age from
  a `-ready.md`'s mtime.** This is also the cleanest instance yet of §7's `[LIVE]` rule: the sweep's
  `armed: 0` was correct when printed and false three minutes later.
- ⚠️ **`rev-<n>-ready.md` are auto-generated REVIEW JOBS**, not prompts. They have no front matter **by
  design**. Exclude them from prompt audits instead of reporting them as malformed.
- ⚠️ **`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15, at
  `C:\po-watcher\STOP-WATCHER-LANE2` — in the `po-watcher` PARENT directory, OUTSIDE both git
  repos.** It is not drift and it is not a stop signal. The real sentinel is `STOP-WATCHER`,
  likewise clone-side at `C:\po-watcher\STOP-WATCHER`, and **it cannot stop an already-running
  watcher.**
  🔴 **The PATH is the load-bearing half of this bullet, and omitting it manufactured the
  opposite verdict twice.** Without it the obvious probe — a `STOP-WATCHER*` search in
  `C:\ProjectOperations2` and in `C:\po-watcher\ProjectOperations` — returns **0 and 0**, which
  reads as *"the documented mechanism is gone"*. That false negative was written into a table of
  §9 verdicts on 2026-08-26, and **four** separate Station 04 runs (08-25, 08-26, 08-27, 08-28)
  have since filed the identical one-clause fix, none of which landed. [MEASURED] 2026-09-05T07:2xZ:
  `C:\po-watcher\STOP-WATCHER-LANE2` present, **1090 bytes**; `C:\po-watcher\STOP-WATCHER`
  **absent** (`Test-Path` -> False); NEGATIVE control `C:\po-watcher\zzzNoSuchNeedleZzz*` -> 0 files.
  🔧 **Check the MECHANISM, not the file.** The readers are the launchers in `C:\po-watcher`,
  **none of which is in this repo**: `ensure-watcher.ps1` (3 hits), `watcher-launcher.ps1` (4),
  `watcher-launcher-singlelane.ps1` (4), `watcher-launcher-lane2.ps1` (3).
  `docs/pipeline/stations/03-machine-minder.md` still repeats the pathless form and inherits this
  trap.
- ⚠️ **A restart adopts nothing.** The watcher runs `index.mjs` **from the clone**, so the clone must
  be fast-forwarded before a restart changes any behaviour.
- ⚠️ **The watchdog heartbeat only ticks MID-RUN**, so age alone cannot separate idle from wedged. A
  long-stale heartbeat while a PR is open usually means **merge-wait**, not a hang.
- ⚠️ **Never count or kill by image name.** Resolve PIDs and verify command lines — 19 `node.exe` were
  running on 2026-08-24 and exactly one was the watcher.
- ⚠️ **QUARANTINED ledger rows are recorded but NOT binding.** Citing one as authority is an error.
- ⚠️ **`check-breadcrumb.mjs` measures two different sets, and only ONE of them sees `archive/`.**
  **Freshness is recursive**: `trackedSet` comes from `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
  (anchor: the `ls-tree -r` call) and is matched by **trailing path segment** (anchor:
  `p.lastIndexOf('/')` — the token `basename` does not occur in that file at all), so archiving a station's newest breadcrumb does
  **not** make it read SILENT — measured 2026-08-30 archiving 152 files, with `03` (15.1h) and `05`
  (24.0h) unchanged across the move. **Structure is depth-1 only**: it iterates `readdirSync(DIR)`
  (anchor: `readdirSync(DIR)`), so the same move took `structure: 122 checked` to `11`. Both exited 0. Archiving is
  therefore safe, but "it counts by basename" is true of freshness and **false** of the structure
  pass — do not quote the one result as covering both.

- 🔴 **RULE 2's ONLY PROBE HAS TWO HOMES, BOTH ANSWER, AND THE DEAD ONE'S POSITIVE CONTROL
  PASSES.** The `marco:true` probe reads `docs/pr-prompts/processed/*.log`. That path resolves in
  **two** trees, and the watcher clone holds a dead DECOY copy of the same directory. Measured
  2026-09-03T20:1xZ at `054dccd4`:
  `C:\\ProjectOperations2\\docs\\pr-prompts\\processed` = **1864** logs, newest
  `2026-09-03T17:20:00Z`, `marco.:true` → **606**; `C:\\po-watcher\\ProjectOperations\\docs\\pr-prompts\\processed`
  = **21** logs, newest **2026-08-17T14:28:09Z** — seventeen days stale — `marco.:true` → **10**.
  🔴 **The decoy therefore passes the mandated positive control**: POS=10 (>0), NEG=0, exactly the
  shape the standing rule asks for — and then returns *no verdict* for every PR opened since
  17 August. A run that probes the clone reads all four of today's open PRs as carrying no Marco
  routing, i.e. **RULE 2 fails OPEN on the one gate that exists to stop an agent merging Marco's
  work.** This was reached by a `Test-Path`-with-fallback that preferred the clone; it is not a
  typo, it is a plausible path expression that silently selects the corpse.
  🔧 **Pin the tree: the live probe directory is `C:\\ProjectOperations2\\docs\\pr-prompts\\processed`,
  and NEVER the watcher clone.** POS>0 is not sufficient on its own — **also assert the newest log is
  younger than the oldest open PR**, which is the only control that separates the two directories.
  ⚠️ **And the log is keyed by PROMPT NAME, not PR number**, so match `PR #<n>` in the log BODY;
  a filename search returns a uniform zero. **Control it against a PR you know the watcher did NOT
  open** — e.g. a station's own docs PR — which must read `NO LOG`, proving `NO LOG` means
  *second lane* (§10) and not *probe broken*.

- 🔴 **`NO LOG` HAS TWO CAUSES, AND THE DANGEROUS ONE LOOKS EXACTLY LIKE THE BENIGN ONE.**
  The control above proves `NO LOG` is not a *broken probe*. It does **not** prove *second lane*.
  MEASURED 2026-09-04T08:2xZ at `99451d99`: **#1570 was opened BY THE WATCHER**, from the prompt
  `pr-watcher-merge-policy-nested-test-paths`, whose front matter reads `escalates: true` — and the
  probe returns `NO LOG` for it. The watcher crashed (`raw node exit: -1`) between opening the PR
  and writing the merge verdict, so the verdict line was never written at all. One reading, two
  opposite meanings: a second-lane PR that no human ever routed, and an escalating watcher PR whose
  human gate died in transit. The probe was well controlled — 1881 logs, newest inside the hour,
  `marco.:true` → 608, and #1573 as the negative control returning a real verdict — and it still
  could not tell the two apart.
  🔧 **So `NO LOG` obliges you to ask WHICH absence — and BOTH probes this bullet used to
  prescribe are broken. MEASURED 2026-09-04T20:1xZ at `fafd5057`, with controls.**
  🔴 **(a) THE BRANCH NEEDLE IS GUARANTEED EMPTY.** This bullet read *"check whether any prompt
  in `docs/pr-prompts/processed/` names that PR’s branch or scope"*. Searching the WHOLE directory
  for the head branch of **#1606 — a PR the watcher DID open** — returns **0**, while that PR’s own
  merge verdict sits in the same directory in `pr-wbsshift-s1-web-rate-follows-shift-ready.md.log`.
  The watcher never writes a head branch name into any processed artefact, so the branch form has
  **no positive control that can pass** and answers *second lane* for every PR that exists.
  **Never match on the branch.**
  🔴 **(b) A BARE `PR #<n>` MATCH OVER `processed\*.log` ALSO HITS SECOND-LANE PRs**, because
  `rev-<n>-ready.md.log` — the auto-generated REVIEW JOB (§9.5, above) — names the PR by number and
  by scope, and the review lane reviews PRs the watcher never opened. MEASURED the same run: a
  `rev-<n>-ready.md.log` exists for **all four** open PRs (#1589 · #1593 · #1594 · #1606), i.e. for
  BOTH lanes — so its presence carries **zero** lane information, and #1594’s only `PR #1594` hit in
  `processed\*.log` is that review log.
  🔧 **The discriminator that works is the PROMPT logs alone — exclude `rev-*`:**
  `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'`.
  MEASURED at `fafd5057`: **#1606 → 2** and **#1589 → 1**, both of which also carry a real
  `merge result for PR #N: {"ok":false,"marco":true,…}`; **#1593 → 0** and **#1594 → 0**, both
  second lane and hand-classified as Marco’s under §10.1 step 2; NEGATIVE control `PR #999999`
  → **0**. Then cross it with `.arming-log.txt` for an arm inside the PR’s window — that half was
  always sound and stands. **A watcher-opened PR with no verdict is RULE 2 at its most binding, not
  its least** — the crash silently downgraded an escalating prompt to an ordinary one, and nothing
  on the PR shows it.

- ⚠️ **`list_sessions` reports `running` long after a session has stopped, so it cannot answer
  "is another actor live?"** MEASURED 2026-09-04T08:1xZ: two `"00 supervisor"` sessions both read
  `running` — `local_38901e4d` (created `04:08:48Z`, whose own report declares it ended `04:25Z`,
  newest file write `05:15:26Z`) and `local_a03e81fe` (created `2026-09-03T21:08:45Z`, newest file
  write `03:59:32Z`). Nearly three hours and over four hours of zero filesystem activity, both
  still `running`, against a 00 run that takes 15–25 minutes. **Two runs have already read that
  flag as a live-actor signal and stood down on it**, and one made *"no other 00 supervisor in
  `running` state"* a precondition for arming — a precondition a flag that never clears can never
  satisfy, which livelocks the fix it was gating.
  🔧 **The single-actor question is answered by `status-sweep.ps1` section 3** — in-progress
  prompts, `index.lock` in both trees, running `git` processes, and any PR touched in the last two
  minutes — cross-checked against the session directory’s newest file write. Use those.
  `list_sessions` is sound for *which* sessions exist and as the way into `read_transcript`; its
  state field is not a lock.

- 🔴 **`docs/pr-reviews/` IN THE DEV TREE IS A STALE MIRROR, NOT THE REVIEW LANE’S OUTPUT.** The
  `rev-<N>` review job runs in the watcher’s clone and writes there. MEASURED 2026-09-05T19:2xZ by
  Station 00: the dev tree’s newest review file was `pr-1669-review.md` (14:33:29Z), which reads as
  *"the review lane stopped producing artifacts at 14:33Z"* — a clean, five-in-a-row false finding.
  The artifacts existed the whole time in `C:\po-watcher\ProjectOperations\docs\pr-reviews\`
  (`pr-1675-review.md` 19:03:00Z, `pr-1676-review.md` 19:05:52Z), with older ones relocated to
  `C:\po-watcher\verdicts-archive\`; NEGATIVE control, a minted needle over the same recursive search
  → **0**. **Probe the clone and that archive before concluding the review lane is dead** — §9.6, an
  empty result read as an empty world.
  ⚠️ **And the `SessionEnd hook … Hook cancelled` line in a `rev-*` log is NOT the discriminator**:
  `rev-1660` and `rev-1662` carry it and produced their files; `rev-1674` and `rev-1676` do not carry
  it and did not.

## 9.6 The rule behind all of them

🔴 **AN EMPTY RESULT IS NOT AN EMPTY WORLD.** Before concluding absence, ask what your instrument is
blind to, and run the same query against a case you know returns something. Every trap above is a
query that answered confidently and wrongly.

⚠️ **"No process is holding it" is only evidence when you know WHERE the process would have run.** A
lock left by a destroyed Linux VM has no Windows process by construction, forever.

🔴 **A NEGATIVE CONTROL YOU WROTE DOWN IS A POSITIVE.** MEASURED 2026-09-05T18:1xZ by Station 04
over `docs/pr-prompts/**` (depth 1 + `archive/` + `needs-marco/`): the two needles this pipeline has
been prescribing for weeks — `zzz`+`NoSuchNeedleZzz` and `zzz`+`NoSuchTokenZzz`, written split here
so this bullet does not add to the count it reports — returned **40** and **36** hits. A negative
control that returns 36 tells its reader the query is broken while the query is working perfectly,
and 04 hit exactly that live: a *"has this been reported before?"* search read
`slug → 3, POSITIVE → 14, NEGATIVE → 36`. The contamination is self-inflicted and strictly
monotonic — every run that quotes its control in a breadcrumb makes the next run’s control worse —
and it is worst over exactly the corpus stations search most.
🔧 **MINT A FRESH NEEDLE EVERY RUN.** Station 04 used `zzQqNeedle04b20260906` → 0 over that corpus;
Station 00 used `zzQq00Needle20260905T2008` → 0 at 20:1xZ. **Both are now written down too, so
neither is usable again** — which is the rule, not an oversight: a needle is spent the moment it
lands in a tracked file.
⚠️ **Those hit counts are STATE — re-measure them, never quote them.**

<!-- END-CANONICAL-BLOCK: instruments v2 -->


# 🛰️ §10. SECOND LANES — work that reaches the repo without passing through the watcher

Added 2026-08-31. Until now exactly one path put code on this board: a prompt is armed, the watcher
builds it, the watcher opens the PR, and the watcher writes a merge verdict. **That assumption is now
false.** A Claude Code cloud session connected to `GH-Mantova/ProjectOperations` can clone, branch,
commit and open a PR without the watcher, the dev tree or Marco's machine being involved at all, and
Claude Design can author interface work the same way. Everything below follows from that.

## 10.1 A PR the watcher did not open carries NO RULE-2 verdict — and that reads as "cleared"

🔴🔴 **THIS IS A SAFETY RULE, NOT A CONVENTION.** RULE 2 — never merge a PR the watcher routed to
Marco — has exactly one live probe: the line

    [watcher] merge result for PR #N: {"ok":false,"marco":true,"reason":"…"}

written into `docs/pr-prompts/processed/<prompt>.md.log` by the watcher's merge step
(`index.mjs`, `waitForPolicyMerge` / `waitForMerge`). **A PR that never went through the watcher never
gets that line.** Probing for it returns empty — and an empty result here is indistinguishable from
"this PR was checked and is not Marco's".

This is §9.6 (*an empty result is not an empty world*) with a merge button attached. Measured
2026-08-31: the probe's own corpus holds **593** `"marco":true` verdicts across **1801** logs, so the
probe is well calibrated for watcher-opened PRs and says nothing whatsoever about any other PR.

**THE RULE.** Before merging ANY PR, establish which lane opened it, and say so:

1. `docs/pr-prompts/processed/*.md.log` contains a verdict naming that PR ⇒ obey it. `marco:true` ⇒
   **RULE 2 applies, do not merge.**
2. No log names that PR ⇒ **it did not come through the watcher.** The absence proves nothing about
   its risk. Apply the policy gate BY HAND — `classifyPolicyFiles` in `index.mjs` is the definition,
   and 🔴 **READ THE FUNCTION, NOT THIS SENTENCE.** It refuses an empty diff, refuses any path
   matching `(^|/)migrations/`, and then refuses the first path that is not test-or-docs — where
   test-or-docs is `NESTED_TEST_PATHS` (anchor: `const NESTED_TEST_PATHS`), which as of
   2026-09-04 accepts **THREE** forms, not one:

   ```js
   const NESTED_TEST_PATHS = [
     /^(tests|docs)\//,
     /(^|\/)__tests__\//,
     /\.(test|spec)\.[cm]?[jt]sx?$/,
   ];
   ```

   **So a PR touching only `scripts/pipeline/__tests__/backlog-parser.test.mjs`, or
   `apps/api/src/bootstrap/dev-helper.spec.ts`, is TESTS — not Marco's** (both paths are real and
   tracked, so this example is checkable). Anything outside those three forms is Marco's.
   ⚠️ **This shorthand had already outgrown its symbol once.** From 2026-08-31 to 2026-09-04 it read
   *"any path outside `^(tests|docs)/`"*, while the function had been widened precisely because that
   single regex *"classifies every real test-only PR as 'outside' and routes it to Marco"* (its own
   comment, still there). Over-routing fails **SAFE** — nothing of Marco's could merge on it — which
   is why it survived four days unnoticed: it silently manufactured the human decisions this lane
   exists to remove. That is §9.5's closing bullet, in §10's own text.
   🔧 **The falsifying probe for this paragraph is the array itself:**
   `git show origin/main:scripts/pr-watcher/index.mjs | Select-String 'NESTED_TEST_PATHS'`
   (POSITIVE CONTROL `classifyPolicyFiles`; NEGATIVE `zzzNoSuchTokenZzz` → 0). If the array is gone
   and the single regex is back, **this paragraph is wrong again** — read the function and correct it
   here. Found by Station 04 2026-09-04T18:1xZ (F3); confirmed against `origin/main` and landed by
   Station 00 at 2026-09-04T19:1xZ.
3. **EXCEPTION - a KNOWN STATION LANE is classified by the authority matrix, not by
   `classifyPolicyFiles`.** A PR opened by a station acting inside its own recorded authority
   (`STATION-CAPABILITIES.md` section 5) is classified by that matrix, and the PR body must NAME
   ITS LANE so the claim is checkable by the next reader. A PR that strays outside its station's
   lane falls through to step 2 unchanged. **Marco's ruling, 2026-09-04**, on escalation
   `needs-marco/sot-only-pr-merge-authority-conflict-2026-09-03.md`; first applied to #1554.

   **Why the exception is needed at all.** `classifyPolicyFiles` answers ONE question: *may this
   merge with no human judgement applied?* Its three rejections - empty diff, migration file,
   outside `tests|docs` - are reasons to WITHHOLD AUTOMATION. None of them is evidence about
   WHICH human. Step 2 borrowed that function to answer a different question - *whose* judgement
   is required - and the only vocabulary the function has is "not the automatic lane", which step
   2 then read as "Marco". For a watcher-opened PR that inference is sound: the watcher's routing
   has exactly one human in it (`{ ok: false, marco: true }`). For a station acting inside its own
   lane it is a category error, because section 5 has already named a competent authority who is
   not Marco.

   **This removes no gate.** The `do-not-merge` label still binds absolutely - only Marco removes
   it. A real watcher `marco:true` verdict still binds absolutely: step 1 runs first and wins.
   Migrations are untouched - they fail `classifyPolicyFiles` on their own clause, and no station
   lane covers them.

   **In practice this is ONE lane today.** 00's lane is `docs/` and 06 stages under
   `docs/pr-prompts/` - both already inside `^(tests|docs)/` and already passing step 2
   unaided. (02 is deliberately not listed: it has no schedule of its own, and its board file
   is not tracked, so it has no lane a classifier could check.) The only lane step 2 rejects is
   **05 -> `sot/`**. The wording is general so that the next lane does not reopen the argument,
   but the live scope of this exception is one station and one directory.

   > **A NEW lane outside `tests|docs` may NOT be added to the section 5 matrix without a CI gate
   > that proves the lane's boundary.** 05's lane already has one: **CP-24** in
   > `scripts/pr-gates/pr-gates.mjs` hard-blocks any PR mixing `sot/` with `apps/`, `scripts/`,
   > `.github/`, `packages/`, `package.json` or `pnpm-lock.yaml`, with no escape hatch (sot/05
   > LL-36, PR #543 on 2026-07-13). That gate is what makes "05 doc-reconcile" a MEASURED claim
   > rather than a self-declaration. **A lane with no such gate is self-declaration, and
   > self-declaration is not classification.**

4. Never record "no verdict found" as "not routed to Marco". Write `[NO LANE VERDICT — hand-classified]`
   and give the classification.

⚠️ **The probe must be written without a quote character**: `-Pattern 'marco.:true'` (regex, `.` matches
the quote). The `-SimpleMatch '"marco":true'` form returns 0 **and so does its negative control** —
escaped double quotes do not survive the `-Command` layer (§9.4, and it is a SHELL fact, not a `gh` one).

## 10.2 A cloud session is a CODE-WRITING lane. It cannot drive the board.

`arm-prompt.ps1`, `smoke-pr.ps1`, `pipeline-lib.ps1`, `status-sweep.ps1` and `bring-up-to-speed.ps1`
are Windows PowerShell 5.1 reading absolute paths under `C:\ProjectOperations2` and `C:\po-watcher`.
A cloud session has none of them. It therefore **cannot arm, cannot smoke, cannot merge through
`Assert-SmokedOrEscalate`, and cannot read the queue's true state.**

- ✅ It may: write code and docs, open a PR, and say plainly which lane it is.
- 🚫 It may NOT: arm or disarm a prompt, merge anything, mutate `docs/pr-prompts/`, touch `/sot/`
  (Station 05's, CP-24), or act as a second supervisor. *"Nobody owns dev-tree convergence"* is an
  open escalation; a second unsynchronised board actor is exactly the failure it names.
- 🔧 A cloud session sees **only what is committed to the repo.** The station bootstraps under
  `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`, the project memory, and any chat are all invisible to
  it. If a rule is not in `sot/`, `docs/` or `CLAUDE.md`, the cloud lane does not have it.

### 10.2.1 EXCEPTION — Station 00 may also run as a SUPERVISED cloud lane

🔴 **The lane described below is the one that wrote this section.** Read the disclosure at the end
before you rely on it.

The bullets above are correct about a **headless** cloud session and remain in force for one. They
are wrong about a cloud session that Marco is **sitting in front of and directing turn by turn**,
because that lane has the one input §10.2's own last bullet says a cloud session cannot have: Marco
himself, live, in the chat.

**THE EXCEPTION.** Station 00 may also run as an **interactive or cloud lane under Marco's direct
supervision**. Such a lane:

- ✅ may open PRs, merge, and update PR branches — but **only** PRs Marco has released in chat, and
  **only** while he is actively directing that session;
- ✅ may write prompt files under `docs/pr-prompts/`, because Marco directs that work in the same
  chat turn;
- 🚫 may **still not** remove a `do-not-merge` label (CP-26 gate 1 — only Marco), touch `/sot/`
  (CP-24 — Station 05's), or arm a prompt through `arm-prompt.ps1`, which it does not have;
- 🚫 may **still not** clear a genuine watcher `marco:true` verdict (§10.1 step 1 runs first and
  wins), or touch Azure / Entra / SharePoint (§5.1, absolute);
- 📝 **must leave a `docs/decisions/merge-approvals/<N>.md` receipt naming itself as the author** of
  every merge it makes, so the lane is identifiable after the fact from the repo alone.

**This removes no gate. It adds one.** The label still binds, CP-26 still binds, a real watcher
verdict still binds, migrations still fail `classifyPolicyFiles` on their own clause. The receipt
requirement is new, and it is a *constraint on this lane*, not a permission.

**§10.1 step 3's proviso is satisfied by an existing check, not a promised one.** A new lane outside
`tests|docs` needs a CI gate proving its boundary. This lane's gate is **`Approval receipt (CP-26)`**,
already required on `main` by ruleset `15532058`: it fails `RELEASED_NO_RECEIPT` when a released PR
carries no receipt, so a merge by this lane that leaves no signature cannot reach `main`. That is the
boundary, enforced by CI, today.

**PROVENANCE — Marco's own words, chat, 2026-09-04 and 2026-09-05.** Quoted verbatim, in order:

> *"can you takeover station 00 roles now and drive the board?"*

> *"you're supposed to stay at it, 24/7, until all prs are merged"*

> *"I'm handing the board back to you, your goal is to open as many prs possible from the pipeline,
> and drive the entire board to green and to merge, including prs that the other station 00 opens or
> the watcher opens"*

> *"i removed the label from all prs with do not merge label / run whatever other checks you need on
> them, keep driving the board to green and merge / open any other prs that the merged one release
> the gates"*

**WHY THIS WAS NOT WRITTEN DOWN FOR THREE DAYS, and why it had to be this lane that wrote it.**
§10.2's last bullet is the cause: *"A cloud session sees only what is committed to the repo … any
chat are all invisible to it."* The ruling was given in chat. Every scheduled 00 run since could see
its **effects** on the board — PRs merging with no arm, receipts naming an actor §10 did not list —
but never its **cause**, so five consecutive runs (00:08Z, 01:08Z, 03:08Z, 05:08Z, 06:08Z on
2026-09-05) each re-derived *"an unattributable actor is releasing PRs"* from first principles, one
of them as a suspected attack. The 06:08Z run (`#1644`) reached the correct disposition and stopped
at the right place: *"I cannot fix it. Recording a ruling I have not heard is guessing Marco's
intent (§5.5)."* That is right for a lane that was not in the room. This lane **was** in the room,
so for it the same act is not guessing — it is transcription, and the quotations above are what make
it checkable.

🔴 **DISCLOSURE — I am the interested party.** This section authorises the lane that wrote it, and
that is exactly the shape of change a reader should distrust. Three things are offered in place of
trust: the quotations above are verbatim and Marco can strike them if they are not his; the
exception is strictly narrower than the practice it records (it adds the receipt requirement and
re-states four prohibitions); and **this PR was opened WITHOUT auto-merge and is not self-merged** —
it waits for Marco. If he does not confirm it, strike this section; the correct fallback is option
**(b)** on `#1644` — the cloud lane stops merging — and not silence, because silence is what cost
five runs.

**Filed against:** `docs/pr-prompts/archive/00-00-supervisor-2026-09-05-0608-doctrine-forbids-the-cloud-lane-from-merging-and-it-merged-1615-mid-run.md`
(moved into `archive/` by the 2026-09-05T11:08Z collect once every finding in it carried a disposition;
the path is corrected here because `lint-station.mjs` REJECTs this document for naming an untracked repo path)
F1, option **(a)**, whose wording this section adopts.

## 10.3 Route docs-and-tests work through the watcher, not around it

The auto-merge policy is live: `start-watcher.ps1:160` sets `PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs"`,
and `classifyPolicyFiles` admits a diff confined to `tests/**` + `docs/**` with no `migrations/` path.
**42 PRs have merged with no human through that gate.** It works.

🟢🟢 **REFUTED 2026-09-04T03:1xZ by Station 00 — the lane is NOT dead, and has not been for three days.**
This paragraph read *“But it last fired on #1301 — 0 auto-merges since #1400, against 22 PRs routed to
Marco”* from 2026-09-01 until this correction. It was already false when it was written.
**[MEASURED]** `Select-String -Path docs\pr-prompts\processed\*.log -Pattern 'merge result for PR #(\d+): \{"ok":true'`,
run against the LIVE tree `C:\ProjectOperations2` and never the clone (§9.5), returns **48** `ok:true`
watcher merge verdicts, negative control (`\{"ok":zzzNoSuchZzz`) **0**. **Six of the 48 are after #1400:**
#1476 (2026-09-01T04:29Z) · #1514 (09-02T04:49Z) · #1531 (09-03T06:29Z) · #1534 (09-03T07:02Z) ·
#1537 (09-03T08:18Z) · **#1563 (09-04T03:10Z)**.

**Worked instance — #1563**, `docs/pipeline/DOCTRINE.md` + `docs/pipeline/stations/_canonical-blocks.json`,
both under `docs/`: opened `02:21:34Z`; the watcher enabled native squash auto-merge at `03:09:09Z`;
**merged `03:10:30Z`**; its log carries `[watcher] merge result for PR #1563: {"ok":true}`. Open-to-enable
was **47.6 min**, inside the 90-min `MERGE_TIMEOUT_MS` window. Nobody reviewed it and nobody merged it by hand.

🔴 **What survives, and it is the half that matters: the MECHANISM below is untouched.** CI creation
*can* outrun `MERGE_TIMEOUT_MS`, and when it does the timeout is written **byte-identically** to a genuine
policy routing (§10.3 table, and the `marco: true` returned inside `waitForPolicyMerge` — anchor:
`async function waitForPolicyMerge`). That is a **latent, intermittent**
defect — not a stopped lane — and the distinction changes what you may conclude from one `marco:true`:
**a single routing verdict on a docs-only PR is evidence of a timeout at least as much as of a policy
decision, and neither reading clears it for merge** (RULE 2 still binds).

⚠️ **The falsifying probe for THIS paragraph is the `ok:true` count above.** Re-run it before quoting
either half. The reason the old sentence outlived its truth by three days is that it named no probe —
the exact failure §9.5's closing bullet records, one section earlier, about a claim in a document every
station is told it can trust.

⚠️ **This paragraph used to continue "Not because the gate is blocked: because docs work is
hand-landed … so it never reaches the gate." THAT CAUSE IS REFUTED — measured 2026-09-01/02 by
direct experiment.** Station 00 armed a docs-only prompt precisely to test it. The work DID reach
the gate, and the gate still did not fire. **The measured cause is CI-creation latency outrunning
the merge window:**

| | [MEASURED] |
|---|---|
| `#1500` opened | 2026-09-01T20:18:43Z |
| its first CI run **created** | 2026-09-01T23:51:20Z — **212.6 min later**, `run_attempt=1` (not a re-run) |
| merge window | `MERGE_TIMEOUT_MS` = **90 min** (anchor: `const MERGE_TIMEOUT_MS` in `index.mjs`), expired at about 21:48Z |
| controls, same window | `#1502` 0.0 min · `#1501` 0.0 (opened 8 s after #1500) · `#1499` 0.0 · `#1498` 0.0 · `#1497` 0.0 |

`allGreen` in `index.mjs` (anchor: `const allGreen`) needs `checks.length > 0 &&
checks.every(SUCCESS|NEUTRAL|SKIPPED)` before it will enable auto-merge. With **zero checks in
existence** `allGreen` is false for the whole window, so the lane falls out of
`waitForPolicyMerge` (anchor: `async function waitForPolicyMerge`) and records `marco: true` on
the timeout path inside it.

⚠️ **Every citation into another file in THIS DOCUMENT is a symbol or fixed-comment anchor, not a
line number — §9.5's opening bullet, applied document-wide.** That bullet scoped itself to "every
citation below", so §10.3 was never swept, and on 2026-09-05 all four of its `index.mjs` line
numbers were found wrong at once: `:129-130` -> `const MERGE_TIMEOUT_MS` is at 139, `:1753-1757` ->
`const allGreen` is at 1837, `:1774` is the `waitForPolicyMerge` header itself, `:1776` -> the
`marco: true` returns are at 1789/1793. Nobody edited a claim; the file moved under all four
together, and the available conclusion — *"the mechanism §10.3 describes is not in this code"* —
would have retired a live RULE-2-affecting defect as non-reproducing. Found by Station 04
2026-09-05T14:1xZ (F2), landed by Station 00 at 14:4xZ. **POSITIVE control that the instrument was
sound: §10.3's other line citation, `start-watcher.ps1:160`, was correct at the same moment.**

🔴🔴 **A TIMEOUT IS THEREFORE WRITTEN IN THE BYTE-IDENTICAL FORMAT TO A GENUINE POLICY ROUTING.**
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` is
indistinguishable, to every later reader and to RULE 2, from a policy verdict meaning "this one is
Marco's to decide". A docs-only PR the lane would have merged with no human becomes **permanently
human-gated** — and RULE 2 correctly forbids any station from clearing it, since a provably-weak
routing reason does not clear a verdict. **The lane built to remove work from Marco silently
creates it.** Open with Marco as of 2026-09-02; the falsifying probe is the table above — re-run
it and this note dies.

🔴🔴 **THE REASON STRING HAS TWO CONJUNCTS, AND ONLY ONE OF THEM HAS A RECORDED CAUSE.**
`"timeout waiting for green checks + MERGE verdict"` fires if EITHER half misses the window, and the
table above measures the FIRST half only — CI-creation latency, on `#1500`. **[MEASURED]
2026-09-05T19:1xZ by Station 00 on `#1675` — the first instance run to completion with no supervisor
touching it, and one where the first half is 0% of the failure:**

| | [MEASURED] |
|---|---|
| armed | `2026-09-05T16:16:51Z` (`.arming-log.txt`) |
| watcher opened it | `17:27:48Z` — `opened PR #1675, policy=tests-docs, waiting…` |
| all 3 CI runs **created** | `17:29:33–17:29:35Z` — **2.3 min** after open |
| all 3 CI runs **success** | `17:31:04Z` — **3.75 min** after open |
| 90-min `MERGE_TIMEOUT_MS` window | expires ≈ `18:57:48Z` |
| `rev-1675` review job **started** | **`19:00:48Z`** — 93.5 min after open, 3 min AFTER the window closed |
| its verdict | `Verdict: MERGE for PR #1675` |
| watcher’s recorded result | `{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` |

**A reader who applies the table above to `#1675` finds CI healthy and concludes the mechanism does
not reproduce — retiring a live RULE-2-affecting defect.** It reproduced. The starved conjunct was
the MERGE verdict, which `verdictApproves` requires at `docs/pr-reviews/pr-<N>-review.md` and which
the single-lane worker cannot produce while the merge waiter holds the lane. That starvation is the
open escalation `needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md`, whose own
falsifying probe — *"leave a watcher-built `tests-docs` PR alone; if the review appears and
auto-merge enables with nobody touching it, this escalation is dead"* — was run unattended today
and the escalation **SURVIVED it**.

⚠️ **The falsifying probe for THIS paragraph is per-PR, not the `ok:true` count**: for a docs PR
that timed out, check whether its `docs/pr-reviews/pr-<N>-review.md` was written BEFORE the window
closed. If it was, this conjunct was not the cause on that PR.
🔴 **And do not read the six-minute miss as a margin.** The gap between the verdict (19:00:48Z) and
the window (18:57:48Z) is small only because this PR’s CI was fast; the delay underneath it is 93.5
minutes of queueing. **Raising `MERGE_TIMEOUT_MS` is not a fix** — a longer wait occupies the single
lane for longer, which is the defect itself.

Hand-landing is a **contributing** factor, not the cause: Hand-landing is legitimate (00 may merge a docs-only
PR itself) and it does not consume Marco — but it produces **no review**, and it is how a docs change
lands with nobody but its author having read it.

**Prefer arming a docs/tests change over hand-landing it.** Hand-land when the content must be exact
— binding law, a canonical block, a correction to DOCTRINE itself — and say in the PR body that you
did, and why.

## 10.4 Design decisions are settled BEFORE the prompt, not inside the slice

Interface questions have been surfacing as mid-slice STOP-AND-REPORTs — the owner-control permission
model in `#1416`, the Tip Finder no-coordinates behaviour, the map-locations rename guard. Each one
burns a slice and then waits on Marco anyway.

**A design question found while writing a prompt is Marco's to answer before the prompt is armed**
(RULE 3). `PROMPT-SCHEMA.md` already requires an executable premise; an unsettled interface decision
is a premise that cannot execute. Take it to him as a decision with options and the measured evidence
for each, not as a status update.

## 10.5 An artifact carries ONE identity for its whole life

Added 2026-09-02. **Ruled by Marco**, after the register became unreadable.

Published artifacts are a second lane in the same sense as §10.1: they reach Marco without passing
through the repo, and unlike a PR they carry **no history he can read** — an artifact shows only its
current content and its title. On 2026-09-02 his register held **24 artifacts with at least four
near-duplicate pairs**, and nothing on any page said which member of a pair was live.

🔴 **The thing that forks an artifact is the SOURCE FILE PATH, not the title.**

- Republishing the **same** file path (or passing the artifact's `url`) updates that artifact **in
  place, at the same URL**. This is what improvement looks like.
- Publishing a **different** file path mints a **brand-new artifact** — even when the title is
  byte-identical. Nothing warns you; the publish succeeds and returns a new URL.
- Changing the **title** forks nothing. But it **hides a fork that already happened**, because the
  two pages stop sorting next to each other in the gallery. The rename is the camouflage, not the
  wound.

**THE RULE.**

1. **The name is fixed at first publish.** Never rename an artifact. If the name has stopped fitting,
   say so to Marco — that usually means the scope drifted — but the name still does not change. He
   navigates the register by it.
2. **The source file is fixed at first publish.** Keep editing that exact path. Never
   `-v2`, `-final`, `-wbs`, `-new` or any other filename for the same subject.
3. **The favicon is fixed too.** Omit it on every redeploy. A changed icon reads as a different page.
4. **A new artifact requires a new SUBJECT** — never a better version of an existing one. If you
   cannot tell whether the subject is new, it is not (RULE 3: ask).
5. **Before publishing anything this conversation did not itself publish:** list the register, look
   for **near**-matches rather than exact title matches — the whole failure mode is that the older
   page is named something slightly different — then read that artifact and republish to its `url`.
   If the local source file is gone, recover the content by reading the artifact; do not rebuild it
   under a new filename.
6. **Superseded artifacts are never deleted and their URLs never break.** Republish the retired page
   with a banner at the top naming its replacement and linking to it, so anyone opening the old link
   is told immediately that it is not current.

⚠️ **Worked example — this rule exists because of a measured failure, not a hypothetical.** On
2026-09-02 a chat lane published `punch-list.html` as *"PR Master Punch List"*, improved the same
work, and published the improvement as `wbs.html` titled *"ProjectOperations Work Breakdown"*. Two
artifacts, one subject, no signal which was current. Rules 1 and 2 each independently prevent it.

## 10.6 A second-lane PR does not consume the prompt that describes the same work

Added 2026-09-05. **The watcher deletes a prompt when it builds it. A second lane does not**, because
it never reads the queue (§10.2). So work that reaches the board through a second lane leaves its
`-HOLD.md` sitting there with its premise intact and its gates satisfied — and `triage-holds.ps1`
lists it under **GATES SATISFIED — CANDIDATES**, which is exactly where an arming decision goes
looking.

🔴 **The premise dies on MERGE, not on OPEN.** For the whole time a second-lane PR waits on Marco,
its prompt is `ADMIT` and reads as fresh work. Arming it opens a SECOND PR for work already open.

**[MEASURED] 2026-09-05T15:2xZ at `52232fec` — two live instances at once**, each an exact scope
match to an open PR, both sitting in that run's `ADMIT` bucket of 40:

| `ADMIT` prompt | `scope:` entries | open PR | PR files | matched |
|---|---|---|---|---|
| `pr-plantdays-retire-and-drop-HOLD.md` | 6 | **#1662** | 6 | 6 of 6 |
| `pr-scopecosts-s1-operational-cost-lines-api-HOLD.md` | 8 | **#1665** | 8 | 8 of 8 |

🔧 **The test to run before arming ANY `ADMIT` is the `scope:` list, not the head branch.** Cross
the prompt's `scope:` entries against `gh pr list --state open --json number,files`. A head-branch
match happens to catch both instances above, because this second lane names its branch after the
prompt slug (`pr-plantdays-retire-and-drop`, `pr-scopecosts-s1-operational-cost-lines-api`) — but
that is the *other lane's naming convention*, not a property of the prompt.
[MEASURED] `Select-String -Pattern 'branch|headRef'` over both prompt files returns **0**: the
prompt carries no branch information at all, so a branch test is checking something the prompt never
asserted and can stop working without anything warning you. **The scope list is what the prompt does
assert.**

⚠️ **Same defect as the never-retired-HOLD case, reached from the other side.** There an armed
prompt outlives its own build because the PR does not delete it; here the prompt was never built at
all. Both end with an armable duplicate, and neither is visible to `lint-prompt.mjs`, whose gates
ask only whether the premise still holds — which, until the PR merges, it does.

