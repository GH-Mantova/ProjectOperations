#!/usr/bin/env node
// =============================================================================
// tenant-id-null-audit.mjs
// =============================================================================
// READ-ONLY audit of nullable tenantId columns on company-owned pilot tables.
//
// EXIT 0 always. This is a measurement script, not a gate.
// It never modifies the schema, writes migrations, or backfills data.
//
// MT-3 classification (docs/plans/multi-tenant-plan.md):
//   Company-owned (backfill + enforce NOT NULL): Tender, Job
//   Shared master data (stay nullable, NOT in scope): Client, Worker, Contact
//
// What it counts:
//   Tender  — total / null-tenantId / non-null-tenantId
//   Job     — total / null-tenantId / non-null-tenantId
//
// Uses raw SQL ($queryRawUnsafe) so this script works regardless of whether
// the installed @prisma/client was generated with or without the MT-1 tenantId
// fields — the underlying postgres columns always exist after MT-0.
//
// Outputs:
//   - Headline counts to stdout
//   - Timestamped report to docs/data-model/tenant-id-null-audit-<ISO-stamp>.md
// =============================================================================

import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(REPO_ROOT, 'docs', 'data-model');

// Resolve @prisma/client from the main repo's apps/api node_modules.
// In a git worktree the worktree folder has no node_modules of its own;
// the installed packages live in the canonical checkout at C:\ProjectOperations2.
// We use createRequire with the canonical path so module resolution works
// regardless of which worktree this script is called from.
const CANONICAL_API = 'C:\\ProjectOperations2\\apps\\api';
const require = createRequire(join(CANONICAL_API, 'package.json'));
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pct(part, total) {
  if (total === 0) return 'N/A';
  return ((part / total) * 100).toFixed(1) + '%';
}

// Raw-SQL count helper — returns a plain JS number.
// Uses $queryRawUnsafe so the script works regardless of which version of the
// @prisma/client generated types are installed (the tenant_id column always
// exists in Postgres after MT-0 regardless of what the TS client knows about).
async function sqlCount(sql) {
  const rows = await prisma.$queryRawUnsafe(sql);
  // Prisma returns BigInt for COUNT(*) — coerce to Number.
  return Number(rows[0].cnt);
}

// ---------------------------------------------------------------------------
// audit functions (READ-ONLY — SELECT/COUNT queries only, no UPDATE/ALTER)
// ---------------------------------------------------------------------------

async function auditTender() {
  const total    = await sqlCount('SELECT COUNT(*) AS cnt FROM tenders');
  const nullTenant = await sqlCount('SELECT COUNT(*) AS cnt FROM tenders WHERE tenant_id IS NULL');
  const nonNull  = total - nullTenant;
  return { total, nullTenant, nonNull };
}

