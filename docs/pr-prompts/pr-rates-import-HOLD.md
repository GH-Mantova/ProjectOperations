---
premise: '! grep -rEq "rates/import|importRates" apps/api/src/modules'
premise_means: There is no rates import endpoint yet.
scope:
  - apps/api/src/modules/rates/**
  - apps/api/src/modules/estimates/**
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - package.json
  - pnpm-lock.yaml
done_when: pnpm build && pnpm lint && grep -rEq "rates/import|importRates" apps/api/src/modules
size: 10
gate_allow: dependencies
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm ONLY after pr-rates-export has MERGED to main -->
# HOLD — Rates & Lists: Excel IMPORT + preview/confirm (round-trip, half 2)

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**.
**ARM ONLY WHEN** `pr-rates-export` has merged to `main` (import consumes the exact workbook
that export produces). Verify `grep -rq "rates/export" apps/api/src/modules` on `main` first.

Context (Marco, 2026-07-15): the IMPORT half of the round-trip. User exports, edits/adds rows
in the fixed format, uploads; the tool shows a preview (add / change / no-change per surface),
user confirms, then it applies. Idempotent — re-importing the same file is a no-op. Merge
rules already decided with Marco (see the merged-master review + memory
`project_rates_import_and_material_types`): em-dash canonical (normalise hyphens); POA/TBC →
unpriced+flag; per-load→loadRate/"load", each→"each"; keep-both by default; EACH weights in
kg/item.

## What to build

Branch: `feat/rates-import`. Reviewer: `GH-Mantova`. Dependency: an xlsx PARSER for the API
(reuse the `exceljs` added by `pr-rates-export` if present; else add it) + multipart upload
support. Bare `GATE-ALLOW: dependencies` at column 0 of the PR body. No schema migration
(writes existing tables via the service layer).

1. `POST /rates/import/preview` (guarded `rates.manage`): accepts the uploaded .xlsx, parses
   every tab, matches rows to live data by the `_key` id column (fallback: the natural key —
   Waste = Facility+Waste type normalised em-dash; Density = Material; Plant/Transport =
   Type), and returns a structured DIFF: per surface, lists of ADD / CHANGE (old→new) /
   NO-CHANGE, plus any parse warnings (unknown tab, bad number, POA/TBC). Writes NOTHING.
2. `POST /rates/import/apply`: takes the confirmed diff token/payload and applies it via the
   existing rates/estimate services — upserts by key, sets kind/unit/flags per the merge
   rules above. Idempotent. Returns a summary.
3. Web: on `RatesListsAdminPage.tsx`, an **Import** button → file picker → preview table
   (add/change/no-change per surface) → **Confirm** → apply, then refresh the grid.

## Do NOT

- Do NOT write anything during preview. Apply only on explicit confirm.
- Do NOT invent waste types/materials not in the file or the system — no rate fabrication.
- Do NOT touch Azure/prod. Do NOT change the SoW calc or schema here.
- Do NOT auto-merge duplicates silently — "keep both" is the default; surface conflicts.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If `rates/export` is NOT on `main`, STOP with `NO-OP: predecessor pr-rates-export not merged`.
- If size would exceed 10 files, SPLIT (preview API + apply API + web) and say so — do not blow the cap.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
