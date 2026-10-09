# Station 00 — Supervisor | 2026-09-25T03:14Z–2026-09-25T03:40Z

## GROUND

```
UTC            2026-09-25T03:15:06Z
origin/main    b9e01c91            (fetched, then rev-parse)
dev tree       main @ 1e5f3f11  C:\ProjectOperations2   (3 behind at start; b9e01c91 == origin/main at end)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

Binding documents read from the dev tree working copy after proving it byte-identical to
`origin/main`: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY. That is the
sanctioned comparison form (no pipe, no re-encode), so the working copy is the same text
`git show origin/main:` would have produced.

## WHAT I MEASURED

**[MEASURED] The box is reachable. This was not a blind run.** `start_process` (shell
`powershell.exe`) returned `SHELL_OK 2026-09-25T13:14:42+10:00`. Desktop Commander ids were
resolved by keyword `ToolSearch` for `desktop-commander`, not assumed. Saying so loudly because the
two runs before mine — `00-00-supervisor-2026-09-24-2315-blind-no-windows-shell` and
`00-04-scanner-2026-09-25-0211-blind-no-windows-shell-desktop-commander-absent` — were both blind,
and a blind run and a healthy quiet run produce the same "no news".

**[MEASURED] vm-git-guard: exit 2, INSTALLED BUT INERT.** Last line verbatim:
`PATH="/sessions/fervent-friendly-clarke/.local/bin:$PATH" git <args>`, above it
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
`GUARD_EXIT=2`, read from the installer itself and not from a pipeline appended to it. Expected
outcome for a station; a FINDING, not a STOP. No `git` was run against the mount this run — every
git call went through the Windows shell.

**[MEASURED] Board: 5 open PRs, and all five fail the SAME single gate.**

| PR | branch | labels | mergeState | failing checks |
|---|---|---|---|---|
| #2189 | feat/watcher-adopt-ancestry-and-sweep-anomaly | `do-not-merge` | BLOCKED | CP-26 x2 |
| #2184 | fix/s8i-travel-index-reset-and-tip-dailykm | `do-not-merge` | BLOCKED | CP-26 x2 |
| #2183 | feat/sec-a1-auth-fail-fast | `do-not-merge` | BLOCKED | CP-26 x2 |
| #2167 | fix/verdict-guard-spaced-path-candidates | `do-not-merge` | BLOCKED | CP-26 x2 |
| #2158 | feat/fv2-formrule-contract-drop | `do-not-merge` | BLOCKED | CP-26 x2 + tendering-e2e |

Read from the JOB LOG, never the diff or the PR page (run `36087159349`, jobs `107921508202` and
`107921508074`):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
       A human must review and REMOVE the label; removing it is what releases the merge.
FAIL - CP-26 do-not-merge [...]
```

Everything else in that job PASSES or SKIPS — CP-11, CP-12, CP-13, CP-17, CP-23, CP-24, CP-25 all
PASS. **The two red checks are one gate reported twice.** "13 pass / 2 fail" reads like two defects
and is zero defects. No open PR carries a code fault.

**[MEASURED] `main` CI is red on one job only, and it flaps.** `Tendering Browser Smoke`:
`failure` on b9e01c91, `success` on 5045e81d, `failure` on de63eb78 — all three are docs-only
station-00 breadcrumb commits, which cannot break a browser smoke. Flake, consistent with the
01:14Z run's F1. `CI`, `Deploy` and `Push on main` are green on b9e01c91.

**[MEASURED] #2158's third failure is the dashboard e2e batch, and the duplicate-key line is the
mechanism, not a red herring — but it is still a flake.** 4 failed, all dashboard
(`see-widgets-on-canvas`, `see-its-chart-title`, `download-Content-Disposition`), each
`expect(locator).toBeVisible() failed / element(s) not found`, alongside
`ERROR: duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"`
three times. The same batch is green on #2184 and #2183 right now, so it is intermittent rather
than broken. Re-run dispatched (`gh run rerun 36087173127 --failed`, exit 0); IN_PROGRESS at
write-time.

