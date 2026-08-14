import type { Request } from "express";

export type AuthenticatedUser = {
  sub: string;
  email: string;
  permissions: string[];
  isSuperUser?: boolean;
  /** MT-2: active tenant for this session. null = no tenant (fail-closed to shared-only). */
  tenantId?: string | null;
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
