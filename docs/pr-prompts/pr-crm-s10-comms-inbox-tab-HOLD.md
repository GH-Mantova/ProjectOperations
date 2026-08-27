---
premise: '! grep -q "CommsInboxTriage" apps/web/src/pages/crm/CommsHubPage.tsx'
premise_means: >-
  The lead-intake module has a 292-line service and three routes with zero web callers. Marco's decision
  3 makes it the Inbox tab of the Comms hub — one window, one nav item, two modules underneath.
scope:
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/CommsInboxTriage.tsx
  - apps/web/src/pages/crm/crm-api.ts
  - apps/web/src/pages/crm/__tests__/**
done_when: 'pnpm build && pnpm lint && grep -q "CommsInboxTriage" apps/web/src/pages/crm/CommsHubPage.tsx'
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
cluster: crm-build
cluster_order: 10
requires_on_main: apps/web/src/pages/crm/CommsHubPage.tsx :: AnchorPicker
---

# CRM S10 — the Inbox tab: intake's screen, in the comms window

## The measured gap

`lead-intake.controller.ts` exposes `GET /crm/intake/open` (`:102`), `POST /crm/intake` (`:114`),
`POST /crm/intake/:id/triage` (`:131`), backed by a 292-line service that resolves or creates a PROSPECT
account (`lead-intake.service.ts:268`) and triages to a draft tender or a governed drop reason (`:199`).
Grepping `crm/intake|lead-intake|leadIntake` across all of `apps/web/src` returns **nothing**.

## Do

1. `CommsInboxTriage` rendered as the **Inbox** tab of the Comms hub (S2 built the shell).
2. Per row: title, anchor type chip, channel chip (email / phone / portal / referral), age, body excerpt,
   and the matched account — or "no match, will create X".
3. Actions per row: **Price it** and **Don't pursue**, calling `POST /crm/intake/:id/triage`.
4. **Capture a lead** using `POST /crm/intake`, with the channel selector the service already supports.
5. Channel filter, and the anchor filter S9 established.

## Do NOT

- **Do NOT move triage into the comms service.** This tab is intake's screen; it calls
  `/crm/intake/*`. Comms owns threads and tasks. Marco's decision 3 is explicit and it is the reason he
  asked to keep the sub-module — **if you import a comms service into intake or vice versa, stop and report.**
- **Do NOT route intake through the older leads-collapse path** (`/crm/entries`,
  `/crm/leads/:id/generate-draft-tender`). That path never sets `accountId` or `captureChannel`, which is
  why those columns are dead today.
- Do NOT add archive or delete here — that is S11.
- Do NOT change the Leads & opportunities board under Tendering.

## Tests

1. Triage payload targets `/crm/intake/:id/triage`, not `/crm/entries`. Assert the URL — this is the
   whole point of keeping the module.
2. Capture payload carries `captureChannel`; assert the key is present for each of the four channels.
3. A row with no matched account renders the create-intent state and still submits.
4. Negative control: the triage builder never emits a legacy stage value.

## STOP AND REPORT

- `/crm/intake/open` does not return the fields the row needs.
- Triage requires a permission a `crm.view` holder lacks.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> **Finishing the work and then asking for permission is indistinguishable from failing.**

Every scope limit above still applies; a scope limit is not a reason to stop before pushing. STOP AND
REPORT means **open the PR, put the problem in the body, leave it unmerged** — never exit without a PR.
Report measurements, not conclusions.

Full programme context, decisions and ground truth: `docs/plans/crm-build-order-plan.md`.
