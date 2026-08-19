---
premise: 'grep -q "error-envelope humane render \*\*Done\*\*" sot/02-roadmap-and-status.md'
premise_means: sot/02 still records the error-envelope humane render as Done, and still records the superseded 2026-08-04 "null = shared" multi-tenant mechanism. Both statements are false on main today.
scope:
  - sot/02-roadmap-and-status.md
done_when: pnpm lint && ! grep -q "error-envelope humane render \*\*Done\*\*" sot/02-roadmap-and-status.md && grep -q "D48" sot/02-roadmap-and-status.md
size: 1
gate_allow: none
seed_only: false
escalates: true
---

# Doc-reconcile: two false statements in `sot/02-roadmap-and-status.md`

Branch: `docs/sot-02-reconcile-2026-08-19`. New PR.

## Standing rule

A doc-reconcile PR touches **only** `sot/` and `docs/`. Nothing else. No code, no scripts, no
workflows, no package manifests. CP-24 (`sot-purity`) enforces this at the CI layer.

**This PR touches exactly one file: `sot/02-roadmap-and-status.md`.**

## Why this PR exists

Station 06 (PR Master) grounded a defect Marco reported on 2026-08-19 — the Tip Finder rendering a
raw JSON error envelope — and found that the roadmap records the fix for that whole class of defect
as finished when it is not. A second, unrelated stale statement was found in the same file while
verifying: the multi-tenant sharing mechanism recorded on 2026-08-04 was superseded by D48 on
2026-08-17 and the old wording is still present.

Both are single-line corrections with exact replacement text supplied below. **Do not paraphrase and
do not restructure the sections** — replace the named text and nothing else.

## Target SoT file

`sot/02-roadmap-and-status.md` — two edits, both inside existing lines. No new sections.

## Edit 1 — the "Partial last-mile" paragraph (§4)

FIND this exact fragment:

```
error-envelope humane render **Done** (`lib/api-errors.ts`, 16 files)
```

REPLACE it with:

```
error-envelope humane render **PARTIAL** — the helper `lib/api-errors.ts` shipped and 22 files use it, but **38 files / 124 call sites** still do `throw new Error(await res.text())` and render the raw JSON envelope to the user (measured 2026-08-19); tracked as BACKLOG `web-raw-error-envelope-migration`
```

Leave the rest of that paragraph — AI-provider abstraction, payroll-export, `siteId` NOT-NULL,
SharePoint re-org, Entra grants — exactly as it is.

## Edit 2 — the "Resolved 2026-08-04 (were #8/#9)" note (§6)

FIND this exact fragment:

```
**Multi-tenant model → A, row-level `tenantId`** (nullable; null = shared master data, set = company-owned transactions)
```

REPLACE it with:

```
**Multi-tenant model → A, row-level `tenantId`**. ⚠️ **Mechanism SUPERSEDED 2026-08-17 by D48** — a blank `tenantId` is **not** a valid state; every record has an owner, and sharing is an **explicit grant**, never an implicit null. Model A itself is unchanged. The 2026-08-04 wording "nullable; null = shared master data" no longer describes the design — see `docs/plans/multi-tenant-plan.md`
```

Leave the websockets/SSE half of that sentence and the trailing "Both baked into their §3 plan
docs…" clause exactly as they are.

## Do NOT

- Do NOT touch any file other than `sot/02-roadmap-and-status.md`.
- Do NOT edit `§2 In-PR`, or any other status line — they have their own drift and are not in scope.
- Do NOT reword, reflow, or reformat surrounding prose. Two find-and-replace edits, nothing else.
- Do NOT change any code to match the docs. The docs are what is wrong here, not the code.

## Gates

`pnpm lint`. No schema, no migration, no seed, no app code. CP-24 will PASS — only `sot/` is touched.

## Guardrails

- One attempt. If either fragment cannot be found verbatim, make the edit you CAN make, and say
  `NO-OP: <which fragment was missing>` for the other. Do not guess at a near-match.
- Never exit silently. Never ask a question or stand by for approval.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Do NOT auto-merge

SoT changes → Marco reviews the rendered diff.

## The completion test

Is there a PR number in your output? If no because the work was already on `main`, say
`NO-OP: <reason>`. If no because you are waiting for someone — there is nobody. Open the PR.
