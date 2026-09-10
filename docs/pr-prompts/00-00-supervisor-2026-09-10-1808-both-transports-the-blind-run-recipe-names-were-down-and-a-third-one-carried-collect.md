# Station 00 — Supervisor | 2026-09-10T18:08:14Z–2026-09-10T18:3xZ

🔴 **BLIND RUN.** Desktop Commander could not be reached — the server itself reported
`CONNECT_TIMEOUT ... connection timed out after 30000ms` after four `ToolSearch` load attempts, so
this is a failure **after** the load and is blindness under the station contract, not an unloaded
schema. **I armed nothing, merged nothing, opened no PR, and claim no liveness, smoke, safe-to-act or
merge verdict.** Per `STATION-CAPABILITIES.md` §3 I COLLECTED first and acted on none of it — this is
the "blind, so I read everything readable and acted on none of it" report, not the "blind, so I did
nothing" one.

⚠️ **This breadcrumb is UNTRACKED in the dev tree.** A blind run cannot open a PR (the GitHub MCP
token is write-403 and `github-projectops` failed to connect outright this session), so this file
stays untracked at `docs/pr-prompts/` until a sighted run sweeps it up. **If you are that run, this
file and my predecessor's 1708 breadcrumb both need archiving.**

Fresh negative-control needle minted for this run: `zzQq00Needle20260910T1808`. It is now written
down and is spent.

## GROUND

