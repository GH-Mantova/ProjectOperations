# Station 00 — Supervisor | 2026-09-10T14:08Z–2026-09-10T14:25Z

## GROUND

```
UTC            2026-09-10T14:08:31Z
origin/main    58a947fe             (git fetch origin --prune, then rev-parse)
dev tree       main @ 58a947fe      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions AGREE, so this run is not read-only.

**SIGHTED.** Desktop Commander reached the box on the first `start_process` after a keyword
`ToolSearch` load (PREFLIGHT step 1: a validation error is not blindness — the schemas arrived
deferred and were loaded first).

**Which tree I read in.** The dev tree, and PREFLIGHT step 2's `git show origin/main:` requirement
is satisfied by construction here: `git rev-list --count HEAD..origin/main` → **0** and
`origin/main..HEAD` → **0**, and `git diff --numstat origin/main --` over all three binding
documents returned **EMPTY**. The working copy of those three files IS `origin/main`. No piped hash
was taken (§9.1 — the piped form is unsound in `powershell.exe`); `--numstat` EMPTY is the answer.

All three read in full this run: `00-supervisor.md` (1299 lines), `DOCTRINE.md` (1913),
`STATION-CAPABILITIES.md` (485).

## WHAT I MEASURED

**Sweep, twice.** `status-sweep.ps1` captured to a FILE both times (it returns early and hides its
own section 7 otherwise) and decoded for a UTF-16LE BOM in node per §9.3 — the first capture was
132,290 B. Verdict at **14:09:21Z** and again at **14:15:32Z**: `[LIVE] SAFE TO ACT: no board
mutation in progress, no recent remote activity, no live station worktrees.` `index.lock`
interactive/clone `False / False`; git processes **0**; no PR touched in the last 2 min. [MEASURED]

**Board — 5 open, 4 green + CLEAN, 1 red.** [MEASURED] from the sweep's `[LIVE]` lines:
`#1852` `#1850` `#1845` `#1832` all CLEAN, CI 15 pass / 0 fail / 0 pending. `#1823` BLOCKED,
14 pass / 1 fail. `main` CI on `58a947fe`: 4 success / 0 failed (trunk green). **armed = 0.**

**RULE 2 — all five open PRs are Marco's.** Probe pinned to the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (§9.5 — the clone holds a dead decoy that passes
its own positive control). **2118** logs, newest `2026-09-10T13:29:04Z` — younger than every open
PR, which is the control that separates the two directories. POSITIVE `marco.:true` → **629**
(regex form, no quote character); NEGATIVE, a freshly minted needle → **0**. [MEASURED]

| PR | verdict | lane |
|---|---|---|
| `#1850` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/triage-holds.ps1"}` | watcher |
| `#1845` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/status-sweep.ps1"}` | watcher |
| `#1832` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}` | watcher |
| `#1823` | `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` | watcher |
| `#1852` | **no `[watcher] merge result` line** | `[NO LANE VERDICT — hand-classified]` |

`#1852`'s only `processed/` hits are a `rev-1852` REVIEW JOB verdict and a mention inside
`rev-1853`; per §10.1 step 4 that absence is recorded, not read as "not Marco's". Hand-classified by
`classifyPolicyFiles`: its sole scope entry is `scripts/pipeline/status-sweep.ps1`, which matches
none of the three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S**. Same answer either way.

⚠️ `#1823` carries `labels=[]` — **unlabelled and still Marco's.** Removing the label does not clear
a watcher verdict, and its single red is `tendering-e2e`, **not** CP-26 — so this is not the
`[LABEL_PRESENT]` parked-by-design case (§9.4). It already carries a `REJECT-AND-REDO` review and an
open escalation at `needs-marco/pr-1823-review-reject.md`. Left entirely alone.

**COLLECT — nothing new to collect.** `check-breadcrumb.mjs --freshness` → `CLEAN`, **exit 0**:
`00` 1.1h (cadence 2h) · `03` 15.2h (24h) · `04` 4.1h (4h) · `05` 16.2h (24h), all `ok`. Asking the
TRACKED set rather than the dev tree (`git ls-files docs/pr-prompts`, basename match), the **only**
unarchived root breadcrumb is my own 1308 one — every earlier station finding is already archived,
i.e. already dispositioned. No breadcrumb has been written since 13:08Z. [MEASURED]

