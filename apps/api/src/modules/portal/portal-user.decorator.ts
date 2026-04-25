import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { PortalAuthenticatedRequest, PortalUserPayload } from "./portal-auth.types";

export const PortalUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): PortalUserPayload => {
    const request = ctx.switchToHttp().getRequest<PortalAuthenticatedRequest>();
    if (!request.portalUser) {
      throw new Error("Portal user not attached to request.");
    }
    return request.portalUser;
  }
);
