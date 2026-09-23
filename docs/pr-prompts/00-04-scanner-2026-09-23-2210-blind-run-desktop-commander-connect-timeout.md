# Station 04 — Scanner | 2026-09-23T22:06Z–2026-09-23T22:14Z

**BLIND RUN. Desktop Commander did not connect. No sweep was run. This is not a quiet healthy run.**

## GROUND

```
UTC            2026-09-23T22:06Z  (VM clock, `date -u`; no host clock reachable)
origin/main    d6c086c8  [MEASURED by plain file read of .git/refs/remotes/origin/main — NOT `git rev-parse`, and NOT re-fetched]
dev tree       main @ d6c086c8   C:\ProjectOperations2  [MEASURED by plain file read of .git/HEAD + .git/refs/heads/main]
doc version    1   (docs/pipeline/stations/04-scanner.md front matter, WORKING COPY — see F2)
bootstrap      1   (scheduled-task SKILL.md, `station_doc_version: 1`)
```

Version and bootstrap AGREE. That agreement is not a freshness proof and the station doc says so
explicitly: the working copy is routinely behind `main`, and content is corrected without bumping
the version. I could not run `git show origin/main:<path>`, so **every document I read this run was
read from the working copy** — the exact thing the preflight forbids. See F2.

## WHAT I MEASURED

**1. Device-bridge git guard — installed, INERT (expected outcome for a station).**

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
  bash -lc 'command -v git' -> /sessions/pensive-bold-darwin/.local/bin/git
  bash -c  'command -v git' -> /usr/bin/git
=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL.
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/pensive-bold-darwin/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] Exit code **2**, read from the installer itself, not from a pipeline appended to it (no
`tail`, no `Select-Object`). This is the documented middle outcome: a FINDING, not a STOP. The ban
was therefore REMEMBERED this run, and honoured: **no `git` binary was invoked against the mount at
any point.** All ref values above came from `cat` of files under `.git/`, which takes no lock.

**2. Desktop Commander — ABSENT. Schema was loaded FIRST, per the preflight.**

[MEASURED] Two `ToolSearch` calls were made before any device tool was called, exactly as the
preflight demands — a keyword search, not a hard-coded `select:` of environment-specific ids:

- `ToolSearch "desktop-commander start_process interact_with_process"` → no matching tools; server
  listed as still connecting.