**`lastRunAt` cross-check — and it is this run's headline.** The freshness table is one instrument
and cannot name a cause, so it was crossed against the scheduled-tasks MCP as the COLLECT step
requires. [MEASURED]

| task | cron | `lastRunAt` | newest breadcrumb |
|---|---|---|---|
| `00-supervisor` | `5 * * * *` | **2026-09-10T14:08:10Z** — this run | 13:08Z |
| `04-scanner` | `0 */4 * * *` | **2026-09-10T14:09:49Z** | 10:10Z |
| `05-sot-keeper` | `10 0 * * *` | **2026-09-10T14:10:55Z** | 09-09T22:02Z |
| `03-machine-minder` | `0 9 * * *` | 2026-09-09T23:01:42Z | 09-09T23:01Z |

**00, 04 and 05 all fired inside 165 seconds and two of them were still live while this run
worked.** Independent corroboration from a different instrument: the sweep's section 3 reported
`headless claude-code sessions: 3`. `list_scheduled_tasks` and the sweep agree, and neither depends
on the other. ⚠️ `list_sessions`' state field was deliberately not used — §9.5 records it never
clears.

**Triage.** `triage-holds.ps1` exit 0, GIT and SPENT controls both PASS: **40** HOLDs —
`spent=0 · gates-satisfied=9 · still-gated=31 · unreadable=0`. [MEASURED]

**The decisive measurement — TESTS-DOCS ELIGIBLE = 0 of 9.** Each of the 9 `ADMIT` candidates was
parsed with the **CRLF-explicit** `scope:` matcher §9.3 mandates and classified against the three
live `NESTED_TEST_PATHS` forms. [MEASURED]

| `ADMIT` prompt | scope | classification |
|---|---|---|
| `pr-brandtheme-s3-full-palette-columns` | 8 | MARCO — `migrations/` |
| `pr-brandtheme-s6-live-preview-contrast-and-override` | 6 | MARCO — `apps/web/src/lib/contrast.ts` |
| `pr-company-manage-s1-permission-and-grant` | 4 | MARCO — `migrations/` |
| `pr-e2e-container-s2-swap-required-job` | 2 | MARCO — `.github/workflows/playwright.yml` |
| `pr-fv2-maintenance-usage-intervals` | 5 | MARCO — `migrations/` |
| `pr-qpdf-1-estimate-preview-mark` | 6 | MARCO — `apps/api/.../quote-html.builder.ts` |
| `pr-qpdf-3-quoteref-collision-409` | 3 | MARCO — `apps/api/.../client-quotes.service.ts` |
| `pr-qpdf-4-freeze-issued-terms` | 6 | MARCO — `apps/api/.../quote-pdf.service.ts` |
| `pr-rateparity-s1-harness` | 4 | MARCO — `apps/api/.../charge-step-parity.service.ts` |

Controls: classifier POSITIVE on `scripts/pipeline/__tests__/backlog-parser.test.mjs` → `true`,
NEGATIVE on `scripts/pipeline/status-sweep.ps1` → `false`. **Extraction controlled separately from
the decision, per §9.3's own instruction:** the pre-correction `/^scope:\s*\n.../m` matcher returned
**null on 9 of 9** while the CRLF form parsed all nine to non-zero counts. So the CRLF trap is LIVE
on this corpus, the §9.3 bullet landed 2026-09-10T08:5xZ passes its falsifying probe, and this
headline was computed with the sound parser rather than inheriting the broken one's identical number.

**Clone and worktrees.** [MEASURED], read-only git only. Clone on `main` at `e4ecd9a5`, **2 commits
behind** `58a947fe` (`merge-base --is-ancestor` → 0). Untracked: `docs/pr-reviews/pr-1850-review.md`
and `pr-1852-review.md` — review-lane output sitting in the clone home only (§9.5 three homes).
**Stash count 71** (the closed loop: the launcher preflight stashes, nothing pops). Orphaned
worktrees: `C:/po-vg` age **9016 min** holding one untracked file
`scripts/pipeline/check-pipeline-heartbeat.mjs`; `C:/po-worktrees/pr1823` age **958 min**, clean.

