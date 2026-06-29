# Migration history audit

**Date:** 2026-06-19
**Scope:** `apps/api/prisma/migrations/` vs `apps/api/prisma/schema.prisma`
**Status:** Report only — no migrations or schema changes made.

This audit catalogues sort-order risk and obvious drift signals in the
existing Prisma migration history. It is a findings document for Marco to
action later; remediation belongs in a separate PR.

Related lesson: **LL-05 (2026-05/06)** — Prisma sorts migration folders
alphabetically, so bare `YYYYMMDD_*` folders sort *before* any same-day
`YYYYMMDDHHMMSS_*` folders, but *after* same-day folders that include
HHMMSS digits because `_` (0x5F) sorts higher than the digit characters
`0–9` (0x30–0x39). The standing reviewer guard is: *never merge a
migration that doesn't sort AFTER all existing same-day migrations.*
This audit lists the historical folders that violate that guard.

## 1. Inventory by timestamp shape

| Shape | Count | Example |
|---|---|---|
| `YYYYMMDD_…` (8-digit, bare date) | 50 | `20260418_s4_sso_user_flag` |
| `YYYYMMDDHHMM_…` (12-digit, no seconds) | 19 | `202604020001_auth_foundation` |
| `YYYYMMDDHHMMSS_…` (14-digit, full timestamp) | 38 | `20260502011757_feat_persona_registry_foundation` |
| **Total** | **107** | + `migration_lock.toml`, `reconciliation-notes.md` |

`pnpm prisma migrate deploy` applies these in pure lexicographic order,
which is the underlying risk: only the 14-digit form is unambiguous.

## 2. Sort-order risk findings

### 2.1 Bare `YYYYMMDD_` folders co-located with HHMMSS folders on the same date

These are the cases where a bare-date folder must sort *after* every
same-day full-timestamp folder, by virtue of `_ > 0-9`. Today this still
applies cleanly because all known same-day siblings authored earlier in
the day chronologically also have lower lex order. But the trap is that
**any future PR landing a 14-digit migration on the same date will sort
before the bare-date sibling, regardless of when it was authored**:

| Bare-date folder | Same-day 14-digit siblings (lex < bare) |
|---|---|
| `20260528_rename_person_days_to_labour_days_override` | `20260528033535_plant_rate_category`, `20260528151542_quote_scope_redesign` |

Walk-through for 20260528:

| Order applied | Folder | Effect |
|---|---|---|
| 1 | `20260527045615_scope_card_header_overrides` | ADD `scope_cards.total_person_days_override` |
| 2 | `20260528033535_plant_rate_category` | unrelated |
| 3 | `20260528151542_quote_scope_redesign` | unrelated |
| 4 | `20260528_rename_person_days_to_labour_days_override` | RENAME → `labour_days_override` |

Today this works. A future 14-digit migration dated `20260528*` that
expects `labour_days_override` to already exist would sort *before* step
4 and fail.

### 2.2 Bare-date folders with no same-day siblings (lower direct risk)

Most of the 50 bare-date folders are isolated on their date and pose no
*current* ordering hazard, but every one of them is a future trap because
any later PR on the same calendar date with a 14-digit prefix will sort
before them. Densely-populated dates:

- **20260420** — 6 folders, all bare-date
- **20260421** — 10 folders, all bare-date
- **20260422** — 8 folders, all bare-date
- **20260426** — 16 folders, all bare-date

Within these same-date clusters, apply order is dictated by the slug
suffix (alphabetical), not by authored order. If any pair has a
producer/consumer relationship, replay-from-empty may diverge from the
dev-DB history.

### 2.3 12-digit `YYYYMMDDHHMM_NNNN_…` folders (April 2026 init batch)

The 19 folders `202604010001_…` through `202604160001_…` use a
`YYYYMMDDHHMM` prefix with a 4-digit run-number tail. They sort cleanly
among themselves (the explicit run-numbers preserve intent) and sort
*before* the bare-date `20260418_*` folders. No active hazard, but they
are inconsistent with the 14-digit standard and should not be used as a
template for new migrations.

## 3. Drift signals (cross-checked against `schema.prisma`)

