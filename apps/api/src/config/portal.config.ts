import { registerAs } from "@nestjs/config";
import { parseCorsOrigin } from "./app.config";

export const portalConfig = registerAs("portal", () => ({
  publicUrl: process.env.PORTAL_PUBLIC_URL ?? parseCorsOrigin(process.env.CORS_ORIGIN)[0]
}));
