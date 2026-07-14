# The Agent Department — enforced roles, isolated workspaces, executable lessons

**Status:** proposal for Marco's review. No code written yet.
**Date:** 2026-07-14
**Supersedes:** the org section of `automation-concurrency-design.md` (the concurrency analysis there still stands).

---

## 0. The finding that changes everything

**Every guardrail I wrote this week is SOFT — prose in a SKILL.md that an agent may simply ignore.
And three times in 24 hours, one did.**

| Incident | What it was told | What it did |
|---|---|---|
| LL-36 | "verify before deleting the secret" | deleted first |
| LL-37 | "never judge liveness from bash `ps`" | judged from bash `ps` → false emergency |
| LL-38 | "never git-write in the watcher repo" | ran `git merge`, abandoned it, killed the queue |

I responded each time by **writing a stronger paragraph**. That is the wrong instrument. You cannot
instruct your way out of a permissions problem, any more than you can prevent a data race with a
comment.

**Claude Code supports HARD enforcement — runtime-level, un-ignorable:**

| Mechanism | Enforcement | What it gives us |
|---|---|---|
| Subagent `tools:` frontmatter | **HARD** — allowlist; the runtime blocks any tool not listed | An agent with no `Write` tool *cannot write*, no matter what it decides |
| `permissions.deny` in settings | **HARD** — deny-first, first-match-wins; **cannot be overridden**, even by `--dangerously-skip-permissions` | `Write(sot/**)` denied to everyone but the SoT keeper |
| `PreToolUse` hook | **HARD** — sees the actual command string *and* cwd; exit 2 blocks the call | Block `git merge` when cwd is `C:\po-watcher` |
| `isolation: worktree` | **HARD** — subagent's file ops happen in its own git worktree | Two agents physically cannot share an index |

**The design principle for everything below:**

> **Rules that matter must be enforced by the runtime, not by the prompt.**
> Prose explains *why*. Configuration decides *what is possible*.
> If a rule only exists in a SKILL.md, assume it will eventually be broken.

---

## 1. The department (Marco's model, corrected)

Marco: *"the supervisor is the boss, the senior developer, that has the holistic view and full
access; each agent has its specific function that the supervisor calls upon."*

**The on-demand dispatch idea is right and I under-rated it.** Today five agents wake on independent
timers and blunder into each other. Under dispatch, nothing runs unless the boss calls it — work is
serialised *by construction*, prompts get smaller, and cost drops because specialists only run when
there is something to do.

**Two corrections.**

### Correction 1: the boss has LESS access, not more

Every serious incident this week was the supervisor **doing** something. A boss who can be wrong
costs an hour. **A boss with `git push` and `rm -rf` can be wrong and cost the repo.**

This is also true to the metaphor: a senior dev who hand-edits the shared repo while the team works
is *the bad boss*. Their power is judgment and delegation — not typing.

> **The SUPERVISOR gets: `Read`, `Grep`, `Glob`, `Agent` (dispatch), and read-only `Bash`.
> It gets NO `Write`, NO `Edit`. It cannot git. It cannot merge. It cannot break anything.**
> Its power is *deciding who acts* — and that is enough.

### Correction 2: specialise by RESOURCE, not by TOPIC

A "UI/UX agent" edits `apps/web/**`, commits, pushes, opens a PR. So does a "GitHub agent". So does
the watcher. **All three write the same git tree.** Topic boundaries cut *across* resource
boundaries, so "one agent per topic" separates nothing that matters — they still collide.

**UI/UX, database, docs, SWMS are not agents. They are PROMPTS that the code-writer runs** — each in
its own worktree. That gives you the specialisation you want without multiplying the number of
things that can write to disk.

---

## 2. The org chart — write-sets disjoint by construction

| Agent | Model | May MUTATE | Tools (hard allowlist) | Cannot, mechanically |
|---|---|---|---|---|
| **SUPERVISOR** *(boss)* | Opus | **nothing** | `Read, Grep, Glob, Agent, Bash(read-only)` | write any file · git · merge |
| **CODE-WRITER** | Sonnet | its **own worktree** only | `Read, Write, Edit, Bash, Grep, Glob` + `isolation: worktree` | touch the shared tree · merge a PR · write `sot/` |
| **BOARD-DRIVER** | Sonnet | **GitHub only** (API) | `Bash(gh:*), Read, Grep` | write repo files · local git |
| **MACHINE-MINDER** | Haiku | **processes + queue files** | `Read, Write(docs/pr-prompts/**), Bash(process control)` | **any git at all** · write code |
| **SCANNER** | Sonnet | **stages prompts only** | `Read, Grep, Glob, Write(docs/pr-prompts/**)` | write code · git · merge |
| **SOT-KEEPER** | Opus | **`/sot/` only** | `Read, Write(sot/**), Edit(sot/**), Bash(gh:*)` | write code · merge its own PR |

