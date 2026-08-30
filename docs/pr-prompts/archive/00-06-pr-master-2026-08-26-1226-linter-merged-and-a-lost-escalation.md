# Station 06 — PR Master — 2026-08-26 12:26Z — linter merged, and a Marco decision that was never filed

## GROUND

Station 06 (PR Master), `GH-Mantova/ProjectOperations`. Marco's standing loop, unattended.
Previous breadcrumb: `00-06-pr-master-2026-08-26-1156-windows-ci-merged-linter-armed.md`.

## WHAT I MEASURED

### #1336 — the linter fix (merged `b9eb3cf3`, 12:24:07Z)

4 files, `+627 / -6`. All three defects verified **from the runner log**
(`actions/jobs/98171947856/logs`), not from the PR body:

- **Human-gate blindness** — `HUMAN_GATE_PRESENT` fires on an HTML comment, on `DO NOT ARM`, and on
  `Arm ONLY`. Critically: `ok 9 — do NOT arm (mixed case) is NOT a gate (case-sensitive rule)`. That
  is the guard against re-introducing my own "12 gated prompts" error, where case-insensitive
  matching caught the ordinary prose line *"Do NOT arm, promote or rename any HOLD…"*.
- **TIER-1 destructive detector on quoted text** — `ok 1 — destructive-sounding filename in backticks
  does NOT force escalates`, with `ok 2 — real unquoted destructive DDL statement in prose DOES force
  escalates` as the negative control. The detector was narrowed, not disabled.
- **GATE_NOT_RELEASED (the F6 fix)** — `ok 1 — HOLD with absent requires_on_main needle does NOT
  return bare ADMIT`, plus `ok 3 — git probe failure → warn-and-skip, NOT false gate absent`. It
  fails safe rather than asserting "gate absent" when it cannot measure.

Totals: watcher suite `tests 137 / pass 137 / fail 0 / skipped 0`; new linter suite `33 / 33 / 0 / 0`.

**Scope excursion, examined and accepted**: `scripts/pipeline/test-lint-prompt.mjs` (+7 / −4) was not
in the declared scope. It had to change — it asserted the OLD contract (unmet gate → plain ADMIT,
exit 0), which is precisely what defect 3 inverts. The diff flips the expected exit 0→1 and the
assertion from "no PROMOTE" to "has GATE_NOT_RELEASED", with a comment naming the branch that changed
the behaviour. It re-points the test at the new contract rather than weakening it. Correct.

**This repairs the instrument that misled me earlier tonight.** From the next arm onward, a bare
`ADMIT` again means every declared gate is satisfied.

### Next candidate — `pr-dns-s1-tfm-series`, measured against main `b9eb3cf3`

Front matter read directly (not via my scan — see F4): `size: 3`, `gate_allow: none`,
`escalates: false`, `cluster: d-namespace`, `cluster_order: 1`, **no `requires_*`**. Chain head,
slice 1 of 5, Marco approved the chain 2026-08-20.
Premise `! grep -q "TFM-D3" …/sharepoint-legacy-copy.service.ts` — on main: `TFM-D3` **0**, against a
sanity floor of 774 lines / 24 import-export decls. 15 `TFM-` tokens already present and 3 bare
`D<digit>` tokens remain, so the slice is partly done and genuinely has work left. **Premise holds.**
Local 5269 − 99 CR = 5170 = main's size exactly.

## WHAT CHANGED

- **#1336 merged** — `b9eb3cf3`, native squash auto-merge.
- **`pr-dns-s1-tfm-series` ARMED** — `fs.renameSync`, 5269 → 5269 identical. Never `git mv`.
- **`needs-marco/rates-consumers-slice3-blocker-2026-08-26.md` FILED** — see F6 below.

## FINDINGS

**F6 — A Marco decision has been silently lost for seven days. Two agents said they escalated; neither did.**

At 12:16Z the watcher restaged `pr-rates-consumers-s3-persona-export` as attempt 2 (`-b-`). It ran
12:16:57 → 12:21:07, exit 0, **no branch, no PR** — the slice cannot be executed without breaking one
of three explicit "do not change" constraints. Its log names the file it escalated to:
`docs/pr-prompts/needs-marco/rates-consumers-slice3-blocker.md`.

**That file does not exist.** `needs-marco/` has not been written to since 2026-08-18.

Attempt (a), 2026-08-19, did the same: *"blocker report remain in place until you decide"* — nothing
in `needs-marco/`. It also said *"The user declined to answer"*, i.e. it tried to ask a human in an
unattended run and treated silence as grounds to halt. The STANDING AUTHORITY block exists to prevent
exactly that.

So both decision requests lived only inside `.log` files in the queue directory. Attempt (a)'s was
swept into `no-pr-opened/` and attempt (b)'s will follow. Per DOCTRINE §5b `needs-marco/` is the only
real stop — so by the stop mechanism's own reckoning, **nothing ever stopped**, twice, for a week.

I verified the technical claim rather than relaying it. `rate-resolver.service.ts` on main (748
lines): `type ListedRate` carries `info: Record<string, unknown>`, and the file mentions `fuelRate`
**0**, `loadRate` **0**, `wasteGroup` **0** times. The conflict is real and the agent was right to
stop. One correction to its framing: because `info` is already an open bag, **option A needs no type
change** — only three more keys populated in the resolver. Cheaper than the ~30 LOC presented, though
it still means touching the resolver the prompt forbade.
*Disposition: **ESCALATED** — filed to `needs-marco/` with options A/B/C intact. **I did not choose.** Slice 4 is
independent and unblocked.*

**F7 — The restage mechanism itself is sound.**
I initially read the unexplained `-ready` file in the queue as an unattributed arming. It was not:
`no-pr-opened/` holds attempt (a) and the watcher restages once with a `-b-` suffix. It terminates —
no loop. Worth recording because it means **the queue can gain armed prompts without me**, so
"arm ONE AT A TIME" constrains my hand, not the board.

## WHAT I DID NOT DO

- **Did not decide A/B/C** on the rates slice. Recorded only.
- **Did not touch worktree `agent-a734bd30ec4540c44`**, reported left in place on 2026-08-19 and
  flagged in the escalation as a possible disk leak. Not checked, not cleaned.
- **Did not arm `pr-tendering-board-restore-submitted-cardless`** despite it also being a valid
  slice-0. Its scope is `TenderingPage.tsx` + `tenderingPage.helpers.ts`, and #1334 changed that
  surface an hour ago by rendering `<TenderingPage>` inside the new Pipeline Board tab. Arming a
  6-day-old prompt against code that moved twice tonight, unattended, is the riskier of the two
  cluster heads. It stays HOLD and is the natural next arm once Marco has eyes on it.
- **Did not run `git` through the device bridge.** All measurement via the GitHub API against main.
- **Did not arm a second prompt.** RULE 4: one at a time.
- **Did not commit anything.** Breadcrumbs, the s3-nav HOLD, and the new `needs-marco/` file are all
  uncommitted; Marco sweeps them himself.
