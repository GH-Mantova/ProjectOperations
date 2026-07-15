---
premise: '! grep -rq "EXISTING_SITE_PICKER" apps/api/src/modules/forms apps/web/src'
premise_means: No EXISTING_SITE_PICKER forms field type exists yet in the form builder.
scope:
  - apps/web/src/**
  - apps/api/src/modules/forms/**
  - apps/api/src/**/__tests__/**
done_when: pnpm build && pnpm lint && grep -rq "EXISTING_SITE_PICKER" apps/api/src/modules/forms apps/web/src
size: 8
gate_allow: none
seed_only: false
escalates: false
---

# Form builder: an 'existing sites' picker field a form can mark required

Site capture on forms is a **per-form choice in the form builder**, NOT a DB constraint.
FormSubmission.siteId STAYS NULLABLE. A form author adds an 'existing sites' dropdown field
(populated from the `Site` table) and can toggle it required; enforcement is per-form at
submission-validation time, driven by the field's required flag.

## STANDING AUTHORITY - read this first

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean "wait for approval
before starting", and it does not mean "do the work then ask permission to push". There is no human
in this run. **Finishing the work and then asking for permission is indistinguishable from failing**
— the work is discarded either way. **Your run is complete only when your output contains a PR NUMBER**
— or an honest `NO-OP: <reason>`.

## Marco's decision (2026-07-15) — this is the spec

> Build as a form-builder field type. Populate the dropdown from the `Site` table; a form author can
> toggle 'required'; validate on submit. Do NOT add a DB NOT NULL on `FormSubmission.siteId`.

## What to build

1. **Field type** — add a new form-builder field type (an 'existing sites' picker). Read how the
   existing field types are declared in the forms engine (`apps/api/src/modules/forms/` and the
   web form builder under `apps/web/src`) and add this one the same way — do not invent a parallel
   mechanism. **Key the new field type with the exact identifier `EXISTING_SITE_PICKER`** (the
   enum member / type constant) so it is greppable and unambiguous — the premise and done_when
   both check for that token.
2. **Options source** — the picker's options come from the `Site` table (id + name/address label),
   fetched through the existing forms/site data path. Do not hardcode a site list.
3. **Required flag** — the field participates in the existing per-field `required` mechanism.
4. **Submit-time validation** — when a form's site-picker field is marked required, a submission
   missing it fails validation with a clear error, through the SAME validation path other required
   fields use. Unit-test: required + missing => rejected; required + present => accepted; optional
   + missing => accepted.

## Do NOT

- Do NOT add a DB NOT NULL constraint on `FormSubmission.siteId` — that is explicitly out of scope
  and is a different (escalating) backlog item.
- Do NOT add a migration for this — it is a field-type + validation feature, not a schema constraint.
  If you believe a schema change is truly required, `NO-OP: <reason>` and explain, rather than
  silently adding one.
- Do NOT touch `sot/`. CP-24 hard-fails any PR mixing code and `sot/`.

## Guardrails

- **ONE ATTEMPT.** If it does not work, `NO-OP: <reason>` and stop.
- **NEVER ask a question. NEVER "stand by".** There is nobody to answer.
- **CI failures: read the job log** (`gh run view <run> --job <job> --log`) before diagnosing.
- Open the PR. Do not merge it — Marco reviews the diff.
