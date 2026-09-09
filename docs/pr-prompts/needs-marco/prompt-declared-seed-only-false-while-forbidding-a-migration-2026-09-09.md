# A prompt can declare `seed_only: false` while forbidding a migration. CP-23 then makes it unsatisfiable, and `lint-prompt.mjs` cannot detect it.

**Raised by** Station 00, 2026-09-09
**Found via** PR #1823 (EA-GATE report self-filter), routed REJECT-AND-REDO by the watcher
**Originating prompt** `docs/pr-prompts/pr-ea-gate-report-self-filter-HOLD.md` (amended in the same PR as this file)
**Marco's call needed on** whether to add the linter rule proposed at the bottom

---

## GROUND

CP-23 (`scripts/pr-gates/pr-gates.mjs:254-316`) exists because production deploys with
`prisma migrate deploy` and never runs the TypeScript seed. Two silent regressions to date
(#504, #506). It fails any PR that touches `apps/api/prisma/seed*` without adding a new folder under
`apps/api/prisma/migrations/`, and offers exactly **two** exits:

1. add a migration alongside the seed change; or
2. put a column-0 `SEED-ONLY: dev` line in the PR body — which is an assertion that
   **production does not need this data**.

Separately, prompt front matter carries a `seed_only` boolean, listed among the known keys at
`scripts/pipeline/lint-prompt.mjs:996`.

## WHAT I MEASURED

`[MEASURED]` The prompt that produced #1823 contained all four of these at once:

| Where | Text |
|---|---|
| front matter | `seed_only: false` |
| front matter | `scope:` includes `apps/api/prisma/seed.ts` |
| §1 | "**No migration is needed.**" |
| §4 | grant `reporting.team` to every role holding `tenders.allocate`, via `rolePermission.createMany` in `apps/api/prisma/seed.ts` |
| §4 rationale | "it means **nobody loses access on deploy**" |
| Do NOT | "Do NOT add a migration, touch `schema.prisma`, or regenerate the data-model map." |

`[MEASURED]` The agent followed it exactly. #1823's previous head (`e43a5f3b`) changed `seed.ts`
(+32 lines) and added no migration. CP-23 failed. The agent had no compliant move available.

`[MEASURED]` Both CP-23 exits were closed by the prompt's own text:

- exit 1 (**add a migration**) — forbidden by the Do NOT list;
- exit 2 (**`SEED-ONLY: dev`**) — would have asserted production does not need the data, which
  contradicts §4's own stated rationale, "nobody loses access **on deploy**".

`[MEASURED]` `seed_only: false` was the *correct* declaration. This was never dev-only data. The
front matter and §4 were therefore contradictory too — and the correct value of the field is exactly
what made §4 impossible.

`[MEASURED]` `lint-prompt.mjs` ADMITted the prompt. POS control: the same linter REJECTs on its
other rules, so the instrument was live. It cannot catch this one because it validates `seed_only`
as a known key with a boolean value and never cross-checks the prose against the declared `scope`.

`[MEASURED]` The §1 claim was *half* true, which is why it survived review. The startup registry
re-sync (`permission-registry.ts:2`) does cover the `permissions` **row** — the definition of the
code. It does **not** cover `rolePermission` links, which are ordinary seed data. §4 extended the
narrower true claim to cover the wider false one.

`[MEASURED]` **The board carries exactly one other prompt with this shape, and it was armable.**

I first wrote this section as `[CANNOT MEASURE]`, on the reasoning that grepping 3,199 prompt stems
by hand is not a defensible instrument. That was the wrong denominator. The set that can actually be
armed is the 36 `*-HOLD.md` at **depth 1** of `docs/pr-prompts/`, which is entirely tractable, so I
implemented the four conditions of the proposed rule as a report-only probe and ran it over that set:

```
=== CONTROLS ===
  POS fixture fires = true    (must be true)
  NEG fixture fires = false   (must be false)     <- same fixture with gate_allow: migrations

=== SWEEP: 36 *-HOLD.md at depth 1 ===
  prompts touching apps/api/prisma/seed* in scope : 6
  of those, RULE WOULD FIRE                       : 1
  unreadable                                      : 0

=== WOULD FIRE ===
  pr-ea-s2-dashboard-preset-HOLD.md
      seed_only=false  escalates=true  gate_allow=none
      scope seed entries: apps/api/prisma/seed.ts
      matched: no-migration-is-needed
```

Both controls behaved, and the 6 seed-touchers prove the `c1` detector was live — so "1 of 36" is a
real count, not a silent no-op. **False-positive rate on this board: 0 of 1.** The rule found the one
prompt that has the defect and did not flag the other five prompts that touch the seed legitimately.

That prompt was sitting in the triage's **GATES SATISFIED** bucket — presented to every station as an
arming candidate. Had any station armed it, CP-23 would have failed the resulting PR for exactly the
reason recorded here, and a second arm-implement-open-review cycle would have been spent on a
known-unsatisfiable spec.

`[MEASURED]` The same prompt is **also** superseded: `pr-ea-gate-report-self-filter-HOLD.md` says
EA-GATE, EA-2a and EA-2b together replace it, and both successors are on disk
(`pr-ea-s2a-dashboard-preset-seed-HOLD.md`, `pr-ea-s2b-dashboard-filter-surface-HOLD.md`). Nothing in
the prompt itself said so, so neither a reader nor the triage report could see it.

**Action taken:** a `<!-- watcher: do-not-arm -->` marker plus a dated, explicitly reversible
Station-00 hold note has been added to that prompt in this same PR. It now REJECTs
`HUMAN_GATE_PRESENT` instead of ADMITting, so nothing can arm it. Deleting one line clears the hold.
Whether it is retired to `superseded/`, repaired with a real migration, or declared dev-only is
Marco's call and is set out in the note.

That is a one-off manual hold on one prompt. It is not a substitute for the rule: the next prompt
with this shape will ADMIT exactly as this one did.

## WHY THIS IS A CLASS, NOT AN INCIDENT

The failure was **fully determined at authoring time** and survived every gate before CI:

1. the prompt author (an agent) wrote a self-contradictory spec;
2. `lint-prompt.mjs` ADMITted it — no rule covers the shape;
3. RULE-4 arming checks passed — the three don't-arm markers are absent;
4. the implementing agent followed it faithfully — the contradiction is only visible if you already
   know CP-23's two exits;
5. CI caught it, correctly, but **after** a full arm-implement-open-review cycle had been spent;
6. the watcher's verdict named the defect but offered only (a) add a migration, (b) drop the code,
   (c) ship code-only and accept the regression — none of which is the cheap fix.

The cheap fix was (d), key visibility off a **list** of codes including one production already has.
Nothing in the pipeline was positioned to propose it, because every layer was reasoning about how to
satisfy the prompt rather than whether the prompt was satisfiable.

The generalisation, which is what makes this worth a rule:

> **A prompt that requires production data AND forbids the only mechanism that delivers production
> data is unsatisfiable. Nothing before CI checks for that.**

## PROPOSED LINTER RULE — Marco's call

Add to `lint-prompt.mjs`. Verdict **REJECT**, code `SEED_GRANT_UNDELIVERABLE`. Fires when **all** of:

1. `scope` contains a path matching `^apps/api/prisma/seed`; **and**
2. `scope` contains no path matching `^apps/api/prisma/migrations/`; **and**
3. `gate_allow` does not include `migrations`; **and**
4. the body matches a forbid-migration instruction, case-insensitive —
   `/do\s+NOT\s+add\s+a\s+migration/i` or `/no\s+migration\s+is\s+needed/i`.

Message: *"This prompt writes to the Prisma seed, forbids a migration, and does not declare
`gate_allow: migrations`. Under CP-23 that is unsatisfiable — the only two exits are a migration
(which you forbid) or a `SEED-ONLY: dev` body marker (which asserts production does not need the
data). Either declare the data dev-only, or permit the migration."*

Every input is already available to the linter — `scope`, `gate_allow` and the body text are all
parsed today. No new I/O, no `git show` probe, so it cannot take the warn-and-skip fail-safe path
that silently no-ops `CLUSTER_DEAD_GATE` on a shallow checkout.

**Deliberately narrow.** It does not attempt to judge whether data is "production-required" — that
is prose, and guessing would produce false REJECTs on genuinely dev-only seed prompts. It fires only
on the mechanical contradiction: *touches seed + forbids migration + no migrations gate*. A genuinely
dev-only prompt clears it by declaring so, which is a sentence the author should have written anyway.

### The three questions for Marco

1. **Add the rule?** The WARN-first hedge was there in case the rule lit up half the board. It does
   not — 1 of 36, no false positives — so **REJECT straight away** looks safe, and REJECT is the
   verdict that actually prevents the wasted cycle. Your call; I have not implemented either.
2. ~~**Sweep existing prompts?**~~ **Done — see WHAT I MEASURED.** 1 of 36 depth-1 HOLDs fires,
   0 false positives, and that one prompt is now held with a `do-not-arm` marker pending your call
   on it. The remaining question is only whether to widen the sweep past depth 1; I would not
   bother, since nothing below depth 1 is armable.
3. **Should `seed_only: false` + a `seed*` path in `scope` be a REJECT on its own,** independent of
   the prose? Stricter and simpler — no regex over English — but it would REJECT a legitimate
   prompt that touches the seed *and* adds a migration in the same slice, unless condition 2 above
   is kept. I lean on keeping condition 2 and *not* going stricter, but this is a board-throughput
   trade-off and therefore yours.

## WHAT I DID NOT DO

- Did **not** implement the linter rule. `lint-prompt.mjs` is the instrument the whole arming path
  depends on; a rule change belongs in its own PR with tests, after Marco rules on the shape.
- Did **not** touch `sot/05-decisions-and-lessons.md`. CP-23's own error text cites #504 and #506
  there, and this class belongs beside them — but sot edits land only via Station 05's dedicated
  doc-reconcile PR (CP-24 hard-blocks mixing). **Flagged for Station 05.**
- Did **not** re-arm or retire the originating prompt. Its `premise` goes false when #1823 merges, so
  `lint-prompt.mjs` returns SPENT and it cannot be re-armed. Retirement to `superseded/` is Station
  05's board-PR lane.
- Did **not** decide what happens to `pr-ea-s2-dashboard-preset-HOLD.md`. Holding it from being
  armed is a supervisor's job; choosing between retiring it, giving it a real migration, or
  declaring its preset dev-only is not. All three are laid out in the note on the prompt itself.
- Did **not** run the probe below depth 1 of `docs/pr-prompts/`. Nothing there is armable, so the
  extra coverage buys nothing; say the word if you want it anyway.

## FINDINGS

- **ACTIONED** — #1823 fixed at `5fa45ce8` via option (d): `TEAM_VISIBILITY_CODES` accepts
  `tenders.allocate` as well, so nothing depends on an undeliverable grant. `seed.ts` reverted to
  byte-identical with `origin/main`; CP-23 now reports
  `PASS [no seed files changed]`. A `[delivery-mechanism guard]` test fails if anyone re-narrows it.
- **ACTIONED** — originating prompt amended: §1 scoped to the permission row, §4 rewritten (original
  preserved in a `<details>` block so the defect stays legible), §5 given the guard test, the
  forbid-migration Do NOT line qualified, `scope` and `size` corrected, and the false "it seeds a
  role grant that runs on deploy" line fixed.
- **ACTIONED** — swept all 36 depth-1 HOLDs with a controlled report-only probe of the proposed rule.
  1 fires, 0 false positives, 6 seed-touchers proving the detector was live.
- **ACTIONED** — `pr-ea-s2-dashboard-preset-HOLD.md`, the one that fires, was sitting ADMIT in the
  triage's arming-candidate bucket. It now carries a `<!-- watcher: do-not-arm -->` marker and a
  dated, one-line-reversible Station-00 hold note. It is also superseded by two prompts that already
  exist on disk, which nothing on it recorded.
- **ESCALATED** — the linter rule. Three questions; question 2 is now answered by the sweep and
  question 1's WARN-first hedge is no longer needed, so what is really left is 1 and 3.
- **ESCALATED** — what happens to `pr-ea-s2-dashboard-preset-HOLD.md`: retire, repair, or leave held.
- **DEFERRED** — the sot lessons entry, to Station 05's doc-reconcile lane.
