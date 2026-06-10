# Sanity Check — Final Summary

**Generated:** 2026-06-09
**Driver:** Cowork in Claude Desktop, Chrome MCP for browser automation
**Scope:** Full system smoke from Phase 0 (setup) through Phase 3 (system-wide) plus targeted Phase 1B + 1C deep checks on Tendering and the Tendering Assistant

## Top-line verdict

**The system is in good shape.** The §5A.1 (AI personas), §5A.2 (HTML→PDF), and the B-chain Scope-of-Works reshape are all visible and functioning at the UI layer. The seed produces a realistic dataset that exercises the major paths. Marco's `JOB-2026-001` regression and the field-route 403 UX are the main usability dents found in this pass. The schema-drift finding is the only one with a real deployment-blocking implication.

## Findings rollup

| ID | Severity | Module | Title | File |
|---|---|---|---|---|
| F0-01 | **CRITICAL** | Platform / Prisma | Schema drift between `schema.prisma` and 102 migration files | `findings/2026-06-09-phase-0-schema-drift/REPORT.md` |
| F1E-01 | **HIGH** | Seed / Jobs | Job ID canonicalisation regression — legacy `JOB-YYYY-NNN` format alongside canonical `J-YYYY-NNN` | `findings/2026-06-09-phase-1e-job-id-format-regression/REPORT.md` |
| F3-01 | **CONCERN** | Field / Mobile | `/field/allocations` shows raw JSON 403 to admin user instead of a styled error state | `findings/2026-06-09-phase-3-system-smoke/REPORT.md` |
| F1A-01 | **RESOLVED** | Sites | Sites detail page (`/sites/:id`) now ships KPI strip, Overview/Tenders/Projects/Documents tabs, and Delete button (pr-138a DELETE endpoint + pr-138b documents rollup + this frontend PR) | `findings/2026-06-09-phase-1a-master-data/REPORT.md` |
| F1B-01 | **CONCERN** | Tendering | Estimate tab merged into Scope of Works — needs roadmap/module-reference doc reconciliation | `findings/2026-06-09-phase-1b-tendering-core/REPORT.md` |
| F1A-02 | **MINOR** | Master data | `?tab=workers` URL silently rewrites to `?tab=clients` | `findings/2026-06-09-phase-1a-master-data/REPORT.md` |
| F1A-04 | **MINOR** | Clients | Email column truncates in client contacts tab without tooltip | `findings/2026-06-09-phase-1a-master-data/REPORT.md` |
| F3-02 | **MINOR** | Compliance | Sidebar Compliance badge "6" diverges from page total "4" at default 30-day window | `findings/2026-06-09-phase-3-system-smoke/REPORT.md` |
| F3-03 | **MINOR** | Documents | Context rail labels generic ("Jobs", "Tendering") — should show parent record code/name | `findings/2026-06-09-phase-3-system-smoke/REPORT.md` |
| F1A-03 | **ACKNOWLEDGED** | Resources | Worker / WorkerProfile dual model — already on PHASE 6 deferred list | `findings/2026-06-09-phase-1a-master-data/REPORT.md` |
| F1B-02 | **TODO** | Tendering | Quote PDF render (§5A.2 HTML→PDF) not smoke-tested this pass | `findings/2026-06-09-phase-1b-tendering-core/REPORT.md` |
| F1B-03 | **TODO** | Tendering | Quote editor sub-tabs (Provisional Sums / Cost Options / Assumptions / Exclusions / T&C / Preview) content not individually verified | `findings/2026-06-09-phase-1b-tendering-core/REPORT.md` |

## What's not covered

- Tendering Assistant actual chat exchange (would need an Anthropic or OpenAI key in `apps/api/.env`)
- Drawing tools live from persona on IS-T020 (has demo PDF per PR #146)
- Proposal accept/reject flows (propose_scope_items / propose_estimate_items / propose_quote_content / propose_clarifications)
- lookup_rate tool across all 8 rate types
- read_asbestos_register against the seeded BGS-T020 Asbestos Register PDF
- Tender → Award → Contract → Convert-to-Job end-to-end flow (no contract seeded)
- Variation + Claim submit/approve/pay end-to-end
- New tender creation flow + filter presets
- Bulk-status update (Raj-blocking item per §5A.3)
- PR #313 specific CenteredModal migration spots (vs the wider PR #300 sweep already verified by-side)
- JobsPage empty state (#327) — couldn't trigger because seed has 3 active jobs and filters don't yield 0
- Portal `/portal/client` (separate JWT — would need a portal-user login)
- Mobile responsive layout (375px width)
- Permission gating across non-admin roles
- Phase 6 deferred Chat1 dashboard items (KPI title/period collision, tender title truncation at narrow viewports, scheduler weekend clipping below 1280px, sidebar Tendering duplication, "Due this week" mismatch)

These are noted in the per-phase findings reports for follow-up sessions.

## See also

- `MASTER-PLAN.md` — the test plan we executed against
- `RESUME.md` — pickup guide if a follow-up session re-enters
- `findings/` — per-finding reports
- `PR-FIX-QUEUE.md` — the prioritised list of PR-prompt drafts to address the findings
