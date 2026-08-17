---
premise: gh pr view 789 --json state -q .state | grep -q OPEN
premise_means: PR 789 (CRM board as a second tab on the Tenders page) is still open and red on tendering-e2e.
fixes_pr: 789
scope:
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/crm/CrmBoardPage.tsx
done_when: pnpm lint && grep -q "CrmBoardContent" apps/web/src/pages/tendering/TenderingPage.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Fix PR #789 - CRM tab strip pushes the register under the Tendering Assistant pill

**Work on the EXISTING branch `feat/crm-tab-on-tenders-page` (PR #789). Check it out,
fix, push to that branch. Do NOT open a new PR.**

## Confirmed diagnosis (do not re-litigate; job log + artifact already read)

tendering-e2e has failed 5 consecutive runs on this branch, always the same spec:
`batch2-tendering.spec.ts:198` "quick edit slide-over opens from row hover and saves a
due date". The Playwright error-context artifact (run 30241578857) shows the click on
`Quick edit T260407-GOLD-Rev1` is intercepted by
`<div class="persona-window">` / "Open Tendering Assistant" - the FIXED bottom-right
assistant pill (styles.css `.persona-window`, bottom: 24px, right: 24px).

Root cause: the new `TopTabStrip` (44px min-height + 12px margin) adds ~56px of
vertical height ABOVE the register. At the CI viewport (1280x720) the single filtered
row now lands at y~633-696 and its right-edge hover actions cell sits inside the
pill's hitbox (y 652-696, x 1069-1255). On main the row sits 56px higher and clears
the pill - the spec passes there. This is a REAL occlusion bug: a user at this
viewport cannot click Quick edit on that row either.

## What to build

Remove the net vertical height the tab strip adds above the register so the row
geometry returns to (or above) main's. Acceptable approaches, in preference order:

1. Fold the Tenders | CRM tabs into the EXISTING header block instead of a separate
   strip above it - e.g. render the tabs on the same row as the "TENDERING"
   `s7-type-label` line (that label line is redundant next to the breadcrumb), so
   net added height is ~0.
2. Slim the strip AND reclaim offsetting padding from `.tender-page__header` via
   inline style so the net shift is <= 8px.

Whichever you pick, both tabs must remain reachable when the CRM tab is active
(the tendering header is hidden in that state - keep the strip/tabs outside the
conditional, as now).

## Verify (mandatory before push)

Run the failing spec SOLO against a local build and confirm green:
`npx playwright test tests/e2e/pr-acceptance/batch2-tendering.spec.ts -g "quick edit slide-over"`
Also run the two CRM tab specs on this branch if present, and `pnpm lint`.

## Do NOT

- Do NOT touch `.persona-window` CSS or PersonaWindow.tsx - shared by every page.
- Do NOT modify batch2-tendering.spec.ts to force-click, hide the pill, or otherwise
  mask the occlusion. The spec is correct; the geometry is the bug.
- Do NOT change CrmBoardPage behaviour beyond what the layout fold requires.
- Do NOT rebase or force-push the branch; ordinary commits on top only.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

(For this fix-lane prompt, "open the PR" = push the fix to the existing PR #789
branch; the PR number in your output is 789.)

## Guardrails

One attempt; never exit silently (say `NO-OP: <reason>`); never ask a question or
"stand by" for approval; read the job log before diagnosing any CI failure.
