---
premise: '! grep -q "model ActivityEntry" apps/api/prisma/schema.prisma'
premise_means: There is no universal activity-timeline control across records.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/platform/**
  - apps/web/src/components/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model ActivityEntry" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 Timeline control) | MVP: universal activity stream -->
# HOLD — UX: universal activity Timeline (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 Timeline parity: one chronological stream on every
record (notes, status changes, attachments, and — where they exist — correspondence/comms entries).

## What to build
Branch: `feat/ux-universal-timeline`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — a polymorphic `ActivityEntry` (`entityType`, `entityId`, `kind` note/status/attachment/
   system, `body`, `authorId`, `createdAt`, optional `documentId`). A generic add-note + auto-log of
   status changes. Do NOT duplicate the existing `correspondence` threads — the timeline READS/merges
   them alongside ActivityEntry for a unified view.
2. API in `platform`: `GET /timeline/:entityType/:entityId` (merged, paged) + `POST` a note; guarded
   by the host record's permission.
3. Web — a reusable `<Timeline>` component (filterable by kind, add-note box, attachment) that any
   detail page can drop in. Wire it onto ONE record type as the reference (e.g. Job or Client).

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT replace the correspondence module — merge with it. Do NOT wire every entity in the MVP (one
  reference). Do NOT touch Azure/prod. If >10 files, split (model+API / component) and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
