# Pipeline correctness gates — binding slice plan

**Status:** authored 2026-08-05; awaiting Marco approval on this SLICE-0 document before any
code slice can arm.
**Owner:** Marco / ProjectOperations pipeline (`scripts/pipeline/**`, `scripts/pr-watcher/**`,
`.github/workflows/**`, plus `apps/web` + `apps/api` test suites).
**Chains behind:** `docs/plans/merge-liberty-and-speed-plan.md` — it is the governing doc for
merge policy. This plan reuses that plan's machinery (`must_contain:` front-matter,
`Assert-BodyClaimsAreReal`, the `needs-marco/` router) and does not contradict it.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. The decision lands in `sot/05` via a DEDICATED
doc-reconcile slice — never mixed with pipeline code.

## Alignment with merge-liberty (read first)

Merge-liberty enacts Marco's 2026-08-02 ruling: **"merge anything but hard-stops on green."**
The hard-stop list is four classes only — `azure`, `prod-auth`, `human-identity`, `prod-data`.
Migrations and permission/authz changes are deliberately NOT hard-stops; they auto-merge on green.

This plan does **NOT** re-widen the human bottleneck and adds **no** new `needs-marco/` parking
class. It adds **automated gates that replace human oversight** for two failure modes that pass
green CI today — exactly the "strengthen the gates before liberty widens" discipline merge-liberty
§1.5 asks for. Nothing here weakens a hard-stop; nothing here parks routine work on a human.

---

## 1. Motivation — two 2026-08-05 incidents that passed green CI

### 1.1 #923 — migration backfill wrote invalid data, CI stayed green
- `apps/api/prisma/migrations/20260804_fv2_formrule_expand/migration.sql` backfilled the new
  `FormRule.definition` JSONB from the legacy flat columns. It applied `lower(effect)` but copied
  `operator` **verbatim**.
- Legacy `operator` is stored UPPERCASE (`forms.service.ts` writes `rule.operator` unmodified;
  `forms.service.spec.ts` uses `operator: "EQUALS"`). The canonical `ConditionOperator`
  (`packages/config/src/forms-rule-definition.ts`) is lowercase (`equals`, `not_equals`, …).
- Result: every API-authored rule backfilled to a `definition.…operator` token the rules engine
  cannot match. **CI could not catch it** — JSONB content is not type-checked, and there was no
  test asserting a backfilled row is contract-valid. Caught by manual review only; fixed in commit
  `23dcf30b` (`lower(operator)`).

### 1.2 #922 — authz enforced inconsistently, e2e only checked the sidebar
- `apps/web/src/components/ShellLayout.tsx` dropped the Settings group's `adminOnly` nav gate and
  `SettingsShell.tsx` moved to per-item permission codes. Correct by design.
- But `apps/web/src/App.tsx` guards every sibling admin route in `<AdminOnly>` / `<SuperUserOnly>`
  while `/settings/company` and `/settings/ai` are bare `<Route>`s. No live exposure today (the page
  components and their APIs self-guard), but it is a defence-in-depth gap: a later refactor that
  drops the in-component check — assuming the route guards it, like its siblings — silently opens it.
