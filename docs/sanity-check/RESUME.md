# Resume — Sanity Check Session

**If you're resuming this session, read this first.**

---

## Current status

**2026-06-09** — Mid-flight. Phase 0 complete, Phase 1A complete, Phases 1B + 1C partially complete (UI wiring verified, no live AI call made yet). Phases 1D / 1E / 2 / 3 not started.

App is up at http://localhost:5173 with seeded DB. Login `admin@projectops.local` / `Password123!`.

3 findings reports written so far:
- `findings/2026-06-09-phase-0-schema-drift/REPORT.md` (CRITICAL)
- `findings/2026-06-09-phase-1a-master-data/REPORT.md`
- `findings/2026-06-09-phase-1b-tendering-core/REPORT.md` (also covers Phase 1C UI wiring)

---

## Module-by-module progress

| # | Module | Status | Findings | Notes |
|---|---|---|---|---|
| 0 | Platform / Setup (Prisma migrations) | **Complete** | 1 CRITICAL | Schema drift between schema.prisma and 102 migration files. Production deploy gate. |
| 1 | Platform Foundation (Dashboard etc.) | **Complete (light)** | 0 | Operations dashboard renders, KPIs populated, 6-segment tender pipeline chart |
| 2 | Auth / Users / Roles / Permissions / Audit | Partial | 0 | Login works; admin user OK after `pnpm seed` |
| 3 | SharePoint + Platform Services | Not started | — | Mock mode for sanity check |
| 4 | Master Data | **Complete** | 4 CONCERN | Clients (8) + Subs (4) + Sites (8) + Workers (legacy) + 9 rate tabs (203 entries) |
| 5 | Tendering and Estimating | **Mostly complete** | 3 CONCERN | Pipeline + IS-T100 + Scope of Works B-chain + Quote editor structure all verified |
| 6 | Tender Documents | Partial | 0 | Documents (3) on IS-T100 listed; drag-and-drop upload area visible |
| 7 | Award / Contract / Job Conversion | Not started | — | Phase 1D |
| 8 | Jobs and Delivery | Not started | — | Phase 1E |
| 9 | Scheduler and Work Planning | Not started | — | Phase 3 |
| 10 | Resources and Competencies | **Complete (light)** | F1A-03 | Workers (legacy) page with KPI strip + grouped directory |
| 11 | Assets and Equipment | Not started | — | Phase 3 |
| 12 | Maintenance | Not started | — | Phase 3 |
| 13 | Forms and Compliance | Not started | — | Phase 3 |
| 14 | Documents | Not started | — | Phase 3 |
| 15 | Dashboards and Reporting | **Complete (light)** | 0 | Operations Dashboard verified |
| 16 | Closeout and Archive | Not started | — | Phase 3 |
| X1 | AI Personas (Tendering Assistant) | Partial — UI wired | 0 | Sub-mode binding verified visually (PR #143). No live chat tested. Needs AI provider configured. |
| X2 | Portal (client-facing) | Not started | — | Separate JWT |
| X3 | Field / Mobile | Not started | — | Resize to 375px |
| X4 | Admin Settings | Not started | — | — |

---

## Where the docs live

- `./MASTER-PLAN.md` — scope, phasing, severity rubric, reporting format
- `./module-reference/<module>.md` — per-module checklists, surface area, recent
  PRs, watch-for list, edge cases
- `./findings/<YYYY-MM-DD>-<slug>/REPORT.md` — individual findings
- `./findings/backlog.md` — P2 / P3 polish list (create on first P2)
- `./findings/SUMMARY.md` — final rollup (create when closing)

---

## How to resume mid-module

1. Read `./MASTER-PLAN.md` end-to-end
2. Read the latest findings reports in `./findings/`
3. Open the relevant `./module-reference/<module>.md`
4. Walk the "What should work" checklist top to bottom
5. For anything that fails — open a findings folder
6. When you close the module — update the progress table above
7. Move to the next module per the phase order in MASTER-PLAN.md

---

## Quick commands

```powershell
# Boot
pnpm dev

# Seed (idempotent — current state is seeded)
pnpm seed

# DB reset (drops + remigrates + reseeds)
pnpm --filter @project-ops/api exec prisma migrate reset --force

# Compliance smoke (backend lifecycle)
pnpm compliance:smoke

# Tendering E2E
pnpm test:tendering:e2e:reuse
```

---

## What's next (resume here)

### Immediate continuation of Phase 1B + 1C
1. Open IS-T100 (the template) → Quote tab → Edit
2. Cycle through each Quote editor sub-tab (Provisional Sums / Cost Options / Assumptions / Exclusions / Terms & Conditions / Preview) and verify pre-populated content matches PR #228 spec (2 provisional sums, 2 cost options, 8 linked assumptions, 7 exclusions, 21 T&C clauses)
3. Click Quote tab > PDF button — verify HTML→PDF render works (§5A.2)
4. Navigate IS-T020 (which has the seeded demo drawing PDF per PR #146) → open Tendering Assistant → switch to scope sub-mode → check the persona window for binding to the drawing tools (PR #143)
5. Test New tender flow with a +New tender CTA from pipeline
6. TenderEntry unified comms panel (PR #260) — go to an Estimating/Submitted tender (NOT template) and verify the Overview tab feed
7. AI provider check: navigate to `/admin/ai-providers` or settings to see if any provider is configured. Without it, persona chat won't respond.

### Phase 1D — Contracts + Tender→Job conversion
- Navigate to Contracts (sidebar Commercial section)
- Verify a contract surface; look for variations + claims (submit/approve/pay)
- Find an Awarded tender (IS-T003 Sandgate or IS-T001 Ipswich) → walk Award → Contract → Convert-to-Job flow

### Phase 1E — Jobs + recent PRs #313/#327
- Navigate to Jobs page
- Verify #327 empty state if no jobs (need to filter — dashboard shows 3 active so unfiltered won't trigger empty state)
- Identify the 2 CenteredModal migrations from #313 — verify visual consistency with PR #300's wider sweep

### Phase 2 — User's own data
- Marco loads a real tender or other live data
- Drive through it with him narrating his frustrations

### Phase 3 — System-wide smoke
- Maintenance, Resources, Assets, Compliance, Safety, Forms, Field/Mobile, Admin, Permissions, Audit
- Lighter touch — confirm every page loads, empty states are sane, permission gating works

---

## Known starting state

- Admin login: `admin@projectops.local` / `Password123!`
- App URL: http://localhost:5173
- API URL: http://localhost:3000
- Default seed tender for AI persona: `IS-T020` (full feature, drawing PDF per PR #146)
- Reference quote tender: `IS-T100` (4 disciplines, 18 scope items, full quote contents)
- SharePoint mode: `mock` (writes to `apps/api/.local-storage/sharepoint-mock`)
- AI provider: NOT configured in fresh seed — persona system gracefully degrades; needs Anthropic or OpenAI key in `apps/api/.env` for full smoke

---

## Open known risks

- F0-01 — RESOLVED 2026-06-09 (pr-135 returned no-drift; pr-144 cleaned up superseded tender_entries.client_id draft folder + matching frontend WIP files).
- **Tendering Assistant fresh-conversation smoke from re-seeded state** is the §5A.1 gate. UI wiring confirmed; need actual AI provider + a chat exchange to complete.
- **CenteredModal sweep** — PR #300 swept 24 modals + PR #313 added 2 more. Spot-checked one (no findings); need to identify and click the 2 PR #313 migrations specifically.
- **Job ID canonicalisation** — PR #210 normalised to J-YYYY-NNN. Re-seed should produce J-2026-NNN format only — verify in Phase 1E when looking at Jobs.
- **Dependabot alerts #14/#15** — pdfjs-dist v3 with `isEvalSupported: false` mitigation; alert remains open by design until v4 migration.
- **deploy.yml secrets missing** — 5 Azure secrets referenced (PROD_DATABASE_URL, PROD_API_BASE_URL, AZURE_API_APP_NAME, AZURE_API_PUBLISH_PROFILE, AZURE_STATIC_WEB_APPS_TOKEN). Workflow lints fail until Azure deploy is wired.

---

## Pointer

Master plan: `./MASTER-PLAN.md`
Findings folder: `./findings/`
Module reference: `./module-reference/`
