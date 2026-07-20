// PR fix/admin-nav-parity-and-orphan-routes — QA S3-018 / S3-021.
//
// The admin nav group used to be gated on a literal "Admin" role name — so a
// super-user without that role saw ZERO admin links, even though every one of
// the linked pages renders for them (PR #537 fixed the pages, this fixes the
// sidebar). And three routes (/admin/company, /tenders/contacts,
// /tenders/settings) shipped without any link. These tests lock in both fixes.

import { describe, expect, it } from "vitest";
import type { SafeUser } from "../../auth/AuthContext";
import { isAdminUser } from "../../auth/permissions";
import { NAV_GROUPS } from "../ShellLayout";

function fakeUser(overrides: Partial<SafeUser>): SafeUser {
  return {
    id: "u1",
    email: "u@example.com",
    firstName: "U",
    lastName: "One",
    isActive: true,
    isSuperUser: false,
    roles: [],
    permissions: [],
    ...overrides
  } as SafeUser;
}

describe("ShellLayout admin gate (QA S3-018)", () => {
  it("super-user WITHOUT the Admin role sees the admin group", () => {
    const superUser = fakeUser({ isSuperUser: true, roles: [] });
    expect(isAdminUser(superUser)).toBe(true);
  });

  it("user WITH the Admin role sees the admin group", () => {
    const admin = fakeUser({ roles: [{ id: "r1", name: "Admin" }] });
    expect(isAdminUser(admin)).toBe(true);
  });

  it("planner (no Admin role, not super-user) does not see the admin group", () => {
    const planner = fakeUser({ roles: [{ id: "r2", name: "Planner" }] });
    expect(isAdminUser(planner)).toBe(false);
  });

  it("null user does not see the admin group", () => {
    expect(isAdminUser(null)).toBe(false);
  });
});

describe("ShellLayout nav — orphaned routes are reachable (QA S3-021)", () => {
  const allItems = NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ groupId: group.id, ...item }))
  );

  it("Company Profile is linked from the admin group", () => {
    const item = allItems.find((i) => i.to === "/admin/company");
    expect(item).toBeDefined();
    expect(item?.groupId).toBe("admin");
    expect(item?.label).toBe("Company Profile");
  });

  it("Tender Contacts is linked from the commercial group", () => {
    const item = allItems.find((i) => i.to === "/tenders/contacts");
    expect(item).toBeDefined();
    expect(item?.groupId).toBe("commercial");
    expect(item?.label).toBe("Tender Contacts");
  });

  it("Tendering Settings is linked from the commercial group", () => {
    const item = allItems.find((i) => i.to === "/tenders/settings");
    expect(item).toBeDefined();
    expect(item?.groupId).toBe("commercial");
    expect(item?.label).toBe("Tendering Settings");
  });

  it("the admin group is still the only adminOnly group", () => {
    const adminOnly = NAV_GROUPS.filter((group) => group.adminOnly);
    expect(adminOnly.map((g) => g.id)).toEqual(["admin"]);
  });

  it("the /tenders 'Tendering' match rule does not swallow the two new sub-routes (active-state isolation)", () => {
    const tendering = allItems.find((i) => i.to === "/tenders" && i.label === "Tendering");
    expect(tendering).toBeDefined();
    expect(tendering?.match).toBeDefined();
    expect(tendering!.match!("/tenders")).toBe(true);
    expect(tendering!.match!("/tenders/contacts")).toBe(false);
    expect(tendering!.match!("/tenders/settings")).toBe(false);
  });
});
