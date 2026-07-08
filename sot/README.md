# ProjectOperations — Source of Truth (`/sot/`)

**This folder is the single source of truth for the ProjectOperations ERP.**
Last reorganised: 2026-07-08.

---

## ⚖️ THE SOURCE-OF-TRUTH LAW (read first, every chat, every time)

All source-of-truth documents live in `/sot/`. You may read, edit, or create a
source-of-truth document **only** inside this folder. Never create or edit governance,
roadmap, progress, data-model, decision, or spec documents anywhere else in the repo.
Operational and working docs (runbooks, PR artifacts, transient notes) live under `docs/`
and are explicitly **not** source of truth.

Before writing any doc, decide: **durable truth → `/sot/`. Runbook / PR artifact / transient
note → `docs/`. When in doubt, ask.**

Root `CLAUDE.md` is the only SoT-adjacent file outside this folder — it must stay at repo
root because Claude Code auto-loads it. It is a pointer stub to this folder, not content.

---

## 📇 Registry — the 7 masters

| File | What lives here |
|---|---|
| `README.md` (this) | The law, this registry, chat routing, re-fetch rules, the SoT sweep policy |
| `01-charter-and-architecture.md` | Company, staff, permission roles, environment/env-vars, tech stack, brand tokens, architecture rules, business logic (Cutrite schedule / densities / estimating), module registry, integrations detail, user types, sidebar nav |
| `02-roadmap-and-status.md` | The one roadmap — every item tagged ✅ Done / 🔧 In-PR / 📦 Staged / 🧊 Awaiting-staging / 💡 Idea, plus the "needs-Marco" list |
| `03-progress-log.md` | Append-only chronological history of what shipped (per-PR ledger) |
| `04-data-model.md` | Canonical entities/relationships + Job↔Project & Worker↔WorkerProfile spine + module ownership / IA map |
| `05-decisions-and-lessons.md` | ADRs, locked decisions, the incident ledger + operational playbooks, migration-history audit |
| `06-active-specs.md` | Forward design specs not yet fully built (Forms Engine v2, Rates & Lists tidy-up, dashboard-widget catalogue, API permission matrix) |

**Not source of truth (stays under `docs/`):** the PR pipeline (`docs/pr-prompts/**`),
per-PR reviews (`docs/pr-reviews/**`), QA registers (`docs/qa/*`), and runbooks/guides
(deploy, setup, troubleshooting, SSO, vs-code, diagnostics, scheduled-tasks-archive).

---

## 🚦 Chat routing (act on this chat's title)

- **`🏗️ MAIN — ProjectOperations Development`** → read `README` + `01` + `02` fully. Role: architecture, PR prompts, roadmap, all decisions.
- **`OldMain` + digits** (OldMain1, OldMain2…) → same role as MAIN. Re-fetch `README` + `01` + `02` at conversation start — context may be stale from compaction.
- **`Chat` + digits** (Chat1, Chat2…) → **support chat**. Read only "Support-chat role" below, then STOP. Never make architectural decisions or write PR prompts.
- **`DR` + digits** (DR1, DR2…) → **document-review** support chat. "Support-chat role" below, document review only, then STOP.
- **Any other title** → ask the user what this chat is for.

## 🔁 Re-fetch / memory rule

- **MAIN + OldMain:** re-fetch `README` + `01` + `02` when context seems stale, after long gaps, or when explicitly asked.
- **Support chats (Chat#, DR#):** fetch once at conversation start; use for the whole session; do not re-fetch mid-conversation.

## 🔗 Fetch URLs (use blob — raw CDN has delays)

- README: `https://github.com/GH-Mantova/ProjectOperations/blob/main/sot/README.md`
- 01 Charter & Architecture: `…/blob/main/sot/01-charter-and-architecture.md`
- 02 Roadmap & Status: `…/blob/main/sot/02-roadmap-and-status.md`
- 03 Progress Log: `…/blob/main/sot/03-progress-log.md`
- 04 Data Model: `…/blob/main/sot/04-data-model.md`
- 05 Decisions & Lessons: `…/blob/main/sot/05-decisions-and-lessons.md`
- 06 Active Specs: `…/blob/main/sot/06-active-specs.md`

## 🧹 SoT sweep policy

Weekly, MAIN reconciles `02` + `03` against merged PRs, open PRs, and the `docs/pr-prompts/`
queue. Edits to `02`/`03` land via a dedicated **doc-reconcile PR** — feature/fix PRs must
not touch their `Last updated` headers or restate status (this kills the recurring header
merge conflict).

---

## Support-chat role (Chat#, DR#) — read only this section, then STOP

You are the eyes and ears of the MAIN chat. Observe precisely, describe completely, never
decide architecture, never write PR prompts. When asked "what should we do?", describe the
issue and say "take this to the MAIN development chat."

**On screenshot upload:** output a full structured description BEFORE any analysis — route
visible, user/role, exact error text verbatim, every UI element (buttons, fields, labels,
dropdowns, table columns, badges, values), exact data values, layout issues, and a numbered
issues list. Nothing omitted, no "etc.", no summarising — this is copied to MAIN verbatim.

**On file upload (PDF/Word/Excel/CSV):** state file type + apparent purpose, describe every
section/field/value, quote exact text where relevant. Nothing omitted.
