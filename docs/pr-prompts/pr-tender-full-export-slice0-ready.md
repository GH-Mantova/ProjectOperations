---
premise: '! test -f docs/plans/tender-full-export-plan.md'
premise_means: There is no build plan for the full-tender export. The feature is decided but unscoped, and a Tender has 39 relations - far too many to serialise in one PR.
scope:
  - docs/plans/tender-full-export-plan.md
done_when: test -f docs/plans/tender-full-export-plan.md && grep -q "SLICE 1" docs/plans/tender-full-export-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# SLICE 0 — write the build plan for the full-tender export

**Write a plan. Write no code.** The only artifact is
`docs/plans/tender-full-export-plan.md`. The resulting PR is held for Marco's review — that is the
point of a SLICE 0, and the code slices are written from the approved plan afterwards.

## Why this is a plan and not a single PR — measured, not assumed

`model Tender` (`apps/api/prisma/schema.prisma:1222-1315`) carries **39 relations, 28 of them
collections**. Several have their own children — `ClientQuote` alone fans out to `QuoteScopeItem`,
`QuoteCostLine`, `QuoteProvisionalLine`, `QuoteCostOption`, `QuoteAssumption`, `QuoteExclusion`,
`QuoteEmail`. A serialiser covering that, with tests, does not fit in ten files. **Do not attempt to
shortcut this into one implementation PR.**

## Decisions already made — BINDING, do not re-litigate

| Ref | Decision |
|---|---|
| **D52** | **Permission = SUPER-USER ONLY, for now.** Deliberately NOT the archive `jobs.view` precedent — that was set when this was framed as a backup. It is now **information disclosure**: a whole tender including internal notes and a document index leaving the system. Ship restricted; widen later. |
| **D53** | **Scope = BULK over the filtered register ONLY.** One entry point, mirroring the CSV export (`buildRegisterCsv`, `TenderingPage.tsx:113`, applied to `filteredRows` at `:616` — respects active filter chips, ignores selection). **No single-tender button on `TenderDetailPage`.** One code path, one permission check. |
| run 5 | **JSON snapshot first**, renderer later. |
| run 5 | **ALL tender surfaces** — including **both** Correspondence **and** Activity & communications, which are different panels. |
| run 5 | **Documents are an INDEX ONLY** — names, categories, links, metadata. **Never the file bytes.** |

**Reclassified and binding:** this is a **portability / audit** feature, **not a safety net**. The
real recovery control is Azure PostgreSQL point-in-time restore. Do not describe it as a backup
anywhere in the plan.

## Grounding — verified on origin/main, do not re-derive

- `buildTenderFullExport` appears **nowhere in the code** — only as a needle in `BACKLOG.yaml`. The
  work is entirely unbuilt.
- **Precedent to mirror:** `apps/api/src/modules/archive/archive.controller.ts:85` —
  `@Get(":jobId/export")` with `@RequirePermissions("jobs.view")` at `:86`. Same shape, different
  gate (see D52).
- **The super-user gate already exists:** `apps/api/src/common/auth/super-user.guard.ts`. Use it. Do
  not invent a new permission code, and do not gate on `tenders.view`.
- **Entry point to mirror:** `buildRegisterCsv` in `apps/web/src/pages/tendering/TenderingPage.tsx`.

## What the plan must decide — explicitly, in writing

1. **The relation manifest.** Enumerate all 39 relations and mark each **IN** or **OUT**, each with
   a one-line reason. A relation left unmentioned is a hole someone fills by guessing later. For
   every IN relation that has children, say how deep the export goes and where it stops.

2. **⚠️ `clientNotes` → `TenderClientNote[]` is a special case.** A retirement prompt for that table
   is already in the queue (`pr-retire-tenderclientnote-s2-HOLD.md`, `escalates: true`). The plan
   must decide whether the export includes a table scheduled for removal, and must not silently
   enshrine it. State the dependency either way.

3. **The envelope shape.** The top-level JSON structure, a schema version field, and what identifies
   the export (tender number, revision, generated-at, generated-by). A consumer must be able to tell
   two exports apart and know which came first.

4. **The document index contract.** Exactly which fields of `TenderDocumentLink` are emitted, and an
   explicit statement that file content is never included.

5. **Scale limits.** A bulk export over a filtered register could be thousands of tenders each with
   28 collections. Decide: a row cap, a warning threshold, streaming vs building in memory, and what
   the file is called. The register CSV already warns and puts the count in the filename — follow
   that precedent rather than inventing a second convention.

6. **Redaction.** Decide, and write down, whether anything is withheld even from a super user —
   soft-deleted rows, other tenants' data reachable through a shared relation, user PII on
   `estimator` / `assignedEstimator` / note authors. "Super user sees everything" is an acceptable
   answer; leaving it unstated is not.

7. **The slice breakdown.** Each slice `size <= 10` files including tests, each with a premise that
   dies when it lands, and each chained on the previous with a **content** gate
   (`requires_on_main: <path> :: <needle the predecessor introduces>`) — **not** a bare
   `requires_file_on_main` pointing at a file that already exists. That mistake is live in the queue
   right now (`pr-ew-s2-alloc-engine`) and it makes a slice dispatch alongside its own predecessor.

8. **A named first slice.** The plan must contain a heading `SLICE 1` with a scope small enough to
   be a real PR. A plan that ends at "then build it" has not done its job.

## Do NOT

- Do NOT write any code, service, controller, endpoint, DTO, test or UI. **Plan only.**
- Do NOT add a single-tender export path. D53 settled that.
- Do NOT propose `tenders.view` or any new permission code. D52 settled that — super-user guard.
- Do NOT include file bytes in the document index.
- Do NOT describe the feature as a backup or safety net.
- Do NOT touch `/sot/`, `schema.prisma`, or anything outside the one file in `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Where the plan makes a judgement call Marco has not made, **mark it `OPEN — Marco:`** so it is
  visible in one pass. Do not bury a decision in prose as though it were settled.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
