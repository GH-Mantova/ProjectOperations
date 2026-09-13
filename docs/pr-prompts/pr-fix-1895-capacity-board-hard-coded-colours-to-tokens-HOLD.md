---
premise: "git fetch -q origin feat/ew5-capacity-board-ui && git show origin/feat/ew5-capacity-board-ui:apps/web/src/components/allocation/EstimatorGrid.tsx | grep -qi '#B91C1C'"
premise_means: >-
  PR #1895 (EW-5 capacity board) hard-codes about a hundred hex colour literals across
  CapacityBoardPage.tsx, EstimatorGrid.tsx, UnallocatedPanel.tsx, RejectModal.tsx and
  DelegateWindowEditor.tsx (measured on the diff: 4B5563 x21, B91C1C x20, 9CA3AF x8, F3F4F6 x7,
  E5E7EB x7, D1D5DB x7, 6B7280 x7, F9FAFB x4, D1FAE5 x3, 065F46 x3, plus the FEE2E2 / DBEAFE /
  1E40AF badge pairs). The hex ratchet fails the Pipeline job on every head (run 34750393468)
  and the review verdict is REJECT-AND-REDO for exactly this: hard-coded hex does not flip with
  the theme and violates sot/01 section 5. Everything else in the PR - board, self-view,
  delegation editor, three API endpoints and their tests - the review found correct.
fixes_pr: 1895
scope:
  - apps/web/src/pages/tenders/CapacityBoardPage.tsx
  - apps/web/src/components/allocation/EstimatorGrid.tsx
  - apps/web/src/components/allocation/UnallocatedPanel.tsx
  - apps/web/src/components/allocation/RejectModal.tsx
  - apps/web/src/components/allocation/DelegateWindowEditor.tsx
done_when: >-
  ! grep -rqiE '#[0-9a-f]{6}' apps/web/src/pages/tenders/CapacityBoardPage.tsx
  apps/web/src/components/allocation && node scripts/pipeline/check-hex-ratchet.mjs && pnpm
  --filter @project-ops/web lint && pnpm --filter @project-ops/web test -- allocation
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tenders
---

# Repair PR 1895 - the capacity board must take its colours from tokens.css

**Do this ON PR #1895's existing branch `feat/ew5-capacity-board-ui`. Do NOT open a new PR.**
The defect is inside that PR's own diff. main is green.

## FIRST: re-verify against the CURRENT head

Run `node scripts/pipeline/check-hex-ratchet.mjs` on the branch and read the `Pipeline -
watcher + linter tests` job of the **latest** CI run: confirm the red step is still the hex
ratchet and it names the allocation files. If anything else is red, fix what the log shows and
say so plainly.

## What to change

Replace every hard-coded colour in the five files with a token from
`apps/web/src/styles/tokens.css` via `var(--token)` (or the existing className the design
system already provides for that role). The palette in use maps onto existing semantic tokens;
pick by ROLE, never by nearest shade:

- greys used for text (4B5563, 6B7280, 9CA3AF) -> `--text-primary` / `--text-secondary` /
  `--text-muted`
- greys used for surfaces and borders (F9FAFB, F3F4F6, E5E7EB, D1D5DB) -> `--surface-page` /
  `--surface-subtle` / `--surface-card` / `--border-subtle` / `--border-default`
- green badge pair (D1FAE5 / 065F46, ALLOCATED and CLAIMED) -> `--status-active` (badge
  background at the opacity the other status badges in the app use; read an existing status
  badge component and copy its technique rather than inventing one)
- red pair (FEE2E2 / B91C1C, UNALLOCATED and overload/danger) -> `--status-danger`
- blue pair (DBEAFE / 1E40AF, POOL) -> `--status-info`

Do NOT add new tokens to `tokens.css` (out of scope), do NOT regenerate `docs/qa/hex-baseline.json`,
and do not change behaviour, layout, copy, tests or the API. If a colour has no honest token
role, use `--status-neutral` and say which one in the commit message.

## Verify, then push

1. `grep -rciE '#[0-9a-f]{6}' apps/web/src/pages/tenders/CapacityBoardPage.tsx apps/web/src/components/allocation` -> every file 0.
2. `node scripts/pipeline/check-hex-ratchet.mjs` -> exit 0.
3. `pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test -- allocation` -> green.
4. `pnpm --filter @project-ops/web build`.
5. Commit on the branch with a message that describes the change and does NOT put the words
   fix/fixes/close/closes/resolve/resolves immediately before `#1895`.
6. Push. Do not open a PR - #1895 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1895 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already repaired` and exit.
- Touch only the five files in `scope`.
- Never add or remove a label; never merge.
