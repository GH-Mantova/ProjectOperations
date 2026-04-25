import type { Request } from "express";

export type PortalUserPayload = {
  sub: string;
  email: string;
  clientId: string;
  type: "portal";
};

export type PortalAuthenticatedRequest = Request & {
  portalUser?: PortalUserPayload;
};
