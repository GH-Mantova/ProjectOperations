# Station 06 — cardui s2 must carry the e2e migration, and its HOLD is a live duplicate hazard

## GROUND

- `origin/main` `6583a220` at time of measurement.
- Cluster `scope-card-redesign`: s1 merged, s2 open as #1483 (red), s3–s8 on HOLD.
- Ruleset `15532058` required checks include `tendering-e2e`.
- Marco chose, this session: migrate the acceptance suite in-chain with tracked restoration
  markers; hold #1483 until the strategy is staged.

## WHAT I MEASURED

- `gh run view 33555041439` — #1483 fails `tendering-e2e` with **7 failed**, not 1:
  `batch3-scope-items` :65 :122 :184 :252, `batch3-scope-waste` :45, `batch8-misc` :91 :105.
  Every one resolves through `getByRole("article")` or `getByLabel("Expand item")`.
- `git diff --stat` on `feat/scope-s2-wbs-table-shell`: `ScopeQuantitiesTable.tsx`
  +1130 / −821. `git grep` on the branch: `Expand item`, `Collapse item` and `role="article"`
  return **no hits** under `apps/web/src/pages/tendering`. The card affordances are gone.
- `PR gates — diff checks` and `Approval receipt (CP-26)` are the **same job** (run 33555041808)
  failing once: CP-26 wants `docs/decisions/merge-approvals/1483.md` on the branch.
- `git ls-tree origin/main docs/pr-prompts/` — `pr-cardui-s2-wbs-table-shell-HOLD.md` is
  **still tracked on main**. s1's prompt is not. The working copy is byte-identical to main
  (the 87-byte delta against `git show` is CRLF, not content).
- s2's `premise` still evaluates true against main (`SCOPE_WBS_TABLE_V1` absent), so the prompt
  is live and armable.

## WHAT CHANGED

- `pr-cardui-s2-wbs-table-shell-HOLD.md`: three acceptance specs added to `scope`, `size` 8 → 10,
  new sections mandating the suite migration with `TODO(SCOPE_*)` restoration markers, and
  housekeeping requiring the PR to delete its own prompt from main.
- `pr-cardui-s8-waste-section-HOLD.md`: `size` 6 → 9, ratchet added —
  `scripts/pr-gates/e2e-restoration-markers.mjs` as its own CI job, failing once
  `SCOPE_WASTE_SECTION_V1` is on main and any marker is still outstanding.
- Lint after amendment: s2 `PROMOTE` + `GATE_RELEASED` (size 10); s3–s8 `REJECT
  [GATE_NOT_RELEASED]`, the correct parked state for chain successors.

## FINDINGS

**F1 — A separate migration slice is impossible; the ordering deadlocks.** `tendering-e2e` is
required, so s2 cannot merge with the suite red; and the suite cannot be rewritten before the
table it targets exists. I framed Marco's choice as "insert s2a after s2" without checking that.
The chosen mechanism — in-chain, marked, ratcheted — survives intact; only the packaging moved
into s2. **ACTIONED.**

**F2 — I staged an 8-slice chain that deletes a UI the acceptance suite asserts, and budgeted no
slice for it.** Same class of miss as the Waste omission earlier in this cluster: I sliced the
build and did not slice the tests that hold the build to account. Every slice from s2 onward
would have hit this wall. **ACTIONED** via the s2/s8 amendments.

**F3 — `pr-cardui-s2-wbs-table-shell-HOLD.md` is a live duplicate hazard.** Arming renames
HOLD → ready in the working tree only; the HOLD stays tracked on main and any pull restores it.
Its premise still passes, so Station 00 can arm it and open a second PR for work #1483 already
carries. The structural fix is in s2's housekeeping section, but that only lands when the branch
does. Until #1483 merges, **do not arm `pr-cardui-s2-*`**. **ESCALATED to Station 00.**

**F4 — Arming does not remove the consumed prompt from main.** F3 is an instance, not an
accident: any armed prompt whose PR does not explicitly delete it stays armable forever. s1's
prompt is absent from main only because its PR happened to remove it. This wants a queue check
of its own — a prompt tracked on main whose PR is open or merged is a defect. **DEFERRED** —
not staged; needs its own prompt.

**F5 — Folding a new assertion into `pr-gates.mjs` makes one failure surface as two red checks.**
CP-26 failing takes `PR gates — diff checks` down with it, and the board shows two independent
reds for one cause. I built that when I gave CP-26 its own job name over the same script. s8's
ratchet is specified as a genuinely separate job to avoid repeating it. **ACTIONED** in the s8
prompt; the CP-26 coupling itself is **DEFERRED**.

## WHAT I DID NOT DO

- Did not touch #1483's branch. Marco elected to hold it until the strategy was staged.
- Did not arm, promote or merge anything. Both amended prompts remain `-HOLD`.
- Did not write `docs/decisions/merge-approvals/1483.md`. It records Marco's approval; authoring
  it myself would hollow out the gate Option A exists to create.
- Did not delete or `.skip()` any failing test.
- Did not remove `pr-cardui-s2-wbs-table-shell-HOLD.md` from main — that is a commit to main,
  which is outside Station 06's authority. Flagged as F3 instead.
