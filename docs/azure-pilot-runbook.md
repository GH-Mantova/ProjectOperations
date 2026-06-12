# Azure Pilot Runbook — CRM / Tendering / Quoting go-live for Sean, Raj, Marco

**Author:** Cowork, 2026-06-12. **Status:** PRE-PILOT — work items in flight.
**Scope:** pilot users live-test tendering/quoting/CRM + supporting modules (clients, subcontractors, rates & lists, user access). Everything else continues per roadmap during the pilot; worker feedback becomes watcher prompts as it arrives.

---

## 1. Gap analysis (what stands between today and go-live)

| # | Gap | Severity | Vehicle | Status |
|---|---|---|---|---|
| G1 | deploy.yml has never deployed green (LL-11) | BLOCKER | pr-166 | in flight 2026-06-12 |
| G2 | Production PostgreSQL not provisioned; prod secrets not set | BLOCKER | manual (§3) + pr-174 | open |
| G3 | Seed mixes reference data with demo entities; seed users have shared password | BLOCKER | pr-173 | staged |
| G4 | Directory "+ New entry" 400s on submit / API 500s without `categories` (batch-5 finding) — can't create subcontractors | BLOCKER | pr-171 | staged -ready |
| G5 | Tender/job number formats (Marco-confirmed `T{YYMMDD}-…` spec) must land before real data exists | HIGH | pr-172 | staged -ready |
| G6 | M365 SSO needs prod Entra app registration + real-account test | HIGH | manual (§3) | open |
| G7 | Quote send-via-Outlook never exercised live (`AZURE_MAIL_*`) | HIGH | manual verify post-deploy (§4) | open |
| G8 | Rates-admin inline-edit save race (LL-27) — Raj's daily surface | HIGH | pr-169 | in flight |
| G9 | CRM interaction logging redesign | MEDIUM | pr-63b | in flight |
| G10 | Seed safety sequences (LL-26) — hygiene before prod seeding patterns are copied | MEDIUM | pr-168 | in flight |
| G11 | No staging slot / post-deploy health gate | MEDIUM | pr-174 | shipped (health-gate-only variant — slot+swap needs Standard+ tier + az credentials, Marco portal follow-up) |

## 2. PR firing order (the weekend plan)

Watcher modes: **review-gated** (task default, auto-merge OFF — verdicts pile up, Marco merges) or **chain** (env `PR_WATCHER_AUTO_MERGE=true` — serialized merge-then-next, post-merge audits). Recommendation: run the low-risk consolidated batch (175–179) in CHAIN mode; keep pilot-critical PRs review-gated.

