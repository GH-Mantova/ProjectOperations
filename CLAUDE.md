# ProjectOperations — Claude Code bootstrap

⚖️ **SOURCE-OF-TRUTH LAW.** All source-of-truth lives in `/sot/`. Read `/sot/README.md`
first, every session. You may read, edit, or create source-of-truth documents — governance,
roadmap, progress, data-model, decisions, specs — **only** inside `/sot/`. Operational and
working docs live under `docs/` and are **not** source of truth. When in doubt, ask.

This file is a pointer stub. Claude Code requires `CLAUDE.md` at the repo root, so it cannot
move into `/sot/`. The real charter — company context, tech stack, architecture rules, code
conventions, git/PR rules, Prisma/seed discipline, and business logic — lives in
**`/sot/01-charter-and-architecture.md`**. Read it before writing any code.

Before diagnosing any operational, CI, git, or database issue, check
**`/sot/05-decisions-and-lessons.md`** (incident ledger) for a matching playbook.

Repo: `GH-Mantova/ProjectOperations` · Local: `C:\ProjectOperations2`
Seed login: `admin@projectops.local` / `Password123!` (all seed users share `Password123!`).
Never commit directly to `main`. `pnpm build` + `pnpm lint` must pass before any PR.