```
UTC            2026-09-10T18:08:14Z   (from scheduled-tasks MCP lastRunAt — no shell clock available)
origin/main    77137033               [READ FROM .git/refs/remotes/origin/main — NOT fetched this run]
dev tree       main @ 77137033        C:\ProjectOperations2  [read from .git/refs/heads/main]
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — this run was not restricted to read-only on that account. It
was restricted by blindness instead.

⚠️ **Both SHAs are file reads of loose refs, not `git rev-parse`.** No `git` ran this run, in any
tree, by any transport. `origin/main` above is whatever the **last fetch by some other actor** left
behind; **this run did not fetch and cannot claim it is current.** The one thing it does establish is
that the dev tree has moved since my predecessor ran at `4b205fca`, which is consistent with the
1708 board PR having merged.

🔴 **The host-local date and the pipeline's clock disagree by ten hours and only one of them is in
this report.** The session environment declares "Friday, September 11, 2026"; the scheduled-tasks MCP
puts this occurrence at `2026-09-10T18:08:14Z`. Brisbane is UTC+10, so both are right and the local
one is useless for naming a run. **Every timestamp in this breadcrumb is UTC**, and the file is named
`2026-09-10-1808` accordingly. This is the same offset `STATION-CAPABILITIES.md` §3 already warns
about for mount `stat` times, reaching a second instrument.

## WHAT I MEASURED

**Preflight step 1 — blindness, established the only way the contract allows.** `ToolSearch` was run
four times (keyword `desktop-commander`, keyword `start_process powershell terminal shell command
execute`, and an explicit `select:` naming four candidate ids). The tools never arrived; the server
reported `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`. **The ids were not
assumed** — the keyword search that §PREFLIGHT prescribes returned nothing from that server at all,
which is a dead server rather than a wrong id.

**Preflight guard — [CANNOT MEASURE], and now for a compounding reason.**
`scripts/pipeline/vm-git-guard.sh` could not be installed: the Linux workspace transport is absent
for the **fifth** consecutive station run. Verbatim, twice, under two attempts eight minutes apart:
`bash failed on resume, create, and re-resume ... source path ... is under Plan9 share "c" which is
not mounted; create: RPC error -1: ensure user: user sleepy-funny-sagan already exists unexpectedly`.
**No `git` ran against any mount this run — there was no mount to run one against.** Per the station
contract a failed install is a finding, not a stop.

**Preflight step 4 — the sweep: [CANNOT MEASURE].** `status-sweep.ps1` cannot run without Desktop
Commander and there is no second transport that executes anything. I therefore have **no** `[LIVE]`
SAFE-TO-ACT line, **no** watcher pid, **no** heartbeat age, **no** wrapper count and **no** trunk
colour. I am not substituting GitHub-side reads for any of them and I did not act.

**The transport that DID answer, with its controls.** The Cowork **native file tools**
(`Read` / `Glob` / `Grep`) reached the live dev tree at `C:\ProjectOperations2` throughout:

| control | result |
|---|---|
| POSITIVE — `Read docs/pipeline/STATION-CAPABILITIES.md` | 486 lines returned |
| POSITIVE — `Grep 'No second transport'` over `docs/pipeline` | **1** occurrence, in `STATION-CAPABILITIES.md` |
| NEGATIVE — `Grep 'zzQq00Needle20260910T1808'` over `docs/pipeline` | **0** |

Both binding documents plus this station's own doc were read **from the working copy**, because
`git show origin/main:<path>` needs a shell this run does not have. ⚠️ **That is the exact thing
PREFLIGHT step 2 forbids**, and I am flagging it rather than hiding it: what I read may be behind
`main`. The mitigation available to a blind run is weak but not nothing — dev-tree `main` and the
last-fetched `origin/main` are the same SHA, so the working copy is not behind *the last fetch*. It
may still be behind `main` itself.

**COLLECT corpus.** `check-breadcrumb.mjs --freshness` cannot run (no shell), so freshness was
crossed against `lastRunAt` from the scheduled-tasks MCP — a different transport, and the one the
COLLECT step already requires as the cross-check:

| station | `lastRunAt` (UTC) | `nextRunAt` | enabled | reading |
|---|---|---|---|---|
| `00` | 2026-09-10T18:08:14Z — **this run** | 19:07:52Z | ✅ | firing on cadence |
| `03` | 2026-09-09T23:01:42Z | 2026-09-10T23:00:45Z | ✅ | aligned; daily |
| `04` | 2026-09-10T18:09:53Z | 22:09:31Z | ✅ | fired 99 s AFTER me — see F3 |
| `05` | 2026-09-10T14:10:55Z | 2026-09-11T14:10:37Z | ✅ | aligned; daily |
| `weekly-security-audit` | 2026-09-06T21:32:44Z | 2026-09-13T21:32:17Z | ✅ | not a station; healthy |

**All five tasks are ENABLED and none is SILENT.** ⚠️ I am **not** quoting `00`'s alignment as an
all-clear: `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2` against a live cron of
`5 * * * *`, and in any case I could not run it. The MCP is the instrument here, not the breadcrumb.

**Breadcrumbs on disk at depth 1: exactly one** — my predecessor's
`00-00-supervisor-2026-09-10-1708-the-duplicate-confirm-step-has-no-instrument-on-ninety-percent-of-the-queue.md`.
`Glob 'docs/pr-prompts/0[3-5]-*.md'` returns **no files**, so 03/04/05 have nothing uncollected. All
five of the 1708 run's findings (F1 ACTIONED, F2–F5 DEFERRED) already carry a disposition, so it is
fully collected — **but I cannot archive it**, which needs a PR. See F4.

**Q3 — armed prompts counted by hand.** `Glob 'docs/pr-prompts/*-ready.md'` → **no files**, i.e.
**armed = 0**, at the start of the run and at the end. `-HOLD.md` at depth 1 → **40**, the same
corpus size the 1708 run measured, so the queue has not moved.

**Q1/Q2 — the open board: [CANNOT MEASURE].** `gh` needs Desktop Commander. I did not substitute the
GitHub MCP and present it as coverage. **The five PRs the 1708 run found are presumed still open and
still Marco's; that is an inherited reading, not a measurement of mine.**

**RULE 2 lane: [CANNOT MEASURE] as a live probe, and NOT cleared by anything I saw.** The
`marco.:true` probe over `docs/pr-prompts/processed` is a `Select-String` and needs a shell. I could
have grepped the same directory with `Grep`, but a hit count without the per-PR body match and
without the positive/negative control discipline the rule specifies is a **different probe wearing
the same name**, and this pipeline has already been burned twice by exactly that. **No RULE 2
clearance reached this run, and blindness is not one.**

## WHAT CHANGED

**Nothing on the board, and nothing in git.** No PR opened, merged, closed, rebased or labelled. **No
prompt armed, disarmed, renamed, moved or deleted** — `armed` was 0 before and after. No watcher
restart (I could not have performed one and could not have judged one was needed). No worktree
pruned, no stash dropped, no branch deleted. **No `git` command ran, in any tree, by any transport**,
so the dev tree's shared index was not touched and no other chat's staged work could have been swept
into a commit.

**One file written:** this breadcrumb, untracked, in the dev tree. That is a filesystem write, not a
board mutation, and it is what §3 prescribes for a blind run.

## FINDINGS

### F1 — both transports the blind-run recipe names were down at once, and a THIRD one it does not name carried the whole of COLLECT

[MEASURED] this run. `STATION-CAPABILITIES.md` §3 is built on two transports and only two: Desktop
Commander ("the only transport that can **RUN** anything"), and — since the 2026-09-05 correction —
the Cowork VM mount `/sessions/<id>/mnt/`, which it credits with "the whole of COLLECT and most of
PHASE 1". **This run had neither.** Desktop Commander: `CONNECT_TIMEOUT` after 30 s. The mount: the
Plan9 share is not mounted, fifth consecutive run.

A reader following §3 literally on a day like today concludes both its transports are gone and stops
with nothing — **which is the precise failure the §3 correction was written to remove, reproduced one
layer down.** In fact the Cowork **native file tools** reached the live dev tree and delivered every
reading in this report: both binding documents, the station doc, the predecessor breadcrumb, the
queue census, the `needs-marco/` census, and the two loose git refs. §3 does not mention them
anywhere. Controls are in WHAT I MEASURED (POSITIVE 1, NEGATIVE 0, plus a 486-line read).

⚠️ **This is emphatically NOT a relaxation of the ceiling, and the same paragraph that adds it must
say so.** The native file tools READ; they execute nothing. Every prohibition in §3's ceiling list
survives unchanged: no `.ps1`, no `git` against the Windows `.git`, therefore **no liveness, smoke,
safe-to-act or merge verdict**, and no board mutation. What changes is only the difference between
*quoting a file* and *issuing a verdict* — the same distinction §3 already draws for the watcher's
clone log.

🔧 **The correction, ready to land verbatim by the next sighted run**, as a third transport row in
§3 under "No second transport":

> 🔴 **AND THE MOUNT IS NOT THE ONLY READ TRANSPORT — A RUN CAN LOSE BOTH NAMED ONES AND STILL
> COLLECT.** [MEASURED] 2026-09-10T18:0xZ by Station 00 with Desktop Commander at `CONNECT_TIMEOUT`
> and the Plan9 share unmounted: the Cowork **native file tools** (`Read`/`Glob`/`Grep`) read
> `C:\ProjectOperations2` directly and returned the binding documents, the breadcrumb corpus, the
> queue census and the loose refs `.git/refs/heads/main` and `.git/refs/remotes/origin/main`.
> POSITIVE control `Grep 'No second transport'` over `docs/pipeline` → 1; NEGATIVE control, a freshly
> minted needle → 0. **They are read-WRITE**: the same run wrote its own breadcrumb to
> `docs/pr-prompts/` through `Write`, which is how a blind run leaves a report at a tracked path even
> though it cannot open the PR that tracks it. **The ceiling above is unchanged** — these tools
> execute nothing, so no liveness, smoke, safe-to-act or merge verdict, and no board mutation; a file
> written this way is untracked until a sighted run sweeps it up. ⚠️ **Falsifying probe:
> from a run with neither Desktop Commander nor a mount, `Read` any tracked file under
> `C:\ProjectOperations2`; if it fails, this paragraph is wrong.** ⚠️ **And note what it costs:
> PREFLIGHT step 2's "read from `git show origin/main:<path>`, never the working copy" cannot be
> honoured on this transport — a run using it must say it read the working copy and that the reading
> may be behind `main`.**

**DISPOSITION: DEFERRED — with a named payment, because this run cannot land it.** A docs-only edit
to `STATION-CAPABILITIES.md` is squarely inside Station 00's lane; the only thing stopping it is that
a blind run cannot push. **The next sighted Station 00 run lands the block above and archives this
breadcrumb in the same PR.** RULE 1 shape: it is complete (it removes the blind spot permanently
rather than for one run) and additive (it grants no new authority — it explicitly restates the
ceiling — so it cannot damage existing or future data entry). The alternative of leaving it in
project memory only fails the *complete* half: memory is not read by the reader who needs it, which
is a future blind run reading §3.

### F2 — the two blindness escalations already open have never overlapped before, and today they did

[MEASURED] this run. Three escalations already cover the pieces:
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md` and
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`. Every prior occurrence recorded
in them is **one** transport failing while the other worked — the 1708 run's F4 says so explicitly
("Desktop Commander was present and healthy throughout all four"). **This run is the first recorded
simultaneous failure of both**, and the sandbox count moves from four consecutive runs to **five**.

The narrow consequence is unchanged and still lucky: `vm-git-guard.sh` stays uninstalled, and there
was again no mount for an unguarded `git` to damage.

**DISPOSITION: DEFERRED, not re-escalated.** All three questions are already with Marco with their
options, and a fourth file restating them splits one question across four homes — the mistake the
1508 run correctly refused to make. This is evidence, and the only genuinely new fact is the
overlap, which is what F1 turns into a fix. ⚠️ **These are counts, i.e. state — re-measure, never
quote.** It becomes urgent if a run ever loses both transports *and* has an armed prompt or a live
merge window waiting, neither of which was true today (`armed = 0`).

### F3 — the 00×04 collision reproduced, at 04:09 local, for the third independent time

[MEASURED] this run from the scheduled-tasks MCP: `00-supervisor` `lastRunAt 2026-09-10T18:08:14Z`
(jitter 172 s) against `04-scanner` `lastRunAt 2026-09-10T18:09:53Z` (jitter 571 s) — **99 seconds
apart**, at **04:08 / 04:09 Brisbane local**, as far from midnight as this schedule allows.

This is a **third** independent sample of the correction `STATION-CAPABILITIES.md` §6 landed on
2026-09-07, and it matches that correction's numbers to the second: it measured 99 seconds at 04:10
local then, and 99 seconds at 04:09 local now. **The midnight framing is dead and the "move 05" remedy
still fixes one occurrence in six** — the two-station 00×04 overlap recurs on every one of 04's six
daily runs by construction, because an hourly `5 * * * *` lands inside ten minutes of every
`0 */4 * * *`.

**DISPOSITION: DEFERRED**, folded into the open `station-schedule-collision-04-and-05-2026-09-03.md`.
Both offsets live in the scheduled-tasks layer, which is Marco's and not this repo, so no station can
land them. Recorded because the correction now has a third confirming sample taken by a *different*
station-run than the two that found it, which is what makes it a property of the schedule rather than
of one observer.

### F4 — the 1708 breadcrumb is fully collected and cannot be archived, and this run adds a second one to the backlog

[MEASURED]. My predecessor's 1708 breadcrumb sits at depth 1 with all five findings disposed, which
by the archiving rule makes it this run's to archive. **A blind run cannot open the PR that archives
it.** This breadcrumb then becomes a second untracked file in the same state.

**The carried-forward claims are re-stated, NOT re-verified, and I am labelling them as inherited
rather than repeating them as measurements:** five PRs open, all Marco's, four carrying a live
watcher `marco:true` verdict and `#1852` hand-classified; `#1823` green, unlabelled, receipted and
still gated on RULE 2, with the `tenders.allocate` role-visibility question still unanswered; three
untracked non-ignored dev-tree files. **None of these was measurable this run.**

