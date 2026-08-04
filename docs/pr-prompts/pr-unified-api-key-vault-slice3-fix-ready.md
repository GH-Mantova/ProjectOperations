---
premise: 'gh pr view 895 --json state -q .state | grep -q OPEN'
premise_means: SLICE-3 backfill PR #895 is still open (red); the migration-drift fix has not landed.
scope:
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/api-keys/**
done_when: pnpm build
size: 6
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Fix lands on PR #895 branch feat/api-keys-vault-backfill-slice-3 only (not main); revert = reset that branch or close #895. Corrective migration is additive/idempotent.'
fixes_pr: 895
---

# FIX-FORWARD #895: SLICE-3 backfill fails prisma migrate (api_key_type.updatedAt drift)

## The defect (verify on current head FIRST)
PR #895 (SLICE-3 backfill) is RED on the `API - lint, test, compliance smoke` check. The
`pnpm prisma:migrate` step fails with:
> "Added the required column `updatedAt` to the `api_key_type` table without a default value.
>  There are 11 rows in this table, it is not possible to execute this step."
Re-verify this is STILL the failure on #895's current head before acting: read the latest failed
job log (`gh pr checks 895`, then `gh run view <runId> --log-failed`). If the failure has changed,
chase the NEW log, not this text.

## Root cause (hypothesis to confirm by reproducing)
`prisma migrate dev` (the CI `prisma:migrate` step) applies all migrations then reconciles against
schema.prisma. It wants to ADD `updatedAt` to `api_key_type` — i.e. the committed SLICE-1 migration
(20260804130000_api_key_vault) and schema.prisma disagree on that column. This passed on SLICE-1
because the table was EMPTY (auto-add on 0 rows succeeds). Now the SLICE-3 backfill
(20260804140000_backfill_api_credential_vault) seeds 11 api_key_type rows FIRST, so the auto-add of a
NOT-NULL, no-default column fails. Confirm by reproducing locally against a fresh Docker postgres.

## What to fix (on PR #895's own branch)
1. `git fetch` and check out PR #895's branch: `gh pr checkout 895`
   (branch = feat/api-keys-vault-backfill-slice-3). The broken migration lives in this branch's diff,
   so the fix MUST land here - do NOT open a new PR.
2. Reproduce: run the SAME command CI runs (`pnpm --filter @project-ops/api prisma:migrate` or the
   repo's `prisma:migrate` script) against a fresh Docker postgres; capture the exact drift with
   `npx prisma migrate diff --from-migrations apps/api/prisma/migrations --to-schema-datamodel
   apps/api/prisma/schema.prisma --script` (or the repo binary per MEMORY - global npx prisma is v7,
   use the repo's v6). 
3. Fix the drift so `prisma migrate dev` applies ALL migrations + the backfill seed cleanly with NO
   auto-generated step and NO "add column" error. Approaches (pick what the diff proves correct):
   - Do NOT edit the already-merged 20260804130000_api_key_vault migration (immutable on main).
   - Preferred: make the drift disappear. If schema.prisma and the merged migration genuinely differ
     on api_key_type/api_credential columns (updatedAt/createdAt), add a corrective migration that
     runs BEFORE the seed inserts (earlier timestamp than 20260804140000) which ALTERs the table to
     match schema.prisma - add the missing column WITH a safe default (e.g. `DEFAULT now()` / backfill
     existing rows) so it is valid on a populated table.
   - Ensure the backfill's own INSERTs into api_key_type set `updatedAt` (and `createdAt`) explicitly
     (@updatedAt has no DB default), so raw-SQL seeding never NULL-violates.
   - If simpler and correct: fold the column reconciliation + seed into a single ordered migration so
     columns always exist before rows are inserted.
4. Prove green locally: `prisma migrate diff ... ` reports NO drift; a fresh `prisma migrate deploy`
   (or the CI `prisma:migrate`) applies clean; `pnpm build` passes; the backfill remains idempotent
   (re-run = no-op) and additive (no drops, legacy rows untouched).
5. Commit to the #895 branch and `git push` (this updates PR #895 and re-runs its CI). Do NOT open a
   new PR. #895 keeps its `do-not-merge` label and escalates posture - Marco merges it once green.

## Do NOT
- Do NOT open a new PR - push to the existing #895 branch (feat/api-keys-vault-backfill-slice-3).
- Do NOT edit merged migrations, schema models beyond removing the drift, UI, /sot/, or Azure.
- Do NOT decrypt/print/log/rotate any key VALUE. Copy encrypted bytes only.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and UPDATE PR #895. Do not ask.**
> This is a FIX-LANE prompt: the PR already exists (#895). Your completion is "#895's branch pushed,
> CI re-running". Do NOT open a new PR; do NOT wait for approval. Finishing then asking = failing.
> escalates:true blocks only the MERGE (Marco's), never your push.

## Guardrails
- One attempt. Re-verify the failure on #895 head before acting; chase the live job log, not this text.
- Never ask a question or "stand by". `pnpm build` must pass and the prisma:migrate repro must be green.
- Completion test: PR #895 branch updated (its CI re-running). That IS the PR number in your output.
