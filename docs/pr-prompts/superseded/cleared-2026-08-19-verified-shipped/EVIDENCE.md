# Cleared 2026-08-19 — verified shipped

18 prompt files retired by Station 06 (PR Master). **Every one was checked against `origin/main`
before it was moved** — no prompt here was retired on the strength of a lint exit code alone.

Method, and why it is not just "the linter said so":

- The intake linter reports `premise no longer holds` (exit 3) **or** a structural `REJECT` (exit 1).
  A `REJECT` is returned *before* the premise is evaluated, so nine prompts in this batch had never
  had their premise tested at all. Five of those nine turned out to be shipped.
- A dead premise is **not** proof of shipped work — a broken premise dies the same way
  (`pr-mig-s1-drop-site-name-unique` matched `model Client` and read as shipped when it was not).
  So for every grep-style premise the **matching line was read**, not just the exit code.
- The grep instrument was run with a positive and a negative control first
  (`ZZZ_NOT_A_REAL_MODEL_ZZZ` correctly reported absent) and every schema result was confirmed a
  second time by an independent method (`git grep -F` as well as an in-memory regex match).
- Where a family had both an API half and a UI half, both were checked. They agree in every case,
  which is the cross-check that makes this batch trustworthy.

## File-existence premises — artifact confirmed present on `origin/main`

| Retired prompt | Artifact that killed it |
|---|---|
| `pr-claim-autogen-reminder-HOLD.md` | `apps/api/src/modules/contracts/claim-draft-reminder.service.ts` |
| `pr-fv2-ai-fill-assist-HOLD.md` | `apps/web/src/pages/forms/FillAssistPanel.tsx` |
| `pr-fv2-push-bindings-ui-HOLD.md` | `apps/web/src/pages/forms/PushBindingsPanel.tsx` |
| `pr-fv2-rules-system-values-HOLD.md` | `apps/api/src/modules/forms/system-context-resolver.service.ts` |
| `pr-tenant-classification-HOLD.md` | `apps/web/src/components/tenancy/TenantAssignmentField.tsx` |
| `pr-tenant-company-admin-HOLD.md` | `apps/web/src/pages/admin/AdminCompaniesPage.tsx` |
| `pr-tenant-scoping-middleware-HOLD.md` | `apps/api/src/common/tenancy/tenant-scoping.middleware.ts` |
| `pr-tenant-backfill-enforce-HOLD.md` | `scripts/data-model/tenant-id-null-audit.mjs` |
| `pr-tender-outcome-capture-web-HOLD.md` | `apps/web/src/pages/tendering/OutcomeCaptureModal.tsx` |
| `pr-tender-winloss-report-HOLD.md` | `apps/api/src/modules/reporting/tender-winloss-report.definitions.ts` |

## Content premises — the matching line was read, not inferred

| Retired prompt | What was actually found |
|---|---|
| `pr-ops-m3-waste-row-tip-finder-HOLD.md` | `ScopeWasteTab.tsx:7` imports `TipFinderDrawer` and `:1134` renders it |
| `pr-realtime-presence-HOLD.md` | `SchedulerGridPage.tsx:100` an SSE presence hook, `:515` `data-testid="presence-indicator"` |
| `pr-realtime-scheduler-HOLD.md` | `apps/api/src/modules/scheduler/realtime/scheduler-realtime.controller.ts:49` sets `Content-Type: text/event-stream` |
| `pr-subbie-rate-cards-ui-HOLD.md` | `SubcontractorsPage.tsx:8` imports `SubcontractorRatesTab`, `:704` renders it |
| `pr-tenant-identity-HOLD.md` | `homeTenantId` present in `apps/api/prisma/schema.prisma` |
| `pr-tenant-model-columns-HOLD.md` | `model Client` carries `tenantId`, the `tenant` relation and `@@index([tenantId])` |
| `pr-fv2-push-engine-core-HOLD.md` | `model FormFieldPushBinding` present in `schema.prisma` |
| `pr-subbie-rate-cards-model-HOLD.md` | `model SubcontractorRate` present in `schema.prisma` |

## The headline: the multi-tenant chain is complete

All six tenant prompts are in this batch — `identity`, `model-columns`, `backfill-enforce`,
`classification`, `company-admin`, `scoping-middleware`. The chain was previously read as
"half-shipped and half-broken and needing a reconciliation pass." It is neither. It is **done**, and
the reconciliation is this file.

## Still live, deliberately NOT retired

Four prompts REJECT on `BACKFILL_TEST_REQUIRED` and their premises **still hold** — the work is real
and outstanding. Each needs one thing to become admissible: a test file named in `scope`, or an
explicit `backfill: false`.

| Prompt | Premise verified still true |
|---|---|
| `pr-fv2-formrule-contract-HOLD.md` | no migration matching `fv2_formrule_contract` on main — and this one is on a **deliberate soak**, do not arm it without Marco |
| `pr-fv2-maintenance-usage-intervals-HOLD.md` | `intervalUsage` absent from `schema.prisma` |
| `pr-fv2-output-channels-HOLD.md` | `FormOutputDelivery` absent from `schema.prisma` |
| `pr-rates-s11c-drop-legacy-tables-HOLD.md` | `model EstimateLabourRate` still present — SLICE 11c has not landed |

Recoverable: these files are moved, not deleted. If a retirement here is wrong, restore the file
from this folder.
