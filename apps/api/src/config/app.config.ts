import { registerAs } from "@nestjs/config";

const DEFAULT_CORS_ORIGIN = "http://localhost:5173";

export function parseCorsOrigin(raw: string | undefined): string[] {
  if (raw === undefined) {
    return [DEFAULT_CORS_ORIGIN];
  }

  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return parsed.length > 0 ? parsed : [DEFAULT_CORS_ORIGIN];
}

export const appConfig = registerAs("app", () => ({
  // Azure App Service injects PORT; API_PORT remains the local-dev override.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  corsOrigin: parseCorsOrigin(process.env.CORS_ORIGIN),
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public"
}));
