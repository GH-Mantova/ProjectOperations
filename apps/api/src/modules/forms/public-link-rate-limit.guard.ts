import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable
} from "@nestjs/common";
import type { Request } from "express";

/**
 * Sliding-window in-memory rate limiter for the unauthenticated public-link
 * submit endpoints.  Keyed by client IP + token.
 *
 * Limits: 30 submits per IP per token per 60-second window.
 * For multi-instance horizontal scale, swap the Map for a Redis counter.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

// Module-level singleton map so state persists across requests.
const buckets = new Map<string, Bucket>();

@Injectable()
export class PublicLinkRateLimitGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const token = (req.params as Record<string, string | undefined>)["token"] ?? "unknown";
    const key = `${ip}::${token}`;
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
