# Station 06 — PR Master | 2026-09-01T02:54Z–2026-09-01T03:35Z

## GROUND

```
UTC            2026-09-01T02:54:26Z
origin/main    1efd079c   (2ae2ee3e by the time of staging)
dev tree       main @ 850a649c   C:\ProjectOperations2   (dirty: 6 tracked)
doc version    1
bootstrap      account skill = RETIRED POINTER v1 (2026-08-24), carries no station_doc_version
```

Interactive run, Marco present, invoked by hand — not a scheduled fire, so the
`C:\Users\Marco\Claude\Scheduled\` layer does not apply. Desktop Commander reached the Windows host
on the first call. `06-pr-master.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md` were all read from
`git show origin/main:<path>`, never from the working copy.

## WHAT I MEASURED

- **[MEASURED]** `docs/pr-prompts/in-progress/` has no producer. `git grep -n "in-progress"
  origin/main -- scripts/pr-watcher/index.mjs` → nothing, exit 1. Positive control
  `classifyPolicyFiles` → exit 0. Negative control `qqzzxxnotarealtokenqqzzxx` → exit 1. The
  watcher's destinations are `processed/`, `failed/`, `no-pr-opened/`, `blocked/`, `paused/`.
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 603 paths, **0** containing
  `in-progress`. `Test-Path` on the dev tree → False.
- **[MEASURED]** Three consumers read it anyway: `status-sweep.ps1:224` and `:254`,
  `supervise-watcher.ps1:582`. `status-sweep.ps1:229` feeds the count into `$boardBusy`; `:354`
  names it in the `DO NOT ACT` verdict. `supervise-watcher.ps1:583` is
  `if ($inProg.Count -gt 0) { continue }  # a build is running: not hung`.
- **[MEASURED]** At 2026-09-01T02:55:09Z the sweep printed `in-progress prompts (a station is
  running one): 0` while `scripts/pr-watcher/logs/2026-08-31.log` held
  `[02:33:55.430Z] [start] pr-scopesub-s3-priced-or-provisional-ready.md` and the heartbeat read
  `elapsed=180s`. A build **was** running.
- **[MEASURED]** `status-sweep.ps1:204` throws `Measure-Object : The property "Length" cannot be
  found in the input for any objects` — `-Recurse` without `-File` yields directories, which have
  no `Length`. Observed on `C:\po-worktrees\fix-followup-notes` (0 files). The exception prints
  mid-report and the sweep continues.
- **[MEASURED]** `pr-statussweep-orphan-worktree-dirs-HOLD.md` has premise
  `! grep -q "orphanWorktreeDirs" scripts/pipeline/status-sweep.ps1`. On `origin/main`:
  `orphanWorktreeDirs` **0**, `abandoned worktree DIRS` **0**, against `REGISTRY-ESCAPEE` **5**,
  `worktree-registry-escapees` **3**, `registeredPaths` **2**. Controls: `Section` **19** present,
  `qqzzxxnotreal` **0** absent. `git log origin/main -- scripts/pipeline/status-sweep.ps1` shows the
  scan shipped in **#1460** (`6d19e841`). The premise is therefore permanently true.
- **[MEASURED]** `PROMPT-SCHEMA.md:186` reads "the human's act of approval"; `only Marco` occurs
  **0** times in that file (control: `premise` **15**). `STATION-CAPABILITIES.md:176`,
  `approvals/README.md:68`, `00-supervisor.md:162` and `02-board-driver.md:151` all already name
  Marco.
- **[MEASURED]** #1469's sole red is CP-26 reporting its own `do-not-merge` label — every other CP
  passed (`--log-failed` on job 99716990199). Label read live off the PR, not from a board listing.
- **[INFERRED]** The watchdog's dead guard is harmless-to-beneficial in practice: a hung node is by
  definition one that believes it is building, which is the 2026-08-11 case the watchdog exists for
  (`supervise-watcher.ps1:70-77`). I recorded this as an inference, not a measurement, and it is why
  the prompt deletes the guard rather than repairing it.

## WHAT CHANGED

- **PR #1474 opened** — `stage/pm-queue-dir-cluster`, commit `fd1a7d69`, 4 files, +615/-0, all under
  `docs/pr-prompts/`. Staged from a **disposable worktree off `origin/main`** at
  `C:\po-worktrees\pm-stage-4prompts`, removed afterwards; `git worktree list` is back to the dev
  tree alone. Read-back: 4 files on the PR, labels `[]`, no auto-merge, 11 checks green / 0 red / 2
  pending at 03:33Z. Hand-classified per DOCTRINE §10.1: **0** paths outside `^(tests|docs)/`, **0**
  matching `migrations/` — policy-eligible for the `tests-docs` lane.
- **Four `-HOLD` prompts staged** (none armed): `pr-sweep-dead-queue-dir-reads`,
  `pr-watchdog-dead-inprog-guard`, `pr-schema-label-removal-is-marcos`,
  `pr-ci-gate-dead-queue-dir-reads`. The last is chained on
  `status-sweep.ps1 :: buildRunning` and `supervise-watcher.ps1 :: heartbeat-only`.
