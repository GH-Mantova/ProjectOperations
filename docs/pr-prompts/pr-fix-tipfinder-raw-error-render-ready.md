---
premise: 'grep -q "throw new Error(await res.text())" apps/web/src/pages/admin/TipFinderPanel.tsx'
premise_means: The Tip Finder still throws the RAW HTTP response body as its error message, so a failed lookup renders the whole JSON error envelope verbatim in the panel instead of the human sentence inside it.
scope:
  - apps/web/src/pages/admin/TipFinderPanel.tsx
  - apps/web/src/pages/admin/MapLocationsTab.tsx
done_when: pnpm build && pnpm lint && ! grep -q "throw new Error(await res.text())" apps/web/src/pages/admin/TipFinderPanel.tsx && ! grep -q "throw new Error(await res.text())" apps/web/src/pages/admin/MapLocationsTab.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Fix: Tip Finder renders the raw JSON error envelope to the user

## What Marco actually sees (reported 2026-08-19)

Opening **Find a tip** from a tender waste row and pressing **Find tips** renders this, verbatim, as
the error text inside the panel:

```
{"statusCode":400,"error":"Bad Request","message":"Tender site has no coordinates stored. Update the
site coordinates in Settings > Map locations to enable distance calculation.","path":"/api/v1/waste/
recommendations","timestamp":"2026-08-19T01:05:08.870Z"}
```

**The API is behaving correctly.** `apps/api/src/modules/map-locations/tip-recommendations.service.ts:378`
raises that 400 deliberately, and its `message` is a genuinely helpful sentence that tells the user
exactly what to do. The bug is that the web layer never unwraps it.

## Root cause (measured on origin/main)

`apps/web/src/pages/admin/TipFinderPanel.tsx:348`:

```ts
if (!res.ok) throw new Error(await res.text());
```

…and `:351` does `setComputeError((err as Error).message)`. `res.text()` is the whole envelope, so
the envelope becomes the message and the message becomes the UI.

The repo already ships the correct helper — `apps/web/src/lib/api-errors.ts`, which exports
`parseApiErrorPayload`, `readApiErrorMessage`, `ApiError` and `throwIfApiError`, and which 22 other
files already use. This panel simply predates it.

**`TipFinderDrawer.tsx` needs no change** — it is a slide-over that wraps `TipFinderPanel`
(`TipFinderDrawer.tsx:22`), so fixing the panel fixes the tender waste-row surface too.

## Why `MapLocationsTab.tsx` is in scope

The error message tells the user to go to **Settings > Map locations**. That page is
`apps/web/src/pages/admin/MapLocationsTab.tsx`, and it has the **same defect in 5 places**. Sending
someone from one raw-JSON error to a screen that also answers in raw JSON is not a fix. Both files
are in the same feature area (`map-locations`), so they travel together.

Occurrences: `TipFinderPanel.tsx` 2, `MapLocationsTab.tsx` 5 — **7 total, 2 files.**

## What to build

For every `throw new Error(await res.text())` in the two scoped files, use the existing helper
instead of inventing anything:

- Prefer `readApiErrorMessage(res, "<a short fallback for this action>")` and throw that message, so
  the user sees the envelope's `message` field and nothing else.
- Where the surrounding code already has an `ApiError` / `throwIfApiError` shape that fits better,
  use that instead — **match the conventions already in `api-errors.ts`; do not add a second
  error-handling pattern.**
- Read `apps/web/src/lib/api-errors.ts` first and follow how the 22 existing call sites use it. A
  good reference is `apps/web/src/components/contacts/ContactsTab.tsx`.
- Every fallback string must be specific to its action (e.g. "Could not load tip recommendations")
  — never a generic "Something went wrong".
- Behaviour on success is unchanged. Do not alter any request payload, route, or response parsing.

## Do NOT

- Do NOT change `tip-recommendations.service.ts` or any API behaviour. The 400 and its wording are
  correct and are not in scope.
- Do NOT attempt the other 36 files that share this pattern — that is a separate, registered backlog
  item (`web-raw-error-envelope-migration`). Staying inside these two files is the point.
- Do NOT change what Tip Finder does when a site has no coordinates. Whether it should degrade to a
  rate-only ranking instead of erroring is an open question for Marco, deliberately NOT decided here.
- Do NOT touch `/sot/`, `TipFinderDrawer.tsx`, or anything outside the two files in `scope`.

## Guardrails

- One attempt. If you cannot complete it, say `NO-OP: <reason>` and stop.
- Never exit silently. Never ask a question or stand by for approval.
- Read the job log before diagnosing any CI failure — never guess from the check name.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
