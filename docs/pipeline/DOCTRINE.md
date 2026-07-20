
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

The supervisor **dispatches**; it does not do the work. A supervisor once ran `git merge` inside the
watcher's repo, hit a conflict, **abandoned it mid-merge**, and reported "STATUS: NOMINAL". That
single act killed the entire overnight queue (LL-38).

**If the job belongs to another station, hand it over. Doing it yourself is the incident.**

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
