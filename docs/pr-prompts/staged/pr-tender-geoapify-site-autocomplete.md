---
premise: '! grep -rq "geocode/autocomplete" apps/api/src'
premise_means: No Geoapify geocoding/autocomplete CALL exists yet (only the API-key slug is registered).
scope:
  - apps/api/src/**
  - apps/web/src/pages/tendering/**
  - apps/web/src/components/**
done_when: pnpm build && pnpm lint && grep -rq "geocode/autocomplete" apps/api/src
size: 9
gate_allow: none
seed_only: false
escalates: false
---

# Tender wizard: Geoapify address autocomplete -> find-or-create Site

Marco's decision (2026-07-15): a Tender's physical **site address must be captured at tender time**.
Give NewTenderWizard an address field that autocompletes as the user types (Geoapify Address
Autocomplete API), and resolve the chosen address to a **Site** record attached to the tender.

## Context you can rely on

- The Geoapify API key already has a home: the integration-keys registry
  (apps/api/src/common/integrations/integration-keys.registry.ts, slug "geoapify") + Admin Settings.
  Read the key server-side via that existing mechanism; NEVER expose it to the browser. Today there
  is NO geocoding call -- only key storage.
- `Site` model: id, name, code?, addressLine1?, suburb?, state?, postcode?, clientId?. Tenders link
  via `Tender.siteId` (nullable today).
- Tender wizard: `apps/web/src/pages/tendering/NewTenderWizard.tsx`. IT ALREADY HAS a FREE-TEXT
  `siteAddress` field that is only folded into the tender description (`Site: ...`) and NEVER linked
  to a Site record -- which is exactly why every tender.siteId is null. This PR REPLACES that
  free-text field with the autocomplete + real Site linkage.

## What to build

1. **API proxy** (apps/api/src): `GET /geo/autocomplete?text=...` that reads the Geoapify key from
   IntegrationCredential settings, calls `https://api.geoapify.com/v1/geocode/autocomplete` with
   `filter=countrycode:au` and `format=json`, and returns the trimmed suggestion list. Keeps the key
   server-side. If no key is configured, return a clear, non-500 "integration not configured" state.
2. **Find-or-create Site** (apps/api/src): a service/endpoint that, given a chosen Geoapify result,
   returns an existing matching Site or creates one (map address_line1->addressLine1, city->suburb,
   state->state, postcode->postcode, formatted->name). Match on normalised address to avoid dupes.
3. **Wizard field** (NewTenderWizard.tsx + a reusable AddressAutocomplete component): a required
   address input driven by the proxy; on select, find-or-create the Site and set the tender's siteId.
   Mark the field **required in the wizard** so a tender cannot be submitted without a resolved site.

## Do NOT

- Do NOT put the Geoapify key in an env var or ship it to the client. Server-side proxy only.
- Do NOT add a DB NOT NULL constraint on Tender.siteId here -- that is pr-tender-required-site
  (escalates, separate). This PR is UI + resolution only.
- Do NOT blind-create a Site on every keystroke; only on explicit selection, and find-or-create.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. Never exit silently -- if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
- `pnpm build` + `pnpm lint` must pass.