**[MEASURED] The dev tree could not fast-forward, and not one of the contract's four probes could
see why.** At 03:15Z the dev tree was 3 commits behind with three tracked paths dirty. All three
turned out to be content-identical to what `origin/main` already holds:

- `docs/pr-prompts/pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md` — deleted locally, and
  `git ls-tree origin/main` says GONE FROM MAIN: the retirement had already landed.
- `docs/pr-prompts/.arming-log.txt` — local last line byte-equal to main's last line (`same=True`).
- `docs/data-model/metadata-catalog.json` — see the next finding.

I restored all three byte-exactly from `HEAD` with the raw-Buffer node write the contract
prescribes (`fs.writeFileSync(abs, execFileSync('git', ['show', 'HEAD:' + rel]))`) — never
`git checkout -- <path>`, never `git clean`. Two cleared. Then `git merge --ff-only origin/main`
still refused:

```
error: The following untracked working tree files would be overwritten by merge:
        docs/pr-prompts/00-04-scanner-2026-09-25-0211-blind-...-absent.md
        docs/pr-reviews/pr-2119-review.md   ... 13 more pr-NNNN-review.md ...
Please move or remove them before you merge.
```

**Fifteen UNTRACKED files at paths `origin/main` creates.** `git rev-list --left-right --count`,
`git diff --numstat`, `git diff --cached --name-status` and `git status --porcelain
--untracked-files=no` were all consulted and **none of the four reports an untracked file** — the
fourth is scoped `--untracked-files=no` by the contract's own wording. Audited each against the
blob main would write there: **14 byte-identical, 1 differing.**

**[MEASURED] `docs/data-model/metadata-catalog.json` reads ` M` in three independent trees and is
modified in none of them.**

| tree | `git status` | working blob (clean filter) | HEAD blob |
|---|---|---|---|
| `C:\ProjectOperations2` | ` M` | `a09a95bd` | `a09a95bd` |
| `C:\po-worktrees\sup-cwd-paths` | ` M` | — | — |
| `C:\po-watcher\ProjectOperations` | ` M` | `a09a95bd` | `a09a95bd` |

`git diff --numstat -- <path>` is EMPTY in the dev tree; `git diff --numstat HEAD origin/main --
<path>` is EMPTY, so main does not touch it. `.gitattributes` carries `* text=auto` with no rule
for `*.json`, and git warns `LF will be replaced by CRLF the next time Git touches it` on every
read. The stored blob is LF, the checkout convention is CRLF, and the stat cache can never settle.

**[MEASURED] Two supervisors, one watcher node — 03's F1–F4 reconfirmed with parentage and start
times.**

```
WRAPPER pid=30116 ppid=14324 started=2026-09-20T21:14:02Z
WRAPPER pid=1724  ppid=37808 started=2026-09-24T07:35:03Z
NODE    pid=42212 ppid=44740 started=2026-09-24T07:35:07Z
```

Wrapper 1724 precedes the live node by 4 seconds and is the one supervising it. Wrapper 30116 has
been up since the twentieth and supervises nothing while holding kill authority. `status-sweep.ps1`
prints `auto-restart wrapper: alive (2)` and presents that as health.

**[MEASURED] Section 5 of the sweep produced ZERO `[STALE]` rows this run.** Every needs-marco line
reads "cites #N (MERGED) as evidence -- not its premise; does not clear the escalation". Nothing to
discharge. (2026-09-10 had eleven.) 48 escalation files, unchanged.