async function auditJob() {
  const total    = await sqlCount('SELECT COUNT(*) AS cnt FROM jobs');
  const nullTenant = await sqlCount('SELECT COUNT(*) AS cnt FROM jobs WHERE tenant_id IS NULL');
  const nonNull  = total - nullTenant;
  return { total, nullTenant, nonNull };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('tenant-id-null-audit — connecting to database...');

  let tender, job;
  try {
    // Positive-control: verify the connection returns a row before trusting
    // any NULL/NOT-NULL counts. A failed connection would produce undefined
    // results that could be misread as meaningful data.
    const ping = await prisma.$queryRawUnsafe('SELECT 1 AS ok');
    if (!ping || ping[0].ok !== 1) {
      throw new Error('Database connection check failed — aborting to avoid false counts.');
    }

    [tender, job] = await Promise.all([
      auditTender(),
      auditJob(),
    ]);
  } finally {
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // stdout headline
  // ---------------------------------------------------------------------------
  console.log('');
  console.log('=== Tender (IN SCOPE — company-owned, candidate for backfill + NOT NULL enforce) ===');
  console.log(`  Total rows:          ${tender.total}`);
  console.log(`  tenantId NULL:       ${tender.nullTenant} (${pct(tender.nullTenant, tender.total)} of total)`);
  console.log(`  tenantId NOT NULL:   ${tender.nonNull} (${pct(tender.nonNull, tender.total)} of total)`);
  console.log('');
  console.log('=== Job (IN SCOPE — company-owned, candidate for backfill + NOT NULL enforce) ===');
  console.log(`  Total rows:          ${job.total}`);
  console.log(`  tenantId NULL:       ${job.nullTenant} (${pct(job.nullTenant, job.total)} of total)`);
  console.log(`  tenantId NOT NULL:   ${job.nonNull} (${pct(job.nonNull, job.total)} of total)`);
  console.log('');
  console.log('NOTE: Client, Worker, Contact are shared master data — not in scope for MT-3.');
  console.log('');
  console.log(`Report written to: docs/data-model/tenant-id-null-audit-${stamp}.md`);

  // ---------------------------------------------------------------------------
  // markdown report
  // ---------------------------------------------------------------------------
  const reportPath = join(OUT_DIR, `tenant-id-null-audit-${stamp}.md`);
  mkdirSync(OUT_DIR, { recursive: true });

  const md = `# tenantId NULL Audit — ${stamp}

Generated by \`scripts/data-model/tenant-id-null-audit.mjs\`.
**READ-ONLY.** No schema changes, no migrations, no row backfills.

---

## Context

This audit was produced to support MT-3: backfill + enforce \`tenantId NOT NULL\` on
company-owned pilot tables (\`Tender\`, \`Job\`).

Per \`docs/plans/multi-tenant-plan.md\` and \`apps/api/src/common/tenancy/tenant.constants.ts\`:
- **Company-owned (IN SCOPE):** \`Tender\`, \`Job\` — will be backfilled to
  \`SEEDED_DEFAULT_TENANT_ID = "tenant-initial-services-001"\` then made NOT NULL.
- **Shared master data (NOT in scope):** \`Client\`, \`Worker\`, \`Contact\` — \`tenantId\`
  stays \`String?\` (nullable), unchanged by MT-3.

MT-3 mirrors the siteId backfill precedent (\`docs/pr-prompts/pr-siteid-notnull-backfill-HOLD.md\`):
the migration SQL is written, reviewed by Marco, and run manually against production.

---

## Tender — IN SCOPE (company-owned)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${tender.total} | 100% |
| tenantId NULL | ${tender.nullTenant} | ${pct(tender.nullTenant, tender.total)} |
| tenantId NOT NULL | ${tender.nonNull} | ${pct(tender.nonNull, tender.total)} |

> All NULL rows will be backfilled to \`tenant-initial-services-001\` by the MT-3
> migration. After backfill, the column is made NOT NULL.

---

## Job — IN SCOPE (company-owned)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${job.total} | 100% |
| tenantId NULL | ${job.nullTenant} | ${pct(job.nullTenant, job.total)} |
| tenantId NOT NULL | ${job.nonNull} | ${pct(job.nonNull, job.total)} |

> All NULL rows will be backfilled to \`tenant-initial-services-001\` by the MT-3
> migration. After backfill, the column is made NOT NULL.

---

## Out of Scope (Shared Master Data)

\`Client\`, \`Worker\`, and \`Contact\` have nullable \`tenantId\` by design.
They are **not** measured or touched by MT-3.

---

## Decision Gate

The MT-3 migration SQL is safe to run when Marco confirms the NULL counts above
are accurate and the one existing tenant (\`tenant-initial-services-001\`) is the
correct backfill target for all rows. If any non-NULL rows exist already (e.g.
from a partial test run), the UPDATE is idempotent (\`WHERE tenant_id IS NULL\`).

---

*Audit run completed at ${new Date().toISOString()} (UTC).*
`;

  writeFileSync(reportPath, md, 'utf8');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  // Exit 0 per the spec — this is a report, not a gate.
  process.exit(0);
});
