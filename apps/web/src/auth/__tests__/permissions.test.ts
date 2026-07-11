import { describe, expect, it } from "vitest";
import { can, canAny, isAdminUser } from "../permissions";
import type { SafeUser } from "../AuthContext";

function makeUser(overrides: Partial<SafeUser> = {}): SafeUser {
  return {
    id: "u-1",
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

describe("can", () => {
  it("returns false for a null/undefined user", () => {
    expect(can(null, "rates.manage")).toBe(false);
    expect(can(undefined, "rates.manage")).toBe(false);
  });

  it("returns true for a super-user regardless of the code, even with empty permissions", () => {
    const su = makeUser({ isSuperUser: true, permissions: [] });
    expect(can(su, "rates.manage")).toBe(true);
    expect(can(su, "any.arbitrary.code")).toBe(true);
  });

  it("honors the permissions array exactly for a non-super-user", () => {
    const u = makeUser({ permissions: ["rates.manage"] });
    expect(can(u, "rates.manage")).toBe(true);
    expect(can(u, "lists.manage")).toBe(false);
  });
});

describe("canAny", () => {
  it("returns true when any of the codes match", () => {
    const u = makeUser({ permissions: ["estimates.view"] });
    expect(canAny(u, "estimates.view", "estimates.admin")).toBe(true);
  });

  it("returns false when none of the codes match", () => {
    const u = makeUser({ permissions: ["something.else"] });
    expect(canAny(u, "estimates.view", "estimates.admin")).toBe(false);
  });

  it("returns true for super-user even with no codes matching the permissions array", () => {
    const su = makeUser({ isSuperUser: true, permissions: [] });
    expect(canAny(su, "estimates.view", "estimates.admin")).toBe(true);
  });

  it("returns false for a null user", () => {
    expect(canAny(null, "a", "b")).toBe(false);
  });
});

describe("isAdminUser", () => {
  it("returns false for null/undefined", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(undefined)).toBe(false);
  });

  it("returns true for super-user even without the Admin role", () => {
    const su = makeUser({ isSuperUser: true, roles: [] });
    expect(isAdminUser(su)).toBe(true);
  });

  it("returns true when the user has a role named 'Admin'", () => {
    const u = makeUser({ roles: [{ id: "r-1", name: "Admin" }] });
    expect(isAdminUser(u)).toBe(true);
  });

  it("returns false for a non-super-user without the Admin role", () => {
    const u = makeUser({ roles: [{ id: "r-2", name: "ProjectManager" }] });
    expect(isAdminUser(u)).toBe(false);
  });
});
