---
premise: '! test -f docs/plans/configurable-fields-xero-exchange-plan.md'
premise_means: No plan/slice set exists yet for the configurable client/vendor field engine + file-based Xero export/import.
scope:
  - docs/plans/**
  - docs/pr-prompts/**
done_when: pnpm build && pnpm lint && test -f docs/plans/configurable-fields-xero-exchange-plan.md && ls docs/pr-prompts | grep -q "pr-cfx-s1-field-registry"
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan + chained slices: configurable client/vendor field engine + file-based Xero exchange

Produce, in ONE docs-only PR: (1) `docs/plans/configurable-fields-xero-exchange-plan.md`, and (2) the chained
armed slice prompts `docs/pr-prompts/pr-cfx-s<N>-<slug>-ready.md`. **No product code here — plan + slice prompts only.**

## Context — grounded against origin/main (PR-Master Phase 2; REUSE, do not rebuild)
- **`Client` and `SubcontractorSupplier` are ALREADY near-Xero-parity typed columns**: name, code, status, email,
  phone, tradingName, businessType, abn, acn, gstRegistered, legalName, country, paymentTermsDay/Type/Days,
  physical+postal address blocks, **bankName/bankAccountName/bankBsb/bankAccountNumber**, creditLimit,
  `xeroContactId`; vendor also has entityType, prequalStatus/notes/reviewed, swmsOnFile. **Do NOT re-add these
  and do NOT convert them to EAV** — real logic depends on them.
- **A Xero API push already exists but is DORMANT (not connected in Marco's environment)**:
  `apps/api/src/modules/xero/xero.service.ts` `syncContact()` pushes a client to Xero via API. Leave it untouched.
  This is why the file-based exchange is the practical path, NOT duplication.
- **No custom/configurable-field engine exists** (GlobalList is managed dropdowns only). This is the net-new heart.
- Admin-controller convention: `apps/api/src/modules/admin-settings|admin-users`. See [[project_rates_lists_architecture]],
  [[project_crm_module_program]], [[project_directory_contracts_archive_decision]].

## Marco's locked decisions (PR-Master panel, 2026-08-12) — bake in, do NOT re-litigate
1. **Hybrid registry, NOT EAV.** Keep the existing typed columns as first-class. Add a **`FieldDefinition`
   registry** (key, label, order, visibility, required, group, appliesTo: CLIENT | VENDOR | BOTH, source:
   BUILTIN | CUSTOM) that *describes* the built-ins and *defines* new fields; store custom-field values in ONE
   additive **`customFields Json`** column on each of Client + SubcontractorSupplier.
2. **"Delete a built-in" = HIDE it (visibility off), NEVER drop the column** (logic depends on it). Rename/reorder/
   require/hide works on any field; add/remove works freely only on CUSTOM fields.
3. **Xero file export/import maps BUILT-IN (parity) fields only** — custom fields are ERP-only and never round-trip
   to Xero (Xero only accepts its known columns).
4. **Add the two missing parity fields** as typed columns: sales/purchase **account codes** and **discount**
   (so the Xero column map is clean). These are BUILTIN in the registry.
5. **File exchange is manual-layout tolerant**: import accepts a CSV/TXT the user has aligned; **dry-run → confirm**;
   NEVER blindly overwrite ERP-mastered data (ERP is source of truth — upsert with review).
6. **Permissions**: configure-fields = super-user + audit; export/import = permissioned + audited (export files
   carry bank/BSB — sensitive); import defaults to dry-run.
7. **Keep the daily form lean** — custom fields are optional + grouped; the everyday create-client/vendor form is
   not buried by config.

## The plan must define these ORDERED slices (each <= ~10 files; keep this order)
- **CFX-1 (S1) — Field registry + customFields + missing parity fields** (schema, `escalates`): `FieldDefinition`
  model; additive `customFields Json` on Client + SubcontractorSupplier; add typed `salesAccountCode`,
  `purchaseAccountCode`, `discount` columns; seed the BUILTIN descriptors for both record types; a
  `field-definition.service.ts` (CRUD, super-user-gated). Migration + rollback + map regen + `GATE-ALLOW: migrations`.
- **CFX-2 (S2) — Admin field-config screen**: reorder / rename / toggle-visibility / set-required / group, and
  add/remove CUSTOM fields (built-ins can only be hidden, not deleted). Gated on CFX-1's service file.
- **CFX-3 (S3) — Dynamic field rendering** on the client + vendor create/edit forms (built-ins + custom, grouped,
  driven by the registry). Gated on CFX-2's page file.
- **CFX-4 (S4) — Xero-format file EXPORT** (`xero-contact-export.service.ts`): generate a Xero contact-import CSV
  from BUILT-IN fields for clients and for vendors; permissioned + audited. Gated on CFX-3's file.
- **CFX-5 (S5) — File IMPORT** (`xero-contact-import.service.ts`): accept a user-aligned CSV/TXT; **dry-run**
  (validate + report) then **commit** (upsert, never clobber without review); permissioned + audited. Gated on CFX-4's file.

## The chained slice prompts you MUST author
For EACH slice author `docs/pr-prompts/pr-cfx-s<N>-<slug>-ready.md` with valid front-matter per
`docs/pr-prompts/PROMPT-SCHEMA.md`: real executable `premise` (primary artifact ABSENT on main) + `premise_means`,
`scope`, `size` (<=10), `done_when`, `gate_allow`, `seed_only`, `escalates`. **Chain with
`requires_file_on_main: <a NEW file the previous slice creates>`** (CFX-2←CFX-1 service file; CFX-3←CFX-2 page;
CFX-4←CFX-3 file; CFX-5←CFX-4 service). CFX-1 (schema) carries `gate_allow: migrations` + non-empty
`rollback_strategy` (all additive — new table + nullable JSON/columns; safe to drop), adds `schema.prisma` +
`docs/data-model/**` to scope, runs `node scripts/data-model/build-relationship-map.mjs` + commits the map, and
declares `GATE-ALLOW: migrations` bare at column 0. Each body carries the verbatim **STANDING AUTHORITY** block +
Guardrails (never ask; one attempt; read the CI log; `pnpm build && pnpm lint` pass). **Run
`node scripts/pipeline/lint-prompt.mjs <file>` on EVERY slice prompt (exit 0) before opening the PR.**

## Do NOT
- Do NOT write product code in this slice — only `docs/plans/**` + `docs/pr-prompts/**`.
- Do NOT convert existing typed columns to EAV; do NOT drop any built-in column; do NOT re-add existing fields.
- Do NOT touch the dormant Xero API `syncContact`. Do NOT round-trip custom fields to Xero.
- Do NOT touch Azure/Entra/SharePoint. Do NOT edit `/sot/`. Do NOT use `requires_merged`.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if this is already on main, say `NO-OP: <reason>`.
- **Never ask a question or "stand by" for a go/no-go.** The go was given when this prompt was armed.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.

## VERIFY
- `pnpm build && pnpm lint`; plan doc exists + defines the 5 ordered slices + the locked decisions;
  every `pr-cfx-s<N>-*-ready.md` lints ADMIT (exit 0) and is chained via `requires_file_on_main`.
