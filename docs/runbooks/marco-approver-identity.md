# Marco approver identity -- setup runbook

**For Marco to carry out. No station may perform these steps or hold this account's credentials.**

CP26_ARMED_BY_DIFF_V1

## Why

Every merge on this board is recorded as `GH-Mantova`. When Marco releases a PR himself
(removes the `do-not-merge` label and commits a receipt with `authority: personal`), the
receipt's `approved_by: marco` field is a station's written claim, not a verified identity.

A receipt with `authority: personal` passes the gate as `RECEIPT_VALID_UNCORROBORATED`
until a second GitHub account is configured -- meaning `approved_by=marco is a station's
statement; no approver identity is configured to confirm it` is printed on every personal
receipt. That message is accurate and intentional; it identifies the gap.

**One shared login means nothing can show it was him.** The watcher, CI scripts, and Marco
himself all write to this repo as `GH-Mantova`. An approving review from a second account
that only Marco holds is the one signal that cannot be forged by the pipeline itself.

## What this runbook covers

1. Creating a second GitHub account with 2FA
2. Inviting it to the repo as a collaborator
3. Setting the `MARCO_APPROVER_LOGIN` repository variable
4. Verifying it on a test PR
5. How to turn it off

## Step 1 -- Create a second GitHub account

1. Use a personal email address (not the `marco@initialservices.net` address -- that is
   already `GH-Mantova`'s email) or a dedicated alias.
2. Create the GitHub account at https://github.com/signup.
3. Enable two-factor authentication immediately after creating it (Settings > Password and
   authentication > Two-factor authentication). This is required: an unprotected account
   that can approve merges is a vulnerability.
4. Choose a username that makes its purpose obvious, for example `marco-approver` or
   `mantova-release-approver`.

## Step 2 -- Invite it to the repository

The account needs the lowest role that allows it to submit an approving review on a
pull request. On GitHub, the minimum role for PR reviews is **Read**:

1. In `GH-Mantova/ProjectOperations` go to Settings > Collaborators and teams.
2. Click "Add people" and invite the new account by username.
3. Set the role to **Read** (the minimum that allows review submissions).
4. Accept the invitation from the new account.

Do NOT grant Write, Maintain, or Admin access. The account's only purpose is to submit
an approving review as a second factor; it should not be able to push branches.

## Step 3 -- Set the repository variable

This is a repository **variable**, not a secret. Variables are visible in CI logs and
are intended for non-sensitive configuration like feature flags. The approver login is
not a credential; it is a username.

1. In `GH-Mantova/ProjectOperations` go to Settings > Secrets and variables > Actions.
2. Select the **Variables** tab (not Secrets).
3. Click "New repository variable".
4. Name: `MARCO_APPROVER_LOGIN`
5. Value: the username chosen in Step 1 (e.g. `marco-approver`)
6. Click "Add variable".

The CI job `approval-receipt` already reads `MARCO_APPROVER_LOGIN` from
`${{ vars.MARCO_APPROVER_LOGIN }}` (added in this PR). Once the variable is set, the gate
will check for an approving review from that account on personal-authority receipts.

## Step 4 -- Verify on a test PR

Open any PR that:
- touches a file outside tests/ or docs/ (so a receipt is required), and
- uses `authority: personal` in the receipt.

1. Submit an approving review on the PR from the new second account.
2. Watch the `Approval receipt (CP-26)` CI job. It should now report
   `PASS - CP-26 approval-receipt [RECEIPT_VALID_CORROBORATED] ...` instead of
   `RECEIPT_VALID_UNCORROBORATED`.
3. If the job still reports `UNCORROBORATED`, check:
   - the variable name exactly matches `MARCO_APPROVER_LOGIN` (case-sensitive),
   - the value matches the second account's GitHub login exactly,
   - the PR's head SHA matches the commit the review was submitted against (or
     only receipt-file commits were pushed after the review).

## Step 5 -- How to turn it off

Delete the repository variable `MARCO_APPROVER_LOGIN` (Settings > Secrets and variables
> Actions > Variables > delete). Personal receipts will revert to `RECEIPT_VALID_UNCORROBORATED`
and the gate will still pass -- the variable is an enhancement, not a hard requirement.

## What happens without this setup

- Personal receipts pass as `RECEIPT_VALID_UNCORROBORATED`.
- The gate message says: `approved_by=marco is a station's statement; no approver identity
  is configured to confirm it`.
- The gate still blocks if no receipt is committed at all.
- The gate still blocks on `authority: standing` mismatches.

The gate is functional without the second identity; this runbook describes how to close
the attribution gap.

## Scope

No station may perform these steps. The account and its credentials belong to Marco alone.
CI reads the login from a repository variable; it never holds credentials for the account.
The account cannot push branches or merge PRs; it can only submit a review.
