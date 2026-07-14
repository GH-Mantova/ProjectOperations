# ProjectOperations — Source of Truth (`/sot/`)

**This folder is the single source of truth for the ProjectOperations ERP.**
Last reorganised: 2026-07-13 (chat-routing model retired; boot sequence + concurrency added).

---

## ⚖️ THE SOURCE-OF-TRUTH LAW (read first, every chat, every time)

All source-of-truth documents live in `/sot/`. You may read, edit, or create a
source-of-truth document **only** inside this folder. Never create or edit governance,
roadmap, progress, data-model, decision, or spec documents anywhere else in the repo.
Operational and working docs (runbooks, PR artifacts, transient notes) live under `docs/`
and are explicitly **not** source of truth.

Before writing any doc, decide: **durable truth → `/sot/`. Runbook / PR artifact /
transient note → `docs/`. When in doubt, ask.**

Root `CLAUDE.md` is the only SoT-adjacent file outside this folder — it must stay at repo
root because Claude Code auto-loads it. It is a pointer stub to this folder, not content.

---

## 🧭 Chat model — every chat is a full development chat

There is **no MAIN / OldMain / Chat# / DR# routing any more.** Ignore any older instruction
that says otherwise. Every chat, regardless of title, has the same authority: architecture,
decisions, PR prompts, document review, diagnostics.

**Multiple chats run concurrently by design.** So the danger is no longer "which role am
I?" — it is **two chats acting on the same thing without knowing.** The Boot Sequence and
Concurrency Rules below exist for exactly that.

---

## 🚀 BOOT SEQUENCE — do this before your first substantive answer

Docs describe intent. **Live state is the truth.** Never plan off `02` alone — it is
reconciled at most daily and is routinely a few PRs behind.

1. Read `README.md` (this file) + `01-charter-and-architecture.md` + `02-roadmap-and-status.md`.
2. **Read `docs/pipeline/DOCTRINE.md`.** ⚠️ **Non-negotiable — see "THE PIPELINE" below.** It is
   `docs/`-class by filing, but it is **binding on every chat and every agent**. If you skip it you
   will re-make mistakes that are already written down.
3. **Check live state, in this order:**
   - Open PRs on `GH-Mantova/ProjectOperations` — this is the real "in flight" list, not `02` §2.
   - `docs/pr-prompts/` — armed `*-ready.md`, plus `failed/`, `needs-marco/`, `blocked/`, `*-HOLD.md`.
   - **Scheduled tasks: are they enabled?** If `00-supervisor` / `04-scanner` / `05-sot-keeper`
     are disabled, *nothing is merging or being tested automatically* — say so up front. This has
     silently stalled the board before: all four sat disabled for three days and no chat noticed.
4. **Query the graph before you grep** — `graphify query "<question>"` (see below). Reading
   files one by one to reconstruct architecture is the single biggest waste of a session.
5. State your working assumption in one line, then proceed.

**Re-boot** (steps 1–2 again) after a long gap, after compaction, or whenever your picture
of the board feels older than the conversation.

---

## 🔑 EXECUTION AUTHORITY — default is DO IT, not ask

Marco (2026-07-13): *"I would rather leave it to you to do all the smoke tests + Marco tests +
fixing + merging PRs. Only those that need my input should come to me."*

Agents with a real shell (Cowork via Desktop Commander, Claude Code, the watcher) have **full
filesystem access** — including `C:\po-watcher\ProjectOperations`, the watcher's git repo that
actually pushes — **PowerShell**, and **`gh` authenticated as `GH-Mantova`**. GitHub writes go
through `gh` in a shell; the GitHub *MCP* is read-only (403s on writes).

**So: diagnose, fix, push, verify CI, and merge. Do not narrate a plan and wait for permission to
do work you can simply perform.** A status update that asks Marco to run a command you could have
run yourself is a failure of this rule.

**ESCALATE only these — bring a question, not a status update:**

1. **Open design/product questions.** Anything only Marco knows. Never guess his intent.
2. **Irreversible / destructive.** Data loss, destructive migrations, force-push, branch deletion.
3. **Authorization grants.** Never grant a permission or role autonomously.
4. **Production auth / secrets / deploy config** that cannot be verified without him.
5. **Requires a real human identity.** The one true hard stop — e.g. PR #538 needs a real Microsoft
   account on a real shared PC. Get it green and mergeable, then hand it over.
6. **Verification exhausted.** Two honest attempts failed. Say so plainly. Do not loop.

Everything else: **do it.**

