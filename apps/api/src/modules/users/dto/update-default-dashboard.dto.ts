import { IsOptional, IsString, ValidateIf } from "class-validator";

/**
 * Payload for `PATCH /users/me/default-dashboard`.
 *
 * `dashboardId` may be a Dashboard id to opt into that dashboard, or
 * `null` to clear the personal default and fall back to the global
 * "Home" dashboard. Marco 2026-07-15: per-user only — no role/module
 * mappings.
 */
export class UpdateDefaultDashboardDto {
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  dashboardId!: string | null;
}
