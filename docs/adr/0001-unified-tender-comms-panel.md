# ADR-0001 — Unified tender communications panel

## Status
Accepted — shipped in PR #260 (2026-05-29).

## Context
The Tender Detail → Overview tab previously had three separate panels for
communications-style entries: Activity timeline (notes), Clarifications &
Communications (RFIs / emails / calls / meetings / notes), and Follow-ups
(tasks with due dates + optional assignees). The split caused:
- Inconsistent author/timestamp display per panel
- No cross-cutting filter (e.g. "show me all entries for client X")
- Duplicate code for create-form modals
- No assignment notifications for follow-up tasks

## Decision
Introduce a single `TenderEntry` row type with a discriminating `type` field
(`note` | `rfi` | `email` | `call` | `meeting` | `follow_up` | `self_reminder`
| `task`). All three legacy panels collapse to one feed; users filter by
type-group via chips or grouped tabs.

## Consequences

Positive:
- Single create-form modal with type-conditional fields (due date, assignee)
- Filter chips work uniformly across all types
- Task assignment fires in-app notification + email
- Pre-existing data backfilled idempotently from legacy tables

Negative:
- Schema migration + data backfill required (handled in PR #260 phases 1-2)
- Legacy tables (`tender_notes`, `tender_clarifications`, `tender_follow_ups`)
  retained for one release cycle for safety — adds storage cost short-term
- Future PR (deferred) will drop legacy tables once the new flow is proven

## Alternatives considered

- Keep the three panels and add cross-panel filters → rejected, doubles
  maintenance surface
- Migrate to a third-party comms platform (e.g. Intercom) → out of scope;
  this is internal tender workflow

## References
- PR #260 — implementation
- PR-29 — deprecation markers on legacy endpoints
- PR-31 — JSDoc on the new module's public exports
