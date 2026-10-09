# Station 00 — Supervisor | 2026-10-09T21:06Z–2026-10-09T21:2xZ

## GROUND

```
UTC            2026-10-09T21:06:26Z
origin/main    120b7ad3   (git fetch origin +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 6332dd05 at start -> 120b7ad3 after the fast-forward below   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md, read from origin/main)
bootstrap      1   (station_doc_version declared by the scheduled-task file) — MATCHES, run is read-write
```

## WHAT I MEASURED

- **[MEASURED] Not blind.** `start_process` shell `powershell.exe` returned `6332dd05` and
  `2026-10-09T21:06:26Z` on the first call, after ONE keyword `ToolSearch` for `desktop-commander`.
- **[MEASURED] vm-git-guard, last line and exit code, verbatim:**
  `=> THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL IN THIS SHELL. It is back to being remembered`
  … last line: `   PATH="/sessions/admiring-upbeat-hawking/.local/bin:$PATH" git <args>`, headline
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`,
  **EXIT=2**. That is the expected station outcome (a FINDING, not a stop). No `git` was run through
  the device bridge this run; every git call went through the Windows host shell.
- **[MEASURED] Binding reads** — all three from `git show origin/main:<path>` **in the dev tree**:
  `docs/pipeline/stations/00-supervisor.md` (466 lines), `docs/pipeline/DOCTRINE.md` (508 lines),
  `docs/pipeline/STATION-CAPABILITIES.md` (740 lines). Cores in full; no REFERENCE section was
  needed except the FF cure, which the core carries inline.
- **[MEASURED] Cadence from the scheduled-tasks MCP, not from any document:** `00-supervisor`
  `5 * * * *` hourly, `lastRunAt 2026-10-09T21:06:08Z` (this run); `03` `0 9 * * *`;
  `04` `0 */4 * * *`; `05` `10 0 * * *`; `weekly-security-audit` `enabled: false`. Four enabled.
- **[MEASURED] `status-sweep.ps1` verdict: `SAFE TO ACT`** — no board mutation in progress, no
  remote activity in the last 2 min, board lease free, `git index.lock` false/false, scoped git
  processes 0, no watcher build in flight (newest heartbeat tick 20.3 min old). Instrument positive
  controls both `[LIVE]` (gh saw merged #2296; node runs). Exit code 0, runtime 189.5 s.
  ⚠️ The sweep's output is 471 lines and its section 5 is ~300 of them; `read_process_output`
  returned 400 and the **verdict was in the 71 lines it withheld**. Read the tail explicitly.
- **[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.**
  `00` last 2026-10-09T20:14Z (1.0 h, cadence 1 h + 0.5 h) ok · `03` 22.1 h (24 h + 3 h) ok ·
  `04` 3.0 h (4 h + 1 h) ok · `05` 6.8 h (24 h + 3 h) ok. No station MISSED, so no classification
  was required. `structure: 1 checked, 0 malformed`. **breadcrumb-clean** is asserted on that
  command, not on an impression of it.
- **[MEASURED] Board:** 1 open PR. `#2294` *fix(pipeline): dedupe section 5 PR crawl and add
  -SkipSection5 fast switch*, head `7671943c`, `BEHIND`, CI 13 pass / 2 fail, carries
  `do-not-merge`. WAITING ON MARCO = **1**. Armed (`*-ready.md`) = **0**.
