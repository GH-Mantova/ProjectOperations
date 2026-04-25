import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from "@nestjs/common";
import type { Request } from "express";

// Sliding-window in-memory rate limiter for unauthenticated portal endpoints.
// Keyed by client IP + route. Suitable for single-instance deployments; behind
// a load balancer with sticky sessions or per-tenant routing it remains useful
// as a per-instance throttle. For multi-instance horizontal scale, replace the
// Map with a Redis-backed counter.

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;
const buckets = new Map<string, Bucket>();

@Injectable()
export class PortalRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${ip}::${req.method}::${req.path}`;
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || existing.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return true;
    }

    existing.count += 1;
    if (existing.count > MAX_REQUESTS) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      throw new HttpException(
        { message: "Too many requests. Please try again later.", retryAfter },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }
}