**DISPOSITION: DEFERRED.** The next sighted run archives both breadcrumbs in one PR, which costs it
nothing extra. ⚠️ **The risk this creates is small but real and worth naming: an untracked breadcrumb
is one `git clean` away from gone**, and `git clean` in the dev tree is already on the forbidden list
for exactly this class of reason. It becomes urgent if a third consecutive run is blind, because the
backlog then outlives the memory of why it exists.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the sweep and present them as coverage.** `gh`, the
  board, CI colour, the watcher's liveness and the merge windows are all `[CANNOT MEASURE]` and are
  reported that way, not filled in from the MCP or from my predecessor's report.
- **Merged nothing.** No PR was measurable, no RULE 2 clearance reached this run, and blindness is
  not a clearance. Removing `do-not-merge` would not have been one either.
- **Armed nothing.** `armed` was 0 throughout, measured directly. A blind run may not arm in any
  case: arming needs `arm-prompt.ps1`, which needs a shell.
- **Did not run the RULE 2 probe under a different instrument and call it the RULE 2 probe.** A
  `Grep` hit count over `processed/` is not `Select-String -Pattern 'marco.:true'` with its per-PR
  body match and its controls, and naming it so is the substitution DOCTRINE §7 exists to stop.
- **Did not author a merge-approvals receipt.** A scheduled run never may. Marco's 2026-09-07 ruling
  covers the supervised cloud lane only, and this run is the scheduled one.
- **Did not run `git` — at all, anywhere, by any transport.** The two SHAs in GROUND are file reads
  of loose refs. A guard I could not install is never a licence to use a bridge, and there was no
  bridge to use.
- **Did not restart the watcher, prune a worktree, drop a stash or delete a branch.** All are 03's,
  all need a shell, and I could not even have judged that any was needed.
- **Did not write to `needs-marco/`.** All three questions this run touches are already open there;
  a fourth file would split one question across four homes. F1's fix is a repo edit, not a Marco
  question.
- **Left `docs/qa/`, `/sot/`, Azure, Entra and SharePoint alone.** No file under `sot/` was read for
  edit or written this run.
