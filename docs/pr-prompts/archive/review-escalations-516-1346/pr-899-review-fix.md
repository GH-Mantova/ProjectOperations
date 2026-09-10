# Follow-up: PR #899 In-PR section stale snapshot

## Issue

PR #899's §2 (In-PR table) documents #895 and #894 as "open right now (2)", but both PRs have since merged:
- #894 merged 2026-08-04 04:41:46Z
- #895 merged 2026-08-04 05:09:13Z
- #899 created 2026-08-04 05:10:10Z (after both merges)

The reconcile commit says "Live snapshot read from GitHub at reconcile time (2026-08-04)", but the In-PR section captures a stale state.

## Fix

Before merging #899, edit §2 to move #895 and #894 to §1 (Done), with a note like:
```
- **Vault SLICE-3:** backfill ApiCredential + flip resolve() to vault-first (#895, merged 2026-08-04).
- **Smart Wizard fix prompts:** SLICE 1-3 staged (#894, merged 2026-08-04).
```

Update §2 header to reflect the current count (now 3 open: #896, #897, #899 itself).

## Rationale

This avoids re-firing the entire reconcile prompt for a one-row correction and keeps the roadmap document accurate before it lands on main.
