# Merge liberty and pipeline-speed — binding slice plan

**Status:** authored 2026-08-03; awaiting Marco approval on this SLICE-0 document before any
code slice can arm.
**Owner:** Marco / ProjectOperations pipeline (`scripts/pipeline/**`, `scripts/pr-watcher/**`,
`.github/workflows/**`).
**Rule:** every code slice below chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. The decision itself lands in `sot/05` via a
DEDICATED doc-reconcile slice — never mixed with pipeline code.

Nothing here weakens any of the enumerated hard-stops (`NEVER_MERGE`, Azure / Entra /
SharePoint, prod-auth / secrets / deploy config, real-human-identity). Liberty is widened on
the **non-hard-stop** path only, and only after the compensating gates that replace human
oversight are proven to hold.

---

## 1. Motivation

Marco's ruling 2026-08-02: **give the watcher/supervisor more liberty to merge, and make the
smoke-test + merge cycle quicker.** Two things must change together — widening liberty without
tightening the gates that replace human oversight would reopen the incident classes those
humans currently catch.

**Verified state on origin/main HEAD 2026-08-03** (pinned to file:line — future readers must
be able to see what changed):

### 1.1 The "escalating class waits for Marco" gate is wider than the doctrine claims

- `docs/pr-prompts/PROMPT-SCHEMA.md:139-167` says `escalates: true` gates the MERGE, not the
  RUN, and `docs/pipeline/DOCTRINE.md:91-113` (§5b) repeats the same ruling: *"run, open PR,
  block merge only"*. The **folder** `docs/pr-prompts/needs-marco/` is the only real stop.
- BUT `scripts/pipeline/queue-sync.ps1:111-153` still counts every `escalates: true` prompt as
  `escalating(do-not-merge)` and prints an ACTION line telling the supervisor those PRs must
  not be merged. In practice today the whole `escalates: true` class parks on Marco even when
  none of the enumerated hard-stops apply — because there is no way for a prompt author to say
  *"escalating, but only for the hard-stops"* vs *"escalating, but a routine merge would
  be safe on green"*.
- Net effect: the flag is doing two jobs (advisory metadata + a merge veto that covers work
  that would be safe on green), and the veto is the wider of the two behaviours.

### 1.2 Main is strict-serial at ~1 merge per CI cycle

- The full `.github/workflows/playwright.yml` job (Tendering + PR-acceptance) runs on every
  push to `main` and every PR (`.github/workflows/playwright.yml:6-11`) — one 60-minute
  budget (`timeout-minutes: 60`, line 17), single runner (`runs-on: ubuntu-latest`, line 18),
  `--workers=1` on the PR-acceptance step (line 88), no matrix / no sharding.
- Every merge that lands on `main` re-triggers the entire suite from scratch. The next merge
  cannot land green until that suite finishes. Throughput on `main` is therefore capped at
  roughly one PR per CI cycle (~40-60 min end-to-end on a warm cache; longer cold).
- `Assert-SmokeGreen` (`scripts/pipeline/pipeline-lib.ps1:309-364`) refuses to merge a PR
  whose `tendering-e2e` (etc.) check is anything but `SUCCESS`/`SKIPPED`/`NEUTRAL`, so there
  is currently no in-flight lane at all.

### 1.3 Smoke/e2e duration is not measured

- `playwright.config.ts:21` sets `fullyParallel: false` for the whole config; the
  PR-acceptance step is additionally pinned to `--workers=1`
  (`.github/workflows/playwright.yml:88`). The suite is intentionally serial today.
- Browsers are installed fresh on every run (`playwright.yml:81-82`
  `pnpm exec playwright install --with-deps chromium firefox webkit`) — no cache key, no
  browser cache action. Chromium/Firefox/Webkit downloads run every CI job even though the
  PR-acceptance step only uses chromium (line 88 `--project=chromium`).
- We do not currently know the baseline (per-step timings for install-deps / prisma /
  seed / build / test:web:logic / install-browsers / tendering-smoke / pr-acceptance). The
  first speed slice below measures before proposing anything.

