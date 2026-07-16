---
premise: '! grep -q "ui_intent" scripts/pipeline/lint-prompt.mjs'
premise_means: The prompt lint does not yet understand the optional ui_shots / ui_intent fields, so prompts cannot declare a UI-acceptance intent.
scope:
  - docs/pr-prompts/PROMPT-SCHEMA.md
  - scripts/pipeline/lint-prompt.mjs
done_when: pnpm -w lint && grep -q "ui_intent" scripts/pipeline/lint-prompt.mjs && grep -q "ui_shots" docs/pr-prompts/PROMPT-SCHEMA.md
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: UI Acceptance Review — Phase 1 (optional ui_shots / ui_intent schema fields)

Branch: `feat/ui-acceptance-schema-fields`. New PR. This is Phase 1 (plumbing only) of the UI
Acceptance Review design (recorded in sot/06-active-specs.md, "UI Acceptance Review"). It adds NO
capture and NO reviewer — only the optional prompt-schema fields so future prompts can declare a UI
intent. Fully non-breaking: every existing prompt still lints unchanged.

## Why

Deterministic gates prove named DOM/artifacts EXIST; they do not prove a rendered screen looks/behaves
right. The design adds a soft, vision-based UI review later. This phase just lets a prompt DECLARE
what to screenshot and what "correct" looks like, so the later reviewer has a spec to check against.

## What to build (additive, optional, non-breaking)

1. `docs/pr-prompts/PROMPT-SCHEMA.md`: document two NEW OPTIONAL front-matter fields:
   - `ui_shots:` — an optional list of `{ route, name }` entries naming screens to capture on the
     seeded app (e.g. `- { route: "/tenders/<id>/scope", name: "material-row" }`).
   - `ui_intent:` — an optional plain-language checklist of what the rendered result must show
     (e.g. "waste controls inline on each material row; delete on rows 2+ only; one row wide").
   State clearly: both are OPTIONAL; omitting them means no UI review (the default, back-compatible).
   Only prompts touching `apps/web/**` SHOULD set them.

2. `scripts/pipeline/lint-prompt.mjs`: parse the two fields if present and validate SHAPE only:
   - `ui_shots` (if present) must be a non-empty array whose entries each have a non-empty string
     `route` and a non-empty string `name`. Otherwise fail with a clear message.
   - `ui_intent` (if present) must be a non-empty string.
   - If BOTH are absent, behave exactly as today (no new requirement). Do NOT make them mandatory for
     any prompt, including apps/web prompts, in this phase.
   Add or extend the lint's unit coverage if the linter already has tests; otherwise a self-check in
   the file's existing style.

## Do NOT

- Do NOT add any capture step, Playwright change, agent, or supervisor dispatch — that is Phase 2.
- Do NOT make ui_shots / ui_intent required for any prompt.
- Do NOT change any existing prompt file.
- Do NOT touch Azure, Entra, SharePoint, auth, or deploy config.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly — never exit silently, never "stand by".
- `pnpm -w lint` must pass; run the prompt linter against an existing prompt AND against a prompt
  carrying valid ui_shots/ui_intent to prove both still ADMIT, and against a malformed ui_shots to
  prove it rejects.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- Completion test: is there a PR number in your output? If not because it is already on main, say
  `NO-OP`. If not because you are waiting for someone — there is nobody. Open the PR.
