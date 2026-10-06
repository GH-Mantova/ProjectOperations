---
premise: '! grep -q "LIST_ITEM_RENAME_LIVE_V1" apps/web/src/pages/admin/RatesListsAdminPage.tsx'
premise_means: >-
  #2242 (LIST_ITEM_RENAME_V1) put the Rename button into apps/web/src/pages/account/GlobalListsSection.tsx,
  which nothing renders: SLICE 6 moved Settings, Reference data and Lists to RatesListsAdminPage
  (App.tsx route "reference-data"), whose Lists tab draws its items table in ListItemsTab. Marco
  checked production at 6955021f on 2026-10-04 and found no Rename on the live screen. Station 06
  grounded #2230's spec on the wrong component. MEASURED at origin/main 6955021f: ListItemsTab offers
  only Add item and Archive. GlobalListsSection is referenced only in comments (App.tsx,
  UserProfilePage.tsx) and its own test.
design_ref: Claude Design/proposed/list-item-rename/list-item-rename-mockup.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter @project-ops/web test -- RatesListsAdminPage &&
  pnpm --filter @project-ops/api test -- global-lists &&
  grep -q "LIST_ITEM_RENAME_LIVE_V1" apps/web/src/pages/admin/RatesListsAdminPage.tsx &&
  ! test -f apps/web/src/pages/account/GlobalListsSection.tsx
scope:
  - apps/web/src/pages/admin/RatesListsAdminPage.tsx
  - apps/web/src/pages/admin/__tests__/RatesListsAdminPage.rename.test.tsx
  - apps/web/src/pages/account/GlobalListsSection.tsx
  - apps/web/src/pages/account/__tests__/GlobalListsSection.rename.test.tsx
  - apps/web/src/pages/account/UserProfilePage.tsx
  - apps/web/src/App.tsx
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Revert the PR. The Rename button leaves the live table and the dead GlobalListsSection comes back.
  No server or data change; the empty-label refusal from #2242 stays on the server either way.
escalates: true
module: admin
---

# Put Rename on the list items table Settings actually shows, and remove the dead copy

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Marco approved the v2 mock-up and this spec on 2026-10-04. Tag new code with
`LIST_ITEM_RENAME_LIVE_V1`. The server side is already done in #2242 (PATCH with `{ label }`, blank
label refused, super users count as admin). **Do not change the API.**

## 1. Live screen: `ListItemsTab` in `RatesListsAdminPage.tsx`

Copy the behaviour #2242 built in `GlobalListsSection.tsx` (read it on main first) into the items
table:

- **Where:** a **Rename** ghost button (`s7-btn s7-btn--ghost s7-btn--sm`, `minHeight: 32`) to the
  left of Archive, in the same cell.
- **When it shows:** only when all of these hold:
  - the list is not DYNAMIC;
  - the item is not archived;
  - the user holds `masterdata.manage`;
  - the user is an admin (`can(user, "platform.admin")`) or created the item. Use the same
    user-id field #2242 used.

  This is exactly #2242's rule, and it matches the server's `assertEditable`. Note that the page
  itself gates on `lists.manage`, but every list mutation on the server needs `masterdata.manage`.
  Keep Archive and Add exactly as they are.
- **Editing:** the Label cell becomes a prefilled, focused input, and the actions cell shows
  **Save** (primary) and **Cancel**. Under the input, show the hint
  `The value <value> stays the same, so existing records keep working.`
  - One row edits at a time.
  - Enter saves; Esc cancels.
  - A blank label disables Save and shows `A label can't be empty.`
  - An unchanged label just closes the edit.
- **Save:** send `PATCH /lists/:slug/items/:itemId` with `{ label }` through `authFetch`.
  - On success, call `onChanged()`.
  - On error, stay in edit mode and show the message through the tab's existing `ErrorBanner`,
    using `readApiErrorMessage`.

## 2. Remove the dead copy

1. Delete `apps/web/src/pages/account/GlobalListsSection.tsx` and its rename test. First confirm
   with `git grep -n "GlobalListsSection" -- apps/web/src` that only comments reference the
   component.
   - If anything imports or renders it, stop with BLOCKED and name the file.
   - Fix the two comments (App.tsx near the `reference-data` route, UserProfilePage.tsx) so they no
     longer point at a deleted file. They should say the Lists UI lives in `RatesListsAdminPage`.
2. Move any useful pure helper from the deleted file into `RatesListsAdminPage.tsx`, or into
   `ratesListsHelpers.ts` if a helper there fits better (add that file to the PR scope note).

## Tests: `RatesListsAdminPage.rename.test.tsx` (mocked `authFetch` and auth)

Render `ListItemsTab` directly, exporting it if needed, and cover:

1. An admin sees Rename on the active rows of a STATIC list. There is none on an archived row or on
   a DYNAMIC list.
2. A user with `masterdata.manage` who is not an admin sees Rename only on rows they created.
3. A user with only `lists.manage` sees no Rename, and Archive is unchanged.
4. Rename, type `Enclosure: labour`, press Enter: exactly one PATCH is sent to
   `/lists/row-types/items/<id>` with body `{ "label": "Enclosure: labour" }`, then `onChanged`
   is called.
5. Blank input: Save is disabled and no request is sent. Esc restores the old label with no request.
6. **Regression guard:** a source check that `App.tsx`'s `reference-data` route renders
   `RatesListsAdminPage`, and that the file containing `LIST_ITEM_RENAME_LIVE_V1` is the one that
   route renders.

## Note for Marco (put this in the PR body)

Once this ships:
1. Go to Settings → Reference data & Lists → Lists → **Scope row types**.
2. Click **Rename** on Enclosure.
3. Type `Enclosure: labour` and click Save.

If no Rename appears at all, your login lacks `masterdata.manage` or admin; that is a role fix, not
a code fix.

`escalates: true`: it adds a production data-editing control. The PR opens labelled `do-not-merge`,
and Marco releases it.