**VM git guard — install FAILED, quoted.** PREFLIGHT asks for the installer's last line pass or
fail. There is no last line: the workspace itself never came up.

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/.../uploads as uploads: source path ... is under Plan9 share "c"
which is not mounted; create: RPC error -1: ensure user: dazzling-upbeat-lovelace already exists
unexpectedly: uid=1981 gid=1981
```

Per PREFLIGHT this is a FINDING, not a STOP, and the run carried on. ⚠️ The hazard the guard exists
to remove is **moot this run in the safe direction**: the guard refuses VM-side `git` against a
mounted folder, and the VM is unreachable, so no VM-side `git` was possible at all. No `git` was run
through the device bridge.

## WHAT CHANGED

**On the board: nothing.** No merge, no arm, no label, no rename, no dispatch file, no `sot/` edit.

**In the repo:** this breadcrumb, written inside this run's own PR worktree
(`C:\po-wt\bc-00-1408`, branch `docs/00-collect-1408` off `origin/main`) — cure 1 of the
delete-the-disk-copy rule, so no loose untracked copy is left in the dev tree and the next
fast-forward cannot be blocked by one.

**In the dev tree:** two scratch captures and one probe script were written at the tree root
(`.sweep-00-2026-09-10.txt`, `.sweep2-00.txt`, `.triage-00-2026-09-10.txt`, `.scope-probe-00.mjs`).
They are untracked, they are NOT breadcrumbs, and they are named here so the next run knows they are
mine and disposable. The dev tree's index was **clean before and after** — `git diff --cached
--name-status` EMPTY on both readings, and nothing of mine was staged there.

## FINDINGS

**F1 — Every arm available today lands on Marco, and four of his PRs are already green and
waiting. `TESTS-DOCS ELIGIBLE = 0 of 9`.**
The pipeline is not blocked: the watcher builds, CI greens, the `tests-docs` lane works. The board
is throughput-blocked at exactly one place — the human gate — and arming a tenth prompt would make
that worse, not better, by adding a **sixth** PR to a queue of five that only Marco can clear. This
is the first run to measure the eligibility per-prompt with the sound CRLF parser and to name the
disqualifying path for each: **3 of 9 are `migrations/`, 6 of 9 are `apps/**` or `.github/`.** That
distribution is the useful part — it says the starvation is structural in what remains to be built,
not an accident of which nine happened to clear their gates.
**DISPOSITION: DEFERRED.** Deliberately did not arm. What would make it urgent: any HOLD reaching
`ADMIT` whose `scope:` is confined to `tests/`, `docs/`, `__tests__/` or `*.test|spec.*` — that one
should be armed immediately, because it is the only kind that can merge without Marco. The standing
escalation this sharpens is the tests-docs starvation already on file; it needs no new file.

**F2 — Three stations fired inside 165 seconds again, and this run overlapped two live ones.**
`00` 14:08:10Z · `04` 14:09:49Z · `05` 14:10:55Z, corroborated by the sweep's independent
`headless claude-code sessions: 3`. This is the already-escalated cron collision reproducing, and it
is the **three-station midnight-local case** (14:08Z = 00:08 Brisbane). `STATION-CAPABILITIES.md` §6
records that moving `05` de-collides only this case and that the two-station `00`×`04` overlap
recurs on **every one of 04's six daily runs** by construction — so the ask is two offsets, not one.
Both crons live in the scheduled-tasks layer, which is Marco's, not this repo's.
**DISPOSITION: ESCALATED — already on file, re-confirmed with today's numbers.** No new escalation
file: a second one would split the evidence. What this run adds is that the overlap is no longer
theoretical for 00 — condition 3 of BOARD DRIVING had to be re-measured mid-run because of it, and
it held (`SAFE TO ACT` at both 14:09:21Z and 14:15:32Z, index clean, 0 git processes).

**F3 — The VM workspace did not come up, so `vm-git-guard.sh` could not be installed.**
Quoted in full above. Not a stop, and not a licence to run `git` through the bridge — none was run.
**DISPOSITION: DEFERRED.** It is infrastructure outside this repo and the guard's hazard is moot
while the VM is unreachable. What would make it urgent: the VM coming back **without** the guard
installed, which is the state the guard exists for. Any run that finds `bash` working should install
it first and quote the last line, pass or fail.

**F4 — The watcher clone is 2 behind, holds 71 stashes, and is the only home for two review
verdicts.** `e4ecd9a5` vs `58a947fe`; untracked `pr-1850-review.md` and `pr-1852-review.md`;
stash count **71**, up from the 69 last recorded — the closed loop is still accumulating.
⚠️ The two review files do **not** unblock anything: both PRs carry live `marco:true` verdicts, and
RULE 2 is not cleared by a MERGE verdict.
**DISPOSITION: DISPATCHED → 03 (machine-minder), next run `2026-09-10T23:00Z`.** Three asks, and
they fold into the clone-hygiene dispatch 03 already carries: (a) fast-forward the clone — **only 03
may**, and 00's ABSOLUTE forbids `git merge` there for anyone else; (b) `git stash drop` the
accumulated stashes, **never `pop`**; (c) preserve the two untracked `pr-*-review.md` files across
any relaunch — the launcher's preflight stash is `--include-untracked`, so copy them out first.

**F5 — Two orphaned worktrees, one holding uncommitted work for 6.3 days.**
`C:/po-vg`, age **9016 min**, holds untracked `scripts/pipeline/check-pipeline-heartbeat.mjs` — a
file that exists nowhere else. `C:/po-worktrees/pr1823`, age **958 min**, clean, and its PR is still
open.
**DISPOSITION: DISPATCHED → 03**, same run. `po-vg` must not be pruned while that file is its only
copy: `git worktree remove` will refuse and `--force` would discard it. `pr1823`'s worktree is clean
and safe to prune, but `#1823` is open and under a `REJECT-AND-REDO` review, so leave it until that
PR settles.

**F6 — §9.3's CRLF front-matter trap is LIVE on today's queue, and its falsifying probe passes.**
The pre-correction matcher returned **null on 9 of 9** `ADMIT` prompts; the CRLF-explicit form
parsed all nine. The bullet landed at 08:5xZ today and is correct as written.
**DISPOSITION: ACTIONED — confirmed, no change needed.** Recorded because the bullet asks for
exactly this re-run and because a future reader meeting `scope=0` should now expect the parser, not
an empty scope.

## WHAT I DID NOT DO

**Merged nothing.** All five open PRs are Marco's — four by a live watcher `marco:true` verdict, one
(`#1852`) by hand-classification recorded as `[NO LANE VERDICT — hand-classified]`. RULE 2 is not
cleared by green, by CLEAN, by an empty label list, by a diff check or by a MERGE verdict, and only
Marco clears it, in chat, for that batch only.

**Armed nothing.** Not because nothing was `ADMIT` — nine were — but because 0 of the 9 can reach
the `tests-docs` lane, so every one of them would open a sixth PR that only Marco can merge. F1.

**Removed no label, and did not touch `#1823`.** It is unlabelled and still Marco's; its red is a
real `tendering-e2e` failure, not the parked `[LABEL_PRESENT]` shape; and it already carries a
`REJECT-AND-REDO` review plus an open escalation. Re-opening it would duplicate a disposition an
earlier run already made.

**Did not fix the clone, drop a stash, or prune a worktree.** Those are 03's lane and 00's ABSOLUTE
forbids `git merge` in the clone. Dispatched instead (F4, F5). Read-only git in the clone only.

**Wrote no receipt.** A scheduled run may never author a `merge-approvals/<N>.md`.

**Did not touch `/sot/`** (05's, and 05 was live while this run worked), Azure / Entra / SharePoint,
production data, or the never-arm denylist (`rates-s11c`, `pr-524`, `siteid-notnull-backfill`,
the `B-P0a`/`B-P0b` family) — all of which appeared in this run's reading and none of which was
acted on.

**Did not re-derive an escalation that already exists.** F1 and F2 both sharpen escalations already
on file; neither got a new `needs-marco/` file, because splitting the evidence across two files is
how the earlier ones became hard to clear.

**Did not archive anything.** The only unarchived root breadcrumb was my own 1308 one and its
findings were dispositioned by the run that wrote it; there was nothing this run had newly
dispositioned to move.

**Left the backlog's one `READY TO STAGE` item alone.** `rates-11c-blocked-consumers` is on the
never-arm denylist and its own note says it stays until its gate dies.
