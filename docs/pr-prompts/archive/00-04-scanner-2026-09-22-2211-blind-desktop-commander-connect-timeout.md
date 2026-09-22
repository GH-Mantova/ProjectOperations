# Station 04 — Scanner | 2026-09-22T22:10Z–2026-09-22T22:16Z

> **FIRST LINE, LOUD: THIS WAS A BLIND RUN.** Desktop Commander did not connect. No shell was
> started on the Windows host. No sweep was run, no board state was read, no gate was evaluated.
> **"No findings" below is the sound of a station that could not look, not the sound of a healthy
> board.** Do not read this report as coverage of anything.

## GROUND

```
UTC            2026-09-22T22:10Z  (first measured stamp 2026-09-22T22:11:03Z)
origin/main    2cfd5b23           [SEE CAVEAT] ref FILE read, not `git rev-parse` — no shell
dev tree       main @ f3162a44    C:\ProjectOperations2   [SEE CAVEAT] ref FILE read
doc version    1                  (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                  (scheduled-task SKILL.md `station_doc_version: 1`)
```

**doc version and bootstrap AGREE (1 = 1).** No version-mismatch read-only clamp. The run is
read-only anyway, for the reason in the banner.

🔴 **CAVEAT on the two SHAs.** Both were obtained by reading `.git/refs/...` as plain files from
the Linux sandbox, because no shell was available to run `git rev-parse`. The `origin/main` line
is therefore the value of a **per-tree remote-tracking ref whose freshness I could not command** —
preflight §2 requires `git fetch` first and I could not fetch. `.git/FETCH_HEAD` carries an mtime
of `2026-09-23 08:10:47 +1000` = **2026-09-22T22:10Z**, one minute before this run's first stamp,
so *something* fetched immediately before me; that is an mtime, not a proof of what it fetched.
**Treat both SHAs as [INFERRED], not as a preflight stamp.**

Preflight §2 also requires reading DOCTRINE.md and STATION-CAPABILITIES.md **from `git show
origin/main:<path>`**, never from the working copy. That command needs a shell. It was not
available, and the sanctioned network fallback (`?plain=1` blob fetch) is a GitHub-side read that
this station's STOP clause forbids substituting as coverage. **So the two binding documents were
NOT read from an authoritative source this run** — which is a second, independent reason nothing
below may be treated as a verdict.

## WHAT I MEASURED

**1. Repo mount is present and readable.** [MEASURED]

```
$ ls -d /sessions/*/mnt/ProjectOperations2
/sessions/admiring-gifted-curie/mnt/ProjectOperations2
```

The tree is *readable*. It is not *operable*: file reads work, `git`/`node`-against-the-board and
PowerShell do not. Readability is exactly the condition that makes a blind run look sighted.

**2. The device-bridge git guard installed, and reports itself INERT — exit 2.** [MEASURED]

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/admiring-gifted-curie/.local/bin/git
  bash -c  'command -v git' -> /usr/bin/git
