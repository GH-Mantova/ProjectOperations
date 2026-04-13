import type { Request } from "express";

export type AuthenticatedUser = {
  sub: string;
  email: string;
  permissions: string[];
};

export type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
