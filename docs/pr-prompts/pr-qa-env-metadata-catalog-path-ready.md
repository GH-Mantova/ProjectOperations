---
premise: grep -rq "process.env.METADATA_CATALOG_PATH" apps/api/src && ! grep -q "METADATA_CATALOG_PATH" .env.example
premise_means: METADATA_CATALOG_PATH is read by the metadata catalog resolver (apps/api/src/modules/metadata/metadata.service.ts:61, "Source 1 — env override") but is not documented in .env.example. Env-drift (scanner Part 0f).
scope:
  - .env.example
done_when: grep -q "METADATA_CATALOG_PATH" .env.example
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# fix(qa): document METADATA_CATALOG_PATH in .env.example (env-drift)

## What exists on main

- `apps/api/src/modules/metadata/metadata.service.ts:61` reads `process.env.METADATA_CATALOG_PATH`
  as **Source 1** of the catalog resolver (env override → bundle → walker; the SLICE-2 resolver
  from #904). `metadata.controller.ts:8` documents the same precedence.
- `.env.example` does NOT list `METADATA_CATALOG_PATH`, so a new environment has no signpost that the
  override exists. Scanner Part 0(f) env-drift finding, 2026-08-05 (five-angle verified: 4 sibling
  candidates — ANTHROPIC_API_KEY, ENTRA_AUTHORITY/ISSUER/JWKS_URI — were confirmed already present and
  are NOT part of this fix).

## What to build

Add a single documented entry to `.env.example`, near the other optional path-override vars
(e.g. by `PUPPETEER_EXECUTABLE_PATH`). It is OPTIONAL — read the code at
`apps/api/src/modules/metadata/metadata.service.ts` (~L18, L61) to phrase the comment accurately, then add:

    # Optional absolute path to a metadata catalog JSON. Source 1 of the catalog
    # resolver (env override -> bundled default -> walker). Leave blank to use the
    # bundled catalog. If set to a path that does not exist, the resolver falls through.
    METADATA_CATALOG_PATH=

Match the exact precedence wording to the code comments if they differ from the above.

## Do NOT

- Do NOT change `metadata.service.ts`, `metadata.controller.ts`, or any code — this is a
  documentation-only edit to `.env.example`.
- Do NOT add, rename, or touch any other env var (the ENTRA_*/ANTHROPIC_API_KEY vars are already
  present — leave them).
- Do NOT touch Azure/Entra/SharePoint config or any real `.env`.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> There is no human in this run. Finishing the work and then asking for permission is indistinguishable
> from failing — the work is discarded either way.

## Guardrails

- One attempt; if genuinely impossible, say `NO-OP: <reason>` instead of stopping quietly.
- Never ask for or wait on approval.
