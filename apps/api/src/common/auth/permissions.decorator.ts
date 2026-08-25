import { SetMetadata } from "@nestjs/common";

export const REQUIRED_PERMISSIONS_KEY = "required_permissions";
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

// Separate key so PermissionsGuard can distinguish the OR semantics from the
// AND semantics above.  Do NOT reuse REQUIRED_PERMISSIONS_KEY — the guard reads
// both keys independently and the two sets must stay distinguishable.
export const ANY_PERMISSIONS_KEY = "any_permissions";
export const RequireAnyPermission = (...permissions: string[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
