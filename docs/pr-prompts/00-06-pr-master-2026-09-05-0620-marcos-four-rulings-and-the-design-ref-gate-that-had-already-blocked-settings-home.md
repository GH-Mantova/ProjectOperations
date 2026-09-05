# Station 06 — 2026-09-05 06:20Z — Marco's four rulings, and the design_ref gate that had already blocked Settings Home

## GROUND

Interactive run, Marco present. Station 06 designs and STAGES; it never arms and never merges.
Marco ruled on four open items at ~06:0xZ and approved staging the result.

Prior artefacts of this run: PR #1643 (merged 05:41Z), PR #1656 (open, AR-S2 correction), and
three published pages — `330c3e98` Theme Builder, `524ef7db` Settings Home, `7c395739` Theme System.

## WHAT I MEASURED

**The two "ungated" routes are not a security defect.** I raised them at 05:15Z as possibly ungated
admin screens. Measured properly:

| page | guard | permission |
|---|---|---|
| Schedule of Rates | `ScheduleOfRatesAdminPage.tsx:319` computes `can(user, "rates.manage")`; `:514` returns `<NoAccess required="rates.manage" />` | `rates.manage` |
| Job roles | no check in the page; `job-roles.controller.ts:21` applies `PermissionsGuard`, `:26` requires `resources.view`, `:43/:53/:63` require `resources.manage` | `resources.view` |

Neither route carries `RequirePermissions` in `App.tsx` (`:613`, `:377`), but the guards exist a
layer down. **No data is exposed.** I escalated on a partial measurement — the route table — and
should have read the component and the controller before using the word ungated.

**Job roles has a worse defect than the one I named.** `JobRolesPage.tsx` `load()` reads
`rolesRes.ok ? await rolesRes.json() : []`. A 403 becomes an empty array, so the page renders an
empty table: not "you cannot see this" but "there are none". That is a false statement about the
data, and it is precisely the failure `NoAccess.tsx` was written to end — its own header cites the
2026-07-13 Rates & Lists incident and sot/01 SECTION 6.

**`pr-settings-home-s1` could not have been armed today, for a reason unrelated to the routes.**
It has no `design_ref`, and VS-S3's gate now REJECTs any prompt whose scope touches `apps/web/`
without one (`lint-prompt.mjs:279`). It had no `design_ref` because its design was a PDF in a
Downloads folder — there was no URL to cite. Publishing `524ef7db` is what makes the prompt armable.
The blindness and the blocker turned out to be the same fact.

## WHAT CHANGED

Nothing in the repository yet. Staged for Marco to arm:

| file | change |
|---|---|
| `pr-settings-home-s1-cards-tabs-counts-HOLD.md` | `design_ref: …524ef7db` added; the two route permissions replaced with `rates.manage` / `resources.view` and the measurement that justifies them; CRM drop reasons given Marco's approved copy, taking the table to 20 of 20 |
| `pr-jobroles-s1-noaccess-instead-of-a-dead-shell-HOLD.md` | **new**, size 2 — read gate, write gate, and stop swallowing a failed read |
| `pr-artifactregister-s2-name-what-is-missing-HOLD.md` | third row for `7c395739`; the theme-system entry moves from Open to Published |

All three lint **ADMIT**, exit 0 (sizes 5, 2, 1). Every scoped path was existence-checked.

## FINDINGS

1. **My 05:15 escalation was over-stated.** "Two ungated admin screens" was drawn from the route
   table alone; the guards are in the component and the API. **ACTIONED** — corrected to Marco in
   chat before he ruled, and the settings-home prompt now carries the measurement rather than the
   alarm.

2. **The real Job roles defect is a lie about data, not an exposure.** An empty table where a 403
   occurred. **ACTIONED** — `pr-jobroles-s1` staged, with a test that asserts no fetch is made at
   all for an unpermitted user, because a markup-only assertion would pass on a page that still
   called the API first.

3. **A design that exists only as a PDF cannot satisfy `design_ref`, so it silently freezes its own
   slice.** `pr-settings-home-s1` sat unarmable and nothing said so. **ACTIONED** — published and
   cited. This is the second-order cost of the unpublished-mock-up problem AR-S2 documents, and it
   is worth stating in the register's rule: publishing is not tidiness, it is what makes the work
   runnable.

4. **`resources.manage` write-gating was not in anyone's brief.** A user with `resources.view` but
   not `resources.manage` is currently offered Edit, Delete and "+ New role" controls that 403 on
   click. **ACTIONED** — folded into `pr-jobroles-s1` as the same defect class, in the same file.

5. **CRM drop reasons is no longer a guess.** Marco approved the line 2026-09-05, so the
   approved-copy table is 20 of 20 and the VERIFY block's `! grep -q "GUESS"` can now pass.
   **ACTIONED**.

## WHAT I DID NOT DO

- I did not arm anything and I did not merge anything. All three prompts are `-HOLD.md`.
- I did not touch `apps/api/**`. The job-roles controller is already correct and is the evidence
  this work rests on; changing it would destroy the ground.
- I did not add a permission check to `JobRolesPage.tsx` inside the settings-home slice, and I said
  so explicitly in that prompt so the two slices cannot collide.
- I did not edit `NoAccess.tsx` or design a variant of it.
- I did not invent a permission anywhere. Both codes are read from the controller and the page.
- I did not alter `theme-system-mockup.html`'s colours, tokens, layout or copy when publishing it;
  the three hosting fixes are listed in the published page's own footer.
- I did not move, rename or delete anything in `C:\Users\Marco\Downloads`.