### 🚫 AZURE / ENTRA / SHAREPOINT — NEVER WITHOUT MARCO (2026-07-13, absolute)

**No agent touches the Azure portal, Entra ID, or the SharePoint tenant. Ever. Not once.** This is
not an escalation category you can reason your way out of — it is a hard stop.

Specifically forbidden without Marco at the keyboard:
- App Service **environment variables / configuration** (incl. `SHAREPOINT_AUTH_MODE`,
  `MAIL_AUTH_MODE`, any `AZURE_*`), restarts, deployment slots, scaling.
- **Entra**: app registrations, client secrets, certificates, API permissions, admin consent,
  managed identities, app-role assignments, directory roles, users, groups.
- **SharePoint**: site permissions, folder structure, document libraries, sharing settings.
- Any `az` / `Connect-MgGraph` / `Microsoft.Graph` PowerShell that **writes**.

These systems are shared company infrastructure. A wrong move locks real staff out of real
documents, and the blast radius extends well beyond this repo.

**What you MAY do:** write the code, the migration, the runbook, and the exact step-by-step
instructions for Marco to execute himself. Ship the PR. Then stop and hand him the steps.

Reading public config values already committed to the repo is fine. Anything that mutates tenant
state is not.

---

## 🏭 THE PIPELINE (2026-07-14) — read this before you touch the board or stage a prompt

The automation is a **production line**. It is not optional context: a chat that does not know it
exists will hand-roll board operations and re-make bugs that are already fixed.

**The files are under `docs/` because they are operational, not because they are optional.**

| What | Where | Why you care |
|---|---|---|
| **The doctrine** | `docs/pipeline/DOCTRINE.md` | **Binding.** Read-back rule; evidence-not-assertion; **§7 "your instrument lies"**; stay-in-your-station; the hard stops; never-exit-silently. |
| **The primitives** | `scripts/pipeline/pipeline-lib.ps1` | **Dot-source it. Never hand-roll a board operation.** Every mutation reads back and proves its effect. |
| **The intake lint** | `scripts/pipeline/lint-prompt.mjs` + `docs/pr-prompts/PROMPT-SCHEMA.md` | Every prompt needs an **executable `premise`**. No front-matter → it cannot enter the queue. |
| **The smoke harness** | `scripts/pipeline/smoke-pr.ps1` | Drives the real acceptance suite. **The exit code decides — not your opinion of it.** |
| **The stations** | `.claude/agents/00-05` + `docs/pipeline/stations/` | Numbered by execution order. |

### The stations

`00-supervisor` (cron, 2h) — **the only thing that starts board or machine work.** Builds the whole
picture, then **dispatches**. It does not do the stations' work; doing so once killed an entire
overnight queue (LL-38).
`01-code-writer` — invoked by the **watcher** when a prompt dequeues.
`02-board-driver` · `03-machine-minder` — **no schedule.** They run *only* when the supervisor
dispatches them. Both mutate git; two of them starting independently is the collision the
supervisor exists to prevent.
`04-scanner` (cron, 4h) — read-only audit; stages lint-compliant prompts.
`05-sot-keeper` (cron, daily) — **the only station allowed to touch `/sot/`.**

### 🚫 NEVER-MERGE

Maintained in code at `scripts/pipeline/pipeline-lib.ps1` (`$script:NEVER_MERGE`) and enforced by
`Assert-Mergeable` **at the point of action** — not in a selection filter, because a filter is one
PowerShell quirk away from being a silent no-op, and once was: it selected **#552, the
production-data PR**, for merge.

**Every entry carries a reason AND a discharge condition.** A guard nobody can ever clear is a lie.

### Merging — there is exactly one way

```powershell
. scripts\pipeline\pipeline-lib.ps1
Assert-SmokedOrEscalate -PR $n -MustContain @("<the artifact the PR body claims>")
Merge-Pr -PR $n
```

