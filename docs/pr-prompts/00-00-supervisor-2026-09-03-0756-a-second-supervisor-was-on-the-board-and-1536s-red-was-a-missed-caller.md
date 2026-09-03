# Station 00 — Supervisor | 2026-09-03T07:06Z–2026-09-03T07:58Z

## GROUND

```
UTC            2026-09-03T07:06:09Z
origin/main    5072f3f6            (fetch --prune, then rev-parse; run opened at 0d67adb1)
dev tree       main @ 5072f3f6     C:\ProjectOperations2  (ff-only, "Already up to date")
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — READ-WRITE. **SIGHTED**, but note the instrument dropped and was re-acquired:
Desktop Commander disconnected at the end of the previous turn and `start_process` succeeded again on
the first call after reload. **A schema that is not loaded is not blindness** (PREFLIGHT step 1).

**This run was an INTERACTIVE Station 00, launched by Marco at ~07:06Z with "you have control".**
That matters for everything below, because it was not the only Station 00 on the board.

## WHAT I MEASURED

| # | Claim | Evidence |
|---|---|---|
| 1 | No git locks; board empty at open | `[MEASURED]` `index.lock`/`HEAD.lock` absent. `gh pr list --state open` → **0**. |
| 2 | Watcher HEALTHY throughout | `[MEASURED]` `restart-watcher-if-wedged.ps1` → `HEALTHY`, pid 26656, heartbeat 0–2 min, churn 0/20 min. Never restarted; a 19-minute build was read as **BUSY**, not wedged. |
| 3 | A SECOND Station 00 was acting concurrently | `[MEASURED]` `#1535` opened **07:17:04Z** on `board/00-2026-09-03-0715-collect`, author `GH-Mantova`, carrying `00-00-supervisor-2026-09-03-0715-…md` — the hourly scheduled run. It also rewrote `MEMORY.md` under me. |
| 4 | Queue: 82 HOLDs — 46 ADMIT, 2 PROMOTE, 24 correctly GATED, 9 REJECT | `[MEASURED]` per-file `lint-prompt.mjs` over all 82. |
| 5 | `pr-visualreview-s1` armable on four independent instruments | `[MEASURED]` ADMIT size 1 · 0 don't-arm markers **with `pr-524` control returning 2** · tracked on `origin/main` via `ls-tree` · dev tree proven at `origin/main` first. |
| 6 | Arm succeeded and released the index | `[MEASURED]` `arm-prompt.ps1` → `SUCCESS`, `Index clean after release`, audit line `2026-09-03T07:24:12Z ARMED pr-visualreview-s1…`. |
| 7 | `#1536` is `marco:true` | `[MEASURED]` `Select-String -Pattern 'marco.:true'` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`. **POS control 604, NEG control 0.** |
| 8 | `#1536`'s API red was a REAL defect, not the label | `[MEASURED]` job log: `Test Suites: 1 failed … 278 passed`, `Tests: 3785 passed`, **0 test failures** — a suite that failed to *compile*. |
| 9 | `#1536`'s other two reds ARE the label | `[MEASURED]` CP-26 log: `[LABEL_PRESENT] PR carries the do-not-merge label (escalates:true). A human must review and REMOVE the label`. |
| 10 | The fix worked | `[MEASURED]` after push `4d70e476`: `API — lint, test, compliance smoke` **COMPLETED/SUCCESS**, `tendering-e2e` **COMPLETED/SUCCESS**. |
| 11 | The archive backlog I twice reported does NOT exist | `[MEASURED]` `git ls-tree -r origin/main` → **18** breadcrumbs in the queue root, **16 of them today's current cycle**, against **269** already in `archive/`. |

## WHAT CHANGED

1. **Armed `pr-visualreview-s1-restore-vision-review-to-00`** (07:24:12Z) via `arm-prompt.ps1`. The
   watcher built it and opened **`#1537`** (docs-only, `policy=tests-docs, waiting`), still open and
   CLEAN in its lane window at the close of this run.
2. **Fixed `#1536`'s red** — one commit, `4d70e476`, four lines in
   `apps/api/src/modules/tendering/__tests__/sub-discipline.spec.ts`. Verified by CI, not by reading.
3. **Nothing merged.** No label touched, no receipt authored, no watcher restart, no `/sot/` edit.

## FINDINGS

### F1 — Two Station 00s were driving one board at the same time, and only luck kept them apart

At 07:06Z Marco handed an interactive session "control" of the board. At **07:15Z the hourly
scheduled Station 00 fired**, and at 07:17:04Z it opened `#1535`. For roughly ten minutes there were
**two supervisors with the same authority, the same scripts and the same shared git index.** That is
BOARD DRIVING condition 3 and LL-38 exactly: *"first confirm nothing else is mid-mutation. If
something else is acting, STOP."*

Nothing broke, and the reason is worth stating precisely: **the collision was avoided by timing, not
by any guard.** The scheduled run happened to finish its board PR before I reached my arming step. Had
I armed two minutes earlier we would have had two `arm-prompt.ps1` calls racing for the same lock, and
`#1535` would have carried whatever I had staged. `arm-prompt.ps1` would have caught the index
collision — that is what it is for — but nothing at all guards two supervisors *choosing different
prompts to arm* or *both deciding to merge the same PR*.

It also produced a real, if harmless, artefact: the scheduled run **refuted my own previous finding**
(lane occupancy as a second cause of the `marco:true` timeout) with better evidence — four docs-only
PRs auto-merged inside overlapping windows — while I was still acting on it. I accept the refutation;
it is correct and I have not reverted it.

