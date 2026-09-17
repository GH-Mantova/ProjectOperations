# Station 00 — Supervisor | 2026-09-17T14:09:13Z–2026-09-17T14:12Z

**BLIND RUN. Station 00 could not open a shell on the Windows host. Nothing was armed, dispatched,
labelled or merged. Read the STOP block below before treating this run's silence as "no news."**

## GROUND

```
UTC            2026-09-17T14:09:13Z   (VM clock; see F-3 — the session env claimed 2026-09-18)
origin/main    [CANNOT MEASURE]       no host shell -> no `git fetch` / `git rev-parse` in the dev tree
dev tree       [CANNOT MEASURE]       HEAD file reads `ref: refs/heads/main`; SHA not resolvable without git
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Doc version and bootstrap **agree**. The mismatch clause did not fire. The run stopped on PREFLIGHT
step 1, not on a version disagreement.

## WHAT I MEASURED

**[MEASURED] Desktop Commander is unreachable. Schema was loaded first; this is not an unloaded-schema lie.**
PREFLIGHT step 1 forbids declaring blindness before a `ToolSearch` load, and forbids hard-coding the
tool ids. I ran the keyword search three times across the run, never a literal `select:` of assumed ids:

1. `ToolSearch "desktop-commander start_process powershell"` → no Desktop Commander tool; server
   reported **still connecting**.
2. `ToolSearch "+desktop-commander"` → no match; server still **connecting**.
3. `ToolSearch "start_process interact_with_process terminal shell"` → no match, and the server had
   by then moved into the failed set:
   `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`
4. `ToolSearch "desktop-commander"` (final confirmation) → same CONNECT_TIMEOUT.

The server transitioned **connecting → CONNECT_TIMEOUT**, i.e. the failure is *after* the load
attempt, which is the station contract's definition of blindness rather than of a validation error.
`start_process` was never callable: there was no tool id to call.

**[MEASURED] vm-git-guard installed, exit 0.** Contract requires the installer's last line be quoted
pass or fail:

```
$ bash /sessions/focused-relaxed-cori/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/focused-relaxed-cori/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
--- exit:0 ---
```

No `git` was run against the mount at any point this run. No `index.lock` was created by this run.

**[MEASURED] The dev tree is readable over the VM mount, and that is NOT coverage.** The mount at
`/sessions/focused-relaxed-cori/mnt/ProjectOperations2/` returns the live tree (e.g. `.git` mtime
`Sep 17 23:23`, `sot/` `Sep 17 14:02`), so this is not the `origin/main` substitution DOCTRINE §7
warns about. It is still **not** sufficient to run the station: PREFLIGHT step 2 requires reading the
binding documents via `git show origin/main:<path>` **in the dev tree**, and step 4 requires
`scripts/pipeline/status-sweep.ps1`. Both need the host shell. A file mount is not a shell.

**[MEASURED] Reading is not the blocker; acting is.** Station 00's whole lane — ARM, DISPATCH, MERGE —
is board mutation, and every mutation is gated on a sweep verdict re-measured immediately before it
(`[LIVE]` means "true when measured", not "true now"). With no shell there is no sweep, no
`Assert-SmokedOrEscalate`, no `Merge-Pr`, no `gh`. Arming or merging off a file read would be exactly
the §7 failure this contract exists to prevent.

**[CANNOT MEASURE]** open PRs, check status, labels, watcher liveness, queue state, lock age/size,
`MERGE_HEAD`/rebase state, `pnpm build`/`lint`, `check-breadcrumb.mjs` on this file.

**[CANNOT MEASURE]** whether any breadcrumb has landed since the previous Station 00 run
(`00-00-supervisor-2026-09-17-1316-the-board-is-parked-and-the-watcher-is-busy-so-i-verified-everything-and-armed-nothing.md`).
COLLECT was deliberately not performed — see WHAT I DID NOT DO.

## WHAT CHANGED

**Nothing on the board.** No PR armed, dispatched, labelled, merged or closed. No prompt renamed or
staged. No `/sot/` edit. No branch, commit or push. The only write this run made anywhere is this
breadcrumb file, untracked in the dev tree.

One VM-local change: `vm-git-guard` shim installed at
`/sessions/focused-relaxed-cori/.local/bin/git` inside the disposable sandbox. It touches nothing on
the Windows host.

## FINDINGS

**F-1 — Station 00 ran blind: Desktop Commander CONNECT_TIMEOUT, no shell on the Windows host.**
Three keyword loads, server went connecting → timed out at 30 s. Per PREFLIGHT step 1 this is a hard
stop, and the stop is the correct outcome, not a failure of this run. The cost is that this
two-hourly slot performed **zero** supervision: nothing was collected, nothing was dispatched,
nothing was merged. If the board was healthy at 13:16 it is unsupervised until the next run reaches
the box. The bootstrap records blindness as intermittent at roughly 40% of recent Station 00 runs
with **cause unknown**; this run adds one more data point and no diagnosis, because there is no
diagnostic short of trying and trying failed.
**DISPOSITION: ESCALATED** — Marco, this is an availability question only you can settle, and it is
now recurring often enough to be the pipeline's dominant failure mode rather than noise. Per RULE 1,
the complete-and-additive option first:
(a) **Make the supervisor's reachability observable and self-healing** — have the scheduled task, on
Desktop Commander timeout, record the blind run to a tracked counter file and retry the MCP connect
once before declaring the stop, so a transient 30 s timeout does not cost a whole two-hour slot, and
so the 40% figure becomes a measured series instead of folklore. Solves it now (most blind runs are
probably transient) and in future (the series tells you whether it is the host, the MCP host process,
or the scheduler). Damages no data. **This is the option I would take.**
(b) Increase the MCP connect timeout for `desktop-commander` only. Cheap, but fails the *future* half
of RULE 1: it hides the cause and leaves you with no series.
(c) Do nothing and accept ~40% blind runs. Fails both halves — the board is unsupervised for
unpredictable multi-hour stretches and nobody can see it happening, because a blind run and a quiet
healthy run look identical from outside.
I cannot diagnose the cause from inside a blind run. What I can say is that **it was not an unloaded
schema this time** — the load was attempted first, three times, and the server itself timed out.

**F-2 — The `desktop-commander` MCP server is in the session's failed-to-connect set, alongside eight
others.** Also failing this session: `prisma:Prisma-Local` (CONNECT_TIMEOUT), and seven on
`"Incompatible auth server: does not support dynamic client registration"` (`legal:box`,
`customer-support:hubspot`, `small-business:google-calendar`, `small-business:xero`,
`small-business:zoom`, `engineering:pagerduty`, `finance:bigquery`), plus `data:definite`
(ENDPOINT_NOT_FOUND). That two **local stdio** servers (`desktop-commander`, `Prisma-Local`) both
timed out at exactly 30 s, while the remote failures are all auth-shaped, is a *lead* pointing at the
local MCP launcher rather than at Desktop Commander specifically — **it is not a measurement**, and I
am not diagnosing it from here.
**DISPOSITION: DEFERRED** — real, not now. It becomes urgent the moment a run finds
`Prisma-Local` and `desktop-commander` timing out together a second time; that would make the shared
local-launcher hypothesis worth a deliberate test on the host, which needs the host.

**F-3 — Clock disagreement between the session environment and the VM.** The session environment
declared `Today's date: Friday, September 18, 2026`; the VM's `date -u` returned
`2026-09-17T14:09:13Z`. The previous Station 00 breadcrumb is stamped `2026-09-17-1316`, which is
consistent with the VM and not with the environment header. This run's filename and GROUND block use
the **VM** clock on that basis. A station that stamps the wrong day writes a breadcrumb that sorts
wrongly and that the next 00 may not collect as "since my last run" — and neither clock warns.
**DISPOSITION: DEFERRED** — no board mutation depended on a timestamp this run, so nothing is
corrupted. It becomes urgent if a run ever *acts* on a date comparison (staleness, age-of-lock,
"since my last run"), at which point the two clocks must be reconciled before the comparison is
trusted.

