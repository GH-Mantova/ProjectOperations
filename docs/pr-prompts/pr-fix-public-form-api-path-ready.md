---
premise: grep -q "fetch(\`/api/forms/public/" apps/web/src/pages/forms/PublicFormFillPage.tsx
premise_means: The public form page still fetches a relative /api path (missing the v1 prefix and any API origin), so QR/kiosk form capture is completely broken in deployment.
scope:
  - apps/web/src/pages/forms/PublicFormFillPage.tsx
  - apps/web/src/pages/forms/FormSubmissionDetailPage.tsx
done_when: pnpm build && pnpm lint && ! grep -q "fetch(\`/api/forms/public/" apps/web/src/pages/forms/PublicFormFillPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# FIX: public form capture + submission PDF hit the wrong API origin/path

## The defect (system audit 2026-07-31, verified on origin/main)

- `apps/web/src/pages/forms/PublicFormFillPage.tsx:174` and `:236` —
  `fetch(\`/api/forms/public/${token}\`)` / `.../submit`. Wrong twice: the API prefix is
  `api/v1` (`apps/api/src/bootstrap/create-app.ts:15`), and the URL is relative to the SPA
  origin, which has no `/api` proxy (`vite.config.ts` has no server.proxy;
  `public/staticwebapp.config.json` navigationFallback rewrites unmatched paths to index.html).
  Every QR/kiosk scan gets the SPA shell back and dies with a JSON parse error
  ("Unexpected token '<'").
- `apps/web/src/pages/forms/FormSubmissionDetailPage.tsx:518` — PDF link
  `href={\`/api/v1/forms/submissions/${id}/pdf\`}` — has the v1 prefix but the same
  relative-origin problem: the download returns the SPA shell, not a PDF.

## What to build

1. Ground how the app's authenticated calls resolve the API origin (read `AuthContext` /
   `authFetch` and the build-time env it uses). Reuse EXACTLY that base-URL mechanism for these
   three URLs — public fetches stay unauthenticated (no token header, no credentials), only the
   origin/prefix is fixed.
2. `PublicFormFillPage`: both fetches → `<apiBase>/forms/public/:token[...]`. Update the stale
   comment at :149-150.
3. `FormSubmissionDetailPage`: PDF href → same base mechanism.
4. If an e2e spec covers public form fill, update it; if none exists, note that in the PR body —
   do not build a new harness here.

## Do NOT

- Do NOT add auth to the public endpoints or change the API side.
- Do NOT introduce a dev proxy or touch vite/staticwebapp config — fix the URLs, not the infra.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -rq "fetch(\`/api/forms" apps/web/src/pages/forms`
- The three URLs all resolve through the shared API base helper.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
