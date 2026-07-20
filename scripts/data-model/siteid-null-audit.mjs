#!/usr/bin/env node
// =============================================================================
// siteid-null-audit.mjs
// =============================================================================
// READ-ONLY audit of nullable siteId columns on four models.
//
// EXIT 0 always. This is a measurement script, not a gate.
// It never modifies the schema, writes migrations, or backfills data.
//
// What it counts:
//   FormSubmission  — total / null-siteId / derivable / not-derivable
//     "derivable" means: siteId is NULL but jobId IS NOT NULL
//     (Job.siteId is NOT NULL, so the correct siteId can be inferred)
//     Also counts shiftId route (Shift.jobId is NOT NULL -> Job.siteId)
//     for transparency, but jobId covers it since shift always implies a job.
//
//   AssetCheckout   — informational only (NOT in scope for NOT NULL flip)
//     "derivable" means: siteId is NULL but jobId IS NOT NULL
//
//   FormPublicLink  — informational only (NOT in scope for NOT NULL flip)
//     "derivable" means: siteId is NULL but jobId IS NOT NULL
//
//   DailyDiary      — informational only (NOT in scope for NOT NULL flip)
//     projectId is NOT NULL on every DailyDiary row, and Project.siteId
//     is NOT NULL, so ALL null-siteId DailyDiary rows are derivable.
//
// Outputs:
//   - Headline counts to stdout
//   - Timestamped report to docs/data-model/siteid-null-audit-<stamp>.md
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

function fmtCount(label, n, total) {
  return `  ${label}: ${n} (${pct(n, total)} of total)`;
}

// ---------------------------------------------------------------------------
// audit functions
// ---------------------------------------------------------------------------

async function auditFormSubmission() {
  const total = await prisma.formSubmission.count();
  const nullSite = await prisma.formSubmission.count({
    where: { siteId: null },
  });

  // Derivable via jobId (Job.siteId is NOT NULL)
  const derivableViaJob = await prisma.formSubmission.count({
    where: { siteId: null, jobId: { not: null } },
  });

  // Derivable via shiftId only (no jobId set) — shift -> job -> siteId
  // Shift.jobId is NOT NULL, so shift always carries a job's siteId.
  const derivableViaShiftOnly = await prisma.formSubmission.count({
    where: {
      siteId: null,
      jobId: null,
      shiftId: { not: null },
    },
  });

  const derivable = derivableViaJob + derivableViaShiftOnly;
  const notDerivable = nullSite - derivable;

  return { total, nullSite, derivableViaJob, derivableViaShiftOnly, derivable, notDerivable };
}

async function auditAssetCheckout() {
  const total = await prisma.assetCheckout.count();
  const nullSite = await prisma.assetCheckout.count({
    where: { siteId: null },
  });
  const derivableViaJob = await prisma.assetCheckout.count({
    where: { siteId: null, jobId: { not: null } },
  });
  const notDerivable = nullSite - derivableViaJob;

  return { total, nullSite, derivable: derivableViaJob, notDerivable };
}

async function auditFormPublicLink() {
  const total = await prisma.formPublicLink.count();
  const nullSite = await prisma.formPublicLink.count({
    where: { siteId: null },
  });
  const derivableViaJob = await prisma.formPublicLink.count({
    where: { siteId: null, jobId: { not: null } },
  });
  const notDerivable = nullSite - derivableViaJob;

  return { total, nullSite, derivable: derivableViaJob, notDerivable };
}