**[MEASURED] Queue: armed=0, 14 `-HOLD.md` in the root, needs-marco=48, no-pr-opened=111,
failed=61, blocked=153.** Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`; the one READY
item is `[P2] rates-11c-blocked-consumers`.

**[MEASURED] Sweep verdict: SAFE TO ACT** — no board mutation in progress, no live station
worktrees, `git index.lock` absent in both trees, 0 scoped git processes.

**[INFERRED] Two findings I nearly filed and retracted, both §7 instrument lies in my own favour.**
(1) `check-breadcrumb --freshness` reported `00 last 2026-09-25T02:15:00Z` while the newest 00
breadcrumb I could see on disk was dated `0014`; the 0215 file existed on `origin/main` and not in
my 3-behind tree. The tool was right. (2) It called three breadcrumbs `UNTRACKED — it reaches
nobody`; all three are archived on main, byte-identical (`5c437893`, `59d6f9a8`, `e3719158`), and
`git ls-tree HEAD` confirms they were archived in a commit my tree did not yet have. Re-running the
same command after the fast-forward: the three NOTEs are **gone**, `structure: 2 checked, 0
malformed`, `CLEAN`, exit 0. No lost reports and no tool defect — my dev tree was the faulty
instrument in both cases.

## WHAT CHANGED

1. **Fast-forwarded the dev tree, `1e5f3f11` -> `b9e01c91`.** Read back all four probes:
   `git rev-list --left-right --count HEAD...origin/main` -> `0 0`; `--numstat` EMPTY; `--cached`
   EMPTY; `git status --porcelain --untracked-files=no` -> the single CRLF false-positive below, and
   nothing else. `git merge --ff-only origin/main` now answers `Already up to date.`
2. **Cleared 15 untracked FF blockers.** 14 deleted only after proving each hash-equal to the blob
   `origin/main` writes at that path, so the fast-forward recreated them byte-for-byte — net content
   change zero. Done from an explicit audited list generated by git's own refusal, not `git clean`.
3. **Preserved the one blocker that differed**, `docs/pr-reviews/pr-2164-review.md`
   (`56307b96`, `VERDICT: BLOCK`), copied to
   `C:\ProjectOperations2\tmp-outputs\superseded-untracked-2026-09-25\` with a post-copy byte
   comparison before the original was removed. Verified still present and still `VERDICT: BLOCK`.
4. **Re-ran #2158's failed jobs** (`gh run rerun 36087173127 --failed`, exit 0).
5. **Created `C:\po-wt\st00-0315`** off `origin/main` to hold this breadcrumb (Cure 1).

Nothing was armed. No label was added or removed. Nothing was merged. No `/sot/` file was touched.

## FINDINGS

### F1 — The fast-forward was blocked by fifteen untracked files, and the contract's four-probe read-back is structurally incapable of seeing them

The contract says of the four probes: *"The first three pass on a dirty tree; only the fourth
catches it."* The fourth is `git status --porcelain` — specified with `--untracked-files=no`. Every
one of the fifteen blockers was **untracked**, so all four probes read PASS while `git merge
--ff-only` refused. This is worse than the tracked case the cure was written for: a station
following the read-back exactly concludes the tree is clean and cannot discover otherwise short of
attempting the merge. Fourteen were byte-identical duplicates of blobs already on main — the rev
lane and the breadcrumb sweep both write into the dev tree at paths a later PR then creates.
The discriminator that works is the refusal itself: attempt `git merge --ff-only`, parse the paths
out of the error, and hash each against `git rev-parse origin/main:<path>`.

**ACTIONED** — dev tree fast-forwarded to `b9e01c91`, all four probes plus a fifth re-attempt read
clean (`Already up to date.`). The instrument gap is real and outlives this run: the contract's
read-back list needs a fifth probe. Left as a finding for a single PR touching all seven station
docs, because the four-probe list lives inside the canonical station-contract block that
`lint-station.mjs` requires byte-identical across all of them — it cannot be changed in one file.

### F2 — `metadata-catalog.json` reads dirty in every tree on the box and is modified in none, which makes one sweep line a permanent false alarm

Same blob `a09a95bd` in the working copy and at `HEAD` in the dev tree, the `sup-cwd-paths`
worktree and the watcher clone; `git diff` empty in all three; `.gitattributes` has `* text=auto`
and no `*.json` rule, so an LF blob on a CRLF checkout never settles. The consequence is not
cosmetic: `status-sweep.ps1` prints `watcher clone: branch=main dirty=1 <-- NOT clean-on-main; the
watcher may refuse to start` on **every** run, and that warning is false and has always been false.
It invites exactly the destructive response — a reset or a clean in the watcher clone — that
DOCTRINE §9.2 records as having cost the overnight queue. It also means the contract's fourth probe
can never read empty in any tree, so the documented clean-tree read-back is unsatisfiable as
written. This also accounts for the tracked half of 03's F6.

**DISPATCHED -> Station 01** — add a `*.json text eol=lf` rule (or `-text` on this path) to
`.gitattributes` and re-commit the file normalized; acceptance is `git status --porcelain` empty on
a fresh clone and on the dev tree. The fix touches a checked-in artefact and a repo-wide attribute,
so it goes through a prompt and a PR, not my hands.

### F3 — The whole open board is parked on `do-not-merge`, five for five, and nothing an agent may do releases it

Confirmed from the gate's own verdict token (`LABEL_PRESENT`) and the label list on each PR, not
from red counts. Removing that label is the release path and is forbidden to me. The board has not
grown a code defect: every other CP check passes on every PR. This is the throughput constraint
stated exactly — 00 can arm, the watcher can build, CI can green, and then every PR stops. Already
on file three times over (`five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`,
`three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md`,
`label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md`) and by my predecessor at
02:15Z. I am adding a count, not a new file — a fourth escalation document for one question is
noise.

**ESCALATED** — the question for Marco is in `## FOR MARCO` below.

