import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.interface";
import { getPersonaBySlug } from "./persona-registry";

@Injectable()
export class PersonaPermissionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const slug = request.params?.slug;

    if (!slug || typeof slug !== "string") {
      throw new NotFoundException("Persona not found");
    }

    const persona = getPersonaBySlug(slug);
    if (!persona) {
      throw new NotFoundException("Persona not found");
    }

    if (request.user?.isSuperUser) {
      return true;
    }

    const granted = new Set(request.user?.permissions ?? []);
    if (!granted.has(persona.permissionRequired)) {
      throw new ForbiddenException(`Missing required permission: ${persona.permissionRequired}`);
    }

    return true;
  }
}
