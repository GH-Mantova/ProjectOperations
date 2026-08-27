# Station 04 — Scanner | 2026-08-27T10:10Z–2026-08-27T10:34Z

Sweep this run: **gate-liveness** (rotation position 1 of 4, per `next-sweep.mjs`; previous run
2026-08-27T06:10:35Z).

## GROUND

```
UTC            2026-08-27T10:10:19Z
origin/main    22b2f529            (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 6283e12b     C:\ProjectOperations2   (behind 1, ahead 2)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE — this run was not forced read-only by a version mismatch. **NOT BLIND**: Desktop
Commander reached the box on the first attempt (`PROBE_OK 2026-08-27T10:10:19Z`). All gate readings
below are against `origin/main` at **22b2f529**.

## WHAT I MEASURED

- **[MEASURED]** `gh` resolves at `C:\Program Files\GitHub CLI\gh.exe`; `node` at
  `C:\Program Files\nodejs\node.exe`. Per DOCTRINE §9.5 this is a precondition for believing ANY
  lint verdict — an ADMIT obtained without `gh` silently waives every `origin/main:` file gate.
- **[MEASURED]** Board population at depth 1 of `docs/pr-prompts/`: **61 `-HOLD.md`, 0 `-ready.md`,
  66 `pr-*.md`** (the 5 non-suffixed: `pr-doctrine-s9-four-false-traps-LOOPING.md`,
  `pr-permission-role-reconciler.md`, `pr-settings-home-slice0-DISARMED-…`,
  `pr-smoke-share-worker-tokens.md`, `pr-user-default-dashboard-ui-RETIRED-…`).
- **[MEASURED]** Ran `lint-prompt.mjs` against **all 66** prompts, one process each, exit code
  captured per file (`C:\po-sup-fix-scripts\gate-liveness-clean.txt`). Verdict census:

  | verdict | exit | count |
  |---|---|---|
  | ADMIT | 0 | 29 |
  | PROMOTE (GATE_RELEASED) | 0 | 7 |
  | REJECT `GATE_NOT_RELEASED` | 1 | 21 |
  | REJECT `HUMAN_GATE_PRESENT` | 1 | 6 |
  | REJECT `NO_FRONT_MATTER` | 1 | 1 |
  | STALE — premise dead | 3 | 2 |

  **Positive control (§7):** the same instrument produced 7 PROMOTE/GATE_RELEASED verdicts in this
  pass, so a REJECT here is a real reading, not a check that can only fail.

- **[MEASURED]** **Board trap — CLEAN.** Tracked `*-ready.md` at depth 1 on `origin/main`:
  `git ls-tree -r --name-only origin/main -- docs/pr-prompts | ? {…-ready\.md$}` → **0**.
  **Control:** the same query for `-HOLD.md` → **71**, so the query is not structurally blind
  (DOCTRINE §9.2 — the missing-`-r` trap). Note 71 tracked vs 61 on disk: 10 consumed HOLDs whose
  deletion is not yet committed. Known channel, not a new finding.
- **[MEASURED]** Open PRs: exactly one — **#1350** `feat(crm-wincount-slice2)`, branch
  `feat/crm-wincount-slice2-six-paths`.
- **[MEASURED]** **Dead-gate test, all 21 `GATE_NOT_RELEASED` gates.** For each, (a) does the target
  file exist on `origin/main`, (b) which OTHER board prompt names the needle. Result: **every one of
  the 21 has a live, named predecessor** — 19 name a predecessor prompt still on the board, 2 name a
  file a predecessor creates (`check-d-register.mjs`, `agreed-record-register.controller.ts`). The
  chains are coherent (`crm-s2→s3→s4→s5→s6`, `s8→s9→s10→s11`, `guard-s1→s2`, `dns-s4→s5`,
  `sor-s9a→s9b`, `rates-value-column-units→rates-column-edit-ui→transport-capacity-column-order`).
- **[MEASURED]** The one gate whose only other mention was a *breadcrumb* rather than a prompt —
  `pr-crm-wincount-s3-recompute` needing `jobs.service.ts :: clientStats.recordTenderOutcome` — is
  **not dead**: `gh pr diff 1350` contains `clientStats.recordTenderOutcome` **10 times** and touches
  `apps/api/src/modules/jobs/jobs.service.ts` (+74). Its predecessor is in flight, not lost.
- **[MEASURED]** `lint-prompt.mjs:712-761` implements three human-gate markers:
  `/<!--\s*watcher:\s*do-not-arm\s*-->/i`, `/DO NOT ARM/` (case-sensitive), `/Arm ONLY/`
  (case-sensitive). `docs/approvals/` references are **WARN-only by design** (source comment,
  line 699).
- **[INFERRED]** Two standing traps carried in project memory are now **out of date** — see F2/F3.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-27T10:10:19Z`. **Read back**:
  rotation now reports the next sweep, not `gate-liveness`.
- This breadcrumb, created at a **tracked** path.
- **Nothing else.** No prompt armed, disarmed, renamed, moved, edited or deleted. No PR touched. No
  `/sot/` edit. The board is byte-identical to how I found it.