=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL.
$ echo "GUARD_EXIT=$?"
GUARD_EXIT=2
```

Exit status quoted is the **installer's own**, not a pipeline's — nothing was piped into `tail` or
`Select-Object`. Exit **2** is the outcome the station contract names as EXPECTED for a station,
not an anomaly: the installer writes its `PATH` export into `~/.bashrc` / `~/.profile` and a
station's shell is non-interactive and non-login, so it sources neither. **The ban was remembered,
not enforced, for this entire run — and it was honoured: no `git` was run against the mount.**

**3. Desktop Commander is ABSENT. Three load attempts, then a definitive transport error.**
[MEASURED]

Per preflight, the schema was loaded **before** any call — a validation error is not blindness, so
the load had to come first and be seen to fail on its own terms.

- Attempt 1, keyword `desktop-commander start_process interact_with_process read_process_output`
  → `No matching deferred tools found. Some MCP servers are still connecting: …
  plugin:desktop-commander:desktop-commander.`
- Attempt 2, keyword `desktop-commander` → same: still connecting.
- Attempt 3, keyword `start_process powershell terminal command execution` → returned five
  unrelated tools (PDF viewer, Microsoft Learn, Chrome shortcuts, plugin search). **No shell tool
  under any id.** The contract's warning that the `mcp__…__` prefix is environment-specific is why
  this was searched by keyword rather than by a hard-coded `select:` — the keyword search returns
  whatever the session offers, and the session offered no shell.
- Then, after a 20s wait, the server resolved its state:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

**This is a load failure that resolved to a transport failure, not an unloaded schema.** `start_process`
was never callable. No shell was started on the Windows host.

**4. No git lock, no interrupted-operation state in the dev tree.** [MEASURED] — by `stat` on the
files, not by running `git`.

```
.git/index.lock                  → absent
MERGE_HEAD / REBASE_HEAD / CHERRY_PICK_HEAD / rebase-merge / rebase-apply / sequencer → all absent
```

This is the one genuinely reassuring reading in the report, and its scope is one directory. It
says the dev tree is not frozen. It says nothing about the watcher clone, the board, or CI.

**5. Sweep rotation state, read but NOT advanced.** [MEASURED]

```
docs/pipeline/sweep-rotation.json
  last_index    1        (= "instrument-honesty", the sweep that was last COVERED)
  last_run_utc  2026-09-22T18:10:25Z
  last_station  04-scanner
