---
premise: grep -rq "throw new Error(await res.text())" apps/web/src/pages/tendering
premise_means: Files under apps/web/src/pages/tendering still throw the raw HTTP error envelope as the user-visible error message instead of using the api-errors helper.
scope:
  - apps/web/src/pages/tendering/ClientQuotesPanel.tsx
  - apps/web/src/pages/tendering/SendQuoteModal.tsx
  - apps/web/src/pages/tendering/TenderDetailPage.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering/ratesTabApi.ts
  - apps/web/src/pages/tendering/scope-cards/useScopeCards.ts
  - apps/web/src/pages/tendering/scope-cards/useTenderEstimate.ts
done_when: pnpm build && pnpm lint && ! grep -rq "throw new Error(await res.text())" apps/web/src/pages/tendering
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Humane API errors — SLICE (tendering): stop rendering the raw JSON envelope

## The defect

`apps/web/src/lib/api-errors.ts` exists and 22 files already use it. But 38 files still do
`throw new Error(await res.text())` and set that string as the visible error message — **124
occurrences, measured on `origin/main`**. `res.text()` is the whole HTTP error envelope, so the
user is shown raw JSON: `statusCode`, `path`, `timestamp` and all.

Marco hit this on 2026-08-19 in the Tip Finder, where a perfectly good API message — *"Tender site
has no coordinates stored. Update the site coordinates in Settings > Map locations"* — was
rendered as the entire envelope. This slice covers the 7 files under `pages/tendering`.

`sot/02-roadmap-and-status.md:150` records this work as **Done**. That is misleading: the HELPER
is done, the MIGRATION is not. **Do not correct that doc here** — it is `/sot/`, and CP-24
hard-fails any PR mixing `sot/` with code. Station 05 reconciles it separately.

## What to build

In each of the 7 files in `scope`, replace every

```ts
throw new Error(await res.text())
```

with the existing helper:

```ts
import { readApiErrorMessage } from "<correct relative path>/lib/api-errors";
// ...
throw new Error(await readApiErrorMessage(res));
```

Read `apps/web/src/lib/api-errors.ts` first. It exports `parseApiErrorPayload`,
`readApiErrorMessage`, `ApiError` and `throwIfApiError`. **Match the pattern the already-migrated
files use** — see `apps/web/src/auth/AuthContext.tsx`,
`apps/web/src/components/contacts/ContactsTab.tsx`, and
`apps/web/src/dashboards/widgets/compliance.tsx` — rather than inventing a new one. If a call site
is better served by `throwIfApiError`, use it; consistency with the neighbouring migrated code
wins over uniformity with this prompt.

Fix the relative import depth per file — `scope-cards/` is one level deeper than the rest.

## Do NOT

- Do NOT touch any file outside `apps/web/src/pages/tendering/`. The other 31 files are separate
  slices; a 38-file prompt is exactly what the size-10 rule exists to prevent.
- Do NOT touch `apps/web/src/lib/api-errors.ts`. The helper is finished.
- Do NOT touch `apps/web/src/pages/tendering/TipFinderPanel*` or `MapLocationsTab*` if they appear
  — they are being fixed separately by `pr-fix-tipfinder-raw-error-render`. If a merge conflict
  would result, leave those two files alone and say so in the PR body.
- Do NOT add a CI gate forbidding the pattern here. That is the final slice of this chain and it
  can only pass once all 38 files are migrated.
- Do NOT change any error *text* the API returns, any API module, or any test expectation beyond
  what the import change strictly requires.
- Do NOT touch `/sot/`.

## Guardrails

- One attempt. `pnpm build` and `pnpm lint` must both pass before you open the PR.
- Never exit silently. If the pattern is already gone from `pages/tendering`, say
  `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.