### 1.4 Watcher throughput is one-at-a-time by design

- `scripts/pr-watcher/index.mjs:328` `let running = false;`, guarded at
  `scripts/pr-watcher/index.mjs:1498` (`drain()` returns early if `running`). Only one prompt
  is drained at a time.
- This is *deliberate*, not an oversight — LL-38 (`sot/05-decisions-and-lessons.md:1148`,
  supervisor doing station work killed the queue) exists because parallel merges collided in
  the shared tree. The one-at-a-time invariant is what the STAY-IN-YOUR-STATION doctrine
  (§4 of DOCTRINE.md) exists to protect.
- `queuePaused` (`scripts/pr-watcher/index.mjs:329, 552, 1112, 1424, 1467, 1498, 1904`) is a
  global kill-switch — while it is `true`, `pollForNewPrs`, `pollForBehindPrs`, `drain`, and
  `rescan` all return early. If a slice re-introduces `queuePaused = true` and its unpause path
  is fragile, the whole board freezes with no user-visible cause. Any concurrency change must
  not multiply that failure mode.

### 1.5 The gates that replace human oversight

These are the checks that will now stand between the automation and a wrong merge. They must
be strengthened *before* liberty widens — the whole plan pivots on their trustworthiness:

- `Assert-SmokeGreen` — `scripts/pipeline/pipeline-lib.ps1:309-364`. Refuses null / pending /
  absent-required-check as pass. Currently the only positive gate on CI state; the doctrine
  §7.1 rule "positive control first" is NOT continuously exercised against it.
- `Assert-BodyClaimsAreReal` — `scripts/pipeline/pipeline-lib.ps1:366-393`. Greps the diff for
  the artefacts the PR body claims to have built. The gate that would have caught #476
  (`createPortal` never landed) and #478 (`managerId` DTO never landed). Only fires when a
  caller passes `MustContain`; prompt authors are not required to declare artefacts today.
- `Assert-Mergeable` — `scripts/pipeline/pipeline-lib.ps1:225-238`. Last line of defence
  against `NEVER_MERGE`. Called AT THE CALL SITE inside `Merge-Pr`
  (`scripts/pipeline/pipeline-lib.ps1:247`), so a broken selection filter cannot bypass it —
  the exact lesson from the #552 near-miss (`sot/05-decisions-and-lessons.md:1224`).
  `$script:NEVER_MERGE = @()` today (line 223); the guard is a live check with an empty list,
  not a decommissioned one (`pipeline-lib.ps1:212-222` explains why an empty list is correct).
- `smoke-pr.ps1` — `scripts/pipeline/smoke-pr.ps1:1-59` and after. Isolated worktree, seeded
  DB, real browser. The one honest "did-it-work" signal; the exit code decides.
- `.claude/hooks/guard.mjs` — a second reader of `NEVER_MERGE` that blocks
  `gh pr merge <n>` at the Claude Code hook layer (referenced from `pipeline-lib.ps1:215`).

### 1.6 The incident classes wider liberty could re-open

Named up-front so §5 can map each compensating gate to the incident it prevents:

- **#552** — the merge queue selection filter was one PowerShell quirk from a no-op and DID
  select the production-data PR; only the empty-list guard + `Assert-Mergeable` at the call
  site saved it. (`sot/05:1224`, DOCTRINE §7 row 8.)
- **#538** — needed a real human identity; no agent has one. (DOCTRINE §5 hard-stop 3.)
- **#476 / #478** — a watcher agent wrote "verified" into the PR body while the diff did not
  contain the artifact. Fixed by `Assert-BodyClaimsAreReal`. (`pipeline-lib.ps1:305`.)
- **LL-38** — supervisor did station work, abandoned a merge mid-conflict, killed the
  overnight queue. (`sot/05:1148`, DOCTRINE §4.)
- **LL-25** — silence read as death; a productive agent was killed as "wedged". Any
  concurrency change must NOT introduce a new "wedged"-shape signal.
