# Station 00 — Supervisor | 2026-08-28 06:08Z–06:30Z

## GROUND

```
UTC            2026-08-28 06:08:51Z
origin/main    fa04501d                 (fetched, then rev-parse)
dev tree       main @ fa04501d          C:\ProjectOperations2
doc version    1
bootstrap      1                        (MATCH — no version fault)
```

**SIGHTED.** Desktop Commander registered on the first `ToolSearch`; `start_process powershell.exe`
returned PID 33236. This run had full board access. Contrast the 04:08Z run, which was blind.

## WHAT I MEASURED

**[MEASURED] Trunk is GREEN, and `status-sweep.ps1` said otherwise.** The sweep printed
`main branch CI (last 3 runs): 1 success / 1 not-success  <-- TRUNK IS RED`. Read per-commit instead
(`gh api repos/GH-Mantova/ProjectOperations/commits/fa04501d/check-runs`, `--json` +
`ConvertFrom-Json`, never `--jq` from PS 5.1): **13 check-runs, 12 `success`, 1 `skipped`** — the
skipped one is `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)`, which does not run on a
push to `main`. Zero failures. This is the sixth time the standing rule "never quote a trunk colour
from the sweep" has paid for itself.

**[MEASURED] Board, immediately before mutating (verdicts expire):**

```
armed (*-ready.md, depth 1)   0
open PRs                      0
in-progress prompts           0
git index.lock (dev / clone)  False / False
git processes                 0
staged in shared dev index    0 files
HOLDs                         56
```

**[MEASURED] The dev tree is NO LONGER STALE.** The 04:08Z and 02:10Z runs called this the #1
blocker: the dev tree was said to be missing `sot-refs` wiring, `FILE_GATE_NOT_RELEASED`, and the
baseline file, which made every dev-tree lint ADMIT unproven. All three are now present at
`fa04501d`:

| Probe | Result |
|---|---|
| `sot-refs` in `.github/workflows/ci.yml` | **11 hits** |
| `FILE_GATE_NOT_RELEASED` in `scripts/pipeline/lint-prompt.mjs` | **9 hits** |
| `HUMAN_GATE_PRESENT` in `scripts/pipeline/lint-prompt.mjs` | **8 hits** |
| `docs/qa/sot-refs-baseline.json` on disk | **True** |

The dev tree was fast-forwarded to `origin/main` between 04:08Z and now — `git rev-parse HEAD` and
`git rev-parse origin/main` both return `fa04501d`. **This finding is closed; do not re-raise it.**

**[MEASURED] `gh` resolves** (`C:\Program Files\GitHub CLI\gh.exe`), so a lint ADMIT this run is a
real ADMIT and not the silent file-gate waiver of DOCTRINE §9.5.