**Read that table as a lattice, not a list.** No two agents' write-sets overlap. Collision is not
*discouraged* — it is **impossible**. That is the entire point, and it is the thing "five agents with
good instructions" can never give you.

### The key unlock: merging needs no working tree

`gh pr merge <n> --squash` is a **GitHub API call**. It touches zero local files. Today the shepherd
merges *locally, for no reason* — which is why it has to share a git tree with the watcher, which is
why they can race. Move merges to the API and **BOARD-DRIVER stops being a git actor entirely.**

Conflict resolution is the *only* task that genuinely needs a tree — and that goes to CODE-WRITER,
in a worktree.

---

## 3. Enforcement — the actual config

### 3a. `.claude/settings.json` — permissions (HARD, deny-first, unbypassable)

```json
{
  "permissions": {
    "deny": [
      "Write(C:\\po-watcher\\**)",
      "Edit(C:\\po-watcher\\**)",
      "Bash(git merge:*)",
      "Bash(git rebase:*)",
      "Bash(git push --force:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean:*)",
      "Bash(az:*)",
      "Bash(Connect-MgGraph:*)",
      "Bash(*New-MgServicePrincipalAppRoleAssignment*)"
    ],
    "ask": [
      "Bash(gh pr merge:*)",
      "Write(apps/api/prisma/migrations/**)"
    ]
  }
}
```

The Azure/Entra denies make the hard-stop **real** rather than a paragraph. Marco's rule
(*"no one touches azure/entra/sharepoint without my supervision"*) becomes physically true.

### 3b. `PreToolUse` hook — the context-aware rules prose can't express

Permissions match on the command; hooks can see **command + cwd together**. That is what we need for
*"never git-write in the watcher's repo, but git is fine elsewhere."*

```
.claude/hooks/guard-watcher-repo.sh
```
- **DENY** any `git` write verb (`merge|rebase|checkout|commit|push|reset|clean|stash`) when
  `cwd` is under `C:\po-watcher` → the exact class of LL-38.
- **DENY** `rescue-watcher-repo.ps1` when a live agent process exists → the near-miss that would have
  torn a branch out from under a running agent.
- **DENY** `Stop-Process` targeting the watcher when the heartbeat is < 90 min old → makes
  "never kill a BUSY watcher" mechanical rather than aspirational.

**Each hook rule is a lesson made executable.** See §5.

### 3c. Subagent frontmatter — the allowlist

```yaml
---
name: code-writer
description: Writes code. Runs in an isolated worktree. Never merges.
tools: [Read, Write, Edit, Bash, Grep, Glob]
model: sonnet
isolation: worktree
maxTurns: 120
---
```

```yaml
---
name: supervisor
description: The boss. Holistic view, read-only, dispatches specialists. Writes nothing.
tools: [Read, Grep, Glob, Agent, Bash]
model: opus
---
```

`maxTurns: 120` on CODE-WRITER is a direct response to last night: the dialogs prompt hit **max-turns
at 240** and left 33 files behind. **Cap the turns, and split the prompt.**

---

## 4. Who controls the Source of Truth

**Today:** anyone can write `/sot/`, and CP-24 catches it *after the fact*, in CI. That's a smoke
alarm, not a lock.

**Proposed: `/sot/` has exactly one writer — SOT-KEEPER.**

- `permissions.deny: ["Write(sot/**)", "Edit(sot/**)"]` at the project level → **nobody** can write it.
- SOT-KEEPER's own subagent config **re-allows** it. It is the only agent that can.
- It still cannot merge its own PR. **Marco reviews every SoT change.** Governance stays human.

Other agents that learn something durable **do not edit `/sot/`** — they cannot. They file a finding,
and SOT-KEEPER curates it into the right master and opens a doc-reconcile PR.

**This solves the recurring `sot/02` merge-conflict problem too:** one writer means no concurrent
edits to the same headers.

---

## 5. Lessons learned — the part I've been getting wrong

We have 38 lessons in `sot/05`. **They are prose. Prose does not stop anything.** LL-36, 37 and 38
were all violations of rules that were *already written down*.

> **A lesson without a guard is a wish.**

### Every lesson ships with a GUARD. Two tiers, one PR.

| Tier | Lives in | Answers | Enforced? |
|---|---|---|---|
| **LESSON** (prose) | `sot/05` | *why* it happened, what we learned | ✗ — it teaches |
| **GUARD** (executable) | a CI gate, a hook, a permission rule, or a script check | *makes it impossible* | ✓ — it prevents |

**A lesson may not be closed until its guard exists.** If a guard is genuinely impossible, the lesson
says so explicitly and states what a human must watch for instead.

