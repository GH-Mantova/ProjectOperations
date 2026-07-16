---
premise: node -e "process.exit(require('fs').existsSync('.claude/agents/ui-reviewer.md')?1:0)"
premise_means: There is no ui-reviewer agent yet, so nothing checks captured UI screenshots against the prompt's ui_intent.
scope:
  - .claude/agents/ui-reviewer.md
  - .claude/agents/00-supervisor.md
  - docs/pipeline/**
done_when: pnpm -w lint && node -e "process.exit(require('fs').existsSync('.claude/agents/ui-reviewer.md')?0:1)"
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# PR prompt: UI Acceptance Review — Phase 2b (ui-reviewer agent + supervisor dispatch)

Branch: `feat/ui-acceptance-reviewer`. New PR. Phase 2b of the UI Acceptance Review design (see
sot/06-active-specs.md, "UI Acceptance Review"). This is the JUDGE half. It assumes Phase 2a's
capture writes screenshots to the worktree's `smoke-artifacts/`; if none exist yet it is simply never
dispatched, so this PR is safe to land independently.

## Context

- Vision is CONFIRMED working: a headless `claude --print` on model haiku read a screenshot via the
  Read tool and reported its labels, checkbox states, and a red delete button correctly (2026-07-16).
- `.claude/agents/pr-fix-reviewer.md` is the existing reviewer pattern to mirror: it reviews a PR
  against its originating prompt, returns a fixed verdict block, and NEVER merges or edits the branch.
- `.claude/agents/00-supervisor.md` (model opus) dispatches exactly one specialist per work item via
  the Agent tool; it has no Write/Edit and never acts itself.

## What to build

1. `.claude/agents/ui-reviewer.md` — a new agent modelled on pr-fix-reviewer.md:
   - Front-matter: `name: ui-reviewer`, `model: sonnet` (vision-capable), `tools: [Read, Grep, Glob,
     Bash]`. NEVER merges, NEVER edits the PR branch (same guardrails as pr-fix-reviewer).
   - Job: given a PR whose originating prompt declares `ui_intent`, `Read` each captured PNG in the
     worktree's `smoke-artifacts/` and check it against the `ui_intent` checklist. Return a UI-VERDICT
     block:
       UI-VERDICT: PASS | CONCERN | FAIL
       - PASS: every control/behaviour named in ui_intent is visibly present and placed as described.
       - CONCERN: a taste/layout issue for a human to judge (advisory only — escalate to Marco).
       - FAIL: an OBJECTIVE miss — a control ui_intent explicitly required is provably absent from the
         shot. This is the only verdict that blocks.
     Plus: which shot(s) it read, and one line per ui_intent checklist item (met / not met / unclear).
   - If no shots exist or no ui_intent is declared, output `UI-VERDICT: N/A` and stop.

2. `.claude/agents/00-supervisor.md` — add a dispatch rule: for a PR that touches `apps/web/**` AND
   whose originating prompt declares `ui_intent`, AFTER the smoke run, dispatch `ui-reviewer` via the
   Agent tool. Route the result:
   - FAIL -> treat like a failed required check: do not merge; fix-forward or re-fire the prompt.
   - CONCERN -> post an advisory comment and escalate to Marco; does NOT block the auto-merge.
   - PASS / N/A -> no effect; the deterministic gates decide the merge.
   Keep it a SOFT check: only FAIL blocks, and only on an objective missing control (DOCTRINE section
   7 — a vision opinion is not an exit code).

3. If `docs/pipeline/` documents the station/merge flow, add a short note there pointing to this soft
   check and its FAIL/CONCERN/PASS semantics. Do not restate sot/06 — reference it.

## Do NOT

- Do NOT let ui-reviewer merge, comment, label, or edit the branch itself (the supervisor routes).
- Do NOT make it a hard gate on subjective quality — only an objective missing control is a FAIL.
- Do NOT change pr-fix-reviewer.md or any other station's core behaviour.
- Do NOT touch Azure, Entra, SharePoint, auth, or deploy config.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt. If blocked, say `NO-OP: <reason>` loudly — never exit silently, never "stand by".
- `pnpm -w lint` must pass. Agent-definition markdown must parse (valid front-matter).
- Read the CI job log before diagnosing any CI failure; never re-run hoping for green.
- Completion test: is there a PR number in your output? If not because it is already on main, say
  `NO-OP`. If not because you are waiting for someone — there is nobody. Open the PR.
