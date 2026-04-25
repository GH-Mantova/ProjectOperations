import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

// Canonical pagination DTO. Both `pageSize` and `limit` are accepted: when
// `limit` is provided it wins over `pageSize`, so newer callers using the
// `limit` convention work alongside older callers using `pageSize`. Both are
// capped at 100 — a frontend asking for `limit=200` hits the validator with
// a clear error rather than silently truncating.
export class PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => Number(value ?? 1))
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Transform(({ value, obj }) => {
    const limit = (obj as Record<string, unknown>).limit;
    if (limit !== undefined && limit !== null && limit !== "") {
      const parsed = Number(limit);
      if (Number.isFinite(parsed)) return parsed;
    }
    return Number(value ?? 10);
  })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 10;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : Number(value)
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
