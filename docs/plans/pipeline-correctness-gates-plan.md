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
class for routine work. It adds **automated gates that replace human oversight** for two failure
modes that pass green CI today — exactly the "strengthen the gates before liberty widens" discipline
merge-liberty §1.5 asks for. Nothing here weakens a hard-stop.

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
A migration that *backfills* (contains an `UPDATE … SET`) must ship with a test that runs the backfill
against a seeded legacy row and asserts the produced value is contract-valid. Three layers, ordered so
the independent, load-bearing pieces do not wait on any other plan:

- **CI test (proves it) — ships first, depends on nothing.** A required job runs a backfill test on a
  seeded row and asserts every transformed token is a valid enum member of the canonical contract. A
  reference test for `FormRule.definition` (operators/effects lowercase-normalized) is included — a
  test of this shape, existing, goes RED on `'EQUALS'`, i.e. it catches #923.
- **Intake lint (makes it general) — STANDALONE, no merge-liberty dependency.** Extend
  `scripts/pipeline/lint-prompt.mjs`: when `scope` includes `apps/api/prisma/migrations/**` AND the
  migration body matches a backfill signature (`/UPDATE\s+.*\sSET\s/i`), REQUIRE that `scope` also
  names a test file (`*.spec.ts` / `*.test.ts`). Missing → `MISSING_FIELD`, prompt rejected before an
  agent runs. This rule stands on its own; IF merge-liberty's `must_contain` field later lands, the
  rule upgrades to also assert the named test appears in the diff (`Assert-BodyClaimsAreReal`) — an
  enhancement, not a prerequisite.
- **AI reviewer (optional backstop, SLICE 4).** Before merge, a subagent adversarially reads any diff
  touching `prisma/migrations/**` (the read that caught #923: is every transformed column normalized to
  its canonical vocabulary? NULL / case / enum mismatches?). On a CONFIRMED blocker it routes the PR's
  prompt to `needs-marco/` — fail toward a human, never auto-approve. See §5.3 for its tension with
  merge-liberty; it is genuinely optional and the two layers above stand without it.

