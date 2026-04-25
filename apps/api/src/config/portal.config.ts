import { registerAs } from "@nestjs/config";

export const portalConfig = registerAs("portal", () => ({
  publicUrl: process.env.PORTAL_PUBLIC_URL ?? process.env.CORS_ORIGIN ?? "http://localhost:5173"
}));
