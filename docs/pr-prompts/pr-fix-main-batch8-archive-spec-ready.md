---
premise: '! grep -q "documents?tab=archived" tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts'
premise_means: The batch8 archive spec still asserts the standalone /archive page that #836 replaced with a redirect — tendering-e2e is red on main and on every open PR.
scope:
  - tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts
done_when: pnpm lint && grep -q "documents?tab=archived" tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# FIX-FORWARD (defect on MAIN): batch8 archive spec asserts the pre-#836 standalone /archive page

## Re-verify first (errors drift)

Confirm the failure on CURRENT main's latest tendering-e2e run before acting. As of 2026-07-31
12:30Z: run 30626214614 — `batch8-documents-archive.spec.ts:24` strict-mode violation:
`getByRole("heading", { name: "Archive" })` resolves to 2 elements ("Archive" h2 + "Nothing
archived yet" h3) because #836 made `/archive` redirect to `/documents?tab=archived` and the
spec now lands inside the Documents workspace. Same signature fails PRs #833/#835/#837 — they
are innocent; fix main only.

## What to build (spec-only)

Rewrite the affected test(s) in `batch8-documents-archive.spec.ts` to the CURRENT intended
behaviour:

1. `page.goto("/archive")` → expect the URL to become `/documents?tab=archived` (positive end
   state: `toHaveURL`), the "Documents" page heading visible, and the Archived tab active.
2. Keep asserting the archive content that still renders inside the tab (Export CSV button,
   filter strip, seeded rows), scoping locators tightly — use `exact: true` or role+level for
   the "Archive" heading (the nested h2 inside the tab is a known audit finding; do NOT fix the
   UI here, assert what IS rendered).
3. `/archive/:jobId` detail assertions (if any in this file) are unchanged — that route still
   renders standalone.
4. Do NOT weaken coverage: every behaviour the old test proved must have a successor assertion.

## Do NOT

- Do NOT touch App.tsx, ArchivePage, DocumentsWorkspacePage, or any app code.
- Do NOT re-run/patch the three red PRs — they go green when main is fixed and their branches
  update.

## VERIFY

- `pnpm lint`
- `grep -q "documents?tab=archived" tests/e2e/pr-acceptance/batch8-documents-archive.spec.ts`
- Run the spec locally if the harness allows; otherwise state so in the PR body.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