### F4 — The `pr-2164` BLOCK verdict in the dev tree is a superseded draft, not a lost blocking review

The dev tree held `VERDICT: BLOCK` (written 2026-09-24T12:55:23Z) while `origin/main` holds
`VERDICT: MERGE`, for a PR that merged at 2026-09-24T23:33:42Z — a shape that reads, at a glance,
like a blocking verdict that was overridden and then papered over. It is not. The BLOCK's stated
cause was a hard-coded `#0369a1` in `ScopeWasteTab.tsx:~768` failing the hex ratchet; main's MERGE
verdict records commit `beb3894f` fixing 40 such literals. Falsifying probe on `origin/main`:
`#0369a1` occurrences = **0**, with `var(--` = **144** in the same file as a positive control that
the read was not vacuous. The BLOCK was answered before the merge. Preserved anyway, unread by
anything, in `tmp-outputs/superseded-untracked-2026-09-25/`.

**ACTIONED** — measured, refuted as a governance failure, and the artefact preserved rather than
deleted. It is still evidence for my predecessor's F3 (the verdict channel has no sweeper): a
reviewer's intermediate verdict sat untracked in the dev tree for 15 hours and, being untracked,
was invisible to every station and to CI, and it happened to be the one file that blocked the
fast-forward for everyone.

### F5 — Two supervisor wrappers are live; one has supervised nothing since 2026-09-20 and still holds kill authority

Reconfirmed independently of 03 with parentage and start times (above). #2189 is the fix — `adopt`
proves ancestry, `WATCHDOG` carries a PID, the sweep flags 2+ wrappers — and #2189 is itself parked
on `do-not-merge`. So the instrument that would report this honestly is behind the same gate as
everything else. I did **not** relaunch or kill anything: `wrapper=0` is the reading my station doc
tells me to treat as a question, and `wrapper=2` with a resolved parent chain is not a fault I may
fix by killing a process — that is 03's lane and 03 has already reported it.

**DISPATCHED -> Station 03** — already its finding (F1–F4 of
`00-03-machine-minder-2026-09-24-2320-...`); I am adding the parentage and start-time evidence and
the observation that its remedy is gated behind #2189's label. Nothing new for 03 to do beyond what
it has queued.