## FINDINGS

### F1 — A live prompt linted ADMIT while carrying an explicit human do-not-arm marker (S2)

`docs/pr-prompts/pr-nav-jobs-projects-merge-HOLD.md` returns **exit 0 / ADMIT**. Its body line 12 is:

```
<!-- watcher: do-not-arm | GATED: arm ONLY after the Job/Project model merge (B-P0a,
job-project-model-merge) has MERGED to main. Merging the UI before the model is merged will
fight the split data model. -->
```

**All three markers miss, each for a different reason:**

| marker | regex | why it misses |
|---|---|---|
| 1 | `/<!--\s*watcher:\s*do-not-arm\s*-->/i` | requires `-->` immediately after `do-not-arm`; the ` \| GATED: …` decoration breaks it |
| 2 | `/DO NOT ARM/` (case-sensitive) | the body says `do-not-arm`, lowercase |
| 3 | `/Arm ONLY/` (case-sensitive) | the body says `arm ONLY` — **misses by one character** |

**Positive control, run in `node` against the literal string:** all three regexes return `false` on
the real marker; the canonical `<!-- watcher: do-not-arm -->` returns `true` on marker 1; and
`'Arm ONLY after X'` returns `true` on marker 3. The instrument works; the prompt genuinely slips.

**Blast radius — measured, and smaller than it first looks, but the marker form is 0-for-3.** The
decorated `watcher: do-not-arm | GATED: …` form is **house style**, used by 8 prompts. Five are
retired (`binned-shipped-20260720/`, `processed/`, `superseded/`). Three are live at depth 1:

- `pr-ops-m2b-tipping-tab-reminder-HOLD.md` — REJECTed, but by a **separate** capitalised
  `DO NOT ARM` prose line, not by the marker it used.
- `pr-vendor-invoice-ocr-HOLD.md` — same: caught by a redundant capitalised line.
- `pr-nav-jobs-projects-merge-HOLD.md` — has **no** redundant line, so it ADMITs.

So the decorated marker is caught **zero** times out of three; two prompts are held by luck. Any
future prompt using house style with no capitalised second line will ADMIT.

**Why this one matters:** `size: 8`, `scope: apps/web/src/**`, and its own gate says arming before
the B-P0a model merge "will fight the split data model". An ADMIT here invites a large UI PR against
an unmerged data model.

