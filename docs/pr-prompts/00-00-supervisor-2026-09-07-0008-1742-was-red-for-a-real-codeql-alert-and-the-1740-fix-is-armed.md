# Station 00 — Supervisor | 2026-09-07 00:08Z–00:25Z

## GROUND

```
UTC            2026-09-07T00:08:41Z
origin/main    b6b7688d            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ b6b7688d     C:\ProjectOperations2   (rev-list --left-right --count = 0  0)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file) — MATCH, full authority
```

Sighted run. `start_process` on `powershell.exe` returned
`HOSTOK … 2026-09-07T00:08:41Z` on the first call — Desktop Commander present, not blind.

**vm-git-guard installer, last line, quoted as the contract requires:**
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
(and `vm-git-guard installed at /sessions/<id>/.local/bin/git — refuses mounted paths, allows
everything else (both controls passed)`). PASS.

**Which tree I read the binding documents in:** the dev tree `C:\ProjectOperations2`, after
`git fetch origin --prune`. I did not read them in the watcher clone.
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY** for all three, which is the sound form
(PREFLIGHT step 2 — no piped hash was taken anywhere in this run). All three read in full.

## WHAT I MEASURED

**Board.** [MEASURED] `status-sweep.ps1` 00:10:25Z and again 00:18:25Z, both captured to a file so
the §7 verdict could not be lost to an early return. Instrument controls green
(`gh CAN reach GitHub (saw merged PR #1744)`, `node runs`). First sweep: `SAFE TO ACT`. Second
sweep: `CAUTION: 1 LIVE STATION WORKTREE C:/po-worktrees/armguard-cq` and
`remote board activity in last 2 min: #1742` — **both signals were my own** (my disposable worktree
and my own push, seconds earlier). I tore the worktree down before arming rather than reasoning past
the caution.

**Open board: 2 PRs, and BOTH are Marco's.** [MEASURED] RULE 2 probe run in the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed`, prompt logs only (`pr-*` / `fix-*`, excluding
`rev-*` per DOCTRINE §9.5), matching `PR #<n>` in the log BODY:

| PR | probe result |
|---|---|
| `#1742` | `merge result for PR #1742: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/arm-prompt.ps1"}` |
| `#1740` | `merge result for PR #1740: {"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` |
| `#1744` (board PR the watcher did not open) | **0** — the prescribed positive-that-must-be-empty control: `NO LOG` means second lane, not broken probe |
| `#999999` | **0** — negative control |

Corpus 2020 logs, 856 prompt logs, newest `2026-09-06T23:41:47Z` — **younger than the `createdAt` of
both open PRs**, which is the freshness assertion that separates the live directory from the
17-day-dead decoy in the watcher clone. **Neither PR may be merged by me.**

**#1742's single red was a real CodeQL alert, not a flake.** [MEASURED] `gh pr checks 1742` at
00:12Z: 14 pass, 1 fail — `CodeQL fail 2s`. A 2-second failure reads like infrastructure; it is not.
`gh api repos/.../check-runs/101579258362` → `title: "1 new alert including 1 high severity security
vulnerability"`, app `github-advanced-security`. The annotations endpoint named it exactly:

```
scripts/pipeline/__tests__/arm-prompt.test.mjs:964 [failure]
Incomplete string escaping or encoding :: This does not escape backslash characters in the input.
```

⚠️ `gh api .../code-scanning/alerts` returned **HTTP 404** for this token, twice, in two query
forms. The check-run **annotations** endpoint answered fully. [CANNOT MEASURE] the alert via the
code-scanning API from this station; do not read that 404 as "no alerts".

The line: `assert.match(line, new RegExp(\`forced_past=[^\\s]*${other.replace(/-/g, "\\-")}\`), …)`
— a regex built out of the prompt slug, escaping `-` and not the backslash.

