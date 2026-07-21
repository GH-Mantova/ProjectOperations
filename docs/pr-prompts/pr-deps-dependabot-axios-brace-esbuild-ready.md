---
premise: gh api "repos/GH-Mantova/ProjectOperations/dependabot/alerts?state=open&per_page=1" --jq length | grep -qv "^0$"
premise_means: Open Dependabot alerts still exist on main (axios < 1.18.0, brace-expansion ReDoS x3 majors, esbuild < 0.28.1) -- the lockfile fix has not landed.
scope:
  - pnpm-lock.yaml
  - package.json
  - apps/api/package.json
  - apps/web/package.json
done_when: grep -q "axios@1.18" pnpm-lock.yaml && pnpm build && pnpm lint
size: 4
gate_allow: dependencies
seed_only: false
escalates: false
---

# chore(deps): resolve all 14 open Dependabot alerts via lockfile upgrade

## What to build

All 14 open Dependabot alerts live in `pnpm-lock.yaml` and collapse to three packages:

1. **axios** -> `>= 1.18.0` (1 high + 10 medium). Where axios is a direct dependency in any
   workspace `package.json`, bump the range to `^1.18.0`. Where it is transitive, add a root
   `pnpm.overrides` entry: `"axios": ">=1.18.0"`.
2. **brace-expansion** (3 high, ReDoS) -- transitive, three major lines in the lock. Add root
   `pnpm.overrides`: `"brace-expansion@1": ">=1.1.16"`, `"brace-expansion@2": ">=2.1.2"`,
   `"brace-expansion@>=3": ">=5.0.7"`.
3. **esbuild** -> `>= 0.28.1` (1 low) -- add override `"esbuild": ">=0.28.1"` only if the
   resolved version is still below 0.28.1 after install; otherwise leave it alone.

Then run `pnpm install` to regenerate the lockfile, and verify `pnpm build && pnpm lint` pass.
PR title: `chore(deps): fix 14 dependabot alerts (axios 1.18, brace-expansion, esbuild)`.
PR body must state which alerts each change discharges, and carry `GATE-ALLOW: dependencies`
bare at column 0.

## Do NOT

- Do not bump any other dependency, and do not change any source code.
- Do not touch `apps/api/prisma/**`, `sot/**`, or `.github/workflows/**`.
- Do not run `pnpm up --latest` repo-wide -- targeted ranges/overrides only.
- If `pnpm build` breaks on axios 1.18 behaviour changes, do NOT patch application code:
  say `NO-OP: axios 1.18 breaks build at <file:line>` and stop.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** -- the work is discarded either way.

## Guardrails

- One attempt; never exit silently -- say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval; there is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- Completion test: is there a PR number in your output? If not, say `NO-OP: <reason>`.
