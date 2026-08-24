---
premise: '! grep -q "DISMISSED_MEANS_PROCEED" docs/pr-prompts/PROMPT-SCHEMA.md'
premise_means: The prompt contract still has no clause telling a headless agent that a dismissed or unanswered question is not a stop signal, so an agent that asks anyway reads the dismissal as "stop" and does zero work.
scope:
  - docs/pr-prompts/PROMPT-SCHEMA.md
done_when: pnpm lint && grep -q "DISMISSED_MEANS_PROCEED" docs/pr-prompts/PROMPT-SCHEMA.md && grep -q "dismissed" docs/pr-prompts/PROMPT-SCHEMA.md
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# NO-PR slice 1: a dismissed question is not a stop signal (Mode B)

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: touch **only** `docs/pr-prompts/PROMPT-SCHEMA.md`. That is a scope
limit, **not** a reason to stop before pushing. Do not mix in `sot/` (CP-24 hard-fails a PR that
mixes code and `sot/`).

## Why this PR exists — MEASURED, not asserted

`docs/pr-prompts/no-pr-opened/` holds **107 prompts that ran to completion and opened no PR.**
There are two distinct failure modes behind that pile, and they need different fixes:

- **Mode A — did the work, then asked.** e.g. `pr-e2e-container-s1-trial-workflow` built an entire
  containerised workflow, self-verified against a seven-point spec table with every line ticked,
  then ended *"Want me to commit and push this as the slice-1 PR, or is more work needed first?"*
  The work exists and is recoverable. **Auto-restage (slice 2) fixes this one.**

- **Mode B — asked first, was dismissed, stopped.** `pr-comms-hub-inbox` at 2026-08-20T09:16Z asked
  a question *before doing anything*, the question was dismissed (headless run, nobody there), and
  the agent read the dismissal as *stop*. **68 seconds, a 465-byte log, zero work done.**

🔴 **Auto-restage alone does NOT fix Mode B.** Restaging just asks again, gets dismissed again, and
burns one run per cycle until the retry bound trips. **This slice is the other half, and it must
land first** — which is why slice 2 gates on the marker this slice introduces.

The existing STANDING AUTHORITY block already says *"There is no human in this run."* The agent read
that and asked anyway. Saying it once, negatively, is not enough: the contract has to say what a
dismissal **means**.

## What to build

Add a subsection to `docs/pr-prompts/PROMPT-SCHEMA.md`, immediately after the existing
`## STANDING AUTHORITY` section (which is at roughly line 240 — **grep for the heading rather than
trusting that number**). It must:

1. Carry the literal token **`DISMISSED_MEANS_PROCEED`** so this contract is greppable and so a
   future lint rule can assert it. Put it in the heading, e.g.
   `### DISMISSED_MEANS_PROCEED — a dismissed question is not a stop signal`.

2. State the rule plainly, in the same voice as the block above it:
   - In a headless run there is no human to answer a question.
   - If you ask one anyway and it is **dismissed, ignored, or returns empty**, that is **not** an
     instruction to stop. It is the absence of a human, which the prompt already told you to expect.
   - **Proceed on your best judgement** and record the assumption you made in the PR body.
   - Stopping because a question went unanswered is indistinguishable from failing — the run is
     discarded either way, exactly as if you had finished and asked.

3. State the one genuine exception, so the rule cannot be read as "never stop": the **hard stops**
   still stop you — Azure / Entra / SharePoint of any kind, production auth or secrets, an
   irreversible or destructive action, or anything needing a real human identity. In those cases do
   **not** proceed on judgement: say `NO-OP: <reason>` plainly, say what you would have done, and
   stop. A hard stop is a refusal with a report, never silence.

4. Record the evidence in one or two lines so the rule is not re-litigated later: the `pr-comms-hub-inbox`
   run above, 68 s and 465 bytes, and the size of `no-pr-opened/`.

## Do NOT

- Do NOT edit the existing verbatim STANDING AUTHORITY block. **81 prompts carry it word for word**
  and a census matches on it; changing its text would invalidate every one of them. **Add a new
  subsection beneath it.**
- Do NOT edit any prompt in `docs/pr-prompts/` other than the schema itself.
- Do NOT touch `scripts/pr-watcher/index.mjs` — that is slice 2.
- Do NOT touch `sot/` (CP-24) or anything Azure/Entra/SharePoint.

## Guardrails

- One attempt. Never exit silently — say `NO-OP: <reason>` if `DISMISSED_MEANS_PROCEED` is already
  on main.
- Never ask a question or "stand by" for approval. There is no human in a headless run — and per the
  very rule you are writing, a dismissed question would mean proceed.
- Read the CI job log before diagnosing any failure.
