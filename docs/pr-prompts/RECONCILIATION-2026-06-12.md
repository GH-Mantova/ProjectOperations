# PR-prompt queue reconciliation — 2026-06-12

**Run by:** Cowork (Fable) sub-agent audit + folder cleanup, while the #364 fix was in flight.
**Trigger:** pr-63b was found misfiled in failed/ (died on a usage limit the watcher didn't recognise as soft-halt) — full sweep ordered.
**Audit baseline:** origin/main @ 2cd866f.

## Headline findings

- Of 50 dead log files in failed/, **47 died on usage-limit waves** (2026-06-05 weekend + 06-07/08, two daily resets), 1 max-turns (pr-31), 1 process error (pr-48), 1 API 529 (pr-66). Almost nothing failed on merit.
- Root cause of the leak: the watcher's usage-limit detector misses the phrasing "You've hit your limit" → soft-halts were misfiled as hard failures and never re-queued. **Fix queued for the next watcher PR: add /hit your limit/i to USAGE_LIMIT_PATTERNS.**
- ~12 prompts' deliverables were later REDONE under other numbers (notably all 6 Swagger prompts superseded by the #353 burn-down). ~25 prompts are GENUINELY MISSING work.

## Folder semantics after this cleanup

- `failed/` — EMPTY. From now on it means "real failure needing attention", nothing else.
- `backlog/` — NEW. All genuinely-missing / re-evaluate prompts moved here (66 files). This is live work to re-stage, ideally as CONSOLIDATED prompts (see below), not by firing 30 stale files.
- `archive/` — received: redone prompts (pr-3, pr-48, pr-78–83, pr-96, pr-119, old pr-63b copy), 15 orphan logs of later-succeeded runs, stale blocked/ copies of merged work (pr-156/#355, pr-161+161a/#360), all 5 awaiting-review notes (#262–267 all merged).
- `blocked/` — only pr-164 (#364, genuinely in flight; fix-forward pr-164a running).
- `awaiting-review/` — empty, folder retired.
- `paused/` — rev-360 + rev-364 (intentional: post-merge audits to run after #364 lands).

## Backlog inventory (re-stage as consolidated prompts)

1. **Unit-test suites (10 missing + 2 thin):** Contracts, Safety, Compliance, Audit, Users, Roles, Quote, TenderClients, TenderClarifications services + web offline syncManager; Maintenance (2 thin tests) and TenderDocuments (1 test) need topping up. → suggest 2-3 consolidated PRs grouped by module family.
2. **JSDoc sweep (12 modules):** forms, scheduler, tendering (pr-125; pr-31 is a duplicate — dedupe), estimates, audit, users, roles, permissions, assets, resources, contracts, workers. → ONE consolidated decorator-style PR (precedent: #353).
3. **UX fixes (5):** explicit 404 page (App.tsx `*` still silently redirects), ArchivePage + CompliancePage empty states, chart tooltip contrast (dark-on-dark — Marco-flagged), tender title truncation (verify still reproduces on dashboard-v2 first).
4. **Feature:** pr-77 tender/job number formats `T{YYMMDD}-{SLUG}-Rev{N}` / `J{YYMMDD}-{SLUG}-{NNN}` incl. backfill migration (Marco-confirmed spec — biggest item, own PR, GATE-ALLOW: migrations).
5. **Docs:** pr-98 roadmap sync — regenerate against CURRENT state (the 06-05 list is outdated; also flip pr-96's stale ⏸️ flag).
6. **Re-verify before staging (dashboard since reworked):** pr-95 truncation, pr-97 KPI title/period collision — check on live dashboard-v2 at ≤1024px; mark obsolete if clean.

## Standing rule

Anything that dies in failed/ gets triaged within a day: real failure → fix; limit/infra → re-queue. The watcher pattern fix + this folder discipline prevent recurrence. Ledger: LL-28.