async function auditDailyDiary() {
  const total = await prisma.dailyDiary.count();
  const nullSite = await prisma.dailyDiary.count({
    where: { siteId: null },
  });
  // DailyDiary.projectId is NOT NULL; Project.siteId is NOT NULL.
  // Therefore every null-siteId DailyDiary is derivable from its project.
  const derivable = nullSite;
  const notDerivable = 0;

  return { total, nullSite, derivable, notDerivable };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  console.log('siteid-null-audit — connecting to database...');

  let fs, ac, fpl, dd;
  try {
    [fs, ac, fpl, dd] = await Promise.all([
      auditFormSubmission(),
      auditAssetCheckout(),
      auditFormPublicLink(),
      auditDailyDiary(),
    ]);
  } finally {
    await prisma.$disconnect();
  }

  // ---------------------------------------------------------------------------
  // stdout headline
  // ---------------------------------------------------------------------------
  console.log('');
  console.log('=== FormSubmission (IN SCOPE — candidate for NOT NULL flip) ===');
  console.log(`  Total rows:          ${fs.total}`);
  console.log(`  siteId NULL:         ${fs.nullSite} (${pct(fs.nullSite, fs.total)} of total)`);
  console.log(`  Derivable via job:   ${fs.derivableViaJob}`);
  console.log(`  Derivable via shift: ${fs.derivableViaShiftOnly}`);
  console.log(`  Total derivable:     ${fs.derivable}`);
  console.log(`  NOT derivable:       ${fs.notDerivable}  <-- need a human rule from Marco`);
  console.log('');
  console.log('=== AssetCheckout (INFORMATIONAL — NOT in scope for flip) ===');
  console.log(`  Total rows:        ${ac.total}`);
  console.log(`  siteId NULL:       ${ac.nullSite} (${pct(ac.nullSite, ac.total)} of total)`);
  console.log(`  Derivable via job: ${ac.derivable}`);
  console.log(`  NOT derivable:     ${ac.notDerivable}`);
  console.log('');
  console.log('=== FormPublicLink (INFORMATIONAL — NOT in scope for flip) ===');
  console.log(`  Total rows:        ${fpl.total}`);
  console.log(`  siteId NULL:       ${fpl.nullSite} (${pct(fpl.nullSite, fpl.total)} of total)`);
  console.log(`  Derivable via job: ${fpl.derivable}`);
  console.log(`  NOT derivable:     ${fpl.notDerivable}`);
  console.log('');
  console.log('=== DailyDiary (INFORMATIONAL — NOT in scope for flip) ===');
  console.log(`  Total rows:          ${dd.total}`);
  console.log(`  siteId NULL:         ${dd.nullSite} (${pct(dd.nullSite, dd.total)} of total)`);
  console.log(`  Derivable via proj:  ${dd.derivable}  (project.siteId is NOT NULL)`);
  console.log(`  NOT derivable:       ${dd.notDerivable}`);
  console.log('');
  console.log(`Report written to: docs/data-model/siteid-null-audit-${stamp}.md`);

  // ---------------------------------------------------------------------------
  // markdown report
  // ---------------------------------------------------------------------------
  const reportPath = join(OUT_DIR, `siteid-null-audit-${stamp}.md`);
  mkdirSync(OUT_DIR, { recursive: true });

  const md = `# siteId NULL Audit — ${stamp}

Generated by \`scripts/data-model/siteid-null-audit.mjs\`.
**READ-ONLY.** No schema changes, no migrations, no row backfills.

---

## Context

This audit was produced to support a planned \`siteId NOT NULL\` flip on
\`FormSubmission\`. The earlier prompt \`pr-siteid-notnull-backfill\` incorrectly
assumed Tender, Job, and Project still had a nullable \`siteId\`. PRs #642 / #646
already made those columns NOT NULL. Only AssetCheckout, FormSubmission,
FormPublicLink, and DailyDiary remain nullable.

Marco's decision (2026-07-20): scope the flip to **FormSubmission only**.
The three other models arguably should stay optional. This audit measures all
four for completeness; only FormSubmission is in scope for a follow-up PR.

**Derivation logic:**
- FormSubmission NULL rows are "derivable" if \`jobId IS NOT NULL\` (Job.siteId
  is a required column, so the correct siteId can always be inferred from the
  linked job) or if \`shiftId IS NOT NULL\` without a jobId (Shift.jobId is NOT
  NULL, so shift -> job -> siteId).
- AssetCheckout and FormPublicLink NULL rows are "derivable" if \`jobId IS NOT
  NULL\`.
- DailyDiary.projectId is NOT NULL and Project.siteId is NOT NULL, so every
  DailyDiary row with a null siteId is derivable from its project.

---

## FormSubmission — IN SCOPE (candidate for NOT NULL flip)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${fs.total} | 100% |
| siteId NULL | ${fs.nullSite} | ${pct(fs.nullSite, fs.total)} |
| Derivable via job (jobId NOT NULL) | ${fs.derivableViaJob} | ${pct(fs.derivableViaJob, fs.total)} |
| Derivable via shift only (shiftId NOT NULL, no jobId) | ${fs.derivableViaShiftOnly} | ${pct(fs.derivableViaShiftOnly, fs.total)} |
| Total derivable | ${fs.derivable} | ${pct(fs.derivable, fs.total)} |
| **NOT derivable — need human rule** | **${fs.notDerivable}** | **${pct(fs.notDerivable, fs.total)}** |

> The "NOT derivable" count represents submissions where \`siteId\`, \`jobId\`, and
> \`shiftId\` are all NULL. These rows have no automated path to a siteId and will
> need a human decision from Marco before the NOT NULL flip can proceed.

---

## AssetCheckout — INFORMATIONAL (NOT in scope for flip)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${ac.total} | 100% |
| siteId NULL | ${ac.nullSite} | ${pct(ac.nullSite, ac.total)} |
| Derivable via job (jobId NOT NULL) | ${ac.derivable} | ${pct(ac.derivable, ac.total)} |
| NOT derivable | ${ac.notDerivable} | ${pct(ac.notDerivable, ac.total)} |

> An asset checkout can legitimately have no site (e.g. checked out to a user
> for off-site storage). Keeping siteId optional is intentional.

---

## FormPublicLink — INFORMATIONAL (NOT in scope for flip)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${fpl.total} | 100% |
| siteId NULL | ${fpl.nullSite} | ${pct(fpl.nullSite, fpl.total)} |
| Derivable via job (jobId NOT NULL) | ${fpl.derivable} | ${pct(fpl.derivable, fpl.total)} |
| NOT derivable | ${fpl.notDerivable} | ${pct(fpl.notDerivable, fpl.total)} |

> A public/kiosk QR link may be used for general-purpose (non-site-specific)
> forms. Keeping siteId optional is intentional.

---

## DailyDiary — INFORMATIONAL (NOT in scope for flip)

| Metric | Count | % of total |
|--------|------:|------------|
| Total rows | ${dd.total} | 100% |
| siteId NULL | ${dd.nullSite} | ${pct(dd.nullSite, dd.total)} |
| Derivable via project (Project.siteId NOT NULL) | ${dd.derivable} | ${pct(dd.derivable, dd.total)} |
| NOT derivable | ${dd.notDerivable} | ${pct(dd.notDerivable, dd.total)} |

> Every DailyDiary has a non-null projectId; Project.siteId is NOT NULL.
> All null-siteId diaries are therefore derivable. Whether to flip is a
> product decision for Marco.

---

## Decision Gate (FormSubmission only)

The follow-up NOT NULL flip PR should be unblocked when Marco confirms a rule
for the **${fs.notDerivable} not-derivable** FormSubmission row(s). If that
count is 0, the backfill is purely mechanical and can proceed.

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