- **[MEASURED] COLLECT.** Breadcrumbs at depth 1: exactly one, my own previous cycle's
  `00-00-supervisor-2026-10-09-2014-the-armed-sweep-fix-deleted-two-blocks-nobody-asked-it-to-touch.md`.
  No 03/04/05 breadcrumb has landed since 18:10Z (04's, collected by #2292). Nothing from another
  station is waiting on a disposition this cycle.
- **[MEASURED] All 13 non-superseded depth-1 `*-HOLD.md` prompts REJECT at `lint-prompt.mjs`**
  (exit 1 each): `HUMAN_GATE_PRESENT` ×8 — `pr-524-rates-b-slice2-canonical`,
  `pr-nav-jobs-projects-merge`, `pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`,
  `pr-scopecards-s8b-azure-maps-travel`, `pr-sec-a2-email-codes-and-reset-links`,
  `pr-siteid-notnull-backfill`, `pr-vendor-invoice-ocr`; `FILE_GATE_NOT_RELEASED` ×4 —
  `pr-fv2-ai-digests`, `pr-fv2-output-channels`, `pr-rates-s11c-drop-legacy-tables`,
  `pr-tenant-mt4-s2-ownership-migration`; `GATE_NOT_RELEASED` ×1 —
  `pr-tipid-s3-retire-the-name-guard-for-an-id-check`.
  `pr-sweep-section5-dedupe-and-fast-switch-HOLD.md` was deliberately NOT linted: #2294 already
  builds that work and adds the file under `superseded/`, so arming it would build it twice
  (DOCTRINE §10.6).
- **[MEASURED] Backlog gates:** `ready=1 needs-marco=2 blocked=4 broken=0`. The one READY item,
  `rates-11c-blocked-consumers [P2]`, is *staging* work — Station 06's lane, not an arm.
- **[MEASURED] main CI history, last 12 runs on `main`:** 11 success, 1 failure — the failure is
  `120b7ad3` only. The red is not a regression in trunk code.
- **[CANNOT MEASURE]** whether the re-run jobs go green: both were `in_progress` at
  2026-10-09T21:14:4xZ when this run ended. Next cycle confirms; I am not claiming green.

## WHAT CHANGED

1. **Dev tree fast-forwarded `6332dd05 → 120b7ad3`**, under the board lease
   (`Enter-BoardLease -Actor 'station-00.scheduled'` → `True`; released → `True`;
   `Get-BoardLease` read back **absent**). All four prescribed read-backs:
   `git rev-list --left-right --count HEAD...origin/main` → `0 0`; `git diff --numstat origin/main`
   → EMPTY; `git diff --cached --name-status` → EMPTY; `git status --porcelain
   --untracked-files=no` → EMPTY.
2. **`docs/pr-prompts/.arming-log.txt` restored byte-exactly from `HEAD`** by a raw-Buffer node
   write (`fs.writeFileSync(abs, execFileSync('git', ['show','HEAD:'+rel]))`), then
   `git update-index --refresh -- <path>`, then per-path `git status --porcelain` → EMPTY. No
   `git checkout -- <path>`, no `git clean`, no `reset`. The line the restore dropped is the same
   line the incoming commit adds — `git diff --numstat origin/main -- <that path>` was EMPTY before
   the restore — so the FF put it straight back. Nothing was lost.
3. **Re-ran only the FAILED jobs** of main's two red workflows: CI run `37990313946` and
   Tendering Browser Smoke run `37990311547` (`gh run rerun <id> --failed`). Read back: both
   `in_progress` at 21:14:4xZ.
4. **Nothing was armed. Nothing was merged. No label was touched. No branch was updated.**
   `NO-OP: nothing is admissible to arm — every depth-1 HOLD rejects at lint, and the only HOLD
   that passed last cycle is already built by #2294.`

## FINDINGS

### F1 — The dev-tree fast-forward was blocked by the mixed-EOL arming log, exactly as last cycle predicted

`git merge --ff-only origin/main` → exit 1,
`error: Your local changes to the following files would be overwritten by merge:
docs/pr-prompts/.arming-log.txt`. The file was ` M` with `lf=161 crlf=157` (26,829 bytes against a
26,647-byte HEAD blob), and the three incoming commits touch that exact path. Every "pass" reading
the core warns about was present: `--numstat origin/main` for that path was EMPTY, `--cached` was
EMPTY, and `rev-list --left-right` read `0 2`, i.e. cleanly behind. Only
`git status --porcelain` saw it.

**DISPOSITION: ACTIONED** — restored from HEAD by raw-Buffer node write, fast-forwarded, and all
four read-backs are clean (WHAT CHANGED 1–2).

### F2 — Trunk is red on one cause and it is not ours: Docker Hub's unauthenticated pull rate limit

Both red workflows on `120b7ad3` failed in **`Initialize containers`, before `actions/checkout`**,
with the identical daemon response:

```
Error response from daemon: toomanyrequests: You have reached your unauthenticated pull rate limit.
##[error]Docker pull failed with exit code 1
```

- CI run `37990313946`, job `API — lint, test, compliance smoke` (`114022548558`) — step 2 failed,
  steps 3–14 all `skipped`. Every other job in that run is `success`, including both pipeline-test
  jobs, the web build, and the data-model generator.
- Tendering Browser Smoke run `37990311547`, job `tendering-e2e` (`114024723167`) — same three
  back-offs, same message, 21:02:42Z → 21:03:01Z.

Named cause, not a guess from the diff: the service-container image pull is rate-limited for
unauthenticated runners, and the pull happens before any of our code runs. 11 of the last 12 `main`
CI runs are green.

**DISPOSITION: ACTIONED** — the failed jobs were re-run (the cause is external and self-clearing,
so this is not "re-running hoping for green"; the cause is named first, per DOCTRINE §2). Next
cycle must confirm; QUEUED/in-progress is not green.

### F3 — The permanent cure for F2 needs either a credential or a registry decision, and both are Marco's

If it recurs, re-running is a mask, not a fix. Two options, RULE 1 applied:

1. **Complete and additive — authenticate the pull.** Add `docker/login-action` with a Docker Hub
   token to the jobs that declare service containers. Solves it immediately and for the future
   (authenticated pulls have a far higher limit), changes no behaviour, and touches no data. It
   fails the *autonomy* half only: it needs a **secret**, which is a hard stop (DOCTRINE §5.4 /
   authorization grants). I can write the workflow change and the runbook; Marco creates the secret.
2. **Partial — pull the images from a registry that is not rate-limited** (e.g. a `ghcr.io` or
   `mcr.microsoft.com` equivalent of the service image). No secret, so I could land it. It fails
   the *complete* half: it swaps our dependency onto a registry nobody has chosen, and it says
   nothing about any other Docker Hub pull in the repo.

Not escalated this cycle on purpose: **one occurrence in twelve runs.** What would make it urgent:
a second container-init rate-limit failure on `main` within 24 h, or any such failure on a PR that
is otherwise ready to merge.

**DISPOSITION: DEFERRED** — trigger named above; the option pair is written so the next cycle can
put it to Marco without re-deriving it.

### F4 — #2294's two reds ARE the gate, and removing the label is necessary but not sufficient

`PR gates — diff checks` fails with
`FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must review
and REMOVE the label; removing it is what releases the merge.]` — every other gate in that job
PASSes or SKIPs. `Approval receipt (CP-26)` fails for the same reason: no receipt exists, and none
is open to me, because a **standing** receipt is not permitted on a PR that was ever labelled
`do-not-merge`, and a **personal** receipt requires Marco to have released it. So there is no fix
lane here and no instrument defect; the PR is correctly parked.

Worth saying plainly so it is not a surprise: when Marco removes the label, the diff-check turns
green by itself, but `Approval receipt (CP-26)` will then want an `authority: personal` receipt
written by whichever station merges. The PR is also `BEHIND` — that is `Merge-Pr`'s job at merge
time (UPDATE_AT_MERGE_TIME_V1); I deliberately did **not** run `gh pr update-branch` on it.

**DISPOSITION: ESCALATED** — Marco: #2294 is `scripts/pipeline/status-sweep.ps1` plus its tests and
a superseded prompt file. It exists to stop the very problem this run hit (the sweep's section 5
crawl dominating the run and pushing the verdict past the readable output window). It is 13/15 green
with the only two reds being the label gate. Remove the label to release it, or say the word and it
stays parked.

### F5 — My own scratch lint classifier lied, in the same shape as last cycle

Last cycle's breadcrumb is titled in part *"my own lint classifier lied"*. I reproduced it: the
helper matched `'ADMIT'` before `'REJECT'`, and `lint-prompt.mjs`'s REJECT output contains the word
ADMIT in its explanatory text, so 5 of 13 HOLDs were reported `ADMIT exit=1` — a verdict and an exit
code that contradict each other on the same line. Nothing warned; the first line of each output read
`REJECT`. The correct reading is in WHAT I MEASURED: **0 admissible.**

The durable cure is one line: **never classify `lint-prompt.mjs` by substring — the exit code is the
verdict**, and if a human-readable tag is wanted, take the FIRST line only. This is §7's standing
guard ("a failed call must not flow into a comparison") applied to my own throwaway scripts, which
are exactly where it keeps happening because nothing lints them.

**DISPOSITION: DEFERRED** — the cure line above belongs in
`docs/pipeline/stations/00-supervisor-REFERENCE.md` next to the scripts registry. Not landed this
cycle because it is a doc edit with no urgency and this run's PR is already the breadcrumb; it is
written here in full so the next cycle can land it verbatim.

### F6 — `check-breadcrumb --freshness` called a tracked breadcrumb UNTRACKED

It printed
`NOTE 00-00-supervisor-2026-10-09-1913-...md is UNTRACKED — it reaches nobody until a board PR
commits it`. That file **is** tracked on `origin/main` — #2295/#2296 moved it to
`docs/pr-prompts/archive/`. At the moment of the reading the dev tree was 2 commits behind, so the
file was still present (and tracked) at depth 1 locally while `origin/main` held it only under
`archive/`; the validator's tracked set is built from `git ls-tree origin/main -- <dir>` and so
missed it. Harm is low and in the safe direction (it over-reports untracked), but it is a false
negative about the one thing the NOTE exists to detect, and it will recur on every cycle that runs
while the dev tree is behind.

**DISPOSITION: DEFERRED** — would become urgent the moment the polarity flips (a genuinely untracked
breadcrumb reported as tracked). Cure to consider: resolve the basename across `origin/main`'s
`docs/pr-prompts/**` rather than one directory level, which is already how the freshness scan sees
`archive/`.

### F7 — The raw-Buffer FF cure DID work on a mixed-EOL file, which narrows #2288's finding

#2296/#2288 recorded that *"the ff cure primary raw-Buffer branch silently does not work in a CRLF
checkout, only its EOL fallback does"*. Measured this run on a genuinely mixed-EOL file
(`lf=161 crlf=157`): the **primary** raw-Buffer write took the path from ` M` to clean on the first
attempt — `AFTER-RAW bytes=26647 porcelain=[]` — and the CRLF and LF fallback branches never ran.
So the earlier claim is not wrong about the case it measured, but it does not generalise to
"a CRLF checkout" as written; what decides it is the blob's own line endings against the path's
`.gitattributes`/`text=auto` treatment, not the checkout.

**DISPOSITION: DEFERRED** — a wording narrowing for `00-supervisor-REFERENCE.md §POST-MERGE-FF-CURE`,
with this run's byte counts as the evidence. Not landed this cycle for the same reason as F5. ⚠️
Falsifying probe for whoever lands it: restore a path whose HEAD blob is pure-LF in this checkout
and read `git status --porcelain -- <path>` after the raw write; if it stays dirty, the original
wording is right for that case and both must be kept side by side.

## WHAT I DID NOT DO

- **Did not arm anything.** 0 of 13 depth-1 HOLDs are admissible (8 `HUMAN_GATE_PRESENT`,
  4 `FILE_GATE_NOT_RELEASED`, 1 `GATE_NOT_RELEASED`). The `HUMAN_GATE_PRESENT` eight are the
  already-open escalation
  `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`;
  I did not re-surface it to Marco this cycle, because re-asking an open question every hour is
  noise, not diligence.
- **Did not merge #2294**, did not remove or add a label, did not run `gh pr update-branch` on it.
- **Did not stage `rates-11c-blocked-consumers`** — the READY backlog item is Station 06's lane.
- **Did not touch the 33 non-main worktrees or the 3 registry escapees** reported by the sweep
  (`C:\PR-Master\worktrees\bootstrap-check`, `C:\PR-Master\worktrees\sweep-section5`,
  `C:\po-wt\dispatch-register-v1`, all 0 KB, no `.lock`). Many hold unpushed commits. That is
  Station 03's lane and 03 is not MISSED (22.1 h, cadence 24 h + 3 h). I did not dispatch it either:
  03 wakes on its own clock at `0 9 * * *` and will read this breadcrumb. *Named here so it does.*
- **Did not clear any `[STALE]` escalation row.** The sweep's section 5 produced ~300 `[FILE]` lines
  and its own verdict on each is *"section 5 CANNOT decide whether it is stale — read the file"*.
  Retiring any of them needs per-file reading plus `gh pr view <n> --json state,mergedAt` per PR
  (a LIST response's `merged` field is unusable — DOCTRINE §9.4), which does not fit beside the FF
  work in one hourly slot. Deliberately left for a cycle with nothing else to do; #2294 landing
  would make it affordable by cutting the crawl.
- **Did not run `git` through the device bridge**, and did not use the mount for any git read.
- **Did not touch Azure / Entra / SharePoint, production data, or any secret.**
