# PR #1066 Fix-Forward Escalation

## Summary

PR #1066 (CFX-1 field registry) is implementation-correct and scope-clean, but CI cannot pass because main branch has a pre-existing build failure. The Opportunity schema (modified in PR #1055) no longer has fields `isLead`, `dropReason`, and `dropReasonDetail`, and no longer supports stage values `"not_pursued"` and `"archived"`, but crm.service.ts still references these. This breaks the entire API build.

## Action required

Fix the CRM schema drift on main (PR #1055) by either:
1. Reverting the problematic Opportunity schema changes in PR #1055, OR
2. Updating crm.service.ts to match the new schema (remove isLead references, update stage enum values, handle dropReason differently)

Once main build passes, re-run CI on PR #1066 — no changes to the PR itself are needed.

## Why FIX-FORWARD and not REJECT

- All substantive work in PR #1066 is correct (schema, migration, service, tests, seed)
- The PR introduces zero new build/lint errors
- The blocker is pre-existing tech debt on main, not a problem with this PR's implementation
