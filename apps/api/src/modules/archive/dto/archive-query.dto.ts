import { Transform } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

/**
 * Query parameters for `GET /archive`. All fields are optional; pagination
 * defaults to page 1, pageSize 20 (capped at 100). Numeric fields use
 * `class-transformer` to coerce inbound string querystring values into
 * numbers before validation.
 */
export class ArchiveQueryDto {
  /** Free-text match against job number, job name, or client name (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  /** Restrict to jobs belonging to a specific client. */
  @IsOptional()
  @IsString()
  clientId?: string;

  /**
   * Calendar year filter. Matches `closeout.archivedAt` when set, otherwise
   * `closeout.createdAt` — keeps closed-but-not-yet-archived jobs visible in
   * the year they were closed.
   */
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === "" ? undefined : Number(value)))
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  /**
   * Closeout-status scope. `ALL` (default) and `CLOSED` both return CLOSED
   * and ARCHIVED jobs; `ARCHIVED` is stricter and requires a non-null
   * `closeout.archivedAt`.
   */
  @IsOptional()
  @IsString()
  status?: "CLOSED" | "ARCHIVED" | "ALL";

  /** 1-indexed page number. Defaults to 1. */
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  /** Items per page. Defaults to 20, capped at 100. */
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 20))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;
}
