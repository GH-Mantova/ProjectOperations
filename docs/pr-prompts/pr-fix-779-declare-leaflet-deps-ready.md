---
premise: '! grep -q "\"leaflet\"" apps/web/package.json'
premise_means: >
  leaflet and react-leaflet are imported by the m1b map view (PR #779) but undeclared in
  apps/web/package.json, so the CP diff-gate fails. Dies the moment the deps are declared.
scope:
  - apps/web/package.json
  - pnpm-lock.yaml
size: 2
escalates: false
done_when: >
  grep finds "leaflet" and "react-leaflet" in apps/web/package.json dependencies AND
  pnpm-lock.yaml is updated in the same commit AND PR #779's "PR gates - diff checks" job is
  green on the new head.
---

# FIX-FORWARD on PR #779: declare leaflet + react-leaflet

## STATUS

PR #779 (feat/ops-m1b-map-view, LocationsMap panel) is green everywhere EXCEPT the
"PR gates - diff checks" job: the diff imports `leaflet` and `react-leaflet` in apps/web without
declaring them in apps/web/package.json (diagnosed from the gate job log on prior runs; recorded
in station notes 2026-07-24). Everything else about the PR is done.

## THE WORK - fix ON THE EXISTING BRANCH, do NOT open a new PR

1. `git fetch origin` and check out branch `feat/ops-m1b-map-view` in an isolated worktree.
2. Confirm the failing gate on the CURRENT head first (`gh pr checks 779`); if the red check has
   CHANGED, diagnose from its job log before acting.
3. Add `leaflet` and `react-leaflet` to apps/web/package.json dependencies at the versions the
   code actually uses (read the imports/types; if the repo pins exact versions elsewhere, match
   that style). Run `pnpm install --lockfile-only` (or plain `pnpm install`) so pnpm-lock.yaml
   reflects the change; commit BOTH files.
4. Push to the same branch. CI re-runs on the new head - that is the PR's own auto-merge path
   (#779 gets armed by the supervisor once green).

## DO NOT

- No new PR. No changes to the map code itself. No other dependency bumps.
- Do not touch any other PR's branch.

## VERIFY

- `node -e "const p=require('./apps/web/package.json');if(!p.dependencies.leaflet||!p.dependencies['react-leaflet'])process.exit(1)"` exits 0.
- pnpm-lock.yaml contains leaflet entries.

## STANDING AUTHORITY

You have STANDING AUTHORITY to finish the work, commit, push to the existing branch. Do not ask.
There is no human in this run. Finishing the work and then asking for permission is
indistinguishable from failing - the work is discarded either way.