- **One scheduled task deleted** — `trig_01KtgZ4gEZwGX7Qr1Yyj7PUf`, a self-scheduled check that
  would have performed a Station 00 act (stop the watcher chain, fast-forward the clone, relaunch)
  at 03:12Z. Cancelled on reassignment to 06, which holds no such authority.
- Nothing else. No `/sot/`, no code, no merge, no label, no arm, no dev-tree write.

## FINDINGS

**F1 — `status-sweep.ps1` and `supervise-watcher.ps1` both count a directory nothing writes.**
The sweep's safe-to-act gate has been running on three of its four signals, and the watchdog's
"a build is running" guard has never been able to fire. **DISPOSITION: ACTIONED** — staged as two
prompts in #1474, split by file so they cannot collide. Verified by lint `ADMIT` exit 0 on both,
with every premise true today and every `done_when` token absent today.

**F2 — the defect class has no CI gate.** Three instances in one session, each fixed by hand.
**DISPOSITION: ACTIONED** — staged as `pr-ci-gate-dead-queue-dir-reads-HOLD.md`, chained behind F1's
two prompts. It lints `REJECT [GATE_NOT_RELEASED]`, which is the gate holding correctly; with only
the `requires_on_main` lines stripped it lints `ADMIT (size 2)`.

**F3 — `pr-statussweep-orphan-worktree-dirs-HOLD.md` has a premise that can never die.** Its work
shipped in #1460 under different identifiers, so arming it rebuilds a shipped scan and collides with
F1's sweep prompt. This is LL-54 inverted: the fix landed, the premise greps a token the fix never
used. **DISPOSITION: ESCALATED** — retiring a queued prompt is a queue mutation. Raised with Marco
2026-09-01T03:2xZ; he elected to handle it directly.

**F4 — `PROMPT-SCHEMA.md:186` says "the human" where every other binding doc says only Marco.**
The label has been removed by an unattributable actor six-plus times on record; Marco has confirmed
the recent ones were his. Wording cannot fix attribution — every actor authenticates as
`GH-Mantova` — but the schema being the one loose document is a gap worth closing.
**DISPOSITION: ACTIONED** — staged as `pr-schema-label-removal-is-marcos-HOLD.md`. Docs-only, so it
can land through the `tests-docs` lane without consuming Marco.

**F5 — the `buildRunning` fact is reported, not enforced, and that is a standing invitation.**
The End-User Advocate lens objected and I could not close it: a measured "a build is running" fact
sitting next to `$boardBusy` will read to the next author as unfinished wiring, and completing it
would freeze Station 00 for most of the day. Mitigated with an in-code comment only.
**DISPOSITION: DEFERRED** — it becomes urgent the moment anyone proposes wiring it in. If that
happens, the answer is no, and the reason is build duration versus supervisor cadence.

## WHAT I DID NOT DO

- **Did not merge anything, and removed no `do-not-merge` label.** #1469 and #1473 both carry live
  gates; #1474 is my own and is Marco's or 00's to merge. Station 06 never merges.
- **Did not arm anything.** All four land as `-HOLD`; the `git mv` to `-ready` is Station 00's alone.
- **Did not touch the watcher, the supervisor, the clone, or any process.** Marco said explicitly not
  to kill the watcher; node `32916`, `start-watcher` `32496` and launcher `13464` were running at the
  start of this run and were never signalled. The clone fast-forward is a Station 00 act and remains
  an open escalation.
- **Did not write to the shared dev tree.** It was dirty on arrival (arming residue — `-HOLD` files
  `git mv`'d to gitignored `-ready`) and has since been synced to `502b6cf3` by another actor. I read
  it and left it.
- **Did not touch `/sot/`, `apps/**`, `prisma/**`, Azure/Entra/SharePoint, or `docs/pr-reviews/`** —
  the last deliberately: those are historical records, and the similar wording in `pr-1165-review.md`
  and `pr-1435-review.md` is evidence, not instruction.
- **Did not run** `git checkout .`, `checkout -- <dir>`, `reset --hard`, `stash pop` or `git clean`
  anywhere.

## Corrections to my own earlier claims in this session

Recorded because a station that quietly fixes its own record teaches nothing.

1. I reported `armed: 0` from a board script that counted `docs/pr-prompts/armed/` and `ready/` —
   folders that **do not exist**. The real count was 1. I reported an empty world from an empty
   result (§9.6) roughly an hour after writing a check meant to catch exactly that. The script has
   been corrected to glob top-level `*-ready.md` and to print `[CANNOT MEASURE]` for any absent
   folder.
2. I told Marco a 70-minute build sat "one stale heartbeat away from being killed as hung". The
   mechanism is real but I ignored the design intent — the watchdog exists to kill hung mid-build
   nodes. Corrected before it reached a prompt.
3. My first negative control for `git grep` was `zzzNoSuchTokenZzz`, which **DOCTRINE itself
   documents as an example needle**, so it matched and the control was worthless. Re-run with
   `qqzzxxnotarealtokenqqzzxx` → exit 1.
4. I described several `pr-*-review.md` files as "instructing agents to remove the gate". They are
   historical review records, not instructions. Overstated; corrected before drafting.
