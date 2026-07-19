---
premise: '! grep -rqi "GlobalSearch\|QuickCreate" apps/web/src 2>/dev/null'
premise_means: There is no global relevance search or quick-create in the app command bar.
scope:
  - apps/api/src/modules/platform/**
  - apps/web/src/components/**
  - apps/web/src/components/ShellLayout.tsx
done_when: pnpm build && pnpm lint && grep -rqi "GlobalSearch\|QuickCreate" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 relevance search + quick create) | MVP -->
# HOLD — UX: global search + quick-create command bar (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 model-driven-app parity: one search box across entities
and a "+ new anything" quick-create, in the shell header.

## What to build
Branch: `feat/ux-command-bar`. Reviewer: `GH-Mantova`. No migration (search over existing tables).
1. API: a `GET /search?q=` relevance-search endpoint that queries the highest-value entities (tenders,
   jobs, clients, contacts, contracts, assets) and returns typed, permission-filtered results with a
   deep-link — do NOT return records the caller can't see.
2. Web: a **global search** box in `ShellLayout` header (keyboard shortcut, grouped results, click to
   open) and a **Quick create ("+")** menu that opens a compact create form for a few common records
   (e.g. contact, expense, task/note) without leaving the current page.

## Do NOT
- Do NOT stand up an external search engine — a good DB query is the MVP. Do NOT leak records past the
  permission layer. Do NOT touch Azure/prod. If >10 files, split (search API / web) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