## WHAT I DID NOT DO

- **COLLECT.** Station 00 is the only reader of station breadcrumbs, and skipping the sweep leaves
  that channel unclosed for this slot. I skipped it deliberately: dispositioning findings I cannot
  verify against a live board would produce ACTIONED/DISPATCHED lines with nothing behind them, which
  is worse than an admitted gap. The next sighted run must treat its window as opening at the
  **13:16** run, not at this one.
- **ARM / DISPATCH / MERGE.** No sweep verdict exists, so no mutation is permissible. Not attempted.
- **Substituted GitHub-side reads for the tree.** Explicitly forbidden, and explicitly not done. I
  read the mounted dev tree only, and I have labelled it as insufficient rather than as coverage.
- **Ran `git` against the mount.** Forbidden (DOCTRINE §9.2). The guard was installed first and
  nothing this run tried to bypass it.
- **Touched `/sot/`.** Station 05's lane.
- **Anything Azure / Entra / SharePoint.** Absolute, and nothing this run came near it.
- **Ran `check-breadcrumb.mjs` against this file.** It needs the host toolchain. This breadcrumb is
  therefore **not** validated — do not read it as `breadcrumb-clean`.

---

**This breadcrumb is untracked in the dev tree at `C:\ProjectOperations2\docs\pr-prompts\`.** The next
board PR should sweep it up. A blind run and a healthy quiet run produce the same silence; this one
was **blind**.
