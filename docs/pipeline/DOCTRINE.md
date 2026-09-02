
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
  `git ls-remote --heads origin`.** Separately, `git branch -r --merged origin/main` is blind to
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

- 🔴 **`lint-prompt.mjs` does NOT reject when `git` is missing or broken — the binary is `git`, NOT
  `gh`.** `readFromOriginMain` (`lint-prompt.mjs:439-459`) runs
  `execFileSync(process.env.LINT_GIT_BIN || "git", ["show", "origin/main:<path>"])` and on failure
  `return null; // git broken - skip check, fail SAFE`, and it feeds all five gate probes (`:492`,
  `:563`, `:826`, `:865`, `:903`). **The five GATE probes use `git` only**, so the old advice — *"confirm `gh`
  resolves"* — proves nothing about them. 🔴 **But `gh` is NOT absent from the file, and this
  bullet said it was until 2026-08-31.** `lint-prompt.mjs:1164` reads
  `process.env.LINT_GH_BIN || "gh"` and `:1165` shells `gh pr view <n> --json state` inside
  `ghFetchPrState`, reached from the exported `checkFixesPrTargetOpen` (`:1518` calls it *"a single
  gh call"*). **A `fixes_pr` verdict therefore DOES depend on `gh`** — confirm it resolves before
  trusting one. (Found by Station 04 2026-08-31T14:1xZ; re-measured by 00 the same hour —
  `Select-String LINT_GH_BIN` returns exactly one hit, line 1164.) **Confirm `git` resolves AND read its stderr before believing any
  ADMIT.** And "fail SAFE" is safe only against wrongly *binning* a prompt: with respect to
  **arming** it fails **OPEN**, because a skipped gate reads as an ADMIT — including for prompts
  that drop database tables.
- 🔴 **`lint-prompt.mjs` ADMIT is NECESSARY, NOT SUFFICIENT.** The linter *does* now see **three**
  literal markers — `DO_NOT_ARM_COMMENT` (`lint-prompt.mjs:728`, case-insensitive),
  `DO_NOT_ARM_CAPS` (`:730`, case-**sensitive**), and 🔴 **`ARM_ONLY` = `/Arm ONLY/` (`:732`,
  conditional arming), which this bullet omitted until 2026-08-31** — and reports
  `HUMAN_GATE_PRESENT: line N contains` at `:743`, `:755` and `:767`. **RULE 4's arming detector
  greps the union of these markers as its second instrument, so a two-marker grep under-reports
  which prompts the linter actually gates** (Station 04, 2026-08-31; re-measured by 00 the same
  hour, with the control that `"Arm ONLY"` occurred 0 times in this document). **The advice survives the fix:** a **prose** human gate matches neither regex,
  and exactly that burned an arm on 2026-08-28T14:09Z — so still read the BODY before arming.
  Measured 2026-08-30 over the 59 depth-1 `-HOLD`/`-ready` on `origin/main`: the two markers cover
  **7 distinct prompts**; `## STANDING AUTHORITY` appears on **51 of 59** and is boilerplate, not a
  gate; and `pr-dns-s5-checker-flip-to-fail-HOLD` carried **neither** marker until #1400
  (2026-08-30) put `<!-- watcher: do-not-arm -->` on it — `lint-prompt.mjs` now REJECTs it
  `[HUMAN_GATE_PRESENT]` at exit 1. **Adding the literal marker is the cure for any future
  never-arm prompt**, and it fires at `:728` before the premise is ever evaluated. The general
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
  The only clock that dates an arm is the arming log `.arming-log.txt` in the queue folder — which is
  itself **UNTRACKED**, so it exists on the box that armed and nowhere else; a clone, CI and any
  cloud-fired station are blind to it and must not infer arm age at all. Measured 2026-08-31 by
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
- ⚠️ **`STOP-WATCHER-LANE2` has been present BY DESIGN since 2026-08-15.** It is not drift and it is
  not a stop signal. The real sentinel is `STOP-WATCHER`, and **it cannot stop an already-running
  watcher.**
- ⚠️ **A restart adopts nothing.** The watcher runs `index.mjs` **from the clone**, so the clone must
  be fast-forwarded before a restart changes any behaviour.
- ⚠️ **The watchdog heartbeat only ticks MID-RUN**, so age alone cannot separate idle from wedged. A
  long-stale heartbeat while a PR is open usually means **merge-wait**, not a hang.
- ⚠️ **Never count or kill by image name.** Resolve PIDs and verify command lines — 19 `node.exe` were
  running on 2026-08-24 and exactly one was the watcher.
- ⚠️ **QUARANTINED ledger rows are recorded but NOT binding.** Citing one as authority is an error.
- ⚠️ **`check-breadcrumb.mjs` measures two different sets, and only ONE of them sees `archive/`.**
  **Freshness is recursive**: `trackedSet` comes from `git ls-tree -r --name-only origin/main -- docs/pr-prompts`
  (`:98`) and is matched by **basename** (`:162`), so archiving a station's newest breadcrumb does
  **not** make it read SILENT — measured 2026-08-30 archiving 152 files, with `03` (15.1h) and `05`
  (24.0h) unchanged across the move. **Structure is depth-1 only**: it iterates `readdirSync(DIR)`
  at `:160`, so the same move took `structure: 122 checked` to `11`. Both exited 0. Archiving is
  therefore safe, but "it counts by basename" is true of freshness and **false** of the structure
  pass — do not quote the one result as covering both.

## 9.6 The rule behind all of them

🔴 **AN EMPTY RESULT IS NOT AN EMPTY WORLD.** Before concluding absence, ask what your instrument is
blind to, and run the same query against a case you know returns something. Every trap above is a
query that answered confidently and wrongly.

⚠️ **"No process is holding it" is only evidence when you know WHERE the process would have run.** A
lock left by a destroyed Linux VM has no Windows process by construction, forever.

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
   its risk. Apply the policy gate BY HAND — `classifyPolicyFiles` in `index.mjs` is the definition:
   any path outside `^(tests|docs)/`, or any path matching `(^|/)migrations/`, means **it is Marco's**.
3. Never record "no verdict found" as "not routed to Marco". Write `[NO LANE VERDICT — hand-classified]`
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

## 10.3 Route docs-and-tests work through the watcher, not around it

The auto-merge policy is live: `start-watcher.ps1:160` sets `PR_WATCHER_AUTO_MERGE_POLICY = "tests-docs"`,
and `classifyPolicyFiles` admits a diff confined to `tests/**` + `docs/**` with no `migrations/` path.
**42 PRs have merged with no human through that gate.** It works.

🔴 **But it last fired on #1301 — 0 auto-merges since #1400, against 22 PRs routed to Marco.**

⚠️ **This paragraph used to continue "Not because the gate is blocked: because docs work is
hand-landed … so it never reaches the gate." THAT CAUSE IS REFUTED — measured 2026-09-01/02 by
direct experiment.** Station 00 armed a docs-only prompt precisely to test it. The work DID reach
the gate, and the gate still did not fire. **The measured cause is CI-creation latency outrunning
the merge window:**

| | [MEASURED] |
|---|---|
| `#1500` opened | 2026-09-01T20:18:43Z |
| its first CI run **created** | 2026-09-01T23:51:20Z — **212.6 min later**, `run_attempt=1` (not a re-run) |
| merge window | `MERGE_TIMEOUT_MS` = **90 min** (`index.mjs:129-130`), expired at about 21:48Z |
| controls, same window | `#1502` 0.0 min · `#1501` 0.0 (opened 8 s after #1500) · `#1499` 0.0 · `#1498` 0.0 · `#1497` 0.0 |

`index.mjs:1753-1757` needs `checks.length > 0 && checks.every(SUCCESS|NEUTRAL|SKIPPED)` before it
will enable auto-merge. With **zero checks in existence** `allGreen` is false for the whole window,
so the lane falls out at `:1774` and records `marco: true` at `:1776`.

🔴🔴 **A TIMEOUT IS THEREFORE WRITTEN IN THE BYTE-IDENTICAL FORMAT TO A GENUINE POLICY ROUTING.**
`{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` is
indistinguishable, to every later reader and to RULE 2, from a policy verdict meaning "this one is
Marco's to decide". A docs-only PR the lane would have merged with no human becomes **permanently
human-gated** — and RULE 2 correctly forbids any station from clearing it, since a provably-weak
routing reason does not clear a verdict. **The lane built to remove work from Marco silently
creates it.** Open with Marco as of 2026-09-02; the falsifying probe is the table above — re-run
it and this note dies.

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