- **`clients.*` gate sat unfixed for days** because a supervisor swept four
  `escalates: true` prompts into `needs-marco/` on the flag alone after Marco had asked for
  them to run (DOCTRINE §5b). The over-broad `escalates: true` semantic is directly why the
  merge queue is slower than it should be — this plan narrows it, it does not eliminate it.

**Already queued elsewhere — this plan does NOT re-plan these:**
`sot/01` §9 doc-reconciles (handled by the sot-keeper on its own cadence), the merge-queue
plumbing script (`scripts/pipeline/merge-queue.ps1`, out of scope until Slice 5 explicitly
opts in), `.claude/hooks/guard.mjs` internals (touched only if `NEVER_MERGE` semantics change).

---

## 2. Target policy (final state)

### 2.1 Merge policy — "merge anything but hard-stops on green"

The automation may auto-merge ANY PR that satisfies **all four** of the following:

1. `Assert-SmokeGreen` returns true (all required checks are `SUCCESS`/`SKIPPED`/`NEUTRAL`;
   no pending; no missing required gate).
2. `Assert-Mergeable` returns true (PR number is not on `$script:NEVER_MERGE`).
3. If the prompt declared a `must_contain:` artefact list (new front-matter, §2.3 below),
   `Assert-BodyClaimsAreReal` matches every declared artefact against the diff.
4. The prompt did NOT declare a hard-stop class (`hard_stop:` front-matter, §2.3 below) AND
   was not authored / moved into `docs/pr-prompts/needs-marco/`.

Every OTHER PR — including the ones today classed as `escalates: true` for "advisory" reasons
(touches a settings tab, adds a new nav entry, ships a new page that a user can reach without
elevated permissions) — auto-merges on green.

### 2.2 Hard-stops — ABSOLUTE, NON-NEGOTIABLE, unchanged by this plan

These NEVER auto-merge, no matter what the other gates say:

