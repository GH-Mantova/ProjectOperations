# Station 00 — Supervisor | 2026-09-07T01:08Z–2026-09-07T01:35Z

## GROUND

```
UTC            2026-09-07T01:08Z
origin/main    14c6810c  (at preflight; da432425 by 01:26Z — #1742 merged mid-run)
dev tree       main @ 14c6810c  C:\ProjectOperations2  (fast-forwarded this run from d202d5b1)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

**Device bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
last line, quoted: `persistence controls passed: .bashrc byte-identical on re-run; login shell
resolves shim`. Installed at `/sessions/eager-optimistic-maxwell/.local/bin/git`, both controls
passed.

**Which tree I read the binding documents in.** `C:\ProjectOperations2` (the dev tree), and I used
`git diff --numstat origin/main -- <path>` rather than a piped hash (PREFLIGHT step 2). Output was
**EMPTY** for all three of `docs/pipeline/DOCTRINE.md`, `docs/pipeline/STATION-CAPABILITIES.md` and
`docs/pipeline/stations/00-supervisor.md` — the working copies ARE `origin/main`'s blobs, so reading
them locally was sound. All three read in full.

## WHAT I MEASURED

**Sighted run.** [MEASURED] `start_process` shell `powershell.exe` returned
`2026-09-07T11:08:36.9497634+10:00`. Desktop Commander present. Not blind.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, captured to a file (it returns early and
hides its own §7 verdict when read inline). 01:10:30Z verdict **SAFE TO ACT**; instrument positive
controls both passed (`gh` saw merged #1747, `node` runs). Re-run at 01:28Z returned **CAUTION — a
PR was touched on GitHub in the last 2 min**; I waited and re-ran at 01:31Z, which returned
**SAFE TO ACT**, and only then mutated anything.

**Watcher.** [MEASURED] `scripts/restart-watcher-if-wedged.ps1` → `VERDICT: HEALTHY - no action.`
node pid 31660, wrapper alive, restart churn 0 in 20 min, queue last moved 43 min ago, heartbeat
38 min. **Not wedged, and I did not restart it.**

**The armed queue.** [MEASURED] exactly **one** `*-ready.md` on disk at 01:12Z:
`fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md`. `lint-prompt.mjs` on it → **`ADMIT (size 3)`**,
exit 0.

**The watcher's own transcript — chosen by mtime, never by constructing a date name** (DOCTRINE §9.5).
[MEASURED] newest `*.log` in `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs` at 01:18Z was
`supervisor.log`; the newest *watcher* log was `2026-09-07.log`. `supervisor.log` had been repeating,
every two minutes since 00:21Z:

```
WATCHDOG armed=1 runnable=0 -- nothing this node can dequeue; a stale heartbeat is legitimate idle.
```

**RULE 2 probe, with controls and the freshness precondition asserted.** [MEASURED] over
`C:\ProjectOperations2\docs\pr-prompts\processed` (the LIVE tree, never the clone) — 2022 logs, 856
`pr-*.log`, newest `rev-1747-ready.md.log` at `2026-09-07T00:35:34Z`, which is **younger** than the
oldest open PR (`#1740`, created `2026-09-06T23:02:21Z`), so the probe is in date. Matching
`PR #<n>` in the BODY of `pr-*.log` only (excluding `rev-*`, DOCTRINE §9.5):

| PR | prompt logs | verdict |
|---|---|---|
| `#1740` | 1 | `{"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` |
| `#1742` | 1 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/arm-prompt.ps1"}` |
| `#1746` | 0 | `[NO LANE VERDICT — hand-classified]` |
| `#1745` | 0 | (merged before this run) |
| `#999999` — NEGATIVE control | 0 | |

POSITIVE control: `"marco":true` present in **619** prompt logs. Fresh NEGATIVE needle
`zzQq00Needle20260907T0115` → **0** (minted this run; now spent).

**`#1746` hand-classified** under §10.1 step 2: it carries the `do-not-merge` label (measured via
`gh pr view 1746 --json labels`) and touches `migrations/`, which `classifyPolicyFiles` refuses on
its own clause. **Marco's.**

**CP-26 on the two red PRs — read from the job log, never the PR page** (DOCTRINE §3).
[MEASURED] `gh run view --job <id> --log`:

- `#1746` → `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
  (escalates:true). A human must review and REMOVE the label`. **Correct by design, not a defect.**
- `#1740` → `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1740 was labelled do-not-merge
  and released, but docs/decisions/merge-approvals/1740.md is not in this PR's diff`.
- On BOTH, `PR gates — diff checks` carries the identical CP-26 text. **One cause, two reds** —
  the known coupling. Do not diagnose the second red separately.

**`#1740`'s label timeline.** [MEASURED] `gh api .../issues/1740/timeline`:
`labeled do-not-merge 2026-09-06T23:03:01Z` · `unlabeled do-not-merge 2026-09-06T23:53:21Z`, both
`actor=GH-Mantova`. **[CANNOT MEASURE] who released it** — every actor on this board authenticates
as `GH-Mantova`. `docs/decisions/merge-approvals/1740.md` is absent from `origin/main` entirely
(POSITIVE control: 37 other receipts are present there, `1745.md` among them).

