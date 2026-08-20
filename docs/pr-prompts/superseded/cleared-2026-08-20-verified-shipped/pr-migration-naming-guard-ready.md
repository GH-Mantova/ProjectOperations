---
premise: test ! -f apps/api/src/common/__tests__/migration-naming.guard.spec.ts
premise_means: No guard spec rejects bare YYYYMMDD_ migration folder names, so the next one lands unnoticed.
scope:
  - apps/api/src/common/__tests__/**
done_when: test -f apps/api/src/common/__tests__/migration-naming.guard.spec.ts && pnpm build && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# Guard spec: reject NEW bare `YYYYMMDD_` migration folder names

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## The problem

Prisma applies migrations in **alphabetical folder order**. The house convention is a full
`YYYYMMDDHHMMSS_` prefix. A bare `YYYYMMDD_` prefix sorts **after** every same-day timestamped
sibling, because at character index 8 the byte `_` (0x5F) is greater than any digit.

MEASURED at `origin/main` 171b5f80 on 2026-08-20 (226 migration folders):

- **58** folders use a bare `YYYYMMDD_` prefix.
- **4 days** carry both a bare folder and same-day timestamped siblings — `20260528`,
  `20260804`, `20260806`, `20260812`. On `20260812` the bare
  `20260812_b_hw_5_handover_instance_schema` sorts after **14** timestamped migrations.

**This prompt does NOT re-order or rename anything.** All 58 are already applied and CI is green
on a fresh `migrate deploy`, so no live breakage is claimed. The exposure is the **next** one: a
backfill written with a bare prefix will silently run last, after the migration it was meant to
precede. That is the failure mode `sot/05` already records for migration ordering.

## The work

Add `apps/api/src/common/__tests__/migration-naming.guard.spec.ts`, mirroring the existing guard
specs (`route-shadowing.guard.spec.ts`, `permission-registry-coverage.guard.spec.ts`) — same
baseline-allowlist shape, so the existing 58 stay green and only NEW offenders fail.

1. Read the directory names under `apps/api/prisma/migrations`.
2. Fail on any folder matching `^\d{8}_` that does **not** match `^\d{14}_`, **unless** it is in a
   hardcoded `KNOWN_BARE_PREFIXES` allowlist.
3. Seed that allowlist with exactly the 58 folders present today. Generate it by listing the
   directory — do not hand-type it.
4. The failure message must state the rule plainly: use a full `YYYYMMDDHHMMSS_` prefix, because a
   bare `YYYYMMDD_` sorts after same-day timestamped migrations.
5. Add a comment above the allowlist saying it is a frozen historical baseline and **must never be
   extended** — a new entry means someone added a bare prefix instead of fixing the name.

## Scope discipline

Test file only. Do **not** rename, re-order, or delete any existing migration folder — those are
applied and renaming one would break `_prisma_migrations` checksum matching on every existing
database. Do not touch `schema.prisma`; this prompt has no schema scope and therefore no
data-model-map regeneration obligation.

## Done

`pnpm build` and `pnpm lint` pass, the new spec passes, and deliberately renaming any existing
timestamped folder to a bare prefix locally makes it fail (verify this once, then revert).