**History (five-angle #4):** this is **residual**, not un-started. `pr-lint-human-gate-blindness-ready.md`
ran and landed (`docs/pr-prompts/processed/`, 2026-08-26T10:14Z) and is what created the three
markers. It closed three forms and left the decorated one open. A *new* prompt is warranted; do not
re-arm the old one.

🔴 **Design hazard the fix must respect** — flagged by a prior supervisor run
(`00-00-supervisor-2026-08-25-1208`, F3): *"a naive do-not-arm grep would refuse to arm the
do-not-arm detector itself."* Any widened regex must not reject the prompt that fixes it, nor the
breadcrumbs that discuss it.

**RULE 1 options** (complete-and-additive first):

- **A — widen marker 1 to match `do-not-arm` anywhere inside a `watcher:` HTML comment**
  (e.g. `/<!--\s*watcher:[^>]*do-not-arm/i`), and make markers 2 and 3 case-insensitive on the
  phrase while keeping them anchored to the directive form. **Passes both halves:** it fixes every
  live and future decorated marker immediately, and it is strictly *additive* — it only widens what
  is caught, so no prompt that currently REJECTs can start ADMITting, and no gate can be released by
  it. No data entry, existing or future, is touched. Must ship with the self-reference guard above.
- **B — hand-edit `pr-nav-jobs-projects-merge-HOLD.md` to the canonical bare marker.** Fixes the
  immediate half; **fails the future half** — the next author writing house style is missed again,
  and this is the third time this class has recurred.
- **C — rely on RULE 4 (a human reads the body before arming).** **Fails both halves**: nothing
  changes now, and it is precisely the control that already failed here, made *more* likely to fail
  because the linter now appears to gate human markers and so makes ADMIT look more trustworthy
  than it is.

**DISPOSITION: ESCALATED.** The question for Marco: *may option A ship as a prompt, with the
self-reference guard, or do you want the regex kept narrow and the three live prompts normalised by
hand instead?* I did not edit the prompt under critique — Station 04 reports prompts, never rewrites
them.

### F2 — "the linter gates none of the human/`requires_*` gates" is now OUT OF DATE (correction)

Project memory's RULE 4 says lint ADMIT/PROMOTE is necessary-not-sufficient *because* "the linter
gates none" of `do-not-arm`, the `requires_*` family, or `docs/approvals/`. **Measured false at
22b2f529:** the linter now hard-REJECTs on `HUMAN_GATE_PRESENT` (6 prompts this run) and on
`GATE_NOT_RELEASED` for the whole `requires_*` family (21 prompts this run), before the premise runs.

**RULE 4's conclusion still holds — its stated reason does not.** ADMIT remains insufficient, but the
residual holes are now precisely two, and they are the two to carry forward:

1. the decorated `watcher: do-not-arm | …` marker (F1);
2. `docs/approvals/` references, which are **WARN-only by design** (`lint-prompt.mjs:699`) — so
   `pr-rates-s11c-drop-legacy-tables` and `pr-tenant-mt4-s2-ownership-migration` both ADMIT while
   naming an approvals gate. (`rates-s11c` is separately covered by the `queue-sync.ps1` never-arm
   denylist; `pr-tenant-mt4-s2-ownership-migration` is **not** — worth a look.)

**DISPOSITION: DISPATCHED** to Station 00 — update the standing RULE 4 note so it names the two real
holes instead of the retired claim. A trap list that overstates the danger gets discounted wholesale.

### F3 — Two prompts are now genuinely STALE and should be binned (S3)

Both return **exit 3** ("the work is ALREADY DONE — binned before spawning an agent"):

- `pr-doctrine-s9-four-false-traps-LOOPING.md` — premise *"DOCTRINE §9 still carries four claims
  measured FALSE, including one whose polarity is inverted"* no longer holds. **Confirmed by reading
  `DOCTRINE.md` §9.5 today**: it now reads "`lint-prompt.mjs` does NOT reject when `gh` is missing —
  it WARNs … Confirm `gh` resolves before believing any ADMIT", i.e. the corrected polarity. Project
  memory still carries this prompt as "ran and looped; do NOT re-arm" — **the reason to leave it
  alone has changed from *it loops* to *it is finished*.**
- `pr-user-default-dashboard-ui-RETIRED-premise-cannot-die-2026-08-18.md` — already named RETIRED;
  exit 3 is expected.

Also: `pr-settings-home-slice0-DISARMED-premise-dead-2026-08-18.md` REJECTs `NO_FRONT_MATTER`, so
nothing can ever evaluate its staleness. It is DISARMED by filename only.

**DISPOSITION: DISPATCHED** to Station 00 — binning/retiring prompts is a board mutation and is 00's,
not mine.

### F4 — Zero dead gates across all 21 parked gates (clean result, recorded so it is not re-run)

Every `GATE_NOT_RELEASED` gate on the board resolves to a live named predecessor; none is a typo, a
renamed symbol, or an orphan waiting on work that no longer exists. The seven `GATE_RELEASED` HOLDs
below are ready to promote and are **surfaced, not armed** (arming is 00's, on Marco's authority):

`pr-crm-lastmile-s1-unblank-todos-and-notes` · `pr-dns-s4-checker-warn-only` ·
`pr-e2e-container-s2-swap-required-job` · `pr-guard-s1-verdict-file-list` ·
`pr-guard-s3-file-gate-not-released` · `pr-lessons-folder-s3-ref-checker` ·
`pr-rates-11b2-resolver-isactive-surface`

⚠️ A released gate is **not** an arming decision: RULE 4 still requires reading each body, and
`pr-lessons-folder-s3-ref-checker` is the predecessor that unblocks `pr-queue-armed-tracked-detector`
(`ci.yml :: check-sot-refs`), so ordering matters.

**DISPOSITION: DEFERRED.** Nothing to repair. This becomes urgent only if a future sweep finds a gate
whose needle no prompt and no open PR produces — that is the shape a dead gate takes.

## WHAT I DID NOT DO

- **Armed, promoted, disarmed, renamed or deleted nothing.** Station 04 is read-only on the board;
  the seven released gates are surfaced above for 00.
- **Did not edit `pr-nav-jobs-projects-merge-HOLD.md`,** despite its marker being the finding. The
  station doc forbids editing a prompt under critique — a silent auto-fix would poison the review.
- **Did not stage a fix prompt for F1.** The regex breadth is a genuine design choice with a
  self-reference hazard (F1), so it is Marco's call, not a lint-clean HOLD I should mint unilaterally.
- **Did not fast-forward the dev tree** (behind 1, ahead 2). Not my lane, and every gate reading here
  was taken against freshly-fetched `origin/main`, so being behind did not colour any verdict.
- **Did not touch PR #1350** beyond reading its diff and file list.
- **Did not run the other three sweeps** (instrument honesty, repo hygiene, instruction drift). One
  named sweep per run, covered completely, is the contract; the rotation has been advanced.
- **Did not run any Part 2 live-site pass** — out of scope for a gate-liveness sweep this run.

- **Did not commit the rotation file or this breadcrumb** — and the station doc contradicts itself
  here. AUTHORITY says *"commit that file with your breadcrumb"*; the REPORT CONTRACT says the
  breadcrumb *"is untracked until the next board PR commits it."* I followed the REPORT CONTRACT.
  **The rotation still turns correctly**: `next-sweep.mjs` reads the **working tree**, and the
  read-back after `--advance` returns `instrument-honesty`, so the next run will not repeat this
  sweep whether or not the file is committed. `git diff --cached --name-status` was **empty**, so no
  other chat's work was at risk either way. **Worth 00 resolving the contradiction in the doc** — one
  of the two lines is wrong and an agent has to guess every run.

---

*Untracked until a board PR commits it. Station 00: sweep this up.*