| Class | Enforced by | Where |
|---|---|---|
| Prod-data class (#552, seed writes to prod tables, destructive migrations) | `Assert-Mergeable` + `NEVER_MERGE` list + `.claude/hooks/guard.mjs` | `pipeline-lib.ps1:223-238` |
| Azure / Entra / SharePoint mutation | `hard_stop: azure` in prompt; queue-sync moves to `needs-marco/` at arm time | New — Slice 2 |
| Production auth / secrets / deploy config | `hard_stop: prod-auth` in prompt; queue-sync moves to `needs-marco/` at arm time | New — Slice 2 |
| Real human identity required (#538) | `hard_stop: human-identity` in prompt; queue-sync moves to `needs-marco/` at arm time | New — Slice 2 |
| Anything Marco personally names | Physical move to `docs/pr-prompts/needs-marco/` | DOCTRINE §5b |

The `needs-marco/` folder remains the ONLY real stop (DOCTRINE §5b); `hard_stop:` frontmatter
is a *routing directive* that queue-sync obeys at arm time (moves the file into `needs-marco/`
before it ever becomes `*-ready.md`), not a runtime veto. This preserves the doctrine's
"location is the contract; frontmatter is a note" invariant — the frontmatter causes the
move; once moved, only the folder matters.

### 2.3 Prompt-schema additions (front-matter only — no runtime overlap)

Two new OPTIONAL front-matter fields, both purely additive:

```yaml
---
hard_stop: azure          # one of: azure | prod-auth | human-identity | prod-data
                          # queue-sync moves the file into needs-marco/ at arm time
must_contain:             # OPTIONAL. If present, Assert-SmokedOrEscalate refuses to merge
  - "src/foo/Bar.tsx"     # unless every string here appears in the PR diff.
  - "export function bar"
---
```

`escalates: true` is **retained**, its semantic **narrowed** to "advisory metadata about the
work — this touched something sensitive, reviewers should notice." It no longer causes any
merge veto by itself. The merge veto lives in `hard_stop:` (structured) and `needs-marco/`
(physical) — one axis of stop each, no overlap. `queue-sync.ps1`'s ACTION line becomes
informational only.

### 2.4 Speed targets (measure first, propose after)

- **Main throughput:** raise from ~1 merge / CI cycle towards *at least* 3 merges / CI cycle
  under sustained backlog, without ever landing a red on `main`. Merge queue (GitHub's native
  or an internal batching lane) is the leading candidate; the trade-off with the current
  "every merge re-smokes serially" invariant is analysed in Slice 5.
- **Smoke/e2e duration:** cut wall-clock of `playwright.yml` by at least 30% via browser
  caching + trimming the trio install + evaluating shard=2 for the pr-acceptance step. Numbers
  proposed only after Slice 3 lands the baseline.
- **Watcher throughput:** allow the watcher to *validate* (compute gate results for) up to
  N PRs concurrently while still *merging* one at a time (LL-38-safe). N is proposed in
  Slice 6 after Slice 5 has proven the concurrent-merge path with the merge queue.

---

## 3. Slice list (ordered, independently shippable)

Each slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. All slices are
docs-and-code (never mixed with `/sot/` edits). One dedicated `sot/05` decision slice sits at
the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/merge-liberty-and-speed-plan.md`
- **Gate/CI:** `pnpm build && pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below. `escalates: true` (Marco reviews the plan before it
  lands); PR opens and stays unmerged with `do-not-merge`.

### SLICE 1 — Prove the gates hold ("positive control first") `size:6`
- **Files:** `scripts/pipeline/__tests__/test-assert-smoke-green.ps1` (new — asserts
  pending/absent/failure all throw); `scripts/pipeline/__tests__/test-assert-mergeable.ps1`
  (new — asserts NEVER_MERGE entry throws; empty list passes; guard.mjs invocation also
  refuses); `scripts/pipeline/__tests__/test-assert-body-claims.ps1` (new — asserts absent
  artefact throws; present artefact passes; missing diff throws); `scripts/pipeline/test-pipeline-lib.ps1` (add three test invocations); tiny README wiring in
  `scripts/pipeline/` for how to run the guards. **Zero behaviour change** — this slice
  only proves the existing gates catch their known-bad inputs, so the wider-liberty slices
  can rely on them.
- **Doctrine hook:** DOCTRINE §7 "positive control first, before believing a NEGATIVE." A
  gate never seen to say PASS on a good input, and FAIL on a known-bad input, is not a gate.
- **Gate:** `pnpm lint` + the three new powershell test scripts pass locally.
- **Requires:** SLICE 0.

### SLICE 2 — Prompt schema: add `hard_stop` and `must_contain`; narrow `escalates` doc `size:4`
- **Files:** `docs/pr-prompts/PROMPT-SCHEMA.md` (add both fields with worked examples;
  rewrite the `escalates` section to mark it advisory-only; keep back-compat — an armed
  prompt with `escalates: true` and no `hard_stop:` runs and can auto-merge on green);
  `scripts/pipeline/lint-prompt.mjs` (validate `hard_stop` enum: `azure`,
  `prod-auth`, `human-identity`, `prod-data`; validate `must_contain` is a non-empty
  string[] when present; REJECT any other value with a clear message);
  `scripts/pipeline/lint-prompt.mjs.__tests__` if that pattern exists (or add to
  `scripts/pipeline/test-lint-prompt.mjs`).
- **Behavioural change:** SCHEMA + LINT ONLY. Queue-sync and the watcher are unchanged this
  slice — a prompt with `hard_stop:` still arms, because no code reads the field yet. The
  routing behaviour arrives in Slice 4.
- **Gate:** `pnpm lint` + `node scripts/pipeline/test-lint-prompt.mjs`.
- **Requires:** SLICE 0.

### SLICE 3 — Measure the current smoke/e2e baseline `size:3`
- **Files:** `docs/audits/pipeline-baseline-2026-08.md` (new — records per-step timings
  captured from three recent green `playwright.yml` runs on `main`: install-deps, prisma
  generate, prisma migrate deploy, seed, api build, test:web:logic, install browsers,
  tendering-smoke, pr-acceptance suite, total). No code touched; this is the measurement
  gate the speed slices depend on.
- **Doctrine hook:** DOCTRINE §7 rule "before you touch the machine, measure what you have."
  Every speed proposal in slices 7/8/9 cites this file so future readers can see the delta
  the change actually bought.
- **Requires:** SLICE 0.

### SLICE 4 — Enact hard_stop routing in queue-sync; narrow `escalates` accounting `size:5`
- **Files:** `scripts/pipeline/queue-sync.ps1` (a) on arm, if the prompt declares
  `hard_stop: <class>`, MOVE the file into `docs/pr-prompts/needs-marco/` before it
  becomes `*-ready.md` — one physical location, one contract; (b) change the accounting: the
  script no longer counts `escalates: true` as `escalating(do-not-merge)` — instead it counts
  `hard_stop:` (and files in `needs-marco/`) as the merge-stop set. `escalates: true` prints
  as `advisory=N` and does NOT emit an ACTION line telling the supervisor to hold merges;
  README notes (in `docs/pipeline/DOCTRINE.md` §5b) updated to match.
- **Behavioural change:** the `escalates: true` prompts that today land as
  `escalating(do-not-merge)` (see `pr-prompts/*.md` grep) will, from this slice on, auto-merge
  on green unless they ALSO declare `hard_stop:` or are physically moved into `needs-marco/`.
  This is Marco's ruling from 2026-08-02, in effect.
- **Rollback:** SLICE 4 revert restores the previous "count as escalating" accounting; the
  underlying prompts do not change shape. `hard_stop:` frontmatter added in the interim keeps
  working (it's still a valid enum after revert — queue-sync just ignores it).
- **Requires:** SLICES 1, 2 (gates proven; schema landed).

### SLICE 5 — Introduce a GitHub merge queue (or in-lane batch) for main `size:6`
- **Two-step:**
  - 5a — **audit-only report** committed to `docs/audits/merge-queue-tradeoffs.md`:
    compare (i) GitHub-native merge queue against `main` with the `Tendering Browser Smoke`
    check required, (ii) internal batching in `scripts/pipeline/merge-queue.ps1`, (iii) the
    status quo. Trade-offs to enumerate honestly: (A) how each interacts with the `main`
    strict-serial CI, (B) how each interacts with `Assert-SmokeGreen`'s current model of "the
    PR's own checks are green" vs "the queued combination is green", (C) revert cost when a
    batch goes red, (D) does it change the meaning of `mergeStateStatus`. Recommend one; ship
    5b against the recommendation.
  - 5b — enact the recommendation. Likely files (worst case): `.github/workflows/playwright.yml`
    (`on:` block adds `merge_group`), `.github/CODEOWNERS`/branch protection notes
    (docs-only, actual settings change is a Marco-only click), `scripts/pr-watcher/index.mjs`
    (add merge-queue-awareness to `attemptMerge`), `scripts/pipeline/pipeline-lib.ps1`
    (`Assert-SmokeGreen` learns to accept merge-group check names as first-class alongside PR
    checks).
- **Non-goal:** no change to the `NEVER_MERGE` guard, no change to `Assert-Mergeable`, no
  weakening of `Assert-SmokeGreen` (the required check set stays required — merge queue
  raises throughput by running the check on batched heads, not by dropping it).
- **Rollback:** disable the merge queue at the GitHub side (branch protection revert); the
  watcher's merge-queue awareness is behind an env var (`PR_WATCHER_MERGE_QUEUE=on|off`) so
  the code can stay in main safely with the feature off.
- **Requires:** SLICES 1, 3.

### SLICE 6 — Watcher: concurrent validate, serial merge `size:5`
- **Files:** `scripts/pr-watcher/index.mjs` — split `drain()` into a validate-phase (compute
  gate results, up to N in parallel where N = env `PR_WATCHER_VALIDATE_CONCURRENCY`,
  default 3) and a merge-phase (still one PR merging at a time — the LL-38 invariant is
  preserved); tests in `scripts/pr-watcher/__tests__/` cover: N=1 behaves exactly as today;
  N=3 does not double-enqueue; `queuePaused=true` still halts both phases; a validate that
  throws does not stop the sibling validates. **Zero change** to the merge path when
  `PR_WATCHER_MERGE_QUEUE=off`; when `on`, defers to Slice 5's merge-queue awareness.
- **Doctrine hook:** DOCTRINE §4 STAY-IN-YOUR-STATION. The merge station stays serial. Only
  the *validate* stage — which is read-only calls to `gh` and computed gates — parallelises.
  There is no shared filesystem mutation during validate.
- **Rollback:** set `PR_WATCHER_VALIDATE_CONCURRENCY=1` — behaviour reverts to today's
  one-at-a-time. Env-flag rollback, no code revert needed.
- **Requires:** SLICE 5 (need the merge-queue plumbing before it is safe to raise
  validate throughput — validating N PRs and then trying to merge one at a time against a
  strict-serial main would just build a longer queue).

### SLICE 7 — Cache Playwright browsers in CI `size:2`
- **Files:** `.github/workflows/playwright.yml` — add `actions/cache@v4` before the
  `playwright install` step keyed on the pinned Playwright version + os; keep the
  `--with-deps` install for the cache-miss case; drop `firefox webkit` from the install list
  because the CI job only runs `--project=chromium` (`playwright.yml:88`) — Firefox/Webkit
  live in `playwright.config.ts:53-68` for local dev, and CI never exercises them today.
- **Numbers cited from Slice 3 baseline:** proposed savings appear in the PR body.
- **Requires:** SLICES 1, 3.

### SLICE 8 — Shard the PR-acceptance suite in CI `size:4`
- **Files:** `.github/workflows/playwright.yml` — add `strategy.matrix.shard: [1/2, 2/2]` to
  the pr-acceptance step; each shard gets its own runner and its own browser cache hit from
  Slice 7. `Assert-SmokeGreen` learns the required-name shape `tendering-e2e (1/2)`,
  `tendering-e2e (2/2)` (or keep the top-level required check via a small `pr-acceptance:
  needs: [shard-1, shard-2]` aggregator job — the audit in the PR body picks whichever
  minimises CI-config change).
- **Non-goal:** no touching of `playwright.config.ts fullyParallel` (that is a *within-runner*
  parallelism change and interacts with the DB + web-server assumptions in a way that needs
  its own audit — file that as a follow-up if the shard doesn't hit the 30% target).
- **Rollback:** drop the `matrix.shard` and restore the single required check name — one-file
  revert.
- **Requires:** SLICES 1, 3, 7.

### SLICE 9 — Require `must_contain` for a small, risky prompt class `size:3`
- **Files:** `docs/pr-prompts/PROMPT-SCHEMA.md` (document the requirement);
  `scripts/pipeline/lint-prompt.mjs` (REJECT with `MISSING_FIELD` when a prompt's `scope:`
  includes any of `apps/api/prisma/**`, `scripts/pipeline/**`, `scripts/pr-watcher/**`,
  `.github/workflows/**` AND `must_contain:` is absent or empty — these are the risky classes
  where a body-over-claim on merge is most expensive); update the two or three prompt
  templates under `docs/pr-prompts/` that live in these areas.
- **Why here, not earlier:** liberty widened in Slice 4 makes `Assert-BodyClaimsAreReal`
  matter more (it catches the #476/#478 shape). This slice makes it *mandatory* on the
  scopes where a wrong merge would be hardest to reverse.
- **Requires:** SLICES 2, 4.

### SLICE 10 — sot/05 decision entry (docs-only, doc-reconcile) `size:1`
- **Files:** `sot/05-decisions-and-lessons.md` — new decision entry recording Marco's ruling
  2026-08-02 to widen automation merge liberty on non-hard-stop PRs and to prioritise
  smoke/merge speed; cites this plan by path; enumerates the four hard-stop classes as the
  binding list. `docs/pipeline/DOCTRINE.md` §5b updated to match (advisory-only semantic on
  `escalates`, hard-stop enum listed).
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Requires:** every code slice merged (SLICES 1-9).

---

## 4. Compensating controls (map each incident to the gate that prevents recurrence)

| Incident class | The gate | Where the gate lives | Slice that proves/strengthens it |
|---|---|---|---|
| #552 (prod-data merged by broken filter) | `Assert-Mergeable` at the call site inside `Merge-Pr` + `NEVER_MERGE` list + `.claude/hooks/guard.mjs` | `pipeline-lib.ps1:225-238, 247` | SLICE 1 positive-controls; unchanged behaviour |
| #476 / #478 (PR body over-claimed the diff) | `Assert-BodyClaimsAreReal` + `must_contain` field | `pipeline-lib.ps1:366-393`; schema per SLICE 2 | SLICES 1, 2, 9 |
| Azure / Entra / SharePoint mutation (DOCTRINE §5 stop 1) | `hard_stop: azure` routes to `needs-marco/` at arm time | `queue-sync.ps1` per SLICE 4 | SLICE 4 |
| Real human identity #538 (DOCTRINE §5 stop 3) | `hard_stop: human-identity` routes to `needs-marco/` | `queue-sync.ps1` per SLICE 4 | SLICE 4 |
| Prod-auth / secrets / deploy config (DOCTRINE §5) | `hard_stop: prod-auth` routes to `needs-marco/`; secrets in the diff still tripwire in the reviewer's checklist (unchanged) | `queue-sync.ps1` per SLICE 4 | SLICE 4 |
| LL-38 (parallel merges collide in shared tree) | Serial merge path preserved; only validate parallelises; no shared-tree mutation during validate | `pr-watcher/index.mjs` per SLICE 6 | SLICE 6 |
| LL-25 (silence read as death; wedged mis-diagnosed) | Concurrent validate does NOT introduce a new "silence" signal — each validate logs its start and finish; `queuePaused` semantics unchanged; timeouts still gated by DOCTRINE §7.4 (only `restart-watcher-if-wedged.ps1` may declare liveness) | `pr-watcher/index.mjs` per SLICE 6 | SLICE 6 |
| `clients.*` swept into `needs-marco/` on flag alone | `escalates: true` narrowed to advisory; `queue-sync.ps1` stops emitting ACTION-line-to-hold on it; supervisors instructed via updated DOCTRINE §5b | schema + queue-sync + doctrine text | SLICES 2, 4, 10 |

**Every liberty-widening slice cites the compensating gate that must exist and be proven
BEFORE the slice merges.** If a gate cannot be trusted to replace the human on a given path,
the plan says so and keeps the human on that path — the `needs-marco/` folder + `hard_stop:`
enum remain the escape hatch.

---

## 5. Risks

### 5.1 The narrowing of `escalates: true` will change one behaviour that supervisors relied on
Today a supervisor sees `escalating(do-not-merge)=N` and knows to hold N merges. After
SLICE 4 that line disappears (advisory count only). Any supervisor prompt or runbook that
grep'd the ACTION line by string will silently no-op. Mitigation: SLICE 4's PR body lists
every `.md` under `docs/supervisor-prompts/` or `sot/` that mentions
`escalating(do-not-merge)` and updates them in the same PR.

### 5.2 A merge queue that batches red PRs
If GitHub's native merge queue batches PR-A (green) with PR-B (red) and re-checks the batch,
a green re-check can hide a legitimately red PR-A. Mitigation: SLICE 5a's audit specifies the
merge-queue trigger to be `MergeQueue: check-required` on `main` with the same required check
name — i.e. the same suite has to pass on the batched head, not a different (cheaper) one.
`Assert-SmokeGreen` on the base ref post-merge remains authoritative.

### 5.3 Concurrent validate could triple-cost a broken instrument
DOCTRINE §7 rule #4 warns: a broken instrument returning a confident-wrong answer is the
worst failure mode. Running the same broken instrument in parallel makes N wrong verdicts.
Mitigation: SLICE 1 lands the positive-control tests *before* SLICE 6 raises concurrency; if
SLICE 1's tests do not go green, SLICE 6 does not arm.

### 5.4 Cache poisoning on the Playwright browser cache (SLICE 7)
`actions/cache` keyed on Playwright version + OS is standard; the failure mode is a corrupt
tarball surviving the key. Mitigation: cache key includes the exact Playwright version from
`pnpm-lock.yaml`; on any red pr-acceptance run, the first fix step is "bust the cache" (the
audit lists the exact key to expire).

### 5.5 Sharding changes the required-check name (SLICE 8)
Renaming a required check is exactly how #544 sat green-but-unmergeable
(`pipeline-lib.ps1:317-322`). Mitigation: SLICE 8 EITHER (a) keeps the top-level check name
`tendering-e2e` via a `needs:` aggregator job, OR (b) updates the branch-protection required
list in the same PR body's runbook — never (c) rely on `Assert-SmokeGreen` matching on
substring alone.

### 5.6 `queuePaused` remains a global kill-switch
SLICE 6 is explicitly a NO-OP against `queuePaused` — when it is `true`, both validate and
merge stop, exactly as today. No slice below re-writes the `queuePaused` semantics; the same
manual unpause path (Marco / runbook) still works. If any future slice touches it, it needs
its own risk section.

### 5.7 Prompt authors will need to learn `hard_stop:` and `must_contain:`
Both are OPTIONAL — the existing prompt corpus keeps working. Discoverability is via the
updated PROMPT-SCHEMA.md, a doctrine cross-link, and (SLICE 9 only) a lint REJECT with a
clear message for the risky-scope class. No silent behaviour change for existing prompts.

### 5.8 Slice 4 is the tipping point
Every slice up to and including 3 is instrumentation and schema — behaviour is unchanged. The
moment SLICE 4 merges, the automation starts auto-merging the previous `escalates: true`
class on green. If SLICE 1's positive controls are not solid at that point, this is the slice
that could re-open #476/#478-shape merges. Explicit gate: SLICE 4 does not arm until Marco
signs the SLICE-1 test log.

---

## 6. Out of scope

- Any change to what the acceptance suite *tests* — this plan speeds it up, it does not
  rewrite specs.
- The `smoke-pr.ps1` script's own semantics (SLICE 3 measures the CI copy of the suite; local
  smoke stays a jig for authors, not a jig for the pipeline).
- The `.claude/hooks/guard.mjs` internals beyond confirming it reads `NEVER_MERGE`.
- Any Azure / App-Service / Entra change to operate — the pipeline changes stay in Git and
  GitHub Actions.
- Sot/01 §9 or §7 rewrites (handled by sot-keeper on its own cadence; this plan lands a §5
  decision entry only, via SLICE 10).
- The `merge-queue.ps1` internal batching lane (evaluated in SLICE 5a, only implemented if
  SLICE 5a's audit recommends it over GitHub-native).
- Renames or deletions of any `NEVER_MERGE` entries (empty list today; the guard's *shape*
  is unchanged).
- Any change that would require a schema migration (this plan is CI/scripts/docs only).
- Field/mobile pipeline (there is no separate pipeline).

---

## 7. Verification of this document

- [x] `test -f docs/plans/merge-liberty-and-speed-plan.md`
- [x] Every hard-stop from DOCTRINE §5 is preserved and enumerated in §2.2 with its
      enforcement site.
- [x] Every audit finding in §1 is pinned to a file:line seen on origin/main 2026-08-03.
- [x] Every liberty-widening slice (4, 5, 6) names the compensating gate that must hold
      before it arms, and cites the incident class the gate prevents.
- [x] `escalates: true` narrowed to advisory (per Marco 2026-08-02) with the physical
      `needs-marco/` folder + structured `hard_stop:` enum remaining the two real stops.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
