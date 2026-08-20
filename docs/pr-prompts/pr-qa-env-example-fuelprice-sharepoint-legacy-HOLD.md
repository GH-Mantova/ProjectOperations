---
premise: '! grep -q "FUELPRICE_QLD_BASE_URL" .env.example || ! grep -q "SHAREPOINT_LEGACY_TENDERS_ROOT" .env.example'
premise_means: .env.example still fails to document at least one of the seven env vars the API reads at boot. Exits 0 while either half is missing; dies only when both are documented.
scope:
  - .env.example
done_when: grep -q "FUELPRICE_QLD_BASE_URL" .env.example && grep -q "FUELPRICE_QLD_TOKEN" .env.example && grep -q "FUELPRICE_QLD_REGION_LEVEL" .env.example && grep -q "FUELPRICE_QLD_REGION_ID" .env.example && grep -q "FUELPRICE_QLD_FUEL" .env.example && grep -q "FUELPRICE_QLD_BRAND" .env.example && grep -q "SHAREPOINT_LEGACY_TENDERS_ROOT" .env.example && ! grep -qE "^SHAREPOINT_LEGACY_TENDERS_ROOT=" .env.example
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# QA: document the 7 undocumented boot-time env vars in `.env.example`

Branch: `docs/env-example-fuelprice-sharepoint-legacy`. New PR.

## Why this PR exists

[MEASURED at `origin/main a561b703`, 2026-08-21T00:2xZ, in a clean `git worktree add origin/main`
tree at `C:\po-worktrees\scan-0821-0014`, by `C:\po-scan-tools\env-drift.mjs` — which reads file
BYTES and decodes UTF-8 explicitly, because PowerShell 5.1 mis-decodes BOM-less UTF-8 and has
already manufactured one false mojibake finding in this same sweep.]

The instrument compared every `process.env.X` / `import.meta.env.X` read in `apps/api/src` and
`apps/web/src` (58 distinct vars, 467 web files) against `.env.example`, `sot/01`,
`.github/workflows/ci.yml` and `docker-compose.yml`. It reported 10 undocumented. **Three of those
are instrument artefacts and are NOT in scope** — say so plainly rather than fixing them:

- `DEV` — `import.meta.env.DEV`, a Vite built-in. Never belongs in `.env.example`.
- `VITE_BUILD_SHA`, `VITE_BUILT_AT` — injected at build time by `apps/web/vite.config.ts` and set
  in `.github/workflows/deploy.yml`. Correctly wired; documenting them as operator-settable would
  be wrong.

**The remaining 7 are real.** Counting rule: *read by application code at boot, and absent from
`.env.example`.*

### Half 1 — `FUELPRICE_QLD_*` (6 vars)

`apps/api/src/config/fuel-price.config.ts:17-29` reads six env vars. The file's own docblock
(lines 9-15) already states each one's meaning and default — **copy those, do not invent new
wording.** All six are optional with defaults; none is required for boot.

### Half 2 — `SHAREPOINT_LEGACY_TENDERS_ROOT` (1 var) — read the constraint before editing

`apps/api/src/config/sharepoint.config.ts:25-35` **throws at module load if this var is present but
empty**:

> `"Configuration error: SHAREPOINT_LEGACY_TENDERS_ROOT is set but empty."`

`.env.example` is copied to `.env` by every developer. Adding a bare `SHAREPOINT_LEGACY_TENDERS_ROOT=`
line would therefore **break the API at boot for everyone who copies the file** — turning a
documentation gap into an outage. It must be added as a **commented** line only. `done_when`
asserts exactly this: the name is present, and no line starts with `SHAREPOINT_LEGACY_TENDERS_ROOT=`.

Its default when unset is `"2. Quotes/Quotes 2026"` (`sharepoint.config.ts:35`).

**This PR touches no SharePoint system, tenant, permission or credential — only the repo's
`.env.example` text file.**

## What to build

Edit **`.env.example`** only. Two additive blocks. Change no existing line.

1. **After the existing SharePoint block** (the `SHAREPOINT_TENDERS_ROOT=` line is at `:75`), add:

```
# Legacy SharePoint tender tree — source layout for the legacy copy path
#   {legacyTendersRoot}/{month}/{T-number folder}
# OPTIONAL. Leave COMMENTED OUT. Defaults to "2. Quotes/Quotes 2026" when unset.
# WARNING: setting this to an EMPTY value throws a startup error by design
# (apps/api/src/config/sharepoint.config.ts). Either comment it out or give it a
# real non-empty path — never leave a bare "SHAREPOINT_LEGACY_TENDERS_ROOT=".
# SHAREPOINT_LEGACY_TENDERS_ROOT=2. Quotes/Quotes 2026
```

2. **Append a new fuel-price section** at the end of the API section:

```
# Fuel price feed — fuelpricesqld.com.au live diesel price (R3 T-2)
# All optional; the defaults below are what the code uses when unset.
FUELPRICE_QLD_BASE_URL=https://fppdirectapi-prod.fuelpricesqld.com.au
# Fallback token ONLY — prefer the DB integration key via resolveIntegrationKey.
FUELPRICE_QLD_TOKEN=
FUELPRICE_QLD_REGION_LEVEL=3
FUELPRICE_QLD_REGION_ID=1
FUELPRICE_QLD_FUEL=Diesel
FUELPRICE_QLD_BRAND=Ampol
```

## Do NOT

- Do NOT add `DEV`, `VITE_BUILD_SHA` or `VITE_BUILT_AT` — see above, they are not operator-settable.
- Do NOT put a real token value in `FUELPRICE_QLD_TOKEN`. Empty is correct; the config resolves
  `?? null`.
- Do NOT uncomment `SHAREPOINT_LEGACY_TENDERS_ROOT`, and do NOT leave it as a bare empty assignment.
- Do NOT touch any file other than `.env.example`.
- Do NOT reorder, reformat or "tidy" existing lines — additive only.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — say `NO-OP: <reason>` if you cannot proceed.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- Before you finish, ask: **"Is there a PR number in my output?"**
