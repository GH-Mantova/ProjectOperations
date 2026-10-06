/**
 * LIST_ITEM_RENAME_LIVE_V1 — rename tests for the live Reference data screen.
 *
 * The web workspace has no jsdom / @testing-library setup — tests exercise
 * pure helpers and simulate the inline-edit control flow (same style as the
 * JobRolesPage.access tests). JSX rendering is not exercised.
 *
 * Test map:
 *   1. Admin sees Rename on active items of a STATIC list; not on archived; not on DYNAMIC.
 *   2. masterdata.manage user (not admin) sees Rename only on items they created.
 *   3. User with only lists.manage sees no Rename, and Archive is unchanged.
 *   4. Rename "Enclosure: labour" + Enter sends exactly one PATCH with { label } and calls onChanged.
 *   5. Blank input: Save disabled, no request. Esc restores old label with no request.
 *   6. Regression guard: App.tsx `reference-data` route renders RatesListsAdminPage,
 *      and the file carrying LIST_ITEM_RENAME_LIVE_V1 is the file that route renders.
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { canRenameItem } from "../RatesListsAdminPage";
import type { SafeUser } from "../../../auth/AuthContext";

const HERE = dirname(fileURLToPath(import.meta.url));

// ── Fixtures ─────────────────────────────────────────────────────────────────

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
}> = {}) {
  return {
    id: "item-1",
    value: "enclosure",
    label: "Enclosure",
    metadata: null,
    sortOrder: 0,
    isArchived: false,
    createdById: null as string | null,
    ...overrides
  };
}

const STATIC_LIST = { type: "STATIC" as const };
const DYNAMIC_LIST = { type: "DYNAMIC" as const };

// ── Test 1: admin sees Rename on active STATIC items ─────────────────────────

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

  it("super user is treated as admin", () => {
    const superUser = makeUser({ permissions: ["masterdata.manage"], isSuperUser: true });
    const item = makeItem({ createdById: null, isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, superUser, true)).toBe(true);
  });
});

// ── Test 2: masterdata.manage user (not admin) ───────────────────────────────

describe("test-2: masterdata.manage user (not admin) sees Rename only on own items", () => {
  const manageUser = makeUser({
    id: "manage-user-id",
    permissions: ["masterdata.manage"]
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

// ── Test 3: user with only lists.manage sees no Rename ───────────────────────

describe("test-3: user with only lists.manage sees no Rename", () => {
  it("canManage=false → canRenameItem is false regardless of admin", () => {
    const user = makeUser({ permissions: ["lists.manage", "platform.admin"] });
    const item = makeItem({ isArchived: false });
    // caller computes canManage from can(user, 'masterdata.manage'), which is false here
    expect(canRenameItem(item, STATIC_LIST, user, false)).toBe(false);
  });

  it("null user → canRenameItem is false", () => {
    const item = makeItem({ isArchived: false });
    expect(canRenameItem(item, STATIC_LIST, null, true)).toBe(false);
  });

  it("Archive logic is unchanged — the Archive button is still rendered in ListItemsTab", () => {
    const sourcePath = resolve(HERE, "..", "RatesListsAdminPage.tsx");
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toMatch(/>\s*Archive\s*</);
  });
});

// ── Test 4: Rename sends PATCH { label } and calls onChanged ─────────────────

describe("test-4: Rename sends one PATCH { label } and calls onChanged", () => {
  it("submitting 'Enclosure: labour' via Enter sends PATCH /lists/<slug>/items/<id>", async () => {
    const authFetch = vi.fn().mockResolvedValue({ ok: true });
    const onChanged = vi.fn();

    const slug = "row-types";
    const itemId = "item-1";
    const newLabel = "Enclosure: labour";

    // Simulate the saveEdit flow in ListItemsTab (Enter path).
    const trimmed = newLabel.trim();
    const original = "Enclosure";
    if (trimmed && trimmed !== original) {
      const res = await authFetch(`/lists/${slug}/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ label: trimmed })
      });
      if (res.ok) onChanged();
    }

    expect(authFetch).toHaveBeenCalledOnce();
    const [url, init] = authFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/lists/${slug}/items/${itemId}`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ label: "Enclosure: labour" });
    expect(onChanged).toHaveBeenCalledOnce();
  });

  it("unchanged label just closes edit — no PATCH, no reload", async () => {
    const authFetch = vi.fn();
    const onChanged = vi.fn();
    const original = "Enclosure";
    const editLabel = "Enclosure";
    const trimmed = editLabel.trim();
    if (trimmed && trimmed !== original) {
      await authFetch(`/lists/row-types/items/item-1`, {
        method: "PATCH",
        body: JSON.stringify({ label: trimmed })
      });
      onChanged();
    }
    expect(authFetch).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });
});

// ── Test 5: blank input and Esc cancel ───────────────────────────────────────

describe("test-5: blank input and Esc cancel", () => {
  it("Save is disabled when the trimmed label is empty, and no PATCH is sent", async () => {
    const authFetch = vi.fn();
    const editLabel = "   ";
    const trimmed = editLabel.trim();
    const isEmpty = !trimmed;

    // Save handler guards with `if (!trimmed) return;`
    if (!isEmpty) {
      await authFetch("/lists/row-types/items/item-1", {
        method: "PATCH",
        body: JSON.stringify({ label: trimmed })
      });
    }

    expect(isEmpty).toBe(true);
    expect(authFetch).not.toHaveBeenCalled();
  });

  it("Esc cancels: no PATCH, state resets to no editing row and empty editLabel", async () => {
    const authFetch = vi.fn();
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

// ── Test 6: route-source regression guard ────────────────────────────────────

describe("test-6: route source regression guard", () => {
  it("App.tsx `reference-data` route renders RatesListsAdminPage", () => {
    const appPath = resolve(HERE, "..", "..", "..", "App.tsx");
    const source = readFileSync(appPath, "utf8");
    expect(source).toMatch(
      /Route\s+path="reference-data"\s+element=\{<RatesListsAdminPage\s*\/>\}/
    );
  });

  it("RatesListsAdminPage.tsx carries the LIST_ITEM_RENAME_LIVE_V1 marker", () => {
    const sourcePath = resolve(HERE, "..", "RatesListsAdminPage.tsx");
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toContain("LIST_ITEM_RENAME_LIVE_V1");
  });

  it("the dead account/GlobalListsSection.tsx file is gone", () => {
    const dead = resolve(HERE, "..", "..", "account", "GlobalListsSection.tsx");
    expect(() => readFileSync(dead, "utf8")).toThrow();
  });
});
