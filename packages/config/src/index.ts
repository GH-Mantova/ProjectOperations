export const sharedEnv = {
  apiPrefix: process.env.API_PREFIX ?? "api/v1",
  apiPort: Number(process.env.API_PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public"
};

export type SharedEnv = typeof sharedEnv;
