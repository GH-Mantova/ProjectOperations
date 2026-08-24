# BREADCRUMB — NAV-5's replacement block now carries a STALE group 7

**Station 05 SoT-Keeper · 2026-08-24 (UTC) · base `origin/main c17a8bb6`**

This is a **tracked** breadcrumb, committed in the SLICE 20 doc-reconcile PR. It is deliberately not
a local-only note: 16 breadcrumbs sit untracked on disk and no clean worktree can read any of them,
so writing one to disk is not reporting.

## What changed

SLICE 20 (`docs/audits/settings-restructure-sot-reconcile.md`) has **rewritten group 7 (SETTINGS)**
of `sot/01` SECTION 9 — new routes, new per-screen permission codes, `Job roles` moved out to HR.

## Why that matters to NAV-5

`docs/pr-prompts/pr-sot-01-nav5-reconcile-2026-08-20-HOLD.md` is a whole-block **FIND and REPLACE**
over the same fenced code block. Its replacement text embeds group 8/SETTINGS **verbatim as it read
on 2026-08-20**:

```
8. SETTINGS  (role-gated)
   Personal:            Account | Notifications | Calendar sync
   Company:             Company | AI Settings | Data Model
   Administration (admin/super only):
                        Users | Roles | Permissions | Audit | Platform | Job Roles
```

That is now the **old** text. Running NAV-5 unchanged would **silently revert SLICE 20** and put the
retired `Job Roles` entry and the retired blanket `admin/super only` guard back into the charter.
NAV-5's own body says group 8 is SLICE 20's and must not be touched by NAV-5 — which is correct in
intent, but its literal replacement string does touch it.

## Required before NAV-5 is armed

Whoever arms NAV-5 must first **re-copy group 7 from `main` into NAV-5's replacement block**
(renumbering it to `8.` as NAV-5 intends, since NAV-5 inserts the CRM group above it). NAV-5's
`done_when` does not test group 7/8, so **CI will not catch this** — the regression would land green.

Not fixed here: editing a staged prompt is queue work (Station 04 / 06), not Station 05's, and the
standing arming hold means NAV-5 is not going to run before someone reads this.

## Second, unrelated observation carried forward from NAV-5

NAV-5 records that `ShellLayout.tsx` sets `to: "operations/assets-equipment"` with **no leading
slash**, unlike every other nav entry. Re-measured 2026-08-24 at `origin/main c17a8bb6`: still true,
now at `ShellLayout.tsx:300`. It is a sub-group toggle rather than a route, so it may be deliberate —
but the line number in NAV-5 (`:134`) is stale and would send a reader to the wrong place.
