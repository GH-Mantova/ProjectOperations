# Dead File Gates — Repoint/Drop Audit (2026-08-19)

**Timestamp (UTC):** 2026-08-19  
**SHA of origin/main measured against:** `e9858cf3b80960c071db9b831c4f10bd523444fa`  
**Executed by:** SLICE 1 of cluster `lint-file-gate-dead`

---

## Command run

```bash
git fetch origin
grep -Hn "requires_file_on_main:" docs/pr-prompts/*.md \
  | sed 's/[[:space:]]*$//' \
  | while IFS= read -r line; do
      f="${line%%:*}"
      p="$(printf '%s' "$line" | sed "s/.*requires_file_on_main:[[:space:]]*//; s/^['\"]//; s/['\"]$//")"
      if git cat-file -e "origin/main:$p" 2>/dev/null; then echo "DEAD  $f  ->  $p"; fi
    done
```

## Raw output (before any edits, SHA e9858cf3)

```
DEAD  docs/pr-prompts/pr-cfx-s5-xero-file-import-ready.md  ->  apps/api/src/modules/xero/xero-contact-export.service.ts
DEAD  docs/pr-prompts/pr-crm-leads-s6-reason-admin-settings-ready.md  ->  apps/web/src/pages/crm/DontPursueModal.tsx
DEAD  docs/pr-prompts/pr-ew-s1-alloc-schema-HOLD.md  ->  docs/plans/estimator-allocation-workload-plan.md
DEAD  docs/pr-prompts/pr-hw-9-compliance-derivation-ready.md  ->  apps/api/src/modules/handovers/handovers.service.ts
DEAD  docs/pr-prompts/pr-ratehub-s4-create-sor-HOLD.md  ->  apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts
DEAD  docs/pr-prompts/pr-sor-s8-ar-office-review-lane-ready.md  ->  apps/api/src/modules/agreed-records/agreed-records.service.ts
DEAD  docs/pr-prompts/pr-tfm-s9-backfill-and-cleanup-HOLD.md  ->  docs/migration-runs/tender-folder-copy-2026.md
DEAD  docs/pr-prompts/pr-tr-s1-reminder-policy-HOLD.md  ->  docs/plans/tender-reminders-plan.md
```

(Note: PROMPT-SCHEMA.md and several other prompts also showed DEAD with empty paths — those are schema-doc example entries with no real path and are irrelevant to this audit.)

---

## Per-prompt treatment table

| Prompt file | Old gate path | Treatment | New value / reason |
|---|---|---|---|
| pr-cfx-s5-xero-file-import-ready.md | apps/api/src/modules/xero/xero-contact-export.service.ts | **(A) REPOINT** | `requires_on_main: apps/api/src/modules/xero/xero-contact-export.service.ts :: XERO_CONTACT_CSV_COLUMNS` — CFX-5 calls the CSV column set exported by CFX-4; `XERO_CONTACT_CSV_COLUMNS` is confirmed present on origin/main. |
| pr-crm-leads-s6-reason-admin-settings-ready.md | apps/web/src/pages/crm/DontPursueModal.tsx | **(B) DROP** | File existence was the whole dependency (signals S4 landed and `listDropReasons` in crm-api.ts is live). File confirmed on origin/main. Gate dropped; HTML comment added below front-matter. |
| pr-ew-s1-alloc-schema-HOLD.md | docs/plans/estimator-allocation-workload-plan.md | **(B) DROP** | Plan document — existence was the whole dependency. File confirmed on origin/main (402 lines). Gate dropped; HTML comment added below front-matter. |
| pr-hw-9-compliance-derivation-ready.md | apps/api/src/modules/handovers/handovers.service.ts | **(A) REPOINT** | `requires_on_main: apps/api/src/modules/handovers/handovers.service.ts :: export class HandoversService` — HW-9 builds compliance derivation on top of the service class; symbol confirmed present on origin/main. |
| pr-ratehub-s4-create-sor-HOLD.md | apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts | **(A) REPOINT** | `requires_on_main: apps/api/src/modules/schedule-of-rates/sor-source-markup.service.ts :: resolveEffectiveRate` — S4 wizard calls `resolveEffectiveRate` during SoR creation; symbol confirmed present on origin/main. |
| pr-sor-s8-ar-office-review-lane-ready.md | apps/api/src/modules/agreed-records/agreed-records.service.ts | **(A) REPOINT** | `requires_on_main: apps/api/src/modules/agreed-records/agreed-records.service.ts :: export class AgreedRecordsService` — S8 office-review service extends S7's agreed-records service; symbol confirmed present on origin/main. |
| pr-tr-s1-reminder-policy-HOLD.md | docs/plans/tender-reminders-plan.md | **(B) DROP** | Plan document — existence was the whole dependency. File confirmed on origin/main (216 lines). Gate dropped; HTML comment added below front-matter. |

---

## Needle verification (positive control)

All (A) needles verified present on origin/main before applying:

- `XERO_CONTACT_CSV_COLUMNS` in `xero-contact-export.service.ts`: confirmed (`export const XERO_CONTACT_CSV_COLUMNS = [`)
- `export class HandoversService` in `handovers.service.ts`: confirmed
- `resolveEffectiveRate` in `sor-source-markup.service.ts`: confirmed
- `export class AgreedRecordsService` in `agreed-records.service.ts`: confirmed

---

## Deliberately excluded instance

**`docs/pr-prompts/pr-tfm-s9-backfill-and-cleanup-HOLD.md`** — gate: `docs/migration-runs/tender-folder-copy-2026.md`

This prompt was measured DEAD (the path exists on origin/main) but is **intentionally left untouched** by this slice. It is reserved for SLICE 2's author to handle as part of the `FILE_GATE_DEAD` intake-lint rule work. The gate may require context about the migration run that this slice's author does not have.

---

## Post-edit verification

After applying all 7 edits, re-running the dead-gate scanner shows no remaining `requires_file_on_main:` hits for the 7 target prompts (they were either converted to `requires_on_main:` or had the key deleted). Only `pr-tfm-s9-backfill-and-cleanup-HOLD.md` remains with a live `requires_file_on_main:` key pointing to the migration-run doc, consistent with the deliberate exclusion above.
