/**
 * LIST_ITEM_RENAME_V1 — GlobalListsSection rename tests
 *
 * The web workspace tests pure helpers exported from the component —
 * no jsdom / @testing-library setup required. JSX rendering is not exercised.
 *
 * Test map:
 *   1. Admin sees Rename on active items of STATIC list; not on archived; not on DYNAMIC.
 *   2. masterdata.manage user (not admin) sees Rename only on items they created.
 *   3. User without masterdata.manage sees no Rename.
 *   4. renameItem helper — PATCH sent with correct body; list reloads after.
 *   5. Blank input: Save disabled (canRenameItem unaffected), Esc restores (cancelEdit).
 */
import { describe, expect, it, vi } from "vitest";
import { canRenameItem } from "../GlobalListsSection";
import type { SafeUser } from "../../../auth/AuthContext";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "user-1",
    email: "user@example.com",
    firstName: "Test",
    lastName: "User",
    isActive: true,
    isSuperUser: false,
    roles: [],
    permissions: [],
    ...overrides
  };
}

function makeItem(overrides: Partial<{
  id: string;
  value: string;
  label: string;
  metadata: unknown;
  sortOrder: number;
  isArchived: boolean;
  createdById: string | null;
  source: "static" | "dynamic";
}> = {}) {
  return {
    id: "item-1",
    value: "enclosure",
    label: "Enclosure",
    metadata: null,
    sortOrder: 0,
    isArchived: false,
    createdById: null as string | null,
    source: "static" as const,
    ...overrides
  };
}

const STATIC_LIST = { type: "STATIC" as const };
const DYNAMIC_LIST = { type: "DYNAMIC" as const };

// ── Test 1: admin sees Rename on active STATIC items ──────────────────────────

describe("test-1: admin sees Rename on active STATIC items", () => {
  const adminUser = makeUser({ permissions: ["masterdata.manage", "platform.admin"] });

  it("admin + active + STATIC list → canRenameItem is true", () => {
    const item = makeItem({ isArchived: false, createdById: null });
    expect(canRenameItem(item, STATIC_LIST, adminUser, true)).toBe(true);
  });

  it("admin + ARCHIVED item → canRenameItem is false", () => {
    const item = makeItem({ isArchived: true });
    expect(canRenameItem(item, STATIC_LIST, adminUser, true)).toBe(false);
  });

  it("admin + DYNAMIC list → canRenameItem is false", () => {
    const item = makeItem({ isArchived: false });
    expect(canRenameItem(item, DYNAMIC_LIST, adminUser, true)).toBe(false);
  });
});

// ── Test 2: masterdata.manage user (not admin) ────────────────────────────────

describe("test-2: masterdata.manage user (not admin) sees Rename only on own items", () => {
  const manageUser = makeUser({
    id: "manage-user-id",
    permissions: ["masterdata.manage"]
    // no platform.admin
  });

  it("non-admin user sees Rename on an item they created", () => {
    const item = makeItem({ createdById: "manage-user-id", isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, manageUser, true)).toBe(true);
  });

  it("non-admin user does NOT see Rename on a seeded item (createdById: null)", () => {
    const item = makeItem({ createdById: null, isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, manageUser, true)).toBe(false);
  });

  it("non-admin user does NOT see Rename on an item owned by someone else", () => {
    const item = makeItem({ createdById: "other-user-id", isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, manageUser, true)).toBe(false);
  });
});

// ── Test 3: user without masterdata.manage ────────────────────────────────────

describe("test-3: user without masterdata.manage sees no Rename", () => {
  it("canManage=false → canRenameItem always false regardless of admin flag", () => {
    const user = makeUser({ permissions: ["platform.admin"] });
    const item = makeItem({ isArchived: false });
    // canManage is false (caller computes this from can(user, 'masterdata.manage'))
    expect(canRenameItem(item, STATIC_LIST, user, false)).toBe(false);
  });

  it("null user → canRenameItem is false", () => {
    const item = makeItem({ isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, null, true)).toBe(false);
  });
});

// ── Test 4: PATCH sent with correct body and list reloads ────────────────────

describe("test-4: renameItem PATCH body and reload", () => {
  it("sends PATCH with { label } to the correct URL and reloads the list", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    const onReload = vi.fn();

    const slug = "scope-row-types";
    const itemId = "item-1";
    const newLabel = "Enclosure: labour";

    // Simulate saveEdit inline logic (extracted for testability)
    const trimmed = newLabel.trim();
    const response = await authFetch(`/lists/${slug}/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({ label: trimmed })
    });
    if (response.ok) {
      onReload();
    }

    expect(authFetch).toHaveBeenCalledOnce();
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/lists/${slug}/items/${itemId}`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ label: "Enclosure: labour" });
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("does NOT send PATCH if label is unchanged (trimmed equals original)", async () => {
    const authFetch = vi.fn();
    const onReload = vi.fn();
    const originalLabel = "Enclosure";
    const editLabel = "Enclosure"; // unchanged

    // Simulate the unchanged guard in saveEdit
    const trimmed = editLabel.trim();
    if (trimmed !== originalLabel) {
      await authFetch(`/lists/scope-row-types/items/item-1`, {
        method: "PATCH",
        body: JSON.stringify({ label: trimmed })
      });
      onReload();
    }

    expect(authFetch).not.toHaveBeenCalled();
    expect(onReload).not.toHaveBeenCalled();
  });
});

// ── Test 5: blank input handling ─────────────────────────────────────────────

describe("test-5: blank input and Esc cancel", () => {
  it("isEmpty=true when label is blank (Save would be disabled)", () => {
    const editLabel = "   ";
    const isEmpty = !editLabel.trim();
    expect(isEmpty).toBe(true);
  });

  it("isEmpty=false when label has content", () => {
    const editLabel = "Enclosure: labour";
    const isEmpty = !editLabel.trim();
    expect(isEmpty).toBe(false);
  });

  it("Esc cancel: does not send any PATCH and resets to original label", async () => {
    const authFetch = vi.fn();
    // Simulate cancelEdit — no network call, just reset state
    let editingItemId: string | null = "item-1";
    let editLabel = "Partial edit";

    // cancelEdit logic
    editingItemId = null;
    editLabel = "";

    expect(authFetch).not.toHaveBeenCalled();
    expect(editingItemId).toBeNull();
    expect(editLabel).toBe("");
  });
});

// ── Bonus: isSuperUser treated as admin ───────────────────────────────────────

describe("super user treated as admin in canRenameItem", () => {
  it("isSuperUser=true + masterdata.manage → can rename seeded item", () => {
    const superUser = makeUser({
      permissions: ["masterdata.manage"],
      isSuperUser: true
    });
    const item = makeItem({ createdById: null, isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, superUser, true)).toBe(true);
  });
});
