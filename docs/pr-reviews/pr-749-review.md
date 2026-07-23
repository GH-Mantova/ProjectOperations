VERDICT: MERGE

Scope compliance:
- In scope: Read-only audit script (scripts/data-model/siteid-null-audit.mjs) + timestamped
  report (docs/data-model/siteid-null-audit-2026-07-20T13-43-07.md). No schema changes, no
  migrations, no row mutations. Audits all four models (FormSubmission in scope, other three
  informational per Marco's decision).
- Out of scope: None detected.

Self-verification claims:
- Schema.prisma NOT modified: PASS (diff confirms)
- No prisma migrate or migration files: PASS (diff confirms)
- No rows updated: PASS (script is read-only)
- pnpm build passes: PASS (CI green)
- pnpm lint passes: PASS (CI green)

Risks Marco should know:
- None. This is a measurement PR with no prod impact. The 6 not-derivable FormSubmission
  rows detected are the decision gate for the follow-up NOT NULL flip PR; Marco must
  confirm a backfill rule before that PR can proceed.

Recommendation: Merge. This delivers the evidence needed for the FormSubmission siteId NOT
NULL flip decision. No risks or out-of-scope changes.