- `ToolSearch "desktop-commander"` (max_results 30, one call) → **no matching deferred tools found**,
  and the server is now reported as failed:
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`

This is a failure **after** a successful load attempt, not an unloaded schema. No `start_process` was
reachable to call. Per the station contract's step 1, that is blindness and the run stops there.

`plugin:prisma:Prisma-Local` timed out identically (30000ms) in the same window — two local-bridge
servers, same symptom, same moment. [INFERRED] a single bridge-side outage rather than two
independent faults; I could not probe the bridge to confirm.

**3. Repo mount — READABLE. The blindness is the shell, not the filesystem.**

[MEASURED] `ls` of the mount and `Read` of `docs/pipeline/stations/04-scanner.md` both succeeded.
This run could see the tree the watcher globs; it could not run a single command against it.
Recording the distinction because "blind" in this pipeline usually means both, and here it means
only the second half.

**4. Working-tree lock state — clean.**

[MEASURED] `stat` only, no git: `index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD` are
all **absent** from `C:\ProjectOperations2\.git`. No stale-lock freeze to report. I could not
cross-check running git processes (no host shell), so this is a filesystem reading only.

**5. `refs/heads/main` == `refs/remotes/origin/main` == `d6c086c8`.**

[MEASURED] both refs read identical. `.git/FETCH_HEAD` mtime is `2026-09-24 07:47:33 +1000` =
**2026-09-23T21:47Z**, ~19 minutes before this run started — so some other actor fetched recently
and the ref is unlikely to be badly stale. [CANNOT MEASURE] whether it is current: I could not
`git fetch`, and mtime is evidence of a fetch having happened, never of what it brought back.

**6. Breadcrumbs in the dev tree.** [MEASURED] one present:
`00-00-supervisor-2026-09-23-2114-nothing-armable-of-thirteen-holds-and-the-approvals-channel-has-issued-one-file-ever.md`
(Station 00, 2026-09-23T21:14Z). Uncollected as of this run.

## WHAT CHANGED

**Nothing on the board, and nothing in the repo but this file.**

- No prompt staged, armed, disarmed, renamed, moved or deleted.
- No PR opened, labelled, reviewed or merged.
- `scripts/pipeline/next-sweep.mjs` was **NOT advanced** — correctly, because no sweep was run. The
  rotation pointer is untouched and the next run inherits the same sweep. Station 00: there is no
  advance of mine to commit this cycle.
- One new untracked file: this breadcrumb, at `docs/pr-prompts/`. It is untracked until a board PR
  commits it — Station 00 sweeps it up.

## FINDINGS

**F1 — Desktop Commander connect-timeout made this run blind. [S2]**

The only sanctioned path to a Windows host shell failed with `CONNECT_TIMEOUT` after 30s, with
`Prisma-Local` failing identically in the same window. Without it Station 04 cannot run
`status-sweep.ps1`, cannot run `git fetch` / `rev-parse` for a real GROUND stamp, cannot run
`next-sweep.mjs` to learn or advance its own sweep, and cannot run `check-backlog.mjs`,
`check-lessons.mjs`, `check-escalations.mjs` or `triage-holds.ps1`. Every one of the station's
instruments is on the far side of that bridge.

The load-first discipline was followed and is what makes this a real finding rather than the §7
instrument lie the preflight warns about: the schema search ran before any device call, twice, and
returned nothing both times.

**DISPOSITION: ESCALATED.** Marco — this is the bridge, not the pipeline, and no agent can restart
it. The question, per RULE 1 (complete-and-additive first):

- **(A) Make the bridge's health visible and self-announcing — complete and additive.** A station
  currently discovers the outage by falling over mid-preflight, and a blind run and a healthy quiet
  run produce the same silence, which is exactly why this keeps costing whole cycles. Add a
  bridge-liveness line to Station 00's collection pass: count consecutive breadcrumbs carrying a
  blind declaration and surface the streak. Solves it immediately (this outage becomes legible now)
  and in future (any later outage announces itself), and it writes no data anything else reads.
  Fails neither half of RULE 1.
- **(B) Restart the Desktop Commander MCP host-side and move on.** Fixes the immediate half only —
  the next timeout is as invisible as this one was. Fails the "future" half.
- **(C) Do nothing; blindness is intermittent (~40% of recent Station 00 runs) and runs recover.**
  Fails both halves: the outage recurs untracked, and the rotation pointer silently stops turning
  while nobody can tell a stalled sweep from a quiet one.

If (A) appeals, it is a Station 00 doc change plus a counter — small, and I did not stage it,
because staging a prompt I could not lint is the staging equivalent of the instrument lie.

**F2 — Every binding document this run read was read from the working copy, not `origin/main`. [S3]**

The preflight requires all three binding documents to be read via `git show origin/main:<path>` in
the dev tree, and states that a `station_doc_version` match cannot substitute for that. With no
shell, the working copy was the only readable source. `refs/heads/main` and `origin/main` are equal
at `d6c086c8` and the last fetch was ~19 minutes prior, so the working copy is *probably* current —
but "probably current" is precisely the reading that served two stations superseded instructions on
2026-08-29, and the checked-out tree can hold uncommitted edits that no ref comparison detects.

Consequence, stated plainly: **nothing in this report should be treated as having been validated
against `origin/main`.** The blindness in F1 is what makes this unavoidable; it is recorded
separately because it degrades the trust level of the whole run, not just its coverage.

**DISPOSITION: DEFERRED.** Not independently actionable — it resolves the moment F1 resolves. What
would make it urgent on its own: any evidence the dev tree is carrying uncommitted edits to
`docs/pipeline/**` or `sot/**`, which would mean stations are reading locally-modified instructions
even on sighted runs. I could not run `git status` to check, and that check is the first thing the
next sighted Station 04 should do.

**F3 — The git guard reports itself INERT, so the device-bridge git ban held this run only because
it was remembered. [S3]**

Exit 2 is the expected outcome and is already documented, so this is not news — it is a standing
condition being re-measured, and DOCTRINE §9.2 records the remembered form of this ban as having
failed seven times. Filing it so the streak is visible rather than assumed: **it held this run.** No
`git` binary touched the mount; the one-call `PATH=` form was available and was not needed, because
the run stopped before any git work.

**DISPOSITION: DEFERRED.** Real, and not now — the mechanical fix is a shell the installer cannot
reach (non-interactive, non-login, sources neither rc file), which is a host-side change, not a
station's. What would make it urgent: a fresh 0-byte `index.lock` with no owning process, which is
the failure this ban exists to prevent. None present this run (WHAT I MEASURED §4).

**F4 — Station 00's breadcrumb from 2026-09-23T21:14Z is still uncollected. [S4]**

One breadcrumb sits untracked in `docs/pr-prompts/`, ~52 minutes old at the time of this run. That
is well inside normal latency for the collection pass and is almost certainly nothing. Recorded only
so that if it is still there on the next run, the second sighting has a first sighting to sit
against — an uncollected breadcrumb is invisible by exactly the mechanism that let a finding rot for
nine days.

**DISPOSITION: DEFERRED.** What would make it urgent: still present, uncollected, on the next two
Station 04 runs.

## WHAT I DID NOT DO

- **The sweep — any sweep.** `next-sweep.mjs` names the rotation's next sweep and I could not run it.
  Choosing one myself is explicitly forbidden ("NOT your choice and NOT the first on a list"), and
  guessing would have narrowed coverage without rotating it. The pointer is therefore unadvanced and
  the next run inherits the same sweep, which is the intended behaviour, not a gap.
- **Part 0, the static cross-layer audit.** This is the one deliberate omission worth defending,
  because I could have run it: it is pure grep-and-read over the mount, and the mount was readable.
  I did not, because the station contract's step-1 STOP is unconditional — *"If Desktop Commander is
  absent, or the call fails after the load: STOP. Write one paragraph saying you are blind, name what
  you could not reach, and end the run"* — and the brief that asks for Part 0 "even when the live
  pass is blocked" is subordinate to the contract by the brief's own terms. Reasoning past a hard
  stop because this particular instance looked safe is the documented recurring failure, and a Part 0
  pass read entirely from an unverified working copy (F2) would carry a trust level I could not state
  honestly. **Flagging the tension for Station 00 rather than resolving it unilaterally:** the STOP's
  stated rationale is that `origin/main` is not the tree the watcher globs — which does not describe
  this run, where the tree *was* readable and only the shell was gone. If that distinction is real,
  the contract should name it, and the fix belongs in the doc, not in a station's judgement.
- **Part 1, GitHub reconciliation.** The GitHub connector was very likely reachable. Not run for the
  same reason as Part 0 — and because presenting GitHub-side reads as this run's coverage is the
  specific substitution the STOP names.
- **Part 2, the live-site pass.** Requires Claude in Chrome and a live session; not attempted.
- **Adversarial prompt critique.** Requires reading staged prompts and `lint-prompt.mjs` verdicts.
  The lint side was unreachable, and a design critique quoting no lint result would be a lead, not a
  finding.
- **~~`check-breadcrumb.mjs`~~ — this one I DID do.** Run in the VM, which is permitted: node is not
  a git invocation and takes no lock. [MEASURED]

  ```
  $ node scripts/pipeline/check-breadcrumb.mjs docs/pr-prompts/00-04-scanner-2026-09-23-2210-blind-run-desktop-commander-connect-timeout.md
  ADMIT   00-00-supervisor-2026-09-23-2114-nothing-armable-...-file-ever.md
  NOTE    00-04-scanner-2026-09-23-2210-blind-run-desktop-commander-connect-timeout.md is UNTRACKED — it reaches nobody until a board PR commits it
  ADMIT   00-04-scanner-2026-09-23-2210-blind-run-desktop-commander-connect-timeout.md
  structure: 2 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)
  CLEAN
  CHECK_BREADCRUMB_EXIT=0
  ```

  `breadcrumb-clean`, on the validator's own exit 0 — and note the validator itself flags this file
  as UNTRACKED, which is the F4 mechanism applied to my own report. No `lint-prompt.mjs` verdict is
  quoted anywhere in this document, because a `lint-prompt` result on a breadcrumb is not evidence of
  anything in either direction.
- **Anything under `docs/qa/`.** No lock claimed, no checklist updated, no findings file touched —
  there was no QA run to record, and the run-lock exists to serialise work that did not happen.
