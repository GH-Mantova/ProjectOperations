---
premise: '! grep -qiE "with-deps|install-deps|libnss3|libglib|libgtk|apt-get|chrome-headless-shell" .github/workflows/deploy.yml'
premise_means: The deploy ships a pinned Chrome into the App Service bundle but never provisions Chrome's system shared libraries, so at runtime headless Chromium fails to launch ("libglib-2.0.so.0: cannot open shared object file") and EVERY module's PDF export 500s.
scope:
  - .github/workflows/deploy.yml
  - apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts
done_when: pnpm build && grep -qiE "with-deps|install-deps|libnss3|libglib|libgtk|chrome-headless-shell" .github/workflows/deploy.yml
size: 3
gate_allow: none
seed_only: false
escalates: true
---

# Fix: PDF export fails on every module — Chromium's system libs are missing in the App Service

## Context (verified on origin/main)
Every module's PDF export returns
`PDF Rendering Error: Failed to launch the browser process ... error while loading shared libraries:
libglib-2.0.so.0: cannot open shared object file`. The Chrome BINARY is shipped
(`deploy.yml` "Install Chrome for puppeteer into bundle" + `PUPPETEER_CACHE_DIR=/home/site/wwwroot/.cache/puppeteer`),
and `apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts` resolves/launches it — but the Azure
App Service Linux runtime image does not have the shared libraries Chrome dynamically links against
(libglib, libnss3, libgtk, etc.). PRs #525/#548 only surfaced the error; the root cause (missing OS
deps) is unfixed.

## What to build
Make headless Chromium launchable in the deployed App Service **without requiring an Azure portal
change** wherever possible. Choose the most robust of:
1. Provision the required system libraries at deploy/startup — e.g. a committed startup script the
   App Service runs that installs the Chrome dependency set, or bundling the libs alongside the Chrome
   cache and pointing `LD_LIBRARY_PATH` at them; or
2. Switch the rendering binary to `chrome-headless-shell` (far fewer OS deps) if it satisfies the
   quote/forms PDF templates, resolving it the same env-driven way `pdf-renderer.service.ts` already does.
Keep the existing `PUPPETEER_EXECUTABLE_PATH` / `PUPPETEER_CACHE_DIR` resolution intact. Update the
launch service only if the chosen approach requires it.

## Do NOT
- Do NOT touch the Azure portal / App Service configuration yourself (hard stop). If the fix
  unavoidably needs a portal setting (e.g. a startup-command path), implement everything in the repo,
  write the EXACT step for Marco in the PR body, and stop there.
- Do NOT disable or stub PDF rendering, and do NOT remove the actionable "not installed" error path.
- Do NOT change the PDF templates or the API routes.

## VERIFY
- `pnpm build`
- API unit tests for pdf-rendering still pass (`pnpm --filter @project-ops/api test -- pdf-rendering`).
- `grep -qiE "with-deps|install-deps|libnss3|libglib|libgtk|chrome-headless-shell" .github/workflows/deploy.yml`
- NOTE: real proof is post-deploy — after merge, generate a quote PDF on the deployed site (mind the
  deploy-lag window). State this in the PR body.

## Merge gate (escalates: true)
This changes production deploy config whose effect can only be confirmed on a real deploy — Marco
verifies. Open the PR and LEAVE IT UNMERGED; note it must carry `do-not-merge` for Marco.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if already fixed on main. Never ask a
question or "stand by" for approval. Read the CI/deploy job log before diagnosing any failure.
