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

`[CANNOT MEASURE]` Whether other prompts on disk carry the same shape. A sweep needs the rule below
to exist first; grepping by hand for "do not add a migration" across 3,199 prompt stems is not a
reliable instrument.

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

1. **Add the rule?** REJECT, or WARN-only for a period first so we can see how many existing prompts
   it lights up without blocking the board.
2. **Sweep existing prompts?** The rule is cheap to run in report-only mode across
   `docs/pr-prompts/**`. If others carry the shape, better to know before one is armed.
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
- Did **not** sweep the other prompts for the same shape. Doing it by hand would produce a number I
  could not defend; it wants the rule in report-only mode.

## FINDINGS

- **ACTIONED** — #1823 fixed at `5fa45ce8` via option (d): `TEAM_VISIBILITY_CODES` accepts
  `tenders.allocate` as well, so nothing depends on an undeliverable grant. `seed.ts` reverted to
  byte-identical with `origin/main`; CP-23 now reports
  `PASS [no seed files changed]`. A `[delivery-mechanism guard]` test fails if anyone re-narrows it.
- **ACTIONED** — originating prompt amended: §1 scoped to the permission row, §4 rewritten (original
  preserved in a `<details>` block so the defect stays legible), §5 given the guard test, the
  forbid-migration Do NOT line qualified, `scope` and `size` corrected, and the false "it seeds a
  role grant that runs on deploy" line fixed.
- **ESCALATED** — the linter rule above. Three questions, all board-throughput trade-offs.
- **DEFERRED** — the sot lessons entry, to Station 05's doc-reconcile lane.
- **DEFERRED** — the sweep of existing prompts, until the rule exists in report-only mode.
