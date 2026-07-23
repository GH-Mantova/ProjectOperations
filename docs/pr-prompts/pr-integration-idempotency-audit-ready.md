---
premise: '! test -f docs/qa/integration-idempotency-audit.md'
premise_means: The integration idempotency/retry/degrade audit document does not exist on main yet.
scope:
  - docs/qa/**
done_when: 'test -f docs/qa/integration-idempotency-audit.md'
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# AUDIT: idempotency + retry/degrade behaviour across external-integration call sites

Produce `docs/qa/integration-idempotency-audit.md`. This is an AUDIT (a document), not a code fix.
The fixes it surfaces become their own separately-gated backlog items/prompts.

## Why
No repo-wide check exists that a RETRIED call to Xero, Microsoft Graph mail, or Jotform ingestion
cannot duplicate an invoice, a sent email, or an imported submission; nor that a downstream
integration failure degrades gracefully instead of failing the user's action. Forms v2 sec 4.4 has
the philosophy (submission survives; delivery is logged) - this audit measures the rest of the
codebase against that bar.

## What to do (in this order)
1. **Inventory the call sites.** grep the API for every outbound/ingest integration surface:
   Xero (invoice/ledger sync), Graph mail (outlook provider / send), Jotform (form ingestion),
   OTP email delivery. List each call site by file path.
2. **Per call site, record:** its idempotency mechanism (idempotency key / natural key / NONE),
   its retry semantics (none / blind retry / backoff), and its failure posture (does a failure
   fail the user action, or is it captured and degraded).
3. **Severity-rank the gaps.** Anything that can duplicate money movement, a sent email, or an
   imported record on retry is high severity. Graceful-degrade gaps are medium.
4. **Write `docs/qa/integration-idempotency-audit.md`**: the call-site table, the mechanism/retry/
   posture per site, and a severity-ranked fix list. If a surface is already idempotent, say so
   with evidence - an honest "already covered" is a valid finding.

## Do NOT
- Do NOT fix anything in this PR. Audit only - fixes are separate gated items.
- Do NOT touch code, schema.prisma, or migrations. This is a docs/qa/** deliverable only.
- Do NOT invent behaviour you cannot back from the code - mark it UNVERIFIED.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the audit already exists say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
