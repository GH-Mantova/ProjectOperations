# Dev-to-Prod Workflow

How a change goes from idea to live on Azure.

### Who does what

| Role | Who | Responsibility |
|---|---|---|
| Product / ideas | Marco | Pitches changes, makes the call on priorities, clicks merge on production PRs, does Azure/Entra portal steps |
| Architect / dev | Cowork main chat (this assistant) | Turns ideas into self-contained PR prompts, diagnoses failures, stages `rev-` fix prompts, writes/maintains docs |
| Implementer | PR-watcher + headless Claude Code agents | Branch, write code, run local checks, open the PR |
| Reviewer | Watcher auto-review (verdict) + Marco (final click) | Posts MERGE/FIX/BLOCK verdict; Marco approves production changes |

### The lifecycle

**1. Create the PR.**
- *Automated (normal path):* Marco describes the change → main chat writes a
  self-contained prompt → dropped as `docs/pr-prompts/<name>-ready.md` → the watcher
  picks it up and an agent branches, implements, and opens the PR (body + reviewer
  `GH-Mantova`).
- *Manual:* branch off `main`, make changes, open the PR yourself. Same rules apply.

**2. Test locally (pre-PR gate).** The agent runs this before opening a PR; run the same
by hand for manual work:
```
pnpm install
pnpm dev            # web at localhost:5173, API at localhost:3000 — click through
pnpm lint
pnpm build
pnpm test:api:serial
pnpm test:web:logic
pnpm compliance:smoke
```
Seed/login for local testing: `pnpm seed`, then `admin@projectops.local` /
`Password123!`. Never open a PR with known-failing checks.

**3. Test on GitHub (CI = the authoritative gate).** Opening the PR triggers GitHub
Actions: API lint/test/smoke, web lint/logic/build, PR diff gates, tendering E2E, CodeQL.
Green CI here is what counts. If CI goes red, the PR stays unmerged — paste the failing
job log to the main chat and a `rev-` fix prompt is staged for the watcher. (CI can't be
diagnosed without the job log; PR-body edits don't retrigger workflows.)

**4. Review & approve.** The watcher's auto-review posts a **VERDICT** (MERGE / FIX /
BLOCK) as a PR comment (mirrored from `docs/pr-reviews/`). Merge policy:
- **Tests/docs-only** PRs with green CI + approving verdict → **auto-merge**.
- **Production code, migrations, env vars, or workflows** → **stop for Marco's click**.
  Marco reads the verdict + CI (phone is fine) and merges.

**5. Deploy to Azure (automatic).** A merge to `main` triggers `deploy.yml`:
```
prisma migrate deploy (prod DB)
  → build:azure (web bundle, SSO vars baked in)
  → deploy API (App Service: operations-api)
  → API HEALTH GATE   (polls /api/v1/health; red ⇒ run fails)
  → deploy web (Static Web App)
  → SWA REACHABILITY GATE (root must return 200; red ⇒ run fails)
```
Merge = deploy, health-checked end to end. A red gate fails the run loudly — never a
silent bad deploy.

### When things fail
Everything is built to **fail safe and wait** — nothing loops or merges/ships broken.
- Failure *during* an agent's run (build/lint/test/visual) → the agent fixes it before
  opening the PR.
- Transient infra (cache, runner, "workspace starting") → watcher retries once.
- A PR going stale behind main → watcher auto-updates the branch (content conflicts it
  can't fix → see below).
- Hard failure (turn cap, usage limit, real bug, merge conflict) → quarantined; Marco
  pastes the log/report, main chat stages a `rev-` fix prompt, watcher runs it.

### Merge conflicts
Auto-update-branch only handles fast-forwards. **Content conflicts** need resolution:
small/doc conflicts in GitHub's web conflict editor; code conflicts via a `rev-` prompt
(agent rebases + resolves + reverifies). For append-only logs (`progress.md`), keep both
sides; for single header lines keep the later value.

### Rollback
Current deploy is **direct-to-production** (no slot/swap yet — pending a Standard App
Service tier upgrade). A bad deploy is live until rolled back; see the runbook §8
rollback steps. Upgrading to slot+swap (deploy → health-gate → swap) is the planned
hardening.

### Quick reference
- Repo: `GH-Mantova/ProjectOperations` · Local: `C:\ProjectOperations2`
- Prompts in: `docs/pr-prompts/` (`*-ready.md` = picked up by watcher)
- Verdicts: PR comments + `docs/pr-reviews/`
- Failures: `docs/pr-prompts/failed/` · Escalations: `docs/pr-prompts/needs-marco/`
- Prod web: the Static Web App URL · Prod API: `https://operations-api.azurewebsites.net/api/v1`
