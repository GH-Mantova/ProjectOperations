# Merge-approval receipts (CP-26)

This directory holds one file per PR that required an approval receipt. A receipt is
required when:

- the `do-not-merge` label has ever been applied to the PR (everLabeled), OR
- the PR's diff touches files outside tests/ or docs/ (including migrations)

The receipt is the artefact of that approval: an authored, timestamped commit in the
PR's own diff.

## Why receipts exist

CP-26 originally read only the live `do-not-merge` label. Both the watcher
(which applies the label) and Marco (who releases it) authenticate as
`GH-Mantova`, so `LABELED by GH-Mantova` followed by `UNLABELED by GH-Mantova`
in the events API is unattributable. A released escalation was indistinguishable
from an agent clearing its own gate.

Adding a receipt does not make forgery impossible -- anyone with write access
to the repo can commit one. What it changes is that the approval stops being a
click that leaves no artefact and becomes a commit in the PR diff, authored,
timestamped, and reviewable. That is a detection/attribution improvement, not
an authentication one. Closing it properly needs a separate identity for the
watcher (option B); this is option A.

## The template

File name: `<PR-number>.md` (e.g. `1499.md`). The `pr` field must match the PR
number, and the file must be committed **to the PR branch** so it lands in the
diff a reviewer already reads. A receipt sitting on `main` from an earlier PR
does not clear a new one.

### Personal receipt (Marco released this PR himself)

```markdown
---
pr: 1499
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
authority: personal
---

Why this was approved, in the approver's own words. At least one non-empty
line -- more if the escalation warrants it.
```

### Standing receipt (merged under Marco's standing instruction, inside a lane)

```markdown
---
pr: 2250
approved_by: station-00
approved_at: 2026-10-03T12:00:00Z
authority: standing
lane: sot
---

Station 00 merged this sot/-only PR under Marco's standing instruction.
All diff paths are under sot/; the receipt itself is under docs/.
```

All fields are required on new receipts:

| Field         | Rule                                                                                    |
|---------------|-----------------------------------------------------------------------------------------|
| `pr`          | integer, must equal the PR number under test                                            |
| `approved_by` | non-empty string; `"marco"` for personal, station name for standing                    |
| `approved_at` | any string that `Date.parse` accepts (ISO-8601 recommended)                             |
| `authority`   | `"personal"` (Marco released it) or `"standing"` (station merged within a lane)        |
| `lane`        | required when `authority: standing`; must be a key in `scripts/pr-gates/standing-lanes.json` |
| body          | at least one non-empty line after the closing `---`                                     |

**Receipts already on main without the `authority` field stay valid.** CP-26 only reads
the receipt of the PR being merged. Old receipts predate the field and are not re-checked.

Missing or malformed fields fail the `Approval receipt (CP-26)` CI job with
a specific error code (`RECEIPT_MISSING_AUTHORITY`, `RECEIPT_INVALID_AUTHORITY`,
`STANDING_OUTSIDE_LANE`, etc.) so the reviewer knows exactly what to fix.

## When a receipt is required

From PR #CP26_ARMED_BY_DIFF_V1 (2026-10-03), a receipt is required whenever:

1. The PR's diff contains a migration file (any path matching `(^|/)migrations/`), OR
2. The PR's diff contains any file outside tests/ or docs/ (as defined by
   `classifyPolicyFiles` in `scripts/pr-watcher/index.mjs`), OR
3. The `do-not-merge` label was ever applied to the PR.

Staging PRs and breadcrumb PRs (docs/ and tests/ only) are unaffected.

## The two authority values

**`authority: personal`** -- Marco reviewed and released this PR himself.
- `approved_by` must be `"marco"`.
- If `MARCO_APPROVER_LOGIN` is configured in repository variables, the gate also
  checks that identity submitted an approving review. Until that variable is set,
  the receipt passes as `RECEIPT_VALID_UNCORROBORATED` with a warning.

**`authority: standing`** -- merged by a station under Marco's standing instruction,
inside a lane CI can check.
- `approved_by` must be the station name (e.g. `"station-00"`), NOT `"marco"`.
- `lane` must name a lane in `scripts/pr-gates/standing-lanes.json`.
- Not permitted on a PR that was ever labelled `do-not-merge` (use `personal`).
- Not permitted on a PR containing a migration.

## Standing lanes

The list of valid standing lanes is in `scripts/pr-gates/standing-lanes.json`.
Changing that file is never a standing matter (the file is outside every lane).

| Lane         | Matches when                                                                          |
|--------------|---------------------------------------------------------------------------------------|
| `sot`        | every non-receipt diff path starts with `sot/`                                        |
| `instrument` | every non-receipt diff path is listed in `scripts/pipeline/instrument-lane.json`; if that file is not on main, this lane never matches |

## Worked examples

For a PR that Marco approved after reviewing a migration:

```markdown
---
pr: 1499
approved_by: marco
approved_at: 2026-08-31T05:53:54Z
authority: personal
---

Approved the CP-26 receipt cluster. The gate is deliberately additive
evidence, not a rewrite of any existing record; a revert restores the
prior label-only mechanism without invalidating any PR merged in the
meantime.
```

For a Station 05 sot/-only reconciliation PR:

```markdown
---
pr: 2251
approved_by: station-00
approved_at: 2026-10-03T11:00:00Z
authority: standing
lane: sot
---

Supervisor merged this sot/-only PR under Marco's standing instruction.
All diff paths are under sot/ plus the receipt itself under docs/.
```

## What this gate does NOT do

The `Approval receipt (CP-26)` job is inert until it is added to the
required-status-checks rule of ruleset `15532058` ("Main"). That is a
repo-settings change; a prompt cannot make it. Until Marco flips that
switch, the check runs and reports but blocks nothing.