**#1740 is red for the structural reason Station 06 measured**, and only one of its three reds is a
defect: `API — lint, test, compliance smoke` (Jest cannot parse puppeteer 25's ESM graph);
`Approval receipt (CP-26)` and `PR gates — diff checks` are the `do-not-merge` label and its known
coupling, not separate faults.

**Queue.** [MEASURED] `armed (*-ready.md): 0` at both sweeps, before I armed. Counted myself with
`ls *-ready.md` at depth 1: zero before, exactly one after, and that one is the prompt I armed. No
`rev-*-ready.md` was present to inflate the count.

**Freshness.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0,
`CLEAN`, `structure: 6 checked, 0 malformed`. `00` 1.1 h · `03` 1.2 h · `04` 2.0 h · `05` 10.0 h,
all `ok`. ⚠️ `00`'s row is the weak one — `check-breadcrumb.mjs`'s own `CADENCE` map still carries
`'00': 2` against a live cron of `5 * * * *`, so `--freshness` cannot call `00` SILENT until three
consecutive hourly runs are missed. Crossed against the scheduled-tasks layer by the breadcrumb
trail instead: 23:08Z and 00:08Z are one hour apart, so the hourly occurrence fired.

**Machinery.** [MEASURED] watcher node RUNNING pid 31660, auto-restart wrapper alive (1), heartbeat
29 min (ticks only mid-run; the queue was empty, so stale-and-idle, not wedged). `index.lock` false
in both trees; 0 git processes; 0 in-progress prompts. `main` CI on `b6b7688d`: 4 success / 0 failed.
Watcher clone `dirty=1` and the orphaned worktree `C:/po-vg` (23c91ba9, 1 dirty file, 64 h) are both
already on Station 03's open dispatch — untouched here.

## WHAT CHANGED

1. **Pushed one commit to `feat/armguard-s1-refuse-already-armed` (PR #1742).**
   `91878b54` → **`6813ceac`**, read back with `gh pr view 1742 --json headRefOid`. One file,
   `6 insertions / 1 deletion`, verified with `git diff --numstat` before commit and committed with
   an explicit pathspec. The edit was made in node by **concatenation**, never `String.replace` with
   a replacement string, and the **byte delta was asserted**: `beforeBytes=46205`,
   `afterBytes=46531`, `expectedBytes=46531`, `BYTE_DELTA_OK=true` (DOCTRINE §9.3).
   Done in a **disposable worktree** off the PR branch, which was removed afterwards
   (`git worktree list` now shows only the dev tree and `C:/po-vg`).
2. **Armed `fix-1740-jest-cannot-parse-puppeteer-25-esm`** via `arm-prompt.ps1`
   (`-Actor station-00.0007`), never a bare `git mv`. `-WhatIf` first, then the real arm:
   `ARM_EXIT=0`, `Index contains exactly the two expected paths`, `ARM_INDEX_RELEASED`,
   `Index clean after release`. Audit line read back:
   `2026-09-07T00:20:55Z ARMED fix-1740-jest-cannot-parse-puppeteer-25-esm escalates=true
   actor=station-00.0007`.
3. **Wrote TWO `needs-marco/` files** —
   `app-service-node-version-is-pinned-nowhere-and-puppeteer-25-needs-2212-2026-09-07.md` and
   `tfm-2026-tenders-only-is-not-enforced-in-code-2026-09-07.md`. Both are Station 06 findings
   dispositioned ESCALATED in a breadcrumb with no `needs-marco/` home, which means they were
   escalated to nobody.
4. **Archived six dispositioned breadcrumbs** into `docs/pr-prompts/archive/`.
5. This breadcrumb, and the `.arming-log.txt` line, land in this run's board PR.

## FINDINGS

### F1 — ACTIONED — #1742's only red was a genuine HIGH CodeQL alert, and a 2-second failure is exactly what one looks like

Every other check on #1742 was green, including a 13m48s `tendering-e2e`. The lone red ran for
**two seconds**, which is the signature of an infrastructure hiccup — and the run before this one
could reasonably have re-run it and moved on. It was a real finding: a hand-rolled regex escape in
the test the ARMGUARD-S1 PR adds.

Fixed in place (DOCTRINE §8.2, "prefer ONE complete fix"), not masked. The assertion now captures
the token and checks membership:

```js
const forcedPast = /forced_past=(\S*)/.exec(line);
assert.ok(forcedPast && forcedPast[1].includes(other), …);
```

Same property asserted — the audit line must name the prompt `-Force` was forced past — with **no
regex constructed from the slug at all**, so there is no escape left to be incomplete. Nothing
skipped, deleted or loosened.

**Verified, not asserted:** `node --test scripts/pipeline/__tests__/arm-prompt.test.mjs` in the
worktree → `tests 23 / pass 23 / fail 0`, exit 0, including the edited test
(`✔ -Force waives the ALREADY_ARMED refusal and the audit line names what it was forced past`).
Then on GitHub at 00:22Z: **`CodeQL pass 2s`**, 13 checks green, 2 long ones pending.

**ACTIONED.** #1742 stays unmerged — RULE 2 binds it (measured above).

### F2 — ACTIONED — 06's F1: the fix-forward for #1740 is armed, and it lengthens nobody's queue

Station 06 staged `fix-1740-jest-cannot-parse-puppeteer-25-esm-HOLD.md` at 23:45Z and, correctly for
its lane, did not arm it. The standing arming caution — *"a code-touching arm only lengthens Marco's
queue"* — **does not apply here**: the prompt carries `fixes_pr: 1740`, its body forbids opening a
new PR, and it pushes onto an existing branch. It makes a red PR green rather than adding a
Marco-gated one.

Checks run before arming, in order: `lint-prompt.mjs` → **ADMIT (size 3)** (necessary, not
sufficient); RULE 4's marker union grepped case-insensitively for `do not arm` / `Arm ONLY` →
**0 hits**, against a positive control on `pr-524-rates-b-slice2-canonical-HOLD.md` → **3**; the
**body read in full** for a prose gate — there is none, it grants standing authority explicitly;
`armed = 0` beforehand, so RULE 4's one-at-a-time holds; §10.6 scope cross-check against the two
open PRs — the overlap with #1740's own diff is the point of the prompt, not a duplicate.

**ACTIONED.** Armed 00:20:55Z. `escalates: true` gates the merge, not the run (DOCTRINE §5b); the
`do-not-merge` label on #1740 is untouched and stays for Marco.

### F3 — ESCALATED — 06's F2 had no `needs-marco/` file, so it was escalated to nobody

06 dispositioned it **ESCALATED**: puppeteer 25 is ESM-only, `pdf-renderer.service.ts` loads it with
`require()`, that works only on Node ≥ 22.12, and **the App Service runtime Node version is pinned
nowhere in this repo** — no `linuxFxVersion`, no `WEBSITE_NODE_DEFAULT_VERSION`. On Node 20 or
22.0–22.11, PDF rendering breaks in production. The PR's own smoke cannot rule it out: it ran on
Marco's laptop, and the mechanism is Node-version-gated.

A breadcrumb finding is a report; it is not a queue entry. Written to
`needs-marco/app-service-node-version-is-pinned-nowhere-and-puppeteer-25-needs-2212-2026-09-07.md`
with three RULE 1 options, complete-and-additive first: **(a)** read the App Service Node version,
pin it ≥ 22.12, and record the floor in the repo so the next ESM-only dependency meets a declared
one; **(b)** move the loader to `await import()`, which removes the runtime dependency but ships a
behaviour change as a test fix and leaves the runtime unpinned; **(c)** merge and find out in
production — recorded only so it is visibly rejected.

**ESCALATED.** No agent may check Azure (DOCTRINE §5.1, absolute). I did not, and the armed prompt
forbids the implementer from touching `deploy.yml`, `ci.yml` or App Service configuration.

### F4 — ACTIONED — 06's F3, F4 and F5 need nothing further, and saying so is the disposition

**F3** (the DEPS-S2 prompt under-scoped: it scoped manifests and workflows but the implementer also
had to fix `ensure-puppeteer-chrome.mjs:72` and add an `await` at `pdf-renderer.service.ts:138`) —
06 already folded the lesson in: a dependency-MAJOR prompt must scope for *call sites of the bumped
API*. **F4** (`ci.yml` correctly left alone, because `ci.yml:94` invokes the puppeteer *bin* which
pnpm resolves) — recorded precisely so its absence from the diff is not later read as an omission.
**F5** (`lint-prompt.mjs` returned `REJECT [FIX_TARGET_UNKNOWN] (spawnSync gh ENOENT)` from inside
the Cowork Linux VM, and **ADMIT** when re-linted where `gh` lives) — this is DOCTRINE §9.5's
recorded behaviour, confirmed independently by my own lint on Windows this run: **ADMIT (size 3)**.

**ACTIONED.** All three are correct as filed; no work is outstanding on any of them.

### F5 — ACTIONED — 06's 2320 findings F1–F3 have all shipped

The RULE 4 brief and the ARMGUARD-S1 prompt landed as `#1741` (merged 23:18Z) and the guard itself
is `#1742`, now green but Marco's. F1 (RULE 4 solves collision, not throughput, and has been
credited with both), F2 (the guard must exclude `rev-*` and subdirectories or it refuses every arm)
and F3 (a `-Force` waiver must record what it was forced past) are all implemented and, as of this
run, **all three are covered by passing tests** — I ran the suite: 23 pass, including
`rev-<n>-ready.md alone does NOT count as an armed prompt` and `a *-ready.md in processed/ does NOT
count`.

**ACTIONED.**

### F6 — DEFERRED — 06's 2320 F4: the throughput question is already open with Marco

06 deferred it and named the three measurements that would make gating decidable (merge latency,
the Marco-gated share, the CI cost of rebasing a deep queue), recommending reporting rather than
gating until they exist. My own 23:08Z run already escalated the brief
(`needs-marco/arming-throughput-rule-b-is-ungated-2026-09-06.md`). Re-filing it would be a second
entry for one question.

**DEFERRED** — it becomes urgent when the open board grows past what one person can review in a day.
Today it is **2 PRs**, both Marco's, which is the smallest it has been in a week.

### F7 — DEFERRED — `status-sweep.ps1` §5 again told this run to clear live escalations

§5 emitted well over a hundred `[STALE] … escalation is DEAD, clear it` lines this run, including
against `cp26-passes-vacuously-on-an-unlabelled-destructive-migration-2026-09-05.md` and
`arming-throughput-rule-b-is-ungated-2026-09-06.md` — both of which are **live** and one of which
was filed six hours ago. The rule it applies is *"the file names a PR, that PR is merged, therefore
the file is dead"*, and it is wrong whenever an escalation cites a merged PR **as evidence**.

My 23:08Z run deferred this as F8; a fix is a `scripts/` change and therefore outside the lane 00
may merge. Recording it again only because the volume is growing and a future run may act on it:
**never clear an escalation on a §5 `[STALE]` line alone — read the file.**

**DEFERRED.** Nothing was cleared on §5's say-so this run.

### F8 — ACTIONED — three ` D` consumed HOLDs in the dev tree, all of them expected

`git status` shows ` D` for `pr-armguard-s1-…-HOLD.md`, `pr-deps-s2-puppeteer-…-HOLD.md` and — as
of 00:20:55Z — `fix-1740-…-HOLD.md`. The first two are deleted by their own PRs (#1742, #1740) and
must be left alone. **The third is mine and this run's board PR commits it**, together with the
`.arming-log.txt` line, as DOCTRINE §9.5 requires of any run that arms.

The probe is ` D`, not `RD`: `git diff --cached --name-status` was **EMPTY** before and after the
arm, so there is no staged `R100 HOLD→ready` with no file behind it.

**ACTIONED.**

### F9 — ESCALATED — 06's 2250 breadcrumb carried a SECOND homeless escalation, and this is now twice in one collect

`00-06-pr-master-2026-09-06-2250-…` finding **F2**: your standing rule for the tender-file migration
is COPY ONLY, never move, never delete, **2026 tenders only** — and [MEASURED by 06] a search of
`apps/api/src/modules/admin-imports/*.ts` for `2026` returns only a spec fixture path and unrelated
dated comments. **There is no year guard in the copy service.** The other three constraints hold
structurally (no delete, move or rename call exists); the year is enforced by which tenders the job
is pointed at.

[MEASURED] no `needs-marco/` file mentioned `2026 tenders`, `tfm-s11` or `admin-imports` — grep over
`needs-marco/*.md` → 0, with the positive control that the same grep for `puppeteer` found the file
I had written minutes earlier and `cp26-passes-vacuously-…-2026-09-05.md` is present on disk. Now
filed as `needs-marco/tfm-2026-tenders-only-is-not-enforced-in-code-2026-09-07.md`, with three
RULE 1 options, complete-and-additive first: **(a)** a configured year floor the service asserts and
refuses outside, which still holds next January; **(b)** a hard-coded `2026`, complete today and
silently wrong on 2027-01-01; **(c)** keep it as an instruction and record that it is *deliberately*
unenforced, so the next station does not re-file it.

**ESCALATED.** Whether the year is permanent, migration-only, or rolls annually is Marco's intent
and is not derivable from the codebase (RULE 3).

⚠️ **The pattern is the finding.** Two of the breadcrumbs collected this run carried an
**ESCALATED** disposition with no queue entry behind it, and my own 23:08Z run's F5 recorded a third
instance two days late. A breadcrumb finding is a report; `needs-marco/` is the queue. **A station
that dispositions ESCALATED must also write the file, or 00 has to notice — and 00 noticing is not a
mechanism.** Folding that into the `station-contract` canonical block would fix it for all seven at
once; deliberately not done here, because a canonical-block change must be re-recorded and shipped
across seven docs in one PR, which is more than a collect run should carry.

## WHAT I DID NOT DO

- **I merged nothing.** Both open PRs carry a live watcher `marco:true` verdict, measured this run
  with a positive and a negative control. #1742 is green-but-Marco's; #1740 is red-and-Marco's.
- I did not remove or touch the `do-not-merge` label on #1740, and I did not author a
  `merge-approvals/` receipt for anything.
- I did not check the App Service Node version, run `az`, or open any Azure surface. That is the
  whole content of F3 and it is Marco's alone.
- I did not re-run #1742's CodeQL hoping for green before diagnosing it. DOCTRINE §2: a failure is a
  diagnosis, not a nuisance.
- I did not touch `C:/po-vg` (holds 1 uncommitted file, `git worktree remove` would refuse and
  `--force` would discard it) or the watcher clone's `dirty=1`. Both are Station 03's open dispatch.
- I did not clear any `needs-marco/` file on a §5 `[STALE]` line.
- I did not arm a second prompt. RULE 4 is one at a time, and one is armed.
- I did not run `git checkout .`, `reset --hard`, `stash pop` or `git clean` anywhere.
- I did not read the binding documents from the watcher clone, and I took no piped hash.
