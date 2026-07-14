# Prompt schema — every prompt must pass the lint before an agent sees it

Enforced by `scripts/pipeline/lint-prompt.mjs`. **A prompt that fails the lint never reaches an agent.**

## Why this exists

Of 194 historical failures, **34 were stale prompts** — an agent booting, grepping, discovering the
work was already on `main`, and exiting with no PR. A full agent run, burned, every time. Prompts are
authored days-to-weeks before they dequeue, **and nothing re-validated the premise**.

Another **5** had a premise that was simply *false* — `pr-23` ordered tests mirroring a spec file that
does not exist; `pr-ops-map-m1` ordered the agent to read a design doc that does not exist.

**39 failures, all preventable by one deterministic check that costs zero tokens.**

---

## Required front-matter

```yaml
---
premise: grep -rc "ConfirmDialog" apps/web/src | grep -q ":0"
premise_means: The ConfirmDialog component does not exist yet.
scope:
  - apps/web/src/components/**
  - packages/ui/src/**
done_when: pnpm build && pnpm lint && grep -rq "ConfirmDialog" packages/ui/src
size: 6
gate_allow: none          # none | migrations | env-vars | dependencies
seed_only: false
escalates: false          # true if this touches prod data / auth / Azure
---
```

### `premise` — **the field that matters**

A **shell command that must EXIT 0 for the work to still be needed.**

The linter runs it **at dequeue time**, against current `main`. If it fails, the work is already done
(or was never real) and **the prompt is binned before an agent is spawned.**

> **If you cannot express the premise as a command, you do not understand the problem well enough to
> propose the work.** That is the point of the field, not a formality.

Good premises are assertions of *absence*:

| Intent | Premise |
|---|---|
| Component doesn't exist yet | `grep -rc "ConfirmDialog" apps/web/src \| grep -q ":0"` |
| Env var not yet added | `! grep -q "MAIL_AUTH_MODE" .env.example` |
| Route still unguarded | `! grep -q "isSuperUser" apps/web/src/pages/admin/RatesListsAdminPage.tsx` |
| Migration not yet written | `! ls apps/api/prisma/migrations \| grep -q "rate_table_is_reference"` |
| PR still open | `gh pr view 549 --json state -q .state \| grep -q OPEN` |

### `size` — number of files the prompt expects to touch

**`size > 10` → the linter REJECTS it and demands a split.**

`pr-replace-native-browser-dialogs` tried to migrate **48 call sites**. It burned **240 turns**,
left 33 uncommitted files in the shared tree, and **killed the queue for 13 hours.**
It had already been given double the normal turn budget — **raising the cap does not help. Splitting
does.** That prompt should have been four prompts.

### `gate_allow`

If the PR will add a migration / env var / dependency, name it here. The pipeline then writes the
marker into the PR body **bare, at column 0** — because `## GATE-ALLOW: migrations` does **not** match
CP-11's regex, and `GATE-ALLOW: migrations.` (trailing period) doesn't either. **10 PRs failed on
exactly this.** Stop hand-writing it.

### `escalates`

`true` for production data writes, production auth, or anything touching Azure/Entra/SharePoint.
The pipeline will **build the PR but never merge it** — it goes to Marco.

---

## Also required, in the body

- **What to build** — specific, with file paths.
- **Do NOT** — the explicit out-of-scope list.
- **Guardrails** — one attempt; never exit silently (say `NO-OP: <reason>`); never ask a question
  (there is no human in a headless run — **10 runs died waiting**); read the job log before
  diagnosing any CI failure.

## Lint failures you will hit

| Failure | Meaning |
|---|---|
| `PREMISE ALREADY SATISFIED` | The work is done. Binned. This is the lint **working** — 34 runs saved. |
| `PREMISE INVALID` | The command errored. Your assumption about the repo is wrong. Fix it. |
| `SIZE TOO LARGE` | Split it. Non-negotiable. |
| `MISSING FIELD` | Front-matter incomplete. |
| `GATE_ALLOW MISMATCH` | You declared a migration but `scope` has no `migrations/` path (or vice-versa). |