**`#1742` merged mid-run**, `2026-09-07T01:15:55Z`, with `docs/decisions/merge-approvals/1742.md`
on `origin/main`. The receipt names its author: the supervised cloud lane (DOCTRINE §10.2.1),
under Marco's standing 2026-09-07 ruling *"the lane merges, but writes a receipt first"*.
**Do NOT re-raise this as an unattributable merge** — it is the ruled-on lane behaving as ruled.

**The board grew while I worked.** [MEASURED] at 01:26Z, `gh pr list --state open`: **6** open —
`#1740`, `#1746`, and four opened by the supervised lane between 01:20Z and 01:22Z (`#1748`,
`#1749`, `#1750`, `#1751`). All `BLOCKED`.

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`;
`structure: 1 checked, 0 malformed`; freshness `00 1.1h ok · 03 2.2h ok · 04 3.1h ok · 05 11.0h ok`.
Exactly **one** breadcrumb in the queue root — my own `…-0008-…`, whose findings were dispositioned
in `#1747`. **No 03 / 04 / 05 breadcrumb has arrived since my 00:08Z run**, so there was nothing
else to collect this cycle. ⚠️ `--freshness` still carries `'00': 2` in its `CADENCE` map against a
live hourly cron, so its `ok` for `00` is weaker than for any other station — the standing defect,
unchanged, not re-raised here.

## WHAT CHANGED

**One mutation, and it is the whole of this run's board action.**

`docs/pr-prompts/fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md`
→ `docs/pr-prompts/pr-fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md`

Renamed with `fs.renameSync` (the file is gitignored at `.gitignore:75`, so no git operation was
involved and none was appropriate). Read back: old path gone, new path present, **7103 bytes both
sides, `Buffer.compare` → 0**. Logged to `docs/pr-prompts/.arming-log.txt` as a `RENAMED` row naming
the reason and the actor.

**The read-back that matters is the watcher's, not mine.** [MEASURED] in
`…\logs\2026-09-07.log`, one second after the rename:

```
[2026-09-07T01:23:00.598Z] [fix-lane] pr-fix-1740-…-ready.md jumped to front (fixes PR #1740)
[2026-09-07T01:23:00.598Z] [queue]    pr-fix-1740-…-ready.md (depth: 1, source: watch)
[2026-09-07T01:23:00.966Z] [start]    pr-fix-1740-…-ready.md (max-turns=240)
```

The prompt had sat armed and untouched for **62 minutes**. It started **within one second** of the
rename. Nothing else about it changed.

Also this run: the dev tree was fast-forwarded `d202d5b1 → 14c6810c`
(`git rev-list --left-right --count HEAD...origin/main` → `0 0`; `git diff --cached --name-status`
→ EMPTY). The two ` D` consumed HOLDs (`pr-armguard-s1`, `pr-deps-s2-puppeteer`) were **left
alone** — their own PRs delete them.

## FINDINGS

### F1 — `arm-prompt.ps1` will arm a prompt the watcher can NEVER dequeue, and every other instrument calls that healthy

`scripts/pr-watcher/index.mjs` gates its queue on one constant:

```js
const READY_PATTERN = /^(pr|rev)-.*-ready\.md$/i;
```

`fix-1740-jest-cannot-parse-puppeteer-25-esm-ready.md` — staged by `#1744`, armed by my own 00:08Z
run at `00:20:55Z` — **does not match it.** [MEASURED] against that exact regex:
`fix-1740-…-ready.md` **NOMATCH**; `pr-fix-1740-…-ready.md`, `rev-1747-ready.md` and
`pr-armguard-s1-…-ready.md` all **MATCH**. `arm-prompt.ps1` (506 lines) does not mention
`READY_PATTERN` at all — POSITIVE controls `$PROMPT_DIR` → 3, `ARMED` → 1; NEGATIVE control
`zzQq00Needle20260907T0130` → 0.

**Every instrument except one reported this as fine, and the one that saw it dismissed itself.**

| instrument | reading | true? |
|---|---|---|
| `arm-prompt.ps1` | armed it, wrote the arming-log row | it did arm it |
| `lint-prompt.mjs` | `ADMIT (size 3)`, exit 0 | premise really is live |
| `status-sweep.ps1` §4 | `armed (*-ready.md): 1` | counts the file, not its reachability |
| `restart-watcher-if-wedged.ps1` | `HEALTHY - no action` | the watcher IS healthy |
| watchdog | `armed=1 runnable=0 — nothing this node can dequeue` | **the only true reading** |

The watchdog line is the measurement, and it ends with *"a stale heartbeat is legitimate idle"* —
so the instrument that alone could see the fault explains it away in the same sentence. This is
DOCTRINE §7's shape: a coherent, confident, wrong picture of a working system.

**Blast radius, measured, not assumed.** POSITIVE control: 1777 `pr-*` entries in `processed/`. The
only two `fix-*` entries there are `*-already-done.md` marker files, never `-ready.md` — so **no
`fix-*` prompt has ever been dequeued in this repo's history**, and this failure has no precedent
only because no one had used the prefix before.

