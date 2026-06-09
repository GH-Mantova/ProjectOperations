# Sanity Check — Master Plan

**Owner:** Marco (WHS & Commercial Compliance)
**Last updated:** 2026-06-09
**Status:** Pre-Phase 0 — module reference compiled, awaiting "ready" signal to begin

---

## Scope

A deep, repeatable sanity-check pass over the live ProjectOperations app. Claude
drives the running web app in the persona of:

1. **Backend developer** — does the API behave as documented? Are errors clean?
2. **Frontend developer** — do the UI states (loading, empty, error) all work?
   Does the app degrade gracefully?
3. **Product manager** — does the workflow match what the roadmap claims?
   Are the experience gaps obvious?
4. **End consumer (Raj / Sean / Amy / Matthew / field worker / client)** — can a
   normal human actually complete the task without getting stuck?

The bias of this sanity check is **commercial** — Tendering, Quotes, Contracts,
Progress Claims, and the AI Tendering Assistant. Field/Mobile and Compliance
are secondary, but covered because they share state with commercial flows.

---

## Reference materials

Per-module checklists, surface area, recent PRs, and edge cases live in
`./module-reference/`. There is one file per module (S1 through S16) plus
extras for cross-cutting concerns (AI Personas, Portal, Field/Mobile,
Admin Settings).

Always read the module reference for a module BEFORE driving through it.

---

## Phase 0 — Setup (one-off)

Before any clicking happens:

1. **Verify environment is clean**
   - `git status` clean on whichever branch is being tested
   - `pnpm install --frozen-lockfile` succeeds
   - `pnpm prisma:generate` succeeds
   - `pnpm prisma:migrate` shows zero pending migrations
2. **Seed a known-clean DB**
   - Drop and recreate the local Postgres DB
   - `pnpm seed` runs to completion idempotently
   - Confirm seed user `admin@projectops.local` / `Password123!` logs in
3. **Boot the stack**
   - `pnpm dev` starts both API (`:3000`) and web (`:5173`) without errors
   - Health: `GET http://localhost:3000/api/v1/health` returns 200
   - Swagger: `http://localhost:3000/api/docs` renders
4. **Browser baseline**
   - Open Chrome at `http://localhost:5173`, log in as admin
   - Open DevTools, Console tab, Network tab
   - Take a baseline screenshot for the findings folder
5. **Confirm SharePoint mode**
   - `SHAREPOINT_MODE=mock` for sanity check (live Graph not in scope)
   - File uploads should hit `apps/api/.local-storage/sharepoint-mock`

If any step fails, **stop** and log a Phase-0 finding before continuing.

---

## Phase 1 — Commercial happy paths (priority)

Drive the modules below in the order listed. For each: read the module
reference, work down the "What should work" checklist, log any deviation as
a finding under `./findings/<YYYY-MM-DD>-<module>/`.

| Order | Module | Why first |
|---|---|---|
| 1 | Master Data | Foundation — nothing else works without clients/sites |
| 2 | Tendering & Estimating | The commercial heart of the platform — Raj's daily tool |
| 3 | Tender Documents | Drawings + asbestos register feed AI persona |
| 4 | AI Personas (Tendering Assistant) | Recently completed §5A.1 — high risk for regression |
| 5 | Quotes (under Tendering) | Cost-line structure, T&C, PDF render |
| 6 | Award / Contract / Job Conversion | The tender → project bridge |
| 7 | Contracts (variations, progress claims, retention) | Amy's workflow |
| 8 | Admin Settings | AI Settings, email provider, rates admin |

The default per-module pattern:

1. List view — empty state, full state, filters, search, pagination, bulk ops
2. Create flow — required fields, validation, success state, error state
3. Detail view — every tab, every modal, every CTA
4. Edit / update — both happy path and conflict scenarios
5. Delete — confirmation modal, cascade behaviour, audit log
6. Cross-references — does the data appear on linked records?

---

## Phase 2 — Operations + Compliance

After commercial, move through the operations stack. Lower priority but still
in scope because of compliance gates (Marco's domain).

| Order | Module |
|---|---|
| 9 | Jobs and Delivery |
| 10 | Scheduler and Work Planning |
| 11 | Resources and Competencies |
| 12 | Assets and Equipment |
| 13 | Maintenance |
| 14 | Forms and Compliance |
| 15 | Documents |
| 16 | Dashboards and Reporting |
| 17 | Closeout and Archive |

---

## Phase 3 — Cross-cutting + edge

| Module | Notes |
|---|---|
| Portal (client-facing) | Separate JWT — log out admin, log in as portal user |
| Field/Mobile | Resize to 375px, test PWA install, offline outbox |
| Admin Settings | RBAC, audit trail, AI provider config |
| Platform Foundation | Health, version, telemetry, error boundary |
| Auth / Users / Roles | Impersonation, password reset, M365 SSO if enabled |

---

## Reporting format

For each finding, create a folder under `./findings/`:

```
findings/2026-06-09-tender-bulk-status/
  REPORT.md          # what happened, expected vs actual, severity, repro
  screenshot-1.png   # before
  screenshot-2.png   # after
  network.har        # if a request failed (optional)
```

**Severity rubric:**

- **P0** — blocks a core workflow (can't create a tender, can't send a quote)
- **P1** — visible bug or regression with a workaround
- **P2** — UX rough edge, layout glitch, copy issue
- **P3** — polish, nit, suggestion

**Report contents:**

1. **Module + path** — `Tendering / /tenders/IS-T020 / Quote tab`
2. **What I did** — exact click sequence
3. **What I expected** — based on the roadmap / module reference
4. **What happened** — what the UI actually did
5. **Severity** — P0 / P1 / P2 / P3
6. **Suggested fix** — optional; include if obvious from the source
7. **Evidence** — screenshots, network logs, console errors

---

## How to interpret findings

- A **P0** finding pauses the sanity check immediately. Capture the repro,
  raise it with Marco for a hotfix, resume after merge.
- **P1** findings batch into a single fix-up PR per module.
- **P2 / P3** findings go into a backlog doc — `./findings/backlog.md` — and
  feed into the next polish wave (likely §5A.3 closeout or §6 tech debt).

A sanity check is "complete" when:

- Every module reference's checklist has been walked through
- Every P0 + P1 has either been fixed or formally deferred
- The findings/ folder has a `SUMMARY.md` rolling up severity counts per module
- Marco has signed off on the summary

---

## When to re-run

- Before a tagged release
- After any major schema migration
- After any AI-persona change (Tendering Assistant is the highest-blast-radius
  surface in the app right now)
- After the next big PR chain (§5A.3 close-out, §5B / §5C activation, §7
  field worker competency gate)

---

## Related docs

- `./RESUME.md` — pick up where you left off
- `./module-reference/*.md` — per-module reference
- `./findings/` — every finding, with evidence
- `../diagnostics/README.md` — Cowork diagnostic conventions
- `../Designs/scope-of-works-redesign.md` — Fix Map + Design Map (live)
- `../audits/2026-05-02-system-audit.md` — last full system audit
