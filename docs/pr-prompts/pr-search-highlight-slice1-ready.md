---
premise: '! grep -rq "get(\"highlight\")" apps/web/src/pages'
premise_means: No list page reads the ?highlight= param the Command Palette and Global Search emit — search results land on unfiltered lists.
scope:
  - apps/web/src/pages/jobs/JobsListPage.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/workers/WorkersListPage.tsx
  - apps/web/src/hooks/**
done_when: pnpm build && pnpm lint && grep -rq "get(\"highlight\")" apps/web/src/pages
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# Search highlight slice 1: establish the pattern on Jobs, Tenders, Workers

Marco 2026-08-03: implement ?highlight= for real. This slice builds the shared pattern on
the three highest-traffic targets; a follow-up slice rolls it to the remaining emitter
targets (assets, forms, documents, contracts, master-data/directory clients).

## What to build

1. A small shared hook (e.g. `useHighlightParam`) in apps/web/src/hooks: reads
   `searchParams.get("highlight")`, exposes the id, strips the param from the URL (replace)
   after consumption so refresh/back doesn't re-trigger.
2. In each of the three pages: when a highlight id arrives, scroll the matching row/card
   into view and apply a brief visual emphasis using EXISTING design tokens (e.g. a
   temporary outline/background with --brand-* vars — no raw hex). If the item isn't in the
   current page/filter set, fall back gracefully (no crash, optional subtle notice).
3. Verify against what the emitters actually send: read CommandPalette.tsx urlFor and the
   API search.service emitters for these three entities — match the id field they emit.
4. Keep it cheap: no data refetching redesign; operate on the already-loaded list.

## Do NOT
- Do NOT touch the emitters (CommandPalette/GlobalSearch/search.service) in this slice.
- Do NOT roll out beyond the three pages — the pattern PR stays reviewable.

## VERIFY
- `pnpm build && pnpm lint`; `grep -rq "get(\"highlight\")"` matches in all three pages.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