**Cost of not seeing it:** `#1740` — a GHSA security bump — would have stayed red indefinitely while
the board reported one prompt in flight. My own 00:08Z breadcrumb said *"the 1740 fix is armed"*,
which was true and useless.

**DISPOSITION: ACTIONED.** Renamed to `pr-fix-1740-…-ready.md`; verified by the watcher dequeuing
and starting it one second later (quoted under WHAT CHANGED). The permanent guard is staged, not
armed, as `docs/pr-prompts/pr-armguard-s2-refuse-a-name-the-watcher-can-never-dequeue-HOLD.md` in
this PR — a natural second slice on the script `#1742` just hardened. **I did not arm it: one
prompt is running, and RULE 4 is one at a time.**

### F2 — `#1740` cannot go green on the armed fix alone, and the next run must not read that as a new defect

`#1740` has **two independent reds**, and my armed fix addresses only one of them.

1. `API — lint, test, compliance smoke` — Jest cannot parse ESM-only puppeteer 25. This is what
   `pr-fix-1740-…` is building right now.
2. `Approval receipt (CP-26)` → `RELEASED_NO_RECEIPT`, with `PR gates — diff checks` red on the
   same cause. The `do-not-merge` label was applied `23:03:01Z` and removed `23:53:21Z`, and no
   `docs/decisions/merge-approvals/1740.md` was ever committed.

**Only a human act clears (2).** I may not perform it: the standing rule is that no scheduled agent
authors a `merge-approvals/<N>.md`, and Marco's 2026-09-07 ruling relaxes that **for the supervised
cloud lane only** — which is not this lane. So when the jest fix lands and `#1740` is still red, that
is **this**, not a failed fix.

RULE 1 options, complete-and-additive first:

- **(a)** The supervised cloud lane drives `#1740` the way it drove `#1742` — its instrument
  (`bd-push-slice.ps1`) writes the receipt into the PR branch before arming auto-merge, so the
  signature exists and CP-26 turns green. *Complete* (the PR merges and the record shows who
  released it) and *additive* (nothing is deleted or weakened). **Costs nothing new — it is the
  path the lane already takes.**
- **(b)** Marco commits `docs/decisions/merge-approvals/1740.md` on the branch by hand. Complete,
  additive, but spends Marco on something an instrument already does.
- **(c)** Re-apply the `do-not-merge` label. Fails the *complete* half outright: CP-26 would simply
  return `LABEL_PRESENT` and the PR stays red, with the release history now also muddled.

**DISPOSITION: ESCALATED.** Written to `docs/pr-prompts/needs-marco/` as
`pr-1740-released-with-no-receipt-2026-09-07.md`. RULE 2 binds regardless — `#1740` carries a
genuine watcher `marco:true` verdict, so it is not mine to merge at any greenness.

### F3 — the supervised cloud lane is mid-flight on four PRs; single-actor says I stand off the board

Between `01:20Z` and `01:22Z` the supervised lane opened `#1748`, `#1749`, `#1750`, `#1751` and
merged `#1742` at `01:15:55Z`. BOARD DRIVING condition 3 — *"first confirm nothing else is
mid-mutation… If something else is acting, STOP"* — is the load-bearing one, and it is exactly met.

There is also a measured harm in acting: `pollForBehindPrs` rebases **every** open PR ~3.5 min after
any board PR merges (the open escalation from `#1738`). With six PRs open and four of them inside
their first CI cycle, merging my own board PR now would churn all of them mid-flight.

**DISPOSITION: DEFERRED.** I opened this board PR and deliberately did **not** merge it and did not
enable auto-merge. What would make it urgent: the lane going quiet, or this breadcrumb still
unlanded at the next collect.

## WHAT I DID NOT DO

- **Merged nothing.** `#1740` and `#1746` are both Marco's (`marco:true`, and a `do-not-merge`
  label plus a `migrations/` path respectively). `#1748`–`#1751` belong to a lane that is actively
  driving them.
- **Armed nothing.** One prompt is running; RULE 4 is one at a time. The `armguard-s2` guard ships
  as a `-HOLD.md`.
- **Did not author any `merge-approvals/<N>.md`.** Not this lane's to write, at any greenness.
- **Did not restart the watcher** — `HEALTHY`, and the idle was real: it had nothing it could
  dequeue, which is F1, not a hang.
- **Did not touch `C:\po-vg`** (orphaned worktree, 65 h, 1 dirty file, commit on no remote branch) —
  already dispatched to Station 03 and it holds uncommitted work.
- **Did not touch the watcher clone's `dirty=1`** — Station 03's lane.
- **Did not clear the `[STALE]` `needs-marco/` rows** the sweep lists every run, including
  `agent-authored-rule-2-clearance-2026-09-04.md`, which must not be cleared on a `[STALE]` line.
  `#1750` — opened by the supervised lane at `01:21Z` — is a fix for that sweep behaviour itself.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
