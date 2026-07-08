import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import type { Response } from "express";
import { Observable, from } from "rxjs";
import { switchMap } from "rxjs/operators";
import type { AuthenticatedRequest } from "../../common/auth/authenticated-request.interface";
import { ClientVersionsService } from "./client-versions.service";

@Injectable()
export class ClientVersionInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ClientVersionInterceptor.name);

  constructor(private readonly service: ClientVersionsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const res = context.switchToHttp().getResponse<Response>();

    res.setHeader("X-Server-Version", this.service.serverVersion());

    const userId = req.user?.sub;
    if (!userId) return next.handle();

    const clientVersion = (req.headers["x-client-version"] as string | undefined) ?? undefined;
    const userAgent = req.headers["user-agent"];

    return from(
      this.service
        .recordSighting(userId, clientVersion, userAgent)
        .catch((err) => {
          this.logger.warn(`recordSighting failed: ${(err as Error).message}`);
          return { skipped: true, updateRequested: false } as const;
        })
    ).pipe(
      switchMap((result) => {
        if (result.updateRequested) res.setHeader("X-Update-Requested", "1");
        return next.handle();
      })
    ) as Observable<unknown>;
  }
}
