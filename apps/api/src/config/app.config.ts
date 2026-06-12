import { registerAs } from "@nestjs/config";

export const appConfig = registerAs("app", () => ({
  // Azure App Service injects PORT; API_PORT remains the local-dev override.
  port: Number(process.env.PORT ?? process.env.API_PORT ?? 3000),
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public"
}));
