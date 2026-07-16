# Backlog decisions — Marco, 2026-07-14

**These answer every `marco_question` in `BACKLOG.yaml`. The `needs_marco` flags are now cleared.**
An agent picking up any of these items must read the decision here first — it is the design brief.

---

## 1. Job / Project merge (B-P0a) — **`Job` IS CANONICAL**

Merge `Project` into `Job`. Restart the workstream.

**This gates the scheduler.** Phase A (the links) merged in #500; slices 3-9 never shipped.
Reshapes the spine of the data model — sequence it carefully, and **one slice per PR.**
Do NOT run this concurrently with B-P0b: both regenerate the data-model map and will conflict on it.

## 2. Worker / WorkerProfile merge (B-P0b) — **RESTART. `WorkerProfile` is canonical.**

Same gate, same caution. **Strictly one at a time with B-P0a.**

## 3. Interactive SWMS — **SPLIT, under Compliance, issuable to a Job**

- **(a) Static SWMS wizard** and **(b) the control-mapping tool** are **separate** deliverables.
- Both live **under the Compliance module**.
- A SWMS must be **issuable to a Job** (so it inherits the Job/canonical decision above — it hangs
  off `Job`, not `Project`).
- ⚠️ **Marco wants a VISUALIZATION first**, to confirm the flow matches what he has in mind, **before
  the build.** So the first deliverable is a **clickable/visual prototype**, not production code.
  Do not skip to implementation.

Backbone: Rev 5 template — 7 sections, 102 controls, 410 control rows, 31 SOP-SWMS.
Prototype reference: `C:\ProjectOperations-Reference\Interactive SWMS\`.

## 4. Smart Wizard — **REVIEW THE CATALOG FIRST**, and the wizard must stay LIVE

Two parts, in order:

1. **Review `docs/data-model/metadata-catalog.json` first.** Coverage is **0/195 models
   human-reviewed**. The wizard is only ever as good as this catalog.
2. **The wizard must behave almost like a LIVE agent** — **the catalog WILL change over time, and the
   wizard must pick that up without a rebuild.**

   **Design consequence, and it is the whole design:** the wizard **reads the catalog at RUNTIME.**
   **No code generation. No baked-in model list. No compile-time snapshot.** Add a model to the
   catalog → the wizard offers it, with no deploy. If you find yourself generating code from the
   catalog, you have built the wrong thing.

## 5. QA Workstream C — **FULL DEPTH, but REVIEW THE PLAN BEFORE STARTING**

Still full-depth. **BUT the plan was locked on 2026-07-02 and the world has changed completely
since** — the pipeline, the stations, the gates, the lint, the acceptance suite all now exist.
**Re-review the plan against today's reality before writing a single test.** Much of what it assumed
was missing may already be covered.

## 6. FIELD worker auth track — **IN SCOPE**

Personal-email / OTP track for field workers, alongside OFFICE (Entra).
The `kind` discriminator already exists on `AccessRequest` (baked in deliberately by #538).

## 7. Task-time / waste-weight calculators — **YES, as their own reviewable PR**

**These CHANGE QUOTED PRICES.** They must not ride along with a refactor. One PR, line-by-line
reviewable by Marco, with before/after numbers on a worked example.

## 8. Repo streamline pass — **DROP THE SCRIPT. Fold the intent into `04-scanner`.**

`streamline-and-tidy.ps1` was written **2026-06-30 — before the pipeline existed.** It is a one-shot
destructive bulk-tidy from a world that no longer exists. Running a stale sweep script against a repo
it does not understand is precisely the irreversible-with-no-gate action the guards exist to stop.

**The need is real** (superseded prompt files littering the queue root, `C:\po-worktrees`, orphaned
branches). **The method was wrong.**

→ becomes a **recurring, REPORT-ONLY repo-hygiene check inside `04-scanner`**: it finds the cruft,
reports it, and stages a prompt for anything worth deleting. Continuous and reviewable, instead of
one big blind sweep. **No agent bulk-deletes anything.**

## 9. `Microsoft.Insights` — ✅ **REGISTERED by Marco, 2026-07-14**

Prod now has queryable telemetry. **Stop diagnosing production by watching the Log Stream by hand.**
Next prod incident: query it.

---

## Still owed by Marco (not backlog items)

- **`Mail.Send` verification.** Mail has **never actually worked in prod** (`resolveMailCreds()` reads
  `AZURE_MAIL_*` ?? `SHAREPOINT_*` — none of which ever existed). Sequence:
  merge `pr-zz-mail-managed-identity` → deploy → trigger a real access-request → **confirm the email
  lands** → **only then** delete the old app-registration secrets.
  **Verification BEFORE the irreversible step, never alongside it** (LL-36).


---

# Addendum -- Marco, 2026-07-15 (supersedes two earlier answers)

Two decisions recorded earlier on 2026-07-15 were **revised by Marco the same day**. The revised
answers below WIN. Staged prompt bodies live in `docs/pr-prompts/staged/` (authored, not yet armed).

## A. Default dashboard -- **PER USER** (supersedes per-role/per-module)

One global default dashboard **"Home"** that every user starts on, plus a per-user override
(`User.defaultDashboardId`) each user sets for themselves. **No RoleDefaultDashboard table.** Also:
**delete the two generic dashboards "Operations" and "Tendering"** and replace with "Home".
- Backend + data (escalates, deletes rows): `staged/pr-user-default-dashboard.md`
- Frontend (gated on backend): `staged/pr-user-default-dashboard-ui.md`

## B. Site on Tender -- **REQUIRED at tender time** (supersedes "Tender stays nullable")

A tender's physical **site address must be captured at tender time.** Today NewTenderWizard stores
site as FREE TEXT folded into the description and never links a Site record -- which is why every
tender.siteId is null. Plan:
1. `staged/pr-tender-geoapify-site-autocomplete.md` -- replace the free-text field with a Geoapify
   address-autocomplete (server-side proxy reads the existing "geoapify" integration key) that
   find-or-creates a Site and sets siteId.
2. `staged/pr-tender-required-site.md` (escalates, GATED on #1) -- backfill legacy tenders to
   "Unassigned", then NOT NULL on Tender + DTO validation.
Job + Project NOT NULL is unchanged: `staged/pr-siteid-notnull-job-project.md` (escalates).
FormSubmission stays nullable (`formsubmission-required-site-field`, per-form required field).

## C. Mail managed identity -- unchanged, Marco supervising ops NOW

Build-the-code-PR-now decision stands (`mail-send-managed-identity`, escalates). Marco confirmed he
will supervise the ops sequence: deploy -> trigger a real access-request -> confirm the email LANDS
-> only THEN delete the old app-registration secrets (never alongside; LL-36).