### F6 — Zero `[STALE]` escalation rows this run

Section 5 tagged nothing `[STALE]`; all 48 needs-marco files cite merged PRs as evidence rather
than premise. The eleven dead rows of 2026-09-10 stay cleared. Falsifying probe available: re-run
the sweep and read section 5.

**ACTIONED** — nothing to discharge; recorded so the next run can tell a clean result from an
unchecked one.

## WHAT I DID NOT DO

- **Did not remove any `do-not-merge` label, and did not merge anything.** Absolute, and the
  reason the board did not move this run.
- **Did not arm the one READY backlog item** (`rates-11c-blocked-consumers`). Five PRs are parked
  on a human gate and `armed=0`; arming a sixth lengthens a queue that cannot drain. My own station
  doc records this exactly: *"Arming faster makes the queue longer, not shorter."* It becomes the
  right move the hour the label question is answered.
- **Did not touch Azure, Entra or SharePoint.** Not reached, not considered.
- **Did not edit `/sot/`.** Two of the findings above want doc changes; both are left for the
  stations that own those files.
- **Did not hand-edit the canonical station-contract block** to add F1's fifth probe. It is
  byte-identical across seven station docs and gated by `lint-station.mjs`; changing one copy
  breaks CI. It needs one PR touching all seven.
- **Did not prune the orphan worktrees** (`fv2drop`, `s8h`, `s8i-fixforward`, `sec-a1`,
  `stage-formrule-web`) or the dirty `sup-cwd-paths`. 03's lane, 03's finding, and `sup-cwd-paths`
  holds an untracked `pr-body.md` that is nobody's to discard.
- **Did not diagnose the `tendering-e2e` dashboard failure as a defect.** Re-run first, per the
  transient rule; it was still IN_PROGRESS when I wrote this. If it comes back red on a clean
  re-run, the `user_dashboards_user_id_slug_is_system_key` duplicate-key race is the place to start
  and it is a real lead, not the red herring an earlier run called it.
- **Did not run `git` against the mounted folder** from the VM shell, the guard being INERT.

## FOR MARCO

**One question, and it is the same one four escalation files already ask — I am answering "how many
is it now", not adding a fifth file.**

All five open PRs (#2158, #2167, #2183, #2184, #2189) are green on every check except the
`do-not-merge` label gate, which only you can release. `armed=0`. Nothing else is wrong with them.

Complete-and-additive first, per RULE 1:

1. **Give the release path an actor an agent can satisfy — a signed approval receipt, checked in.**
   CP-26 already describes it in its own failure message: commit
   `docs/decisions/merge-approvals/<pr>.md` with `approved_by` / `approved_at` and a reason. If a
   receipt you author is *sufficient* to release a PR — so the label stops being the only key — you
   approve once per PR, in the repo, and every station can read the decision afterwards. Solves it
   immediately (the five drain as you write receipts) and in future (the channel has a record and a
   sweeper can audit it), and damages no data entry: it is additive, and the label stays available
   for anything you want hard-stopped. **This is the only option that passes both halves.**
2. **Review and unlabel the five by hand, now.** Immediate, and changes nothing about future runs —
   fails the "future" half. Expect the same report next week.
3. **Narrow what sets `escalates:true`**, so routine work never acquires the label. Cheaper per PR,
   but it fails the "without damaging" half in the direction that matters: it releases work by
   *lowering* the gate rather than by recording a decision, and the prompts currently marked
   `escalates:true` include a production-auth change (#2183 SEC-A1) that genuinely wants you.

Separately and much smaller — **F2 is a one-line `.gitattributes` fix** that stops
`status-sweep.ps1` telling every future station the watcher clone is dirty and may refuse to start.
No decision needed from you. Flagging it only because that false warning invites a destructive
"fix" in the watcher clone, which is how the overnight queue was lost once before.