1. **Tonight (already queued, review-gated):** 63b → 166 → 167 → 168 → 169 → 170. Saturday morning: read verdicts, merge the stack.
2. **Already -ready (fire as soon as tonight's stack is merged):** pr-171 (directory bug), pr-172 (number formats — NOTE: depends on nothing, but conflicts with nothing either; it updates seed.ts numbering + canonical/e2e expectations in one PR).
3. **After 168 AND 172 are MERGED:** rename pr-173 (seed split) → -ready. Its pre-flight aborts if either is missing (it rewrites the same seed surface).
4. **After 166 is MERGED:** rename pr-174 (deploy hardening) → -ready.
5. **Weekend chain batch (rename all five + restart watcher in chain mode):** pr-175 JSDoc sweep, pr-176 unit tests API batch 1, pr-177 unit tests API batch 2 + web, pr-178 UX bundle, pr-179 roadmap sync. Independent of pilot work; pure quality digestion.

## 3. Manual provisioning checklist (Marco, in the Azure portal / Entra — NOT automatable, do in this order once pr-166 proves the pipeline)

1. Azure Database for PostgreSQL Flexible Server: smallest burstable tier is fine for 3 users; private networking or firewall to the Web App's outbound IPs; create db `project_operations`; capture admin DSN.
2. Web App (API) configuration → set: `DATABASE_URL`, `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` (fresh 64-char randoms — NOT the dev values), `CORS_ORIGIN` (the Static Web App URL), `SHAREPOINT_MODE=live` + the five `SHAREPOINT_*` values (tenant/client/secret/site/library — from the existing Entra app), `SSO_ENABLED=true` + `ENTRA_*`, `AZURE_MAIL_*` (sender mailbox for quotes).
3. Static Web App configuration: `VITE_API_BASE_URL` (the Web App URL + /api/v1), `VITE_SSO_ENABLED=true`, `VITE_ENTRA_*`.
4. Entra app registration: add the production redirect URIs (Static Web App URL) for SSO; confirm Graph permissions for SharePoint + Mail.Send are admin-consented.
5. GitHub repo secrets: whatever pr-166's diagnosis says the deploy needs (likely refreshed publish profiles / OIDC creds).
6. Run the deploy (push to main or manual dispatch) → green → continue to §4.

## 4. First-deploy verification (in order, ~30 min)

1. `GET https://<api>/api/v1/health` → 200.
2. `prisma migrate deploy` ran clean in the deploy logs (102+ migrations on a fresh DB).
3. Run prod seed (`pnpm seed:prod` — exists after pr-173): reference data only. Verify rates admin shows the Cutrite matrix + 9 tabs, lookups populated, ZERO demo clients/tenders.
4. SSO: each of the three real accounts logs in; roles per Section 1 (Sean Super User, Raj Senior Estimator, Marco Admin+WHS). Confirm the seed/dev local-login users do NOT exist.
5. Create a real test tender end-to-end: client → tender (check number format per pr-172) → scope → quote → PDF → send via Outlook to yourself (G7 verified here) → log an interaction (63b surface).
6. SharePoint: upload a tender document; verify it lands in the live site path.
7. Backups: confirm the Flexible Server's automated backups are on (7-day minimum) and note the restore procedure in this doc.

### Troubleshooting

- **`Application Error` page + `Error: Cannot find module '@nestjs/config'` (MODULE_NOT_FOUND) in Log stream** — the deployed artifact was not self-contained: `apps/api/node_modules` are pnpm workspace symlinks into the repo-root store, which break when the directory is copied. Fixed in `deploy.yml` by shipping a `pnpm deploy --prod --legacy --config.node-linker=hoisted` bundle (`deploy-api/`, physical node_modules + regenerated Prisma client) with a pre-deploy `require()` smoke probe. If this recurs, check the "Smoke-probe bundle before deploy" step in the failed run first.

## 5. Pilot operating model

- Continuous deploy of main stays ON — `deploy.yml` triggers on every push to main (re-enabled by pr-174) with a `deploy-main` concurrency queue so rapid merges serialize. The gate stack (build/lint/unit → canonical → gates → e2e → review) is the safety net before merge; after deploy, pr-174's health gates poll `…/api/v1/health` (12×10s) and the SWA root, failing the run loudly on red. NOTE: this is the health-gate-only variant — slot+swap (bad deploy never goes live) requires a Standard+ App Service plan, a `staging` slot publish profile, and `az` login credentials (service principal/OIDC), none of which exist yet. Until Marco provisions those, a red deploy is live until rolled back (checklist §8), but it is never silent.
- Feedback loop: Sean/Raj report → Marco files one line in `docs/pilot-feedback.md` (create on first item) → Cowork turns items into watcher prompts → normal pipeline. Target turnaround for small UX items: same-day.
- Dev continues per roadmap on the same main; field/safety/etc. modules ship dark for pilot users (permissions already scope what they see).
- Weekly: branch prune task, ledger review, dependabot glance.

## 6. Out of scope for the pilot (explicitly)

Field/mobile workflows, portals (client/sub), offline/PWA, Xero live sync (CSV export stays available), MYOB, scheduler/maintenance/assets day-to-day use. They exist; they're just not part of the pilot contract with Sean/Raj.
