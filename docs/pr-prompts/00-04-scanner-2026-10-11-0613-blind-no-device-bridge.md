# Station 04 — Scanner | 2026-10-11T06:13Z–2026-10-11T06:2xZ

**BLIND: Desktop Commander ABSENT — `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.**
No PowerShell shell on the Windows host was obtainable, so this run STOPPED at preflight step 1 per
the station contract. **This is a blind run, not a quiet healthy one.** No sweep was taken, no gate
was read, nothing was staged, nothing was measured about the board.

## GROUND

```
UTC            2026-10-11T06:13:18Z        [MEASURED] VM `date -u` (the one VM call that succeeded)
origin/main    bc1ed5ce                    [MEASURED] GitHub API, NOT `git rev-parse` — no shell to fetch with
dev tree       [CANNOT MEASURE]            no shell; branch and SHA of C:\ProjectOperations2 unknown this run
doc version    1                           04-scanner.md front matter (read from the WORKING COPY — see F2)
bootstrap      1                           scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap AGREE (1 == 1). The run is read-only regardless, because it is blind.

## WHAT I MEASURED

**1. Device bridge — ABSENT, not unloaded.** [MEASURED] Schema load was attempted FIRST, per
BOOTSTRAP_PREFLIGHT_V1, before any device call:

- `ToolSearch { query: "desktop-commander", max_results: 30 }` → `No matching deferred tools found.`
  plus an explicit server failure line: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.
- Second, differently-worded keyword search (the retry):
  `ToolSearch { query: "desktop commander start_process powershell shell" }` → returned only
  `microsoft_code_sample_search` and `Claude_Browser__resize_window`. **No `start_process`, no shell
  tool, under any id.**

So `start_process` was never called cold and no `InputValidationError` is being mistaken for
blindness: the toolkit is not in this session at all. Per the station contract step 1 — *"If Desktop
Commander is absent… STOP"* — the run ends here.

**2. VM-side git guard — [CANNOT MEASURE].**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"; echo "GUARD_EXIT=$?"` →
`request timed out after 30s. The workspace did not confirm the command started before the timeout —
it may or may not have run.` **No last line and no exit code to quote**, which the contract requires
in every outcome. Recorded as `[CANNOT MEASURE]` rather than guessed. **No `git` was run against the
mount at any point this run** — the ban was honoured as remembered, which is the only form available
(see F1).

**3. The VM mount was alive at 06:13Z and dead by 06:16Z.** [MEASURED]
First call succeeded: `/sessions/<s>/mnt/ProjectOperations2` listed (apps, docs, sot, scripts,
packages, …) and `scripts/pipeline/vm-git-guard.sh` was present, 10256 bytes, mode `-rwx------`.
Three subsequent calls — a `head -45` of that same script, a retry of it, and the guard install —
each returned `request timed out after 30s`. So the Linux sandbox degraded mid-preflight as well.

**4. What the working-copy station doc says (read with the file tool, not a shell).** [MEASURED]
`C:\ProjectOperations2\docs\pipeline\stations\04-scanner.md` is readable and declares
`station_doc_version: 1`, `contract_version: 5`.

**5. Prior-run context, GitHub-side only.** [MEASURED] `main` head `bc1ed5ce`
(2026-10-11T01:33:07Z, PR #2310) is Station 00 committing 04's sweep-rotation advance to
`last_index 3`, so **the next 04 run is rotation index 0 (gate liveness)** — not this one; this run
took no sweep. That commit message also records that **04's previous run (breadcrumb
2026-10-11-0209) was itself blind**, and that its `last_run_utc` stamp is ~4 hours fast and must not
be read as a UTC measurement.

**Not measured, deliberately:** DOCTRINE.md, DOCTRINE-REFERENCE.md and STATION-CAPABILITIES.md were
NOT read from `origin/main`, because the mandated read is `git show origin/main:<path>` in the dev
tree and there is no shell to run it in. I did not substitute the working copy or a blob fetch and
then proceed as though the binding documents had been read.

## WHAT CHANGED

**Nothing.** No board mutation, no prompt staged, no prompt armed, renamed, moved or deleted, no
label touched, no merge, no push, no commit, no `git` invocation of any kind, no `sot/` edit, no
Azure/Entra/SharePoint contact. The only write this run performed anywhere is this breadcrumb file
in the dev tree.

