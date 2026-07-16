import {
  IsArray,
  IsDateString,
  IsNumberString,
  IsOptional,
  IsString
} from "class-validator";

/**
 * Request body for `POST /projects/:projectId/daily-diary` — creates the
 * one-and-only diary row for the given (projectId, date). The unique
 * constraint on the DB will reject a duplicate; the service maps that to a
 * 409. All narrative fields are optional so the site team can save early and
 * fill in later before `submittedAt`.
 */
export class CreateDailyDiaryDto {
  /** ISO calendar date. The DB column is DATE so time-of-day is discarded. */
  @IsDateString()
  date!: string;

  /** Optional `Site` FK — usually inferred from the project but kept overridable. */
  @IsOptional() @IsString()
  siteId?: string;

  /** Free-text weather summary (e.g. "Overcast, showers PM"). */
  @IsOptional() @IsString()
  weather?: string;

  /** Ambient temperature in °C, decimal string, one decimal place. */
  @IsOptional() @IsNumberString()
  temperatureC?: string;

  /** One-line crew summary (headcount / roles / subbies on site). */
  @IsOptional() @IsString()
  crewSummary?: string;

  /** One-line plant summary (assets on site + status). */
  @IsOptional() @IsString()
  plantOnSite?: string;

  /** Deliveries received (materials, quantities, supplier). */
  @IsOptional() @IsString()
  deliveries?: string;

  /** Visitors on site (name, company, purpose, times). */
  @IsOptional() @IsString()
  visitors?: string;

  /** Delays / disruptions / stand-downs — the dispute-defence field. */
  @IsOptional() @IsString()
  delays?: string;

  /** Anything else worth recording for the day. */
  @IsOptional() @IsString()
  notes?: string;

  /** Freeform structured line items (mixed categories) — stored as JSON. */
  @IsOptional() @IsArray()
  lineItems?: unknown[];

  /** Attachments as `[{ fileName, url, mimeType?, uploadedAt? }]` — stored as JSON. */
  @IsOptional() @IsArray()
  attachments?: unknown[];
}

/**
 * Request body for `PATCH /projects/:projectId/daily-diary/:id`. Same shape
 * as create minus `date` (rebinding a diary to a different date would break
 * the one-per-day invariant; delete and recreate instead). `submittedAt`
 * flips the row from draft to submitted; only the author or an admin can
 * clear it back to null.
 */
export class UpdateDailyDiaryDto {
  @IsOptional() @IsString() siteId?: string | null;
  @IsOptional() @IsString() weather?: string;
  @IsOptional() @IsNumberString() temperatureC?: string;
  @IsOptional() @IsString() crewSummary?: string;
  @IsOptional() @IsString() plantOnSite?: string;
  @IsOptional() @IsString() deliveries?: string;
  @IsOptional() @IsString() visitors?: string;
  @IsOptional() @IsString() delays?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsArray() lineItems?: unknown[];
  @IsOptional() @IsArray() attachments?: unknown[];
  /** Set to an ISO string to submit; pass `null` to un-submit. */
  @IsOptional() submittedAt?: string | null;
}

/**
 * Query parameters for `GET /projects/:projectId/daily-diary` — reverse-
 * chronological list with optional date-window filter and pagination.
 */
export class ListDailyDiariesQueryDto {
  /** Inclusive lower bound ISO date. */
  @IsOptional() @IsDateString() from?: string;
  /** Inclusive upper bound ISO date. */
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsNumberString() page?: string;
  @IsOptional() @IsNumberString() limit?: string;
}