`schema.prisma` declares 165 models and 10 enums. A full
`prisma migrate diff --from-migrations … --to-schema-datamodel …` run is
out of scope for this report (would require a shadow DB), so the
findings here are limited to what is visible in the static files plus
the existing reconciliation note.

### 3.1 Resolved drift — `20260602084115_chore_reconcile_drift`

`apps/api/prisma/migrations/reconciliation-notes.md` documents that this
migration folded in:
- **39 foreign-key constraint refreshes** across 21 tables (cascade-rule
  alignment).
- **5 `ALTER COLUMN` corrections** (stale defaults, `TIMESTAMP(6) → (3)`).
- **1 index rename** (`…_depth_mm_ke` → `…_depth_m_key`).
- **Stale-bucket cleanup**: dropped `workers.employmentType` orphan
  column and `tender_clients_contract_issued_idx` orphan index.

The note's `## Scope` section explicitly states no schema edits, no
source/seed/DTO edits, and no in-place migration edits. **No
outstanding follow-ups identified in the note itself.**

### 3.2 Migrations layered after the reconcile point

13 migration folders sort after `20260602084115_chore_reconcile_drift`.
None have a known associated reconciliation gap; spot-checking the most
recent (`20260617090000_pr_competency_gate_enforce`) shows it landed on
14-digit cadence cleanly. No re-reconciliation triggered.

### 3.3 Migrations whose folder name encodes a duplicated date prefix

- `20260527040627_20260527_estimate_material_density` — the slug
  redundantly repeats `20260527`. Cosmetic only; the leading 14-digit
  prefix still sorts correctly.

### 3.4 Backfill / data-only migrations adjacent to schema migrations

- `20260527040628_backfill_material_density` follows
  `20260527040627_20260527_estimate_material_density` by 1 second.
- `20260529020810_backfill_tender_entries` follows
  `20260529020234_tender_entries` by ~6 minutes.

Both pairs sort correctly. Mentioned only because LL-05's standing fix
calls out "full timestamps + inline data for backfills" — these are the
opposite pattern (separate backfill folders), which is fine as long as
the timestamps stay distinct.

### 3.5 Schema models / columns not visible in migration grep — not audited

A static keyword scan from `schema.prisma` model names against migration
SQL is unreliable (rename-via-`@map`, model split across multiple
migrations, etc.). The authoritative check is a shadow-DB
`prisma migrate diff` run; that is **out of scope** for this report-only
audit and is the recommended next step before any cleanup PR.

## 4. Recommended next steps (not done in this PR)

1. Run `prisma migrate diff --shadow-database-url … --from-migrations
   apps/api/prisma/migrations --to-schema-datamodel
   apps/api/prisma/schema.prisma --script` and attach the output.
   Expected: empty (per `reconciliation-notes.md`). Any output is the
   audit's true drift surface.
2. For new migrations going forward: enforce 14-digit
   `YYYYMMDDHHMMSS_` prefixes in CI (e.g. a lint check on
   `apps/api/prisma/migrations/*/`).
3. Decide whether to rename existing bare-date and 12-digit folders.
   **Strongly biased against** — renaming applied migrations breaks
   every deployed environment's `_prisma_migrations` row. The pragmatic
   posture is "leave history alone, gate the future."
4. Add a reviewer-checklist item referencing LL-05.

## 5. Verification

- `git diff --name-only origin/main…HEAD` shows only
  `docs/migration-history-audit.md` (single new doc, per LL-30 explicit
  staging discipline).
- No files under `apps/api/prisma/`, `apps/api/src/`, `apps/web/src/`,
  or `packages/` were modified.
- No migrations added, renamed, or deleted.
- No `schema.prisma` edits.

## 6. Source data

- Migration folder inventory: `ls apps/api/prisma/migrations/` at HEAD
  (107 migration folders + `migration_lock.toml` +
  `reconciliation-notes.md`).
- Schema reference: `apps/api/prisma/schema.prisma` (3813 lines, 165
  models, 10 enums).
- Reconciliation context: `apps/api/prisma/migrations/reconciliation-notes.md`.
- Lesson cross-ref: `docs/lessons-learned/incident-ledger.md` LL-05.
