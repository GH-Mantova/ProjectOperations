---
premise: '! grep -q "Integration ownership" sot/01-charter-and-architecture.md'
premise_means: sot/01 has no "Integration ownership" section yet - the per-integration system-of-record map does not exist on main.
scope:
  - sot/01-charter-and-architecture.md
done_when: 'grep -q "Integration ownership" sot/01-charter-and-architecture.md'
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# DOC-RECONCILE (sot-only): add an "Integration ownership" section to sot/01

This is a **sot-only doc-reconcile** change. Touch ONLY `sot/01-charter-and-architecture.md`.
No code. CP-24 hard-fails a PR that mixes code and `sot/`.

## Why
`sot/04` maps internal domain ownership, but no single artifact states, per EXTERNAL integration,
which side owns which data, how data is ingested, and how the system behaves when the integration
fails. Integration logic is currently written against tribal knowledge (e.g. "Xero stays the
ledger" lives in a locked decision, not next to the data contract).

## What to build
Add a new section titled exactly **`Integration ownership`** to `sot/01-charter-and-architecture.md`
(place it near the architecture-rules material; pick the most coherent spot). It must contain a
table with ONE ROW PER external integration, at minimum:

- **Xero** (accounting ledger)
- **SharePoint / Microsoft Graph mail** (document store + outbound email)
- **Jotform** (external form ingestion)
- **OTP email** (field-worker auth code delivery)

Columns, per row:

| Integration | System of record | Data owned by us vs by them | Ingestion strategy (poll / webhook / manual) | Failure posture (what happens when it is down) |

Fill each cell from what is TRUE in the repo today. Where a fact is not discoverable from code or
an existing locked decision, write `UNVERIFIED - Marco to confirm` rather than guessing. Keep it
tight and factual; this is a data contract, not prose.

## Do NOT
- Do NOT touch any file outside `sot/`. No code, routes, components, or other sot files.
- Do NOT invent ingestion or failure semantics you cannot back from the repo - mark them UNVERIFIED.
- Do NOT auto-merge. Marco owns the Xero/SharePoint rows operationally and must review before merge.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails
- One attempt. Never exit silently -- if the section already exists say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- sot-only; keep the PR a clean doc-reconcile so CP-24 passes.