It **throws** on: the NEVER-MERGE list · a check still **in flight** (*pending is not pass*) · a
**missing** required check (*an absent gate is not a green gate*) · a **diff that does not contain
what the body claims** (#476 and #478 both over-claimed and both merged anyway).

---

## 🔀 CONCURRENCY RULES (multiple chats are live at once)

1. **Claim before you act.** Before staging a prompt, opening a branch, or editing a `/sot/`
   file, re-check that another chat has not already done it: grep `docs/pr-prompts/`
   (including `processed/`) for the artifact, and check open PRs. *Assume a parallel chat has
   been busy.*
2. **Never re-stage a stale prompt without checking `main` first.** Grep `main` for the
   artifact it would create. History: 5 of 7 re-queued prompts turned out to already be shipped.
3. **One `/sot/` doc, one chat, one PR.** `/sot/` edits land only via a dedicated
   **doc-reconcile PR**. Feature/fix PRs must not touch `Last updated` headers or restate
   status — that is what causes the recurring header merge conflict.
4. **Trust code and CI over prose.** PR bodies over-claim. Grep the diff for the named
   artifact before believing "done". Never diagnose a CI failure without the job log.
5. **Leave a trail.** Anything durable you learn goes into `03` (what shipped), `05`
   (decisions/incidents), or a staged prompt — not just the chat.

---

## 🕸️ Graph-first navigation (Graphify)

The repo ships a committed knowledge graph in `graphify-out/` covering **app code +
Prisma/SQL schema + infrastructure in one graph**.

- Ask the graph first: `graphify query "what connects the rate resolver to the schema?"`,
  `graphify path "ClientQuote" "TenderEstimate"`, `graphify explain "RateResolverService"`.
- Broad architecture review: `graphify-out/GRAPH_REPORT.md`.
- **Graphify is NOT source of truth.** It is a generated navigation index (a `docs/`-class
  artifact that lives at repo root only because the tool requires it). The canonical Prisma
  spine remains `sot/04-data-model.md` + `scripts/data-model/build-relationship-map.mjs`
  (deterministic, CI-gated). If the graph and `sot/04` disagree, **`sot/04` wins** — and that
  disagreement is a bug worth reporting.
- Setup / rebuild: `docs/runbooks/graphify-setup.md`.

---

## 📇 Registry — the 7 masters

| File | What lives here |
| --- | --- |
| `README.md` (this) | The law, the chat model, the boot sequence, concurrency rules, this registry, the sweep policy |
| `01-charter-and-architecture.md` | Company, staff, permission roles, env vars, tech stack, brand tokens, architecture rules, business logic (Cutrite schedule / densities / estimating), module registry, integrations, user types, sidebar nav |
| `02-roadmap-and-status.md` | The one roadmap — ✅ Done / 🔧 In-PR / 📦 Staged / 🧊 Awaiting-staging / 💡 Idea, plus the "needs-Marco" list. **Reconciled daily at best — always verify against live PRs.** |
| `03-progress-log.md` | Append-only chronological history of what shipped (per-PR ledger) |
| `04-data-model.md` | Canonical entities/relationships + Job↔Project & Worker↔WorkerProfile spine + module ownership / IA map |
| `05-decisions-and-lessons.md` | ADRs, locked decisions, incident ledger + operational playbooks, migration-history audit. **Check here before diagnosing any ops/CI/git/DB issue.** |
| `06-active-specs.md` | Forward design specs not yet fully built (Forms Engine v2, Rates & Lists, dashboard-widget catalogue, API permission matrix) |

**Not source of truth (stays under `docs/`):** the PR pipeline (`docs/pr-prompts/**`),
per-PR reviews (`docs/pr-reviews/**`), QA registers (`docs/qa/*`), runbooks/guides, and
`graphify-out/`.

---

## 🔗 Fetch URLs (use blob — raw CDN has delays)

- README: `https://github.com/GH-Mantova/ProjectOperations/blob/main/sot/README.md`
- 01 Charter & Architecture: `…/blob/main/sot/01-charter-and-architecture.md`
- 02 Roadmap & Status: `…/blob/main/sot/02-roadmap-and-status.md`
- 03 Progress Log: `…/blob/main/sot/03-progress-log.md`
- 04 Data Model: `…/blob/main/sot/04-data-model.md`
- 05 Decisions & Lessons: `…/blob/main/sot/05-decisions-and-lessons.md`
- 06 Active Specs: `…/blob/main/sot/06-active-specs.md`

---

## 🧹 SoT sweep policy

A daily scheduled sweep reconciles `02` + `03` against merged PRs, open PRs, and the
`docs/pr-prompts/` queue, and reports drift. Deterministic, regeneratable drift may be staged
as a **doc-reconcile PR**; curated prose is never auto-edited — it comes back as a finding for
a human chat to action.

---

## 🖼️ Working with screenshots and uploaded files

When a screenshot or document is shared, describe it **completely before analysing**: route
visible, user/role, exact error text verbatim, every UI element and value, layout issues, then
a numbered issues list. No summarising, no "etc." — the description is the evidence another
chat will act on.