**[MEASURED] Breadcrumb collection.** `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
72 checked, **2 malformed**, 7 skipped as pre-contract. Freshness: **no station is SILENT** —
00 2.0 h (cadence 2 h), 03 31.2 h (cadence 24 h), 04 4.0 h (cadence 4 h), 05 16.0 h (cadence 24 h).
Only **2 breadcrumbs remain untracked**, down from the 9 the 04:08Z run recorded; #1364 and #1365
landed the other seven.

**[MEASURED] Watcher liveness, by the probe that actually works.** Not heartbeat age, not `ps`, not
log growth — **arm-to-pickup.** I armed `pr-crm-s2-nav-three-items-tabs-ready.md` at ~06:12Z; the
heartbeat at `C:\po-watcher\ProjectOperations\scripts\pr-watcher\heartbeat.log` named that exact
prompt at **06:13:50.459Z** and again at 06:14:50Z with `elapsed=120s`. The watcher is ALIVE and
CONSUMING (node pid 5444, wrapper alive ×3).

**[MEASURED] The watcher CLONE is diverged, not merely behind.** `C:\po-watcher\ProjectOperations`:
`HEAD=42a397bd`, its own `origin/main` ref stale at `d9966f89`, and
`git rev-list --left-right --count origin/main...HEAD` = **16 behind / 2 ahead**. The two local
commits are `355dfdec docs(pr-reviews): verdict on pr-1339` and a merge commit on top of it. Working
tree is dirty with **35 unstaged ` D` deletions**, all under `docs/pr-reviews/`. A plain
`git merge --ff-only origin/main` therefore **cannot** succeed here.

**[MEASURED] A fast-forward of the clone would arm nothing.** `git ls-tree -r --name-only origin/main
-- docs/pr-prompts` filtered to depth-1 `*-ready.md` returns **0**. (`-r` used deliberately — without
it the command returns one tree line and any filter over it reports a false zero, DOCTRINE §9.2.)

## WHAT CHANGED

1. **ARMED** `pr-crm-s2-nav-three-items-tabs-HOLD.md` → `-ready.md` by `git mv` of a tracked file.
   Read back: `armed 0 → 1`, HOLD gone from disk, `git diff --cached --name-status` carries **exactly
   one `R100`** and nothing else. Picked up by the watcher ~60 s later (see above).
2. **RE-CUT** `00-00-supervisor-2026-08-27-1009-blind-desktop-commander-absent.md` into the fixed
   section order. No finding, measurement or disposition was altered — headings added, prose moved.
   Read back: the checker's malformed count fell **2 → 1**.
3. **STAGED (not armed)** a new prompt,
   `pr-breadcrumb-gitignore-gate-routing-not-mention-HOLD.md`. Lints **ADMIT**, clean, no
   `MISSING_STANDING_AUTHORITY` warning.
4. **Opened a board PR** carrying items 2 and 3 plus this breadcrumb.

Nothing else was mutated. No merge, no label, no process kill, no clone write.

## FINDINGS

### F1 — the board was completely idle: 0 open PRs, 0 armed, main green

The pipeline had run itself dry. Everything staged since 02:00Z had landed (#1362 → #1365) and
nothing replaced it. An idle board with 56 HOLDs waiting is the failure this station exists to
prevent, and it is invisible in a status sweep because every individual signal reads healthy.

Armed `pr-crm-s2-nav-three-items-tabs` — the next link in the `crm-build` cluster
(`cluster_order: 2`), flagged for re-arm by Station 04's 02:10Z breadcrumb after it proved the
earlier "false negative" against it was the scanner's own instrument lying. Every gate checked live:

- `requires_on_main: apps/web/src/pages/crm/RelationshipsPage.tsx :: buildCreateNoteBody` — **2 hits
  on `origin/main`** ⇒ gate RELEASED; lint agreed with `GATE_RELEASED` / `PROMOTE`, exit 0.
- premise `! grep -q "CRM_NAV_TABS" ShellLayout.tsx` — **0 hits on `origin/main`** ⇒ premise TRUE,
  work not already shipped. **Positive control:** `PIPELINE_FOLDED` in the same file returns **2**,
  so the zero is a real absence and not a broken query (DOCTRINE §7 guard 1).
- `escalates: false`, no `docs/approvals/` gate, no `requires_*` other than the released one.
- do-not-arm union grep over `pr-*.md` only (never `*.md`), case-sensitive `DO NOT ARM` plus both
  comment syntaxes: **6 hits, none of them this prompt.** **Positive control:** the two known
  never-arm prompts, `pr-524-rates-b-slice2-canonical-HOLD.md` and
  `pr-siteid-notnull-backfill-HOLD.md`, both appear in the hit list, so the grep fires.

**Disposition: ACTIONED** — armed, read back, and confirmed consumed by the watcher within 60 s.

### F2 — `check-breadcrumb.mjs` rejects a breadcrumb for *discussing* a gitignored path

`scripts/pipeline/check-breadcrumb.mjs:80-90` enforces "never route findings into a gitignored
channel" as a literal substring scan for two `docs/qa/**` paths, escaped only when the word
`gitignor` appears within a **±200-character window**. It has no notion of a routing destination.

Measured on `00-04-scanner-2026-08-27-0617-instruction-drift-…-backticked-paths.md`: the *first*
mention of the path passes because the sentence says "and it is gitignored (`.gitignore:106`)" ~45
characters later; the *second* mention, 3 lines on, fails because the nearest `gitignored` is ~250
characters back — just outside the window. The breadcrumb is reporting that a station doc has a
dead fallback into a gitignored file, which is precisely the finding the gate is meant to encourage.

This is not cosmetic. `check-breadcrumb.mjs` runs in CI, so the file cannot be landed at all while
it rejects — which is why it is still one of only two untracked breadcrumbs, five days on.

Staged `pr-breadcrumb-gitignore-gate-routing-not-mention-HOLD.md`: replace the proximity window with
a routing-verb lookbehind (`ROUTING_VERBS`), **keep** the existing `gitignor` escape hatch as an OR
so nothing that passes today starts failing, and pin all four cases with unit tests including the
measured false positive verbatim. RULE 1: complete (the class of false positive goes away, not this
instance) and additive (every genuine "I reported into a gitignored sink" still fails).

**Disposition: ACTIONED** (prompt written and lint-clean) → **next 00 run: ARM IT.** It is deliberately
left as a HOLD because this run had already armed one prompt and the rule is one at a time.

### F3 — `node check-breadcrumb.mjs <file>` silently ignores its file argument

Passing two *different* single-file paths produced **byte-identical whole-directory output**, both
ending `structure: 72 checked, 2 malformed`. The per-file form is not a narrower check; it is the
same check with the argument discarded, and a reader who believes they validated one file has
validated nothing about that file specifically. This re-confirms a probe already recorded as dead —
recording it here so the confirmation is in a tracked channel rather than only in chat memory.

Use `--freshness` and filter the output. There is no working per-file mode.

**Disposition: DEFERRED** — real, low blast radius, and the honest fix (accept a path argument, or
reject one loudly) belongs in the same PR as F2 rather than in its own. Becomes urgent the moment a
station reports "I checked my breadcrumb and it passed" on the strength of the per-file form.

### F4 — the watcher clone has diverged from `origin/main` and cannot be fast-forwarded

16 behind, **2 ahead**, 35 unstaged deletions. The watcher runs `index.mjs` **from this clone**
(DOCTRINE §9.5: "a restart adopts nothing"), so the guards merged as #1358 (`FILE_GATE_NOT_RELEASED`)
and #1360 (`headRefName`-driven prompt search) are **not live in the running watcher**, however green
they are on `main`. The two local commits are an unpushed `docs/pr-reviews` verdict and a merge
commit on top of it; the 35 ` D` entries are review files deleted but not staged.

This needs the watcher stopped, the two local commits assessed (the pr-1339 verdict may be worth
keeping as a patch, the merge commit is not), the deletions dealt with without `git checkout` —
which would resurrect them — and then a clean re-point at `origin/main` and a relaunch. That is
local-tree and watcher-process work, and I am forbidden to write git in that clone.

**Disposition: DISPATCHED to 03-machine-minder** (cadence daily, last ran 2026-08-26T23:01Z, so it
is due). Handing over: the clone path, the exact divergence counts above, the two commit SHAs, the
fact that a fast-forward would arm **0** prompts so there is no queue risk in the operation, and the
constraint that the deletions must not be restored with `git checkout`. Do it in an idle window —
not while a prompt is mid-run, which it is as of 06:16Z.

### F5 — four orphaned worktrees in `C:\po-worktrees`, unchanged since the last sweep

`sot-d-register` (407b93d2), `sot-readme-fetch` (904fa4e8), `sotk-03-ledger` (5db5a7c2), `po-wt-h`
(edef9f59). Leftovers from aborted runs. Each needs `git status --short` run inside it before anyone
proposes deletion; none may be deleted unsupervised.

**Disposition: DEFERRED** — they cost disk, not correctness, and nothing on the board is blocked by
them. Becomes urgent if one of them is found holding uncommitted work that a station believes it
already shipped.

### F6 — six stale escalation notes are still being surfaced by the sweep

`status-sweep.ps1` flagged as `[STALE]`: two references in
`HANDOVER-2026-08-14-tenancy-scoping-prod-incident.md` (#1135, #1134 both merged),
`pr-1135-prod-data-backfill-MERGE-DECISION.md` (#1135), two in
`pr-subbie-rate-cards-scope-pricing-HOLD.md` (#213, #212), and
`rates-11b2-consumer-migration-blockers-2026-08-27.md` (#1345). All six point at merged PRs; all six
are dead escalations that the sweep re-prints every run and every reader must re-dismiss.

**Disposition: DEFERRED** — clearing them is a doc-only sweep with no board effect, and it is not
worth a PR of its own; fold it into the next board PR that touches `docs/pr-prompts/`.

## WHAT I DID NOT DO

- **Did not land Station 04's 0617 breadcrumb.** It is a proven false positive (F2), but
  `check-breadcrumb.mjs` runs in CI, so committing it while the gate is unfixed would redden the
  Pipeline check board-wide. It stays untracked until the F2 prompt merges — and then it lands
  **unchanged**, which is how we prove the fix. Correcting an earlier note: this file is *not*
  "landable today".
- **Did not arm a second prompt.** One at a time. The next candidates, in order, are the F2 prompt,
  then `pr-queue-armed-tracked-detector-HOLD.md`, then `pr-crm-wincount-s3-recompute-HOLD.md`
  (`escalates: true` → run it, open the PR, label `do-not-merge`; per DOCTRINE §5b the flag gates
  the merge, not the run). `pr-rates-11b2-resolver-isactive-surface-HOLD.md` is **untracked** and
  needs `git add` before it can be armed by rename. **Not** `dns-s5-checker-flip-to-fail` — its
  premise is Marco triaging #1361's warn findings.
- **Did not touch git in the watcher clone.** Read-only `rev-parse` / `rev-list` / `log` / `status`
  only. The write is F4's, and it is 03's.
- **Did not report a RULE-2 breach count.** The 04:08Z run retracted both the count and the method
  that produced it; no signal distinguishes Marco from an agent, and I found none this run either.
  Nothing merged this run at all, so the question did not arise.
- **Did not clear the four orphaned worktrees or the six stale escalation notes.** See F5, F6.
- **Did not re-run the `postgres:16` glibc-vs-alpine collation comparison** that has been deferred
  for several runs. Still deferred; still nothing on the board blocked by it.
