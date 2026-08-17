---
premise: '! grep -q "TenderClientBidStatus" apps/api/prisma/schema.prisma'
premise_means: TenderClient has no per-client bid-status field/enum yet, so a client cannot be recorded as PRICED / NO_BID / WATCHING.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/dto/tender.dto.ts
  - apps/api/src/modules/tendering/__tests__/**
done_when: pnpm build && grep -q "enum TenderClientBidStatus" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive nullable enum column (bid_status) — forward-only; safe to leave on main, re-run drops nothing. Revert by dropping the column + enum in a follow-up migration.'
backfill: false
---

GATE-ALLOW: migrations

# tender-lifecycle S2a — TenderClient.bidStatus (schema + API foundation)

## Why
The tender lifecycle re-model (SLICE-0 plan: `docs/architecture/drafts/tender-pipeline-register-plan.md`) needs a per-client bid status so we can distinguish a client we PRICED from one we deliberately did NOT price but are WATCHING (tracking their market performance). `TenderClient` today carries `isAwarded` / `contractIssued` / `submissionDate` but nothing to say whether we bid. This slice adds ONLY the data + API for that field — no UI (that is S2b/S2c). It is additive and backwards-compatible.

## What to build
1. **Prisma** (`apps/api/prisma/schema.prisma`): add `enum TenderClientBidStatus { PRICED NO_BID WATCHING }`, and a nullable column on `model TenderClient`: `bidStatus TenderClientBidStatus? @map("bid_status")`. Nullable, no default — legacy rows stay NULL (bid intent unknown). Additive only: no NOT NULL, no default that transforms data.
2. **Migration**: generate the additive migration (ADD COLUMN / CREATE TYPE only). No data transform.
3. **Data-model map** (mandatory): run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`, and `metadata-catalog.json`. The CI drift check hard-fails a schema change that leaves the map stale.
4. **DTO** (`dto/tender.dto.ts`): add `@IsOptional() @IsEnum(TenderClientBidStatus) bidStatus?: TenderClientBidStatus` (import the Prisma enum) to `TenderClientInputDto`.
5. **Service** (`tendering.service.ts`): thread `bidStatus` through EVERY `TenderClient` write map — the nested `create` on tender create (~line 810), the `deleteMany` + `createMany` on update (~line 1143), the duplicate path, and the CSV-import path (~line 1726) — persisting `bidStatus: item.bidStatus ?? null`. Add `bidStatus` to the `tenderClients` `select`/`include` used by the tender GET/detail response so the UI can read it back.
6. **Unit specs** (`__tests__/`): add `bidStatus` to the expected `createMany` / `create` payloads in the affected `toHaveBeenCalledWith(...)` assertions, or the API test job fails.

## Do NOT
- NO UI in this slice — the per-client bid-status control and the client/contact pickers are follow-on slices (S2b/S2c). Data + API only.
- Do NOT add a column default, make it NOT NULL, or write any `UPDATE ... SET` backfill — legacy rows keep NULL. This slice performs no data transformation.
- Do NOT change `isAwarded` / `contractIssued` behaviour, or touch any other model.
- Do NOT skip the data-model map regen (step 3).

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the work is already on `main`, say `NO-OP: <reason>` and stop. Never exit silently.
- Never ask a question or "stand by" for approval — there is no human in this run. Open the PR.
- This prompt is `escalates: true` — a schema change. The resulting PR must be labelled **do-not-merge**; Marco reviews and merges it. Still OPEN the PR.
- If a CI check fails, read the job log before diagnosing.

## VERIFY
- `pnpm build`
- `node scripts/data-model/build-relationship-map.mjs --check` (map is in sync).
- `grep -q "enum TenderClientBidStatus" apps/api/prisma/schema.prisma`
- API unit tests green (updated `createMany`/`create` assertions).