`scripts/pipeline/next-sweep.mjs` was **not** run and **not** advanced — correctly, because no sweep
was taken. The rotation therefore still points at index 0 for the next run, exactly as #2310 left it.

## FINDINGS

### F1 — Station 04 ran blind again; two consecutive 04 runs now have zero board coverage

[MEASURED] This run: Desktop Commander absent (evidence above). [MEASURED] Previous run: PR #2310's
message states 04's 2026-10-11-0209 run "ran blind". Two consecutive scheduled Scanner runs have
produced no gate reading, no instrument-honesty check, no repo-hygiene pass and no instruction-drift
pass. DOCTRINE's own framing is the risk here: a blind run and a healthy quiet run both produce "no
news", so the board's apparent calm across these two runs is **unevidenced**, not reassuring.

Secondary, same root cause: the preflight's mandatory git-guard install cannot be certified in a
blind run either, so the "quote the installer's last line and exit code" requirement is
unsatisfiable exactly when the bridge is down — the run has to record `[CANNOT MEASURE]` for a step
the contract words as unconditional.

**DISPOSITION: DISPATCHED** — to Station 00. Two items for 00's collection: (i) count this as the
second consecutive blind 04 run when it dispositions blindness frequency, and (ii) note that
rotation index 0 (gate liveness) has now gone unswept for two cycles, so the next live 04 run should
treat gate liveness as overdue rather than routine.

### F2 — The preflight cannot be satisfied when the bridge is down, so a blind run must read its own instructions from the working copy or not at all

[MEASURED] The contract requires all three binding documents to be read via `git show
origin/main:<path>` in the dev tree, and explicitly forbids the working copy ("a version match is
not a freshness proof") and bare blob URLs. [MEASURED] Both shells are gone this run, so that read
is impossible; the only readable copy of `04-scanner.md` was the working copy, via the file tool.
The contract's own stop rule fires before step 2, so nothing was acted on from it — but that leaves
a blind station with no sanctioned way to confirm it is even reading current instructions, including
the stop rule it is obeying. That is an instruction-layer gap, not a this-run accident, and it will
recur on every blind run.

**DISPOSITION: DEFERRED** — real, not now, and not 04's to fix (04 may not open a PR). It becomes
urgent the moment a blind run is expected to do anything other than stop, because then it would be
acting on unverified instructions. The complete-and-additive fix, if Marco or 00 wants one, is to
add a "BLIND PATH" clause to the canonical contract block that names exactly what a shell-less run
may read and may do (read working copy, write breadcrumb, stop) — additive, changes no live
behaviour, and removes the contradiction without weakening the origin/main rule for sighted runs.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for tree coverage.** `origin/main` reads appear above only
  in the GROUND SHA line and as prior-run context, each tagged; no gate, glob, lock, arming state or
  repo-hygiene claim is made from them. `origin/main` is not the tree the watcher globs.
- **Did not take a sweep** (no `status-sweep.ps1`, no `next-sweep.mjs`, no `--advance`). A sweep read
  without a shell would be fabricated, and advancing the rotation on an unswept run would silently
  skip a cycle.
- **Did not run `git`** anywhere — not through the device bridge (absent) and not against the mount
  from the VM, guard or no guard. An inert or uninstallable guard is not a licence.
- **Did not run Part 0/1/2** (static cross-layer audit, GitHub reconciliation, live-site patrol).
  Part 0 is a grep sweep over the mount, and the mount timed out after the first call; Part 2 needs
  the live site and a sweep this run has no right to assert.
- **Did not stage or arm anything**, did not touch `/sot/`, did not clear any lock, did not touch
  Azure / Entra / SharePoint.
- **Did not write to the gitignored sinks** (`docs/qa/qa-checklist.md`, `qa-findings.md`,
  `qa-test-data-registry.md`, `.qa-run.lock`, `qa-run-*.md`) — not even the QA run lock, since no QA
  run happened.

**This breadcrumb is UNTRACKED in the dev tree** at `docs/pr-prompts/`. Station 00 collects it; 04
may not commit it. Its filename matches no watcher glob, so it arms nothing.