**DISPOSITION: ESCALATED** — Marco. This is a design question and only he can answer it (RULE 3),
because it is about how *he* wants to use the interactive session. Under RULE 1, the complete-and-
additive option first:

- **(A) Make concurrency detectable, and keep both lanes.** Have `arm-prompt.ps1` and the merge
  primitive write a short-lived `board-actor.lock` carrying actor id, PID and UTC, and have every
  station's PREFLIGHT read it and stand down if another actor is live. *Complete* — it fixes the
  general case, including a future third lane — and *additive*: nothing existing stops working, the
  lock only adds a refusal. Costs one small script change plus a PREFLIGHT line in six station docs.
- **(B) Pause the scheduled 00 while an interactive session holds the board.** Simple and immediate,
  but fails the "future" half of RULE 1 — it is a manual step Marco must remember, and forgetting it
  looks exactly like everything being fine. It also re-introduces the 09-02 failure where the
  scheduled tasks sat disabled for 16.6 h and nobody noticed.
- **(C) Do nothing and rely on timing.** Fails both halves. It is what happened today, and today it
  worked.

**What makes this urgent:** it recurs on a fixed schedule. Any interactive session running across the
hour boundary meets the scheduled run again.

### F2 — `#1536` went red because WBS-SHIFT-S2 changed a signature and missed one caller

`buildRateMaps`'s labour parameter became shift-aware — `{role, dayRate}` → `{role, shift, rate}`
(`scope-item-pricing.ts:111`). The prompt updated `scope/__tests__/scope-item-pricing.spec.ts` but not
`apps/api/src/modules/tendering/__tests__/sub-discipline.spec.ts`, which builds the old shape in four
fixtures. TypeScript rejected the file, so the **suite never ran**.

The shape of the failure is the point: **`Tests: 3785 passed`, zero failures, job RED.** Anyone reading
the test summary rather than the log would have called this a flake and re-run it — DOCTRINE §2's
*"never re-run hoping for green"* with a specific costume.

The fix is `shift: "day"`, which is not a convenience: `buildRateMaps` populates the backward-compat
`labourRateByDiscipline` map **only** on the `day` branch, so day-shift fixtures preserve every existing
assertion exactly. No assertion was weakened, nothing skipped — §8.2's line that a quick fix must never
be a mask.

**DISPOSITION: ACTIONED** — `4d70e476` pushed to the PR branch, read back as the PR head, and
`API — lint, test, compliance smoke` plus `tendering-e2e` both went **COMPLETED/SUCCESS**. The exit
code decided, not my reading of it.

### F3 — `#1536` is green on every real check and is now Marco's alone

Green: API, `tendering-e2e`, Web, CodeQL, both Pipeline jobs, Data model. Red: `PR gates — diff
checks` and `Approval receipt (CP-26)` — **both caused by the `do-not-merge` label itself**, proven from
the CP-26 log rather than assumed from memory.

Two hard stops apply and neither is mine to cross: **I never remove a `do-not-merge` label**, and
**no agent may ever author `docs/decisions/merge-approvals/1536.md`** — the file CP-26 is asking for.
RULE 2 independently bars the merge: the watcher's verdict is `marco:true`.

**DISPOSITION: ESCALATED** — Marco, and it is a one-liner: **`#1536` (WBS-SHIFT-S2 night/weekend shift
pricing) is green and waiting on you for the two things only you can do — remove `do-not-merge` and
author the `1536.md` receipt.**

### F4 — I twice reported an archive backlog that does not exist

My 06:25Z breadcrumb said archiving dispositioned breadcrumbs was "becoming a real backlog" and
deferred it a second time. **Measured this run: 18 breadcrumbs in the queue root, 16 of them today's
current cycle, against 269 already archived.** The station doc's archive rule was written when the root
held 159 against 59 live prompts. The root is fine, and the correct action is to archive nothing.

I inherited that claim from my own earlier run without measuring it — the exact re-read failure
DOCTRINE §7.1 names, committed against my own artifact.

**DISPOSITION: ACTIONED** — measured and retired. **Do not re-raise the archive backlog**, and do not
act on the 06:25Z breadcrumb's "WHAT I DID NOT DO" bullet about it.

## WHAT I DID NOT DO

- **Did not merge anything.** `#1537` is docs-only and CLEAN but belongs to its `tests-docs` lane, which
  is measurably working; `#1536` is Marco's twice over. This board PR is deliberately left unmerged
  because `#1537` is inside its 90-minute window — waiting PR first, board PR second.
- **Did not arm a second prompt.** RULE 4 — `pr-visualreview-s1` was in flight for the rest of the run.
  Next in line, evidence already recorded: `pr-visualreview-s3` (ADMIT 3), `pr-claudedesign-s1`
  (ADMIT 10), `pr-doctrine-s95-cite-symbol-not-line`. **`pr-visualreview-s2`'s gate releases the moment
  `#1537` lands** — its needle is `VISION REVIEW` in `00-supervisor.md`, which is what `#1537` writes.
- **Did not arm `pr-tr-s1-reminder-policy`** (size 9, `gate_allow: migrations` — Marco's to authorise)
  or **`pr-fv2-formrule-contract`** (standing never-arm list), both of which lint ADMIT. A lint verdict
  is not permission.
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, production data, or the five unrelated dirty
  working-tree entries. Every commit this run used an explicit pathspec.
- **Did not restart the watcher** on a 19-minute build. BUSY is not WEDGED.
- 🔧 **Noted, not actioned:** `pr-cardui-s2-wbs-table-shell`'s never-arm condition was *"while `#1483` is
  open"*, and **`#1483` merged on 2026-09-02** — the condition has expired and that memory entry should
  be discharged rather than carried forward as live.
