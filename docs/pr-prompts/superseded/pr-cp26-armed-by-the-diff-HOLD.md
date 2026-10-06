---
premise: '! grep -q "CP26_ARMED_BY_DIFF_V1" scripts/pr-gates/approval-receipt.mjs'
premise_means: >-
  CP-26 (Approval receipt, a required check) only demands a receipt when the PR was ever labelled
  do-not-merge. An unlabelled PR passes green whatever it changes. Real cases: #1624 and #1687 carried
  migrations, #1662 dropped five columns and passed, and #1827 was routed to Marco but merged
  unlabelled. A receipt's approved_by: marco also cannot tell "Marco released it" from "merged
  under his standing instruction". MEASURED 2026-10-03 at origin/main d456f342:
  approval-receipt.mjs is unchanged since #1492 (2026-09-01) and returns PASS NEVER_ESCALATED before
  reading the diff, and DOCTRINE 10.2.1 still calls the receipt "a discipline, not a gate". Sources:
  the three needs-marco files (cp26-passes-vacuously..., label-removal-is-the-release-path...,
  nothing-verifies-a-merge-approval-receipt..., which includes the retraction).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pr-gates/__tests__/*.mjs" &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  grep -q "CP26_ARMED_BY_DIFF_V1" scripts/pr-gates/approval-receipt.mjs &&
  grep -q "CP26_ARMED_BY_DIFF_V1" scripts/pr-gates/approval-receipt-check.mjs &&
  grep -q "authority:" docs/decisions/merge-approvals/README.md &&
  test -f docs/runbooks/marco-approver-identity.md &&
  node scripts/pipeline/check-receipts.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pr-gates/approval-receipt.mjs
  - scripts/pr-gates/approval-receipt-check.mjs
  - scripts/pr-gates/standing-lanes.json
  - scripts/pr-gates/__tests__/approval-receipt.test.mjs
  - .github/workflows/ci.yml
  - docs/decisions/merge-approvals/README.md
  - docs/runbooks/marco-approver-identity.md
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/STATION-CAPABILITIES.md
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 5
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Revert the PR. CP-26 goes back to being armed by the label only. Receipts written with the new
  authority field stay valid, because the old parser ignores unknown fields. No data, migration or
  setting changes.
escalates: true
module: pipeline
---

# CP-26 is armed by what the PR changes, and every receipt says whose authority it was

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

1. **Armed by the diff.** Any PR with a migration, or any file outside tests/docs, needs a receipt,
   labelled or not. The label stays as a second trigger.
2. **Say it honestly now, real proof later.** Every receipt states `authority: personal` (Marco
   released it) or `authority: standing` (merged under his standing instruction, inside a lane CI
   can check). A runbook covers a second GitHub identity that only Marco holds. Once he sets it up,
   CP-26 also requires that identity's approval on `personal` receipts. Until then, `personal`
   passes but is printed as **uncorroborated**.

**Never in scope:** creating accounts, collaborators, repository variables or rulesets. Write the
runbook; Marco does the settings. Tag all new code with `CP26_ARMED_BY_DIFF_V1`.

## 1. One definition of "outside tests/docs"

`approval-receipt-check.mjs` imports `classifyPolicyFiles` from `scripts/pr-watcher/index.mjs`. The
import is safe: the watcher's main is guarded at line ~4016, and
`scripts/pr-watcher/__tests__/classify-policy-files.test.mjs` already imports it this way. Do
**not** copy the regexes and do **not** edit `index.mjs`. If the import turns out to have a side
effect in CI, stop with BLOCKED and say what it was.

`requiredByDiff = !classifyPolicyFiles(diffPaths).ok`, where `diffPaths` is the PR's
`git diff --name-only <merge-base> HEAD`. Keep the receipt path in the list; it is under `docs/`,
so it changes nothing.

## 2. `scripts/pr-gates/standing-lanes.json`

This is the only list of lanes where `authority: standing` is accepted. Changing it is never a
standing matter: the file is outside every lane.

```json
{ "lanes": {
    "sot":        { "match": "all-paths-under", "prefix": "sot/" },
    "instrument": { "match": "instrument-lane-json", "file": "scripts/pipeline/instrument-lane.json" } },
  "_readme": "..." }
```

- `sot`: every diff path starts with `sot/`, apart from the receipt itself. This is Station 05's
  doc-reconcile lane.
- `instrument`: every diff path apart from the receipt is in `instrument-lane.json` (its `files`,
  or its `tests` glob), and that file is unchanged. **If `instrument-lane.json` is not on main, this
  lane never matches.** It is staged in #2227 and may land before or after this prompt.

The check evaluates both lanes and passes `laneMatches` to the pure function.

## 3. `approval-receipt.mjs`: the new decision (keep the module pure, built-ins only)

New inputs: `requiredByDiff`, `requiredReason`, `diffHasMigration`, `laneMatches`
(`{ sot, instrument }`), `approverLogin` (string or empty), and `approverApproved` (boolean, or null
when not configured). Order of checks:

1. `labelPresent` gives FAIL `LABEL_PRESENT` (unchanged).
2. Not `everLabeled` and not `requiredByDiff` gives PASS `NEVER_ESCALATED`. Keep the code name,
   because other tools read it.
3. A receipt is required but not in the diff:
   - if the PR was ever labelled, FAIL `RELEASED_NO_RECEIPT` (unchanged);
   - otherwise, FAIL `RECEIPT_REQUIRED_BY_DIFF`, naming `requiredReason` (for example
     `migration file: ...` or `outside tests/ or docs/: ...`).
4. The existing field checks run (`pr`, `approved_by`, `approved_at`, body), then:
   - `authority` missing gives FAIL `RECEIPT_MISSING_AUTHORITY`;
   - `authority` other than `personal` or `standing` gives FAIL `RECEIPT_INVALID_AUTHORITY`.
5. `authority: standing` fails in each of these cases:
   - the PR was ever labelled: FAIL `STANDING_ON_LABELLED_PR` (a labelled PR is always Marco's
     personal release);
   - the diff has a migration: FAIL `STANDING_NOT_ALLOWED_FOR_MIGRATION`;
   - `lane` is missing, unknown, or its `laneMatches` entry is false: FAIL `STANDING_OUTSIDE_LANE`;
   - `approved_by` is `marco`: FAIL `STANDING_CLAIMS_MARCO` (a standing receipt names the station
     that merged, never Marco).

   Otherwise PASS `RECEIPT_VALID_STANDING`.
6. `authority: personal`:
   - `approved_by` other than `marco` gives FAIL `PERSONAL_NOT_MARCO`;
   - with `approverLogin` set and `approverApproved` false, FAIL `PERSONAL_NOT_CORROBORATED`;
   - with `approverLogin` set and `approverApproved` true, PASS `RECEIPT_VALID_CORROBORATED`;
   - with `approverLogin` empty, PASS `RECEIPT_VALID_UNCORROBORATED`, and the message must say:
     `approved_by=marco is a station's statement; no approver identity is configured to confirm it`.

Update the header comment's verdict table to match.

## 4. `approval-receipt-check.mjs` and `ci.yml`

- Compute `diffPaths`, `requiredByDiff`, `requiredReason`, `diffHasMigration` and `laneMatches`
  from the same merge-base diff it already takes.
- Read `MARCO_APPROVER_LOGIN` from the environment. In `ci.yml`, add exactly one env line to the
  existing `approval-receipt` job: `MARCO_APPROVER_LOGIN: ${{ vars.MARCO_APPROVER_LOGIN }}`. Add
  `pull-requests: read` to that job's permissions only if it is missing. Change nothing else in
  `ci.yml`.
- When the login is set, read `gh pr view <N> --json reviews,commits`. `approverApproved` is true
  when that login's latest review is `APPROVED` and it was made on the head commit, or every commit
  after it changes only the receipt file. Any `gh` error fails closed, as today.
- Update the FAIL help text so step 2's template shows `authority:` (and `lane:` for standing).

## 5. Documents

- **`docs/decisions/merge-approvals/README.md`:** add `authority` (required on new receipts) and
  `lane` (required when standing). Give one example of each. Say plainly that receipts already on
  main without the field stay valid, because CP-26 only reads the receipt of the PR being merged.
- **`docs/runbooks/marco-approver-identity.md`** (new, for Marco to carry out). Cover:
  - why: one shared login means nothing can show it was him;
  - creating a second GitHub account with 2FA;
  - inviting it to the repo with the lowest role that can submit an approving review;
  - setting the Actions repository **variable** (not a secret) `MARCO_APPROVER_LOGIN`;
  - checking it on a test PR;
  - how to turn it off: delete the variable.

  Say that no station may perform these steps or hold this account's credentials.
- **`DOCTRINE.md` section 10.2.1:** replace the "discipline, not a gate" paragraph's conclusion with
  a dated note. From this PR, CP-26 is armed by the diff, standing receipts are checked against
  `standing-lanes.json`, and personal receipts stay uncorroborated until the approver identity
  exists. Keep the correction history; never delete a measured record.
- **`STATION-CAPABILITIES.md` section 5:** under the matrix, say how a standing receipt is written:
  the merging station writes it, with `approved_by: station-00` (or the station's name) and the
  lane. A station writes `authority: personal` only when Marco released that PR himself (label
  removed, or released in chat).
- **`00-supervisor.md`:** in the merge section, before `Merge-Pr`, require the receipt the check
  now demands. If an INSTRUMENT LANE paragraph exists (#2227), add the line: "commit a receipt with
  `authority: standing`, `lane: instrument`".

  Run `lint-station.mjs` and re-record canonical hashes if it asks.

## 6. `node scripts/pipeline/check-receipts.mjs` must still pass

It checks that every receipt on main parses. Do not make it require `authority`. Old receipts
predate the field.

## Tests: `scripts/pr-gates/__tests__/approval-receipt.test.mjs`

Keep every existing test passing unchanged where its inputs still apply. Add:

1. Unlabelled, docs/tests-only diff: PASS `NEVER_ESCALATED`.
2. Unlabelled, a `migrations/` path, no receipt: FAIL `RECEIPT_REQUIRED_BY_DIFF`, naming the file.
   **This is the #1662 / #1687 case.**
3. Unlabelled, an `apps/` path, no receipt: FAIL `RECEIPT_REQUIRED_BY_DIFF`. **This is the #1827
   case.**
4. A receipt without `authority`: FAIL `RECEIPT_MISSING_AUTHORITY`. `authority: maybe`: FAIL
   `RECEIPT_INVALID_AUTHORITY`.
5. Standing, `lane: sot`, sot match true: PASS `RECEIPT_VALID_STANDING`. Same with the match false:
   FAIL `STANDING_OUTSIDE_LANE`.
6. Standing on a PR that was ever labelled: FAIL `STANDING_ON_LABELLED_PR`. Standing with a
   migration: FAIL `STANDING_NOT_ALLOWED_FOR_MIGRATION`. Standing with `approved_by: marco`: FAIL
   `STANDING_CLAIMS_MARCO`.
7. Personal, no approver configured: PASS `RECEIPT_VALID_UNCORROBORATED`, with the
   "station's statement" wording.
8. Personal, approver configured, not approved: FAIL `PERSONAL_NOT_CORROBORATED`. Approved: PASS
   `RECEIPT_VALID_CORROBORATED`. Personal with `approved_by: station-00`: FAIL `PERSONAL_NOT_MARCO`.
9. Lane matching, as a pure helper test:
   - an all-`sot/` diff plus the receipt matches `sot`;
   - one `scripts/` path breaks the match;
   - a missing `instrument-lane.json` means `instrument` never matches.
10. **Negative control:** set `requiredByDiff` to false and remove the label with an `apps/` diff.
    The test must show that it is `requiredByDiff` that turns case 3 red. Mirror the existing
    `everLabeled` control.

## Note for Station 00 (put this in the PR body)

From the moment this merges, every open PR that touches code or a migration needs a receipt before
CP-26 goes green. That is the ruling working as intended, not a regression. Staging PRs and
breadcrumb PRs (docs only) are unaffected.

`escalates: true`: this changes a required merge gate. The PR opens labelled `do-not-merge`, and
Marco releases it.