- **CI could not catch it** — the only test touched (`batch1-auth-shell.spec.ts`) asserts the
  Settings sidebar *label* is visible to a viewer; nothing asserts direct-URL access is denied.
  Fix prompt staged (`pr-fix-settings-company-route-adminonly-ready.md`, PR #931).

### 1.3 Common root cause
CI proves **"green + the claimed files are present"** (`Assert-SmokeGreen` +
`Assert-BodyClaimsAreReal`). Nothing proves **(a)** migration-backfill *data correctness* or
**(b)** *URL-level authz consistency*. Those are the two gaps this plan closes.

---

## 2. Target policy — two automated gates

### Gate A — migration backfill correctness (closes #923)
A migration that *backfills* (contains an `UPDATE … SET`) must ship with a test that runs the
backfill against a seeded legacy row and asserts the produced value is contract-valid. Three layers:

- **Intake lint (deterministic).** Extend `scripts/pipeline/lint-prompt.mjs`: when `scope` includes
  `apps/api/prisma/migrations/**` AND the migration body matches a backfill signature
  (`/UPDATE\s+.*\sSET\s/i`), REQUIRE a `must_contain:` entry naming a backfill test file. Missing →
  `MISSING_FIELD`, prompt rejected before an agent runs. (Reuses merge-liberty SLICE 2's
  `must_contain` + `Assert-BodyClaimsAreReal` — no new field invented.)
- **CI (proves it).** A required job runs the backfill test on a seeded row and asserts every
  transformed token is a valid enum member of the canonical contract. A test of this shape, existing,
  goes RED on `'EQUALS'` — i.e. it catches #923.
- **AI reviewer (optional backstop, SLICE 4).** Before merge, a subagent adversarially reads any diff
  touching `prisma/migrations/**` (the exact read that caught #923: is every transformed column
  normalized to its canonical vocabulary? NULL / case / enum mismatches?). On a CONFIRMED blocker it
  **routes the PR's prompt to `needs-marco/`** — it can only fail *toward* a human, never auto-approve.

### Gate B — authz route-guard consistency (closes #922)
A static test that enumerates the admin/settings routes in `apps/web/src/App.tsx` and asserts each is
either wrapped in a guard (`AdminOnly` / `SuperUserOnly` / `RequirePermissions`) or the target page
self-guards. Deterministic, fast, no human. It fails closed on an unrecognised element shape, and it
would have flagged `/settings/company` immediately.

Both gates plug into machinery that already exists (`lint-prompt.mjs`, `Assert-BodyClaimsAreReal`,
the CI suite, the `needs-marco/` router). Neither parks routine work on a human.

---

## 3. Slice list (ordered, independently shippable)

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/pipeline-correctness-gates-plan.md`.
- **Gate:** `pnpm build && pnpm lint`. `escalates: true` — Marco reviews before any code slice arms;
  PR opens and stays unmerged with `do-not-merge`.
- **Requires:** nothing.

### SLICE 1 — Gate B: authz route-guard consistency test `size:2`
- **Files:** `apps/web/src/components/__tests__/route-guards.authz.test.ts` (new — parses `App.tsx`
  route table, asserts each `/settings/administration/*`, `/settings/company`, `/settings/ai`,
  `/settings/data-model` route is guarded or its page self-guards); tiny helper if needed.
- **Independent** (no dependency on merge-liberty). Cheapest, highest signal — ship first.
- **Gate:** `pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test`.
- **Requires:** SLICE 0.

### SLICE 2 — Gate A intake lint: require a backfill test `size:3`
- **Files:** `scripts/pipeline/lint-prompt.mjs` (+ its test); `docs/pr-prompts/PROMPT-SCHEMA.md`
  (document the rule).
- **Requires:** SLICE 0; merge-liberty SLICE 2 (the `must_contain` field). If merge-liberty has not
  landed `must_contain` yet, this slice defines the minimal field locally and merge-liberty adopts it —
  note the coordination in the PR body.

### SLICE 3 — Gate A CI job + reference backfill test `size:4`
- **Files:** a backfill test for `FormRule.definition` (asserts a seeded legacy row backfills to a
  valid `FieldRule`, operators/effects lowercase-normalized); `.github/workflows/*.yml` wiring the
  job as required. `gate_allow: none` (tests + CI only, no schema).
- **Requires:** SLICE 2.

### SLICE 4 — (optional) AI migration-reviewer gate `size:5`
- **Files:** `scripts/pr-watcher/index.mjs` and/or `scripts/pipeline/*` — before merge, dispatch an
  adversarial migration review on any diff touching `prisma/migrations/**`; CONFIRMED blocker routes
  the prompt to `needs-marco/`. Behind an env flag (default off) so it can land dark.
- **Requires:** SLICE 1 of **merge-liberty** (positive-control gate tests) — see Risk 5.3 there: never
  parallelise an unproven instrument. Ships only after those pass.

### SLICE 5 — sot/05 decision entry (docs-only, doc-reconcile) `size:1`
- **Files:** `sot/05-decisions-and-lessons.md` (record the two gates + the #923/#922 lessons);
  `docs/pipeline/DOCTRINE.md` cross-link. CP-24 sot-purity: never mixed with code.
- **Requires:** SLICES 1–3 (4 if taken).

---

## 4. Compensating controls (incident → gate)

| Incident | Failure CI missed | Gate | Slice |
|---|---|---|---|
| #923 | migration backfill wrote invalid enum tokens; JSONB not type-checked, no backfill test | Gate A (lint + CI + optional AI reviewer) | 2, 3, (4) |
| #922 | admin route unguarded; e2e checked sidebar label, not URL authz | Gate B (static route-guard test) | 1 |

Each gate is automated and fails safe: Gate B fails CI red; Gate A fails intake (lint) or CI red, and
the optional reviewer can only route to `needs-marco/`. No gate can silently pass a bad input, and none
introduces a new human bottleneck.

---

## 5. Risks

### 5.1 Gate B test rots as new route patterns appear
A new guard component or route shape the test doesn't recognise could slip through. **Mitigation:** the
test enumerates by route-path prefix and FAILS CLOSED on an unknown element type for a matched path —
an unrecognised shape is a red, not a silent pass. New guard components are added to the allow-list in
the same PR that introduces them.

### 5.2 Gate A lint false-positives on additive, non-backfill migrations
A pure `ADD COLUMN` with no data movement should not need a backfill test. **Mitigation:** the lint
only triggers on the backfill signature (`UPDATE … SET`), never on `ADD COLUMN` / `CREATE` alone.

### 5.3 The AI reviewer (SLICE 4) is a "broken instrument, parallelised" risk
Merge-liberty §5.3: a confident-wrong instrument run repeatedly is the worst failure mode.
**Mitigation:** the reviewer can only route to `needs-marco/` (fail toward a human), never auto-approve
or auto-merge; it lands behind an env flag; and it ships only after merge-liberty SLICE 1's
positive-control tests are green. It is a backstop, not a load-bearing gate — Gates A(lint+CI) and B
stand without it.

### 5.4 Dependency on merge-liberty (`must_contain`, `Assert-BodyClaimsAreReal`)
If merge-liberty stalls in review, Gate A's lint layer has no `must_contain` field to hang on.
**Mitigation:** SLICE 1 (Gate B) and SLICE 3's CI test are fully independent and ship regardless;
only SLICE 2's *intake-lint* layer depends on merge-liberty, and it can define the field locally if
needed.

### 5.5 CI wall-clock
A new required backfill-test job adds CI time to an already-serial `main` (merge-liberty §1.2).
**Mitigation:** the backfill test is a fast unit/integration test (seeded row, no browser); it runs in
the existing `test:web:logic`/api-test lane, not the Playwright suite.

---

## 6. Out of scope
- The four hard-stop classes (unchanged; owned by merge-liberty §2.2).
- What the acceptance suite tests (this plan adds targeted correctness tests, it does not rewrite specs).
- Pipeline speed / merge-queue / concurrency (merge-liberty owns those).
- Any schema migration — this plan is tests / scripts / CI / docs only (`gate_allow: none` on every
  code slice).
- Retroactive fixes for #923 (already fixed) and #922 (fix prompt #931 staged).

---

## 7. Verification of this document
- [x] `test -f docs/plans/pipeline-correctness-gates-plan.md`
- [x] Each incident in §1 is pinned to the file/commit that caused and fixed it.
- [x] Each gate maps to the incident it prevents (§4) and names where it plugs into existing machinery.
- [x] No new `needs-marco/` parking class for routine work; consistent with merge-liberty's
      "merge anything but hard-stops on green."
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