### Retrofitting this week's lessons

| Lesson | Guard that should exist |
|---|---|
| LL-36 (deleted secret before verifying) | `permissions.deny` on Azure/Entra CLI + a runbook check that enumerates *every* consumer of a credential before revocation |
| LL-37 (false "watcher down" from bash `ps`) | Liveness available **only** via `restart-watcher-if-wedged.ps1`; hook denies `Stop-Process` on a fresh-heartbeat watcher |
| LL-38 (git merge in shared tree) | Hook denies git-write verbs when cwd is `C:\po-watcher`; worktree isolation removes the shared tree entirely |
| "GATE-ALLOW must be column 0" | ✅ already a CI gate (CP-11) — *this is the model to copy* |
| "seed never reaches prod" | ✅ already a CI gate (CP-23) — likewise |

Note the pattern: **the two lessons that have never recurred are the two with executable guards.**
Everything still in prose has bitten us more than once.

### How lessons propagate to agents

**Do not rely on an agent reading a 38-entry ledger.** It will skim. Three channels instead:

1. **Guards** — automatic. Hooks and permissions apply to every agent without being read.
2. **Preflight output** — `scripts/preflight.ps1` runs first for every agent and *prints* the relevant
   facts (CLEAN/BUSY/CORRUPT, dirty PRs, queue state). **Deterministic > remembered.**
3. **`CLAUDE.md` + `sot/README.md`** — the short, always-loaded rules. Kept *short* deliberately.
   A 200-line rulebook is an unread rulebook.

---

## 6. External knowledge — connectors worth adding

Marco offered. Yes to these, each tied to a concrete failure we actually had:

| Connector | Fixes | Evidence |
|---|---|---|
| **Microsoft Learn MCP** | Azure / Entra / Graph accuracy | I told Marco **Cloud Application Administrator** could grant Graph app-role consent. **It cannot.** He hit a wall and had to go back to the external GA. Authoritative MS docs would have caught it. |
| **Context7** (or equivalent library-docs MCP) | NestJS / Prisma / React API accuracy | Prevents hallucinated APIs in generated PRs — the most common silent defect in agent-written code |
| **Graphify** *(already staged)* | code navigation | Stops agents grepping blindly to reconstruct architecture — the single biggest waste of a run |

**Honest note:** external knowledge raises the *ceiling* on quality. It does **not** address safety —
a better-informed agent with `git push` can still destroy the repo. **Ship the enforcement first.**

---

## 7. Sequencing

| Phase | What | Why now | Risk |
|---|---|---|---|
| **1** | `permissions.deny` block (Azure/Entra, force-push, reset --hard, watcher-repo writes) | **One file. Enormous payoff.** Makes today's hard-stops real. | very low |
| **2** | `PreToolUse` hook: no git-write in `C:\po-watcher`; no killing a fresh-heartbeat watcher | Kills LL-37 + LL-38 classes outright | low |
| **3** | `scripts/preflight.ps1` — one shared CLEAN/BUSY/CORRUPT check. **Delete the duplicated logic** in my two scripts, which have already contradicted each other once. | One truth, not two | low |
| **4** | Rebuild the 5 cron agents as **SUPERVISOR + 5 subagents** with `tools:` allowlists | The org fix. Dispatch replaces cron. | medium |
| **5** | Watcher runs every prompt in a **disposable worktree** | Kills the shared-tree class permanently (last night's 13-hour outage) | medium — test on one prompt behind a flag |
| **6** | Lesson→Guard discipline; retrofit LL-36/37/38 | Stops the ledger from being decorative | low |
| **7** | Microsoft Learn + Context7 connectors | Raises quality ceiling | low |

**Phases 1–3 are a morning's work and remove most of the sharp edges.** Phase 5 is the deep fix.

---

## 8. What I'd argue against

- **Don't give the boss full access.** I know it's the intuitive reading of "senior developer." It is
  exactly the configuration that produced every incident this week.
- **Don't specialise by topic.** It feels like an org chart and buys nothing.
- **Don't consolidate prompts as you consolidate agents.** Fewer agents, but **smaller prompts** — the
  dialogs run hit max-turns because one prompt tried to change 48 call sites. That should have been 4.
- **Don't skip Phase 1 to get to the interesting parts.** The dull JSON deny-list prevents more damage
  than the elegant org chart.

---

## 9. The honest caveat

I have been wrong repeatedly this week — including shipping a "safety" check that would itself have
destroyed in-flight work, and writing two scripts that gave contradictory restart advice.

**That is an argument FOR this design, not against it.** The whole point is to stop relying on any
agent — me included — remembering the right thing at the right moment. Put it in the runtime, where
being wrong is not enough to cause damage.
