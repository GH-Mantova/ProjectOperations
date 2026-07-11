import type { SafeUser } from "./AuthContext";

export function can(user: SafeUser | null | undefined, code: string): boolean {
  if (!user) return false;
  return user.isSuperUser === true || user.permissions.includes(code);
}

export function canAny(user: SafeUser | null | undefined, ...codes: string[]): boolean {
  return codes.some((c) => can(user, c));
}

export function isAdminUser(user: SafeUser | null | undefined): boolean {
  if (!user) return false;
  return user.isSuperUser === true || (user.roles?.some((r) => r.name === "Admin") ?? false);
}