```

The previous Station 04 occurrence, 4h before this one and on cadence, completed a sweep — so it
was sighted. **Blindness is intermittent and this occurrence is the blind one.** The next sighted
run is owed index **2, "repo-hygiene"**. I did not run it and I did not advance the pointer; see
WHAT I DID NOT DO.

**6. `docs/qa/.qa-run.lock` absent.** [MEASURED] No concurrent QA run to stand down for. Moot —
there was no run to guard.

**7. LEAD, not a finding: dev-tree HEAD and the `origin/main` ref disagree.** `f3162a44` vs
`2cfd5b23`. **[CANNOT MEASURE] which way.** `git rev-list --left-right --count HEAD...origin/main`
is the probe that answers it and it needs a shell; decoding packed commit objects by hand would be
reimplementing git to dodge a ban whose point is that I should not be doing git here. A divergence
of unknown direction is not something I can disposition, so by the contract it stays a lead and is
recorded here rather than under FINDINGS. **The next sighted run should resolve it first** — a dev
tree that cannot fast-forward is the documented precondition for several worse failures.

**8. [CANNOT MEASURE] `breadcrumb-clean` for this very file.** `scripts/pipeline/check-breadcrumb.mjs`
was NOT run. `node` v22.23.2 exists in the sandbox, so the script would start — but its `tracked()`
helper calls `execSync('git ls-tree -r --name-only origin/main …')` and falls back to
`execSync('git ls-files …')`, and `fromOpenPrs()` shells `gh`. Running it from this sandbox executes
`git` against the mounted Windows `.git`, which is the hard stop I am bound by. **I did not run it,
and I therefore do not claim `breadcrumb-clean`.** The structure below was hand-checked against the
validator's source, which is evidence of care and is *not* a passing verdict. See F3.

## WHAT CHANGED

**On the board: nothing.** No prompt staged, armed, disarmed, renamed, moved or deleted. No PR
opened, labelled, or merged. No branch touched. No `git` command run anywhere, by any path.

**On disk: two writes, both outside the board.**

1. `~/.bashrc` and `~/.profile` **in the disposable Linux sandbox** — written by `vm-git-guard.sh`,
   which the preflight orders run first. Sandbox-local; dies with the session; touches no repo file.
2. **This breadcrumb**, at `C:\ProjectOperations2\docs\pr-prompts\00-04-scanner-2026-09-22-2211-blind-desktop-commander-connect-timeout.md`
   — untracked in the dev tree until a board PR commits it. Named here so Station 00 sweeps it up.

`docs/pipeline/sweep-rotation.json` was **read and left byte-unchanged.**

## FINDINGS

---

**F1 — BLIND RUN: Desktop Commander unreachable, so Station 04 performed no station work.**
Severity **S2** (a scheduled audit station silently produced nothing for a full 4h occurrence).

Evidence: WHAT I MEASURED §3 — three keyword loads, then
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
The schema was loaded before any call, so this is not the §7 instrument lie the preflight warns
about. `plugin:prisma:Prisma-Local` timed out in the same window, which points at the bridge host
rather than at Desktop Commander specifically.

Consequence, stated plainly because the whole point of the STOP clause is that this is easy to
miss: **no `status-sweep.ps1`, no gate liveness, no premise execution, no board read, no Part 0
static audit, no Part 1 GitHub reconciliation, no live-site pass.** The 4h occurrence is a hole in
coverage, not a clean bill of health.

I deliberately did **not** substitute GitHub-side reads and present them as coverage. `origin/main`
is not the tree the watcher globs, and a GitHub-shaped report from a blind station is precisely the
failure this clause exists to prevent.

RULE 1 options for Marco, complete-and-additive first:

- **(a) Make blindness self-announcing, and keep the bridge from being the single point of failure.**
  Two halves, both additive: (i) have the scheduled-task runner emit a bridge-reachability probe
  result into a tracked file on every occurrence, so a missing station run is distinguishable from
  a quiet one **without** relying on the blind station to write its own obituary; (ii) investigate
  the 30s `CONNECT_TIMEOUT` on the Desktop Commander host. Solves it now (the hole is visible) and
  in future (the cause is addressed), and damages no data entry. **Fails neither half of RULE 1.**
- **(b) Timeout/retry only** — raise the MCP connect timeout or retry the connection before the
  station gives up. Cheap, additive, and may well clear the symptom. **Fails the "future" half if
  the root cause is the host being down rather than slow**: a longer timeout cannot connect to a
  process that is not there.
- **(c) Accept intermittent blindness and rely on the breadcrumb** — status quo. Depends on the
  blind station successfully writing and on 00 successfully collecting. [MEASURED] 2026-09-22: a
  blind run wrote a complete report into the session's disposable `outputs` folder and it reached
  nobody. **Fails the "completely" half.**

**DISPOSITION: ESCALATED** — the bridge host is Marco's environment; an agent cannot diagnose a
transport that will not open. The question is (a), (b) or (c), not a status update.

---

**F2 — `vm-git-guard` INSTALLED BUT INERT (exit 2): the device-bridge git ban is remembered, not
mechanical.** Severity **S3**.

Evidence: WHAT I MEASURED §2, the installer's own exit code, unpiped. This is the middle outcome
the station contract documents as **EXPECTED** for a station — non-interactive, non-login shells
source neither `~/.bashrc` nor `~/.profile`. It is quoted because the contract requires it quoted:
an install nobody can see in the report is indistinguishable from one that never ran, and that
invisibility is why earlier bullets telling stations not to run `git` there did not stop the next
occurrence.

It is reported as a finding rather than a stop, exactly as the contract's three-outcome table
directs. The ban was honoured by memory this run. DOCTRINE §9.2 records that memory failing seven
times, which is the whole argument for the shim.

**DISPOSITION: DEFERRED** — expected outcome, already correctly documented, and the one-call form
`PATH="<session>/.local/bin:$PATH" git <args>` is available for any station that needs it. **What
would make it urgent:** an exit of anything other than 0 or 2 (the shim was not written at all), or
a fresh 0-byte `index.lock` with no owning process appearing in either tree — that would mean the
remembered ban has failed an eighth time and the protection must become mechanical.

---

**F3 — The report contract's own validator cannot be run by a station whose only shell is the
device bridge.** Severity **S3**. **NEW** — not previously recorded in any breadcrumb I can see.

Evidence, read from source at `scripts/pipeline/check-breadcrumb.mjs`: `tracked()` runs
`execSync('git ls-tree -r --name-only origin/main -- docs/pr-prompts')` and falls back to
`execSync('git ls-files docs/pr-prompts')`; `fromOpenPrs()` runs `execSync('gh pr list …')`.
From the Linux sandbox those execute `git` against the mounted Windows `.git` — the hard stop.

So the contract creates a gap it does not name: it requires that `breadcrumb-clean` never be
written until `check-breadcrumb.mjs` has exited 0, and on a bridge-only run the only way to obtain
that exit code is to break a hard stop. The honest move is the one taken here — decline to run it,
decline to claim the verdict, hand-check the structure and say that is what was done — but the
contract does not currently tell a station that, so the next blind station may well reach for the
script, or worse, assert `breadcrumb-clean` without it.

Worth noting the shape: the failure is in the *instrument*, and it is invisible unless someone
reads the instrument's source. That is DOCTRINE §7 in its own toolchain.

Not staged as a prompt: this run is blind, so I cannot execute a premise, cannot run
`lint-prompt.mjs` (it too needs a shell), and cannot verify the fix is not already queued in a HOLD
file. Staging an unverifiable prompt from a blind run would be an unverifiable board mutation.

**DISPOSITION: DEFERRED** — real, correctly worked around this run, and it only bites when the
bridge is down, which F1 already escalates. **What would make it urgent:** F1 being answered with
option (c), which would make bridge-only runs the normal case rather than the exception; or a
breadcrumb turning up that asserts `breadcrumb-clean` with no quoted command behind it.

---

## WHAT I DID NOT DO

- **The sweep — any sweep.** `node scripts/pipeline/next-sweep.mjs` was not run and index 2
  ("repo-hygiene") was not covered. A sweep is `origin/main` premise execution and board reading;
  both need the shell.
- **`next-sweep.mjs --advance` — deliberately NOT run.** Advancing the pointer for a sweep I never
  performed would silently consume "repo-hygiene" and the rotation would skip it entirely. The
  contract's instruction to advance presupposes a completed sweep. `sweep-rotation.json` is
  byte-unchanged at `last_index: 1`; **the next sighted Station 04 run is owed index 2.**
- **`scripts/pipeline/status-sweep.ps1`** — PowerShell on the Windows host. No shell.
- **Part 0 static cross-layer audit**, all six sub-checks including the always-on (a) authorization
  parity. Sub-check (a) requires a positive control (the count of correctly super-aware call sites)
  precisely so a blind grep cannot be mistaken for a clean result; I could technically have grepped
  the mount, but reporting Part 0 from a run that could not verify its tree against `origin/main` is
  the same "looks sighted" error in miniature.
- **Part 1 GitHub reconciliation** — not attempted, and not substituted for the local work. See F1.
- **Part 2 live-site regression and visual patrol** — no page audited, no screenshot taken.
- **`check-breadcrumb.mjs` on this file** — see F3. Structure hand-checked against the validator's
  source (five sections, contract order, `# Station 04` heading, name matching `NAME_RE`, every
  finding carrying a literal disposition, no finding routed into a gitignored sink). **That is a
  hand-check, not a passing exit code, and it is not `breadcrumb-clean`.**
- **Any `git` command, anywhere, by any path** — including read-only ones, and including via the
  Node scripts that shell out to them. The guard reported itself INERT (F2), so the ban held by
  memory alone and is recorded here as having held.
- **Staged no prompt, not even a `-HOLD`.** Station 04 may stage a lint-clean prompt; nothing could
  be linted this run, and an unlinted prompt is not lint-clean.
- **Wrote this breadcrumb into the dev tree rather than into a PR worktree** — the contract's
  second-best home, chosen because the best home (inside the run's own PR) requires creating a PR,
  which this station may not do and this run could not do. **Station 00: this is an untracked file
  at a tracked path.** It carries the documented fast-forward hazard if the same path later lands on
  `main` — commit or sweep it rather than leaving it to sit.
