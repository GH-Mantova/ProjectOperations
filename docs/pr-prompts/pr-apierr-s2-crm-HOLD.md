---
premise: grep -rq "throw new Error(await res.text())" apps/web/src/pages/crm
premise_means: Files under apps/web/src/pages/crm still throw the raw HTTP error envelope as the user-visible error message instead of using the api-errors helper.
scope:
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/DropReasonAdminPage.tsx
  - apps/web/src/pages/crm/OpportunityDetailPage.tsx
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/crm-api.ts
done_when: pnpm build && pnpm lint && ! grep -rq "throw new Error(await res.text())" apps/web/src/pages/crm
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Humane API errors — SLICE (crm): stop rendering the raw JSON envelope

## The defect

`apps/web/src/lib/api-errors.ts` exists and 22 files already use it. But 38 files still do
`throw new Error(await res.text())` and set that string as the visible error message — **124
occurrences, measured on `origin/main`**. `res.text()` is the whole HTTP error envelope, so the
user is shown raw JSON: `statusCode`, `path`, `timestamp` and all. This slice covers the 7 files
under `pages/crm`.

`sot/02-roadmap-and-status.md:150` records this work as **Done**. That is misleading: the HELPER
is done, the MIGRATION is not. **Do not correct that doc here** — it is `/sot/`, and CP-24
hard-fails any PR mixing `sot/` with code. Station 05 reconciles it separately.

## Why this is HOLD, not armed

Held only to keep the armed count low while the watcher's runnable-count defect is unresolved. It
has no dependency on any other slice — every file in `scope` is disjoint from every other slice in
this chain. Arm it by renaming `-HOLD.md` to `-ready.md`; nothing else is required.

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
`apps/web/src/dashboards/widgets/compliance.tsx` — rather than inventing a new one.

`crm-api.ts` is the shared fetch layer for this folder. Migrate it carefully and check whether the
page components call through it — if a page's error already flows through `crm-api.ts`, the page
change may collapse to nothing. That is a fine outcome; say so in the PR body rather than forcing
an edit into every listed file.

## Do NOT

- Do NOT touch any file outside `apps/web/src/pages/crm/`. The other 31 files are separate slices.
- Do NOT touch `apps/web/src/lib/api-errors.ts`. The helper is finished.
- Do NOT add a CI gate forbidding the pattern here. That is the final slice of this chain and it
  can only pass once all 38 files are migrated.
- Do NOT change any error *text* the API returns, any API module, or any test expectation beyond
  what the import change strictly requires.
- Do NOT touch `/sot/`.

## Guardrails

- One attempt. `pnpm build` and `pnpm lint` must both pass before you open the PR.
- Never exit silently. If the pattern is already gone from `pages/crm`, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.
