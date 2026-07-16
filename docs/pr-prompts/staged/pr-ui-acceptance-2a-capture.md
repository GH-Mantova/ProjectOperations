---
premise: node -e "process.exit(require('fs').existsSync('tests/e2e/pr-acceptance/ui-shots.spec.ts')?1:0)"
premise_means: There is no acceptance-shot capture spec yet, so a prompt's ui_shots cannot be turned into screenshots for review.
scope:
  - tests/e2e/pr-acceptance/ui-shots.spec.ts
  - scripts/pipeline/smoke-pr.ps1
  - docs/pipeline/**
done_when: pnpm -w lint && node -e "process.exit(require('fs').existsSync('tests/e2e/pr-acceptance/ui-shots.spec.ts')?0:1)"
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: UI Acceptance Review — Phase 2a (capture the ui_shots)

Branch: `feat/ui-acceptance-capture`. New PR. Phase 2a of the UI Acceptance Review design (see
sot/06-active-specs.md, "UI Acceptance Review"). This is the CAPTURE half only — it takes the
screenshots a later reviewer will judge. It judges nothing itself.

## Context (already on main / prior phase)

- The prompt schema now has optional `ui_shots:` (list of `{ route, name }`) and `ui_intent:`
  (Phase 1). Most prompts do not set them; that is fine.
- `scripts/pipeline/smoke-pr.ps1` boots API+web on a seeded DB in a real browser, runs
  `tests/e2e/pr-acceptance/*.spec.ts`, and already sets `PWTEST_SCREENSHOT_DIR` =
  `<worktree>/smoke-artifacts`. Playwright config screenshots only-on-failure today.

## What to build

1. `tests/e2e/pr-acceptance/ui-shots.spec.ts`: a capture-only Playwright spec (chromium). It reads a
   manifest of `{ route, name }` entries from an env var (e.g. `PWTEST_UISHOTS_JSON`) or a JSON file
   the harness writes. For each entry it logs in as the seed admin (reuse the existing auth-setup
   pattern the other pr-acceptance specs use), navigates to `route`, waits for the page to settle
   (network idle or a stable element — NOT a bare toHaveURL; see the batch5/batch8 toHaveURL-race
   lessons), and writes a full-page screenshot to `${PWTEST_SCREENSHOT_DIR}/<name>.png`. If the
   manifest is empty/absent, the spec is a no-op (zero assertions, passes).

2. `scripts/pipeline/smoke-pr.ps1`: after the existing acceptance run, add an OPTIONAL capture step —
   locate the branch's originating prompt (`docs/pr-prompts/**/pr-*-ready.md` /
   `processed/`), and if it declares `ui_shots`, serialise them to the manifest env/file and run
   `ui-shots.spec.ts` so the PNGs land in `smoke-artifacts`. If the prompt declares no `ui_shots`,
   skip silently. This step must NEVER change the smoke exit code — capture is not a gate.

## Do NOT

- Do NOT judge or diff the screenshots — that is Phase 2b (the ui-reviewer agent).
- Do NOT make the smoke fail based on shot content or a missing shot.
- Do NOT change behaviour for prompts that declare no ui_shots.
- Do NOT commit screenshots into the repo — they live in the ephemeral smoke-artifacts dir.
- Do NOT touch Azure, Entra, SharePoint, auth, or deploy config.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly — never exit silently, never "stand by".
- `pnpm -w lint` must pass; run `ui-shots.spec.ts` once with a 1-entry manifest to prove a PNG lands
  in the screenshot dir, and once with an empty manifest to prove it no-ops.
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- Completion test: is there a PR number in your output? If not because it is already on main, say
  `NO-OP`. If not because you are waiting for someone — there is nobody. Open the PR.