### Gate B — authz route-guard consistency (closes #922)
A static test over `apps/web/src/App.tsx` asserting **every route that renders an admin/super/platform
page** is either wrapped in a guard (`AdminOnly` / `SuperUserOnly` / `RequirePermissions`) **or** listed
in an explicit `SELF_GUARDED_ROUTES` allowlist. Each allowlist entry carries a comment naming the
in-component guard it relies on (e.g. `/settings/ai` → `canViewAiSettingsPage` / `canViewCompanyTab`).
The test FAILS CLOSED on any admin-rendering route that is neither wrapped nor allow-listed — so
`/settings/company` (the #922 gap) reds immediately, while `/settings/ai` (correctly self-guarding)
passes only because it is a deliberate, reviewed allowlist entry visible in the diff. The test cannot be
silently satisfied. Scope note: the enumeration is by "renders an admin/super page," not just the
`/settings/*` prefix, so admin routes elsewhere in `App.tsx` are covered too.

Both gates plug into machinery that already exists (`lint-prompt.mjs`, the CI suite, the `needs-marco/`
router). Gates A (CI + lint) and B introduce no new human bottleneck.

---

## 3. Slice list (ordered, independently shippable)

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/pipeline-correctness-gates-plan.md`.
- **Gate:** `pnpm build && pnpm lint`. `escalates: true` — Marco reviews before any code slice arms;
  PR opens and stays unmerged with `do-not-merge`.
- **Requires:** nothing.

### SLICE 1 — Gate B: authz route-guard consistency test `size:2`
- **Files:** `apps/web/src/components/__tests__/route-guards.authz.test.ts` (new — parses the `App.tsx`
  route table; asserts every admin/super-rendering route is guarded or on `SELF_GUARDED_ROUTES`);
  a small `SELF_GUARDED_ROUTES` allowlist constant with justifying comments, seeded with `/settings/ai`.
- **Independent** — no dependency on merge-liberty. Cheapest, highest signal — ship first.
- **Gate:** `pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test`.
- **Requires:** SLICE 0.

### SLICE 2 — Gate A: CI backfill test + reference FormRule test `size:4`
- **Files:** a backfill test for `FormRule.definition` (seeds a legacy row, runs the backfill, asserts
  the result is a valid `FieldRule` with lowercase-normalized operators/effects); `.github/workflows/*.yml`
  wiring it as a required job in the existing fast (non-Playwright) lane. `gate_allow: none`.
- **Independent** — no dependency on merge-liberty. This is the piece that would have caught #923;
  ship it early.
- **Requires:** SLICE 0.

### SLICE 3 — Gate A: standalone intake-lint rule `size:3`
- **Files:** `scripts/pipeline/lint-prompt.mjs` (+ its test); `docs/pr-prompts/PROMPT-SCHEMA.md`.
- Backfill-signature migrations must name a test file in `scope` (standalone rule). Optionally upgrades
  to assert-in-diff IF/when merge-liberty's `must_contain` lands — documented as an enhancement, not a
  prerequisite.
- **Requires:** SLICE 0. (Independent of merge-liberty.)

### SLICE 4 — (optional) AI migration-reviewer gate `size:5`
- **Files:** `scripts/pr-watcher/index.mjs` and/or `scripts/pipeline/*` — adversarial migration review
  on any diff touching `prisma/migrations/**`; CONFIRMED blocker routes the prompt to `needs-marco/`.
  Behind an env flag, default off, so it lands dark.
- **Requires:** merge-liberty SLICE 1 (positive-control gate tests) — see §5.3 (broken-instrument + the
  human-gate tension). Ships only after those pass. Skippable entirely.

### SLICE 5 — sot/05 decision entry (docs-only, doc-reconcile) `size:1`
- **Files:** `sot/05-decisions-and-lessons.md`; `docs/pipeline/DOCTRINE.md` cross-link. CP-24: never
  mixed with code.
- **Requires:** SLICES 1–3 (and 4 if taken).

---

## 4. Compensating controls (incident → gate)

| Incident | Failure CI missed | Gate | Slice |
|---|---|---|---|
| #923 | migration backfill wrote invalid enum tokens; JSONB not type-checked, no backfill test | Gate A (CI test + standalone lint; optional AI reviewer) | 2, 3, (4) |
| #922 | admin route unguarded; e2e checked sidebar label, not URL authz | Gate B (static route-guard test + reviewed allowlist) | 1 |

Each gate is automated and fails safe: Gate B fails CI red (fail-closed on un-allow-listed admin
routes); Gate A fails intake (lint) or CI red; the optional reviewer can only route to `needs-marco/`.
No gate can silently pass a bad input.

---

## 5. Risks

### 5.1 Gate B allowlist could rubber-stamp
`SELF_GUARDED_ROUTES` is the escape hatch; a careless addition re-opens the #922 class.
**Mitigation:** each entry requires a justifying comment naming the in-component guard, and appears in
the PR diff where a reviewer sees it. The test fails closed on any admin route neither wrapped nor
listed — silence is a red, not a pass. Keep the allowlist tiny; prefer a real route guard.

### 5.2 Gate A lint false-positives on additive, non-backfill migrations
**Mitigation:** the lint triggers only on the backfill signature (`UPDATE … SET`), never on
`ADD COLUMN` / `CREATE` alone.

### 5.3 SLICE 4 reintroduces a human gate for the migration class
Routing a flagged migration to `needs-marco/` is, for that PR, a human stop — mild tension with
merge-liberty's "merge anything but hard-stops on green" (migrations are NOT a hard-stop). And
(merge-liberty §5.3) a confident-wrong reviewer run repeatedly is the worst failure mode.
**Mitigation:** SLICE 4 is OPTIONAL and env-flag-gated (default off); it can only route to
`needs-marco/`, never auto-approve; and it lands only after merge-liberty SLICE 1's positive-control
tests are green. Gates A (CI + lint) and B carry the plan without it — SLICE 4 is a backstop, not
load-bearing. If it proves noisy, drop it.

### 5.4 Coupling to merge-liberty
Only two things touch merge-liberty now: the OPTIONAL `must_contain` upgrade of SLICE 3's lint, and
SLICE 4. **Mitigation:** SLICE 1 (Gate B), SLICE 2 (CI test), and SLICE 3's standalone lint all ship
regardless of merge-liberty's status — the general #923 gate does not wait on a stalled plan.

### 5.5 CI wall-clock
A new required backfill-test job adds CI time to an already-serial `main` (merge-liberty §1.2).
**Mitigation:** the backfill test is a fast unit/integration test (seeded row, no browser); it runs in
the existing `test:web:logic` / api-test lane, not the Playwright suite.

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
- [x] The general #923 gate (SLICE 2 CI test + SLICE 3 standalone lint) ships independently of
      merge-liberty; only the optional `must_contain` upgrade and SLICE 4 couple to it.
- [x] Gate B specifies the reviewed `SELF_GUARDED_ROUTES` allowlist mechanism and fails closed.
- [x] No new `needs-marco/` parking class for routine work; SLICE 4's routing is optional and named
      as a tension in §5.3.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).

---

## 8. Decision log

### 2026-08-05 — Marco: "raise the floor now, revisit if a novel one slips."

**Context.** In review we established that Gate A's *general* protection (SLICE 3 lint) enforces that a
backfill migration NAMES a test file, but cannot verify the test is *adequate* — a weak/trivial test
satisfies the lint while a novel semantic backfill bug still passes green. The layer that actually caught
#923 (adversarial semantic reading of the migration diff) is SLICE 4, deliberately OPTIONAL / default-off.

**Decision.** Ship the deterministic floor now — Gate B (SLICE 1) + Gate A CI test (SLICE 2) + Gate A
standalone lint (SLICE 3). Do NOT, for now, promote SLICE 4 to default-on, and do NOT harden the lint to
verify test efficacy. The residual gap is accepted *knowingly*, not overlooked.

**Known residual gap (watch for this).** A NOVEL migration-backfill correctness bug — a new migration
whose authored test is weak or absent-in-substance — can still reach `main` green. Also uncovered by
scope: backend authz gaps, and a *present-but-wrong-permission-code* guard (Gate B proves a guard is
present, not that its code is correct or that the API is authorized).

**Revisit trigger.** A backfill-correctness bug, OR an authz gap of the #922 family, reaches `main`
DESPITE these gates.

**Where to start when it happens** (for whoever picks this up — Marco, another chat, or an agent):
1. Read this plan's §2 Gate A + §5.3 (backfill soft spot) and §5.1 (Gate B limits).
2. Pick the lever that fits the miss:
   - *Novel backfill bug* → EITHER strengthen SLICE 3's lint so the backfill test must reference the
     canonical enum / assert contract-validity (something CI can grep), OR promote SLICE 4 (AI
     migration-reviewer) from optional to default-on for backfill migrations, accepting the per-PR
     agent-run cost and the false-positive-to-`needs-marco/` risk.
   - *Present-but-wrong-code guard, or unguarded backend* → extend Gate B beyond "guard present" to
     cross-check the guard's permission code against `permission-registry.ts`, and add a backend
     authz-parity check. Neither is in this plan today.
3. The instrument that actually caught #923 was a human/AI adversarial read of the migration diff
   (this session, PR #923, fix `23dcf30b`). Reproduce THAT as the reviewer — it is the known-good method.

**Why recorded here.** So the residual gap is not re-discovered from scratch. SLICE 5 folds this entry
into `sot/05`; until then this section is the durable record (mirrored in project memory:
`project_pipeline_correctness_gates_decision.md`).
