// Read at request time (resolvable functions) rather than at decorator
// evaluation, because decorators run at import time — before ConfigModule
// has loaded .env into process.env.
function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const AUTH_THROTTLE_DEFAULTS = {
  ttlSeconds: 60,
  loginLimit: 5,
  refreshLimit: 30
} as const;

export const authThrottleTtlMs = () =>
  readPositiveInt("AUTH_THROTTLE_TTL", AUTH_THROTTLE_DEFAULTS.ttlSeconds) * 1000;

export const authThrottleLoginLimit = () =>
  readPositiveInt("AUTH_THROTTLE_LIMIT", AUTH_THROTTLE_DEFAULTS.loginLimit);

export const authThrottleRefreshLimit = () =>
  readPositiveInt("AUTH_THROTTLE_REFRESH_LIMIT", AUTH_THROTTLE_DEFAULTS.refreshLimit);

export const AUTH_THROTTLE_ERROR_MESSAGE =
  "Too many requests. Please wait before trying again.";

// Same client-IP resolution as PortalRateLimitGuard: behind the Azure front
// end req.ip is the proxy address, so prefer the first X-Forwarded-For hop.
export const authThrottleTracker = (req: {
  headers?: Record<string, unknown>;
  ip?: string;
  socket?: { remoteAddress?: string };
}) =>
  (req.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
  req.ip ||
  req.socket?.remoteAddress ||
  "unknown";
