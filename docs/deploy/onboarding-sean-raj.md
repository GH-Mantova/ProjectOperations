# Onboarding — Sean and Raj (Tendering live test, round 1)

Welcome to the first live Azure round of the Initial Services ERP. This round
is **Tendering only**. Everything else in the UI is visible but not yet
validated for production use — see "Out of scope" at the bottom.

> Companion docs: [`pre-deploy-checklist.md`](./pre-deploy-checklist.md) and
> [`tendering-smoke-test-plan.md`](./tendering-smoke-test-plan.md).

---

## Access

Both of you already have Initial Services M365 accounts. The ERP is configured
for **Microsoft 365 Single Sign-On**, so there is no separate ERP password to
remember.

On first login, SSO auto-provisions an ERP user record with the default
`Viewer` role. Marco then upgrades the role to whatever you need for testing:

- **Sean** → Tendering Editor (or equivalent — final role TBC by Marco at provisioning)
- **Raj** → Tendering Editor + Estimator

If, for any reason, SSO is disabled on the day (Marco's call), Marco generates a
temporary password via the Reset Password admin UI (PR-48 — backend landed in PR #291 as WIP; UI / tests / audit log are tracked as PR-48 follow-up) and shares
it via the agreed channel.

## Login URL

- Web: `<placeholder — Static Web Apps URL, Marco to fill at handoff>`
- Health (if you need to check the API is up): `<placeholder — API URL>/api/v1/health`

## First login — step by step

1. Open the Web URL.
2. Click **Sign in with Microsoft**.
3. Authorise the app with your Initial Services account.
4. SSO auto-provisions your ERP user record (you should land on the dashboard).
5. If you see a "Viewer" badge and can't access Tendering, ping Marco — he
   needs to bump your role.

If you're locked out or stuck in a redirect loop: stop, send Marco the URL
shown in the browser bar plus a screenshot. Don't keep retrying — it just
generates noise in the logs.

## What Sean is testing — visual / quote PDF fidelity

You're the gate on the look of the **quote PDFs**. Concretely:

- Drive these tenders:
  - **`IS-T020`** — the seeded full-feature template tender. Has every section
    populated so the PDF exercises every block.
  - **Plus 1-2 you create from scratch**, ideally modelled on real recent jobs
    so the visual edge cases (long client names, multi-line scope, big tables)
    get exercised.
- For each tender, generate the quote PDF and compare against your reference
  templates.
- Flag any visual fidelity issue:
  - Layout breakage (wrapping, page breaks, table overflow)
  - Branding / typography / colour drift from the reference
  - Cosmetic but client-facing — anything you wouldn't put in front of a client

**How to flag**: screenshot + the tender code (e.g. `IS-T020`) + one-line
description of what's wrong. Send via the channel in "How to report bugs"
below.

You do **not** need to test workflow correctness — that's Raj's lane. If you
notice a workflow issue along the way, mention it but don't go deep on it.

## What Raj is testing — end-to-end Tendering workflow

You're the gate on the **workflow** — does the system let an estimator do their
job from new tender through to sent quote, without losing data or breaking
state? Roadmap §5A.3 (lines 368-373) is the canonical reference for the
expected flow.

Drive the full sequence at least twice end to end:

1. **Create tender** (with required + optional fields populated)
2. **Build scope of works** across multiple disciplines (DEM, CIV, ASB, Other)
3. **Run the estimate** — cost lines, options, assumptions, exclusions
4. **Generate the quote PDF**
5. **Send the PDF** — verify the Mail.Send notification lands (per PR-51)

The full step-by-step is in
[`tendering-smoke-test-plan.md`](./tendering-smoke-test-plan.md). Use that as
your checklist while you drive the flow.

Flag anything that:

- Lost data between screens
- Showed a stale value after a save
- Failed silently (button clicked, nothing happened, no toast)
- Required you to refresh the page to see the right state
- Confused you — if it confused you, it'll confuse someone else

## How to report bugs

`<TBD by Marco>` — Marco to confirm the channel before the invite goes out
(likely email to Marco direct, or a dedicated Slack / Teams channel if one is
set up by then).

Format for each report:

```
Tender: <code or "n/a">
Phase: <Phase 1 / 2 / 3 / 4 from the smoke plan, or "ad hoc">
What I did: <one or two sentences>
What I expected: <one sentence>
What happened: <one sentence>
Screenshot: <attached>
```

If the system is fully down or you can't log in at all, **call Marco** rather
than waiting on the async channel.

## Known limitations on day one

These are known, expected, and not bugs for this round:

- **Quote T&C clauses** are still under Marco's review — placeholder content
  may appear in that section of the PDF. Flag as "noted, not a bug" if you spot it.
- **Email send templates** for Tendering may use generic copy on day one —
  the body is functional, the polished copy comes later.
- **Multi-client tender splits** (multiple quotes per tender from a single
  scope) work but the UI for clients ≥ 3 is being refined — usable but not
  yet pretty.
- Any other stub or cosmetic issue Marco flags in the handoff email — read
  the email before you start so you don't waste time reporting known issues.

## Out of scope for this round

The following modules are visible in the UI but **not** for live testing:

- Operations / Jobs (post-award)
- Forms and Compliance
- Maintenance
- Assets and Equipment
- Resources and Competencies
- Scheduler and Work Planning
- Field Worker mobile
- Closeout and Archive
- Dashboards and Reporting (beyond what shows on the home page)

You're welcome to click around to get a sense of the shape of things, but
don't file bugs against any of these. Tendering is the only module under test.

## Sign-off

When you're done with your scope:

- **Sean** — reply to the handoff thread confirming the quote PDFs are
  client-ready (or list the blockers).
- **Raj** — reply confirming the Tendering workflow is shippable for internal
  use (or list the blockers).

Marco rolls both sign-offs into the go / no-go decision for the next module
to come online.

Thanks for taking the time on this.
