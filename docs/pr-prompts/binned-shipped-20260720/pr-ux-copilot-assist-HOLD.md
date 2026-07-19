---
premise: '! grep -rqi "AssistPanel\|universalAssist" apps/web/src 2>/dev/null'
premise_means: There is no universal in-context AI assist panel across modules.
scope:
  - apps/api/src/modules/ai-providers/**
  - apps/api/src/modules/personas/**
  - apps/web/src/components/**
done_when: pnpm build && pnpm lint && grep -rqi "AssistPanel\|universalAssist" apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | UX-parity (D365 Copilot-everywhere) | extend the AI Tendering Assistant to a universal assist -->
# HOLD — UX: in-context Copilot / AI assist everywhere (MVP)

STATUS: DRAFTED, STAGED, arm-eligible. D365 Copilot parity: a universal, in-context AI assist that
reuses the EXISTING AI provider store (BYOK) + persona registry (do NOT add a new AI stack).

## What to build
Branch: `feat/ux-copilot-assist`. Reviewer: `GH-Mantova`. No migration.
1. A reusable `<AssistPanel>` (a slide-over) available from any record/list: actions "Summarise this
   record", "Draft an email/note about this", "Explain this". It sends the record's visible context to
   the existing AI provider path (server-side; never leak keys to the browser) and shows the result
   with a copy/insert action.
2. API: a small `POST /assist` endpoint in the ai-providers/personas module that takes a task + context
   and returns the completion, guarded by the existing AI permission; respects the BYOK provider config.
3. Wire the panel into 1–2 reference surfaces (e.g. Tender detail, Job detail) as proof; drop-in for more.

## Do NOT
- Do NOT add a new AI provider integration or bypass the BYOK key store. Do NOT send data to any
  provider from the browser. Do NOT auto-apply AI output — the user copies/inserts. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
