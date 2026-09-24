/**
 * Detects whether the API is running in a production runtime.
 *
 * Returns true when:
 *   - NODE_ENV is "production", OR
 *   - WEBSITE_SITE_NAME is set to a non-empty string (Azure App Service always
 *     sets this, so it guards the production log-suppression path even if
 *     NODE_ENV was not explicitly set to "production").
 *
 * A1 (secret check) and A2 (email delivery) both reuse this function.
 * Do not move or rename it.
 */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") return true;
  const siteName = env.WEBSITE_SITE_NAME;
  return typeof siteName === "string" && siteName.length > 0;
}
