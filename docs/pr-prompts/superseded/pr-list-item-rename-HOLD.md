---
premise: '! grep -q "LIST_ITEM_RENAME_V1" apps/web/src/pages/account/GlobalListsSection.tsx'
premise_means: >-
  No list item in Settings, Reference data and Lists can be renamed. Each item row offers only
  archive (x) and the list offers Add. The API already supports it: PATCH /lists/:slug/items/:itemId
  takes { label }, gated on masterdata.manage, and admins can edit system-list items. Archiving and
  re-adding is not a substitute, because it creates a new value and existing records point at the
  old one. Marco hit this on 2026-10-03 trying to rename the Scope row types item "Enclosure" to
  "Enclosure: labour" (asbestos enclosure ruling, 2026-10-02). MEASURED at origin/main 292a29fd:
  GlobalListsSection.tsx has no edit control, and global-lists.service.ts updateItem trims the label
  but accepts an empty one.
design_ref: Claude Design/proposed/list-item-rename/list-item-rename-mockup.html
done_when: >-
  pnpm build && pnpm lint &&
  pnpm --filter @project-ops/api test -- global-lists &&
  pnpm --filter @project-ops/web test -- GlobalListsSection &&
  grep -q "LIST_ITEM_RENAME_V1" apps/web/src/pages/account/GlobalListsSection.tsx &&
  grep -q "LIST_ITEM_RENAME_V1" apps/api/src/modules/global-lists/global-lists.service.ts
scope:
  - apps/web/src/pages/account/GlobalListsSection.tsx
  - apps/web/src/pages/account/__tests__/GlobalListsSection.rename.test.tsx
  - apps/api/src/modules/global-lists/global-lists.service.ts
  - apps/api/src/modules/global-lists/global-lists.controller.ts
  - apps/api/src/modules/global-lists/__tests__/global-lists.rename.spec.ts
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Revert the PR. The Rename button disappears and the empty-label check is removed. Labels already
  renamed stay as renamed (plain data, no migration), and nothing reads them by label.
escalates: true
module: global-lists
---

> **SPENT AND SUPERSEDED 2026-10-04 (Station 06).** Built in #2242, but into `GlobalListsSection.tsx`, a component nothing renders, so the live Settings screen never got the button. Replaced by `pr-list-item-rename-live-screen-HOLD.md`. Do not arm.


# Rename a list item from Settings, Reference data and Lists

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Marco approved the mock-up and this spec on 2026-10-03. Tag new code with `LIST_ITEM_RENAME_V1`.
The approved mock-up is at the `design_ref` path (local and gitignored). Follow it; do not commit it.

## Web: `GlobalListsSection.tsx`

1. On each item row, show a **Rename** ghost button, before the x, only when all of these hold:
   - the list is `STATIC`;
   - the item is not archived;
   - the user holds `masterdata.manage`;
   - the user can edit this item: `can(user, "platform.admin")`, or `item.createdById === user.id`.
     This mirrors the server's `assertEditable`, so the screen never offers a control that will 403.
     If `SafeUser` does not expose the user id, use whatever field `AuthContext` provides and say
     which one.
2. Clicking Rename turns that row's label into a text input, prefilled and focused, with **Save**
   (primary) and **Cancel** buttons, and the hint
   `The value <value> stays the same, so existing records keep working.`
   Only one row is in edit mode at a time.
3. **Enter** saves and **Esc** cancels. With a blank or whitespace-only input, Save is disabled and
   the message `A label can't be empty.` is shown. If the label is unchanged, Save simply closes the
   edit.
4. Save sends `PATCH /lists/:slug/items/:itemId` with `{ label }` through `authFetch`. On success,
   reload the selected list. On error, keep the row in edit mode and show the API message with
   `readApiErrorMessage`, styled like the section's existing errors.
5. `value`, sort order and archive behaviour are untouched. Use s7 kit classes only: `s7-btn`,
   `s7-btn--ghost`, `s7-btn--primary`, `s7-btn--sm` and `s7-input`. No new colours.

## API: `global-lists.service.ts` and controller

- `updateItem`: if `dto.label` is provided and trims to empty, throw `BadRequestException`
  (`Label cannot be empty.`). Everything else stays as it is.
- **Super users.** `toActor` sets `isAdmin` from `platform.admin` only, while `PermissionsGuard`
  admits super users. Read `AuthenticatedUser`:
  - if it carries a super-user flag, treat it as admin in `toActor` too;
  - if it carries none, change nothing and say so in the PR body.

## Tests

**Web** (`GlobalListsSection.rename.test.tsx`, with a mocked `authFetch`):

1. An admin sees Rename on active items of a STATIC list. There is no Rename on an archived item
   or on a DYNAMIC list.
2. A user with `masterdata.manage` but not admin sees Rename only on items they created.
3. A user without `masterdata.manage` sees no Rename.
4. Rename, type `Enclosure: labour`, press Enter: one PATCH is sent with exactly
   `{ label: "Enclosure: labour" }` to the right slug and item, then the list reloads.
5. Blank input: Save is disabled and no request is sent. Esc restores the old label without a
   request.

**API** (`global-lists.rename.spec.ts`):

1. An admin renames a system-list item: label updated, value unchanged.
2. A whitespace-only label returns 400.
3. A non-admin renaming a seeded item (`createdById` null) gets 403.

## Note for Marco (put this in the PR body)

After this ships: Settings, then Reference data and Lists, then **Scope row types**, then **Rename**
on Enclosure, type `Enclosure: labour`, then Save. If the list says "Read-only, managed by
administrators", your login lacks `masterdata.manage`, and that is a separate role fix.

`escalates: true`: it adds a production data-editing control to a Settings screen. The PR opens
labelled `do-not-merge`, and Marco releases it.
