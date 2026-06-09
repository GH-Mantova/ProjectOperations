import {
  IsDateString,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString
} from "class-validator";

/**
 * Request body for `PATCH /projects/:id` — partial update of any subset of
 * writable project fields. `contractValue` is field-gated and requires
 * `projects.admin`; all other fields are gated only by `projects.manage`.
 * Team role ids accept `null` to disconnect.
 */
export class UpdateProjectDto {
  /** Human-readable project name. */
  @IsOptional() @IsString() name?: string;

  /** Street line 1 of the site address. */
  @IsOptional() @IsString() siteAddressLine1?: string;
  /** Optional second street line. */
  @IsOptional() @IsString() siteAddressLine2?: string;
  /** Suburb component of the site address. */
  @IsOptional() @IsString() siteAddressSuburb?: string;
  /** Australian state code. */
  @IsOptional() @IsString() siteAddressState?: string;
  /** Four-digit Australian postcode. */
  @IsOptional() @IsString() siteAddressPostcode?: string;

  /** Contract value as a decimal string. Field-gated by `projects.admin`; emits a `CONTRACT_VALUE_CHANGED` activity entry when changed. */
  @IsOptional() @IsNumberString() contractValue?: string;
  /** Budget as a decimal string. Emits a `BUDGET_CHANGED` activity entry when changed. */
  @IsOptional() @IsNumberString() budget?: string;
  /** Actual-cost rollup as a decimal string — used to derive variance in {@link getById}. */
  @IsOptional() @IsNumberString() actualCost?: string;

  /** ISO proposed start date. */
  @IsOptional() @IsDateString() proposedStartDate?: string;
  /** ISO actual start date — also settable via the status transition payload. */
  @IsOptional() @IsDateString() actualStartDate?: string;
  /** ISO practical completion date — also settable via the status transition payload. */
  @IsOptional() @IsDateString() practicalCompletionDate?: string;
  /** ISO closed date — also settable via the status transition payload. */
  @IsOptional() @IsDateString() closedDate?: string;

  /** FK to the Project Manager User, or `null` to unassign. Emits `TEAM_CHANGED` activity. */
  @IsOptional() @IsString() projectManagerId?: string | null;
  /** FK to the Site Supervisor User, or `null` to unassign. Emits `TEAM_CHANGED` activity. */
  @IsOptional() @IsString() supervisorId?: string | null;
  /** FK to the Estimator User, or `null` to unassign. Emits `TEAM_CHANGED` activity. */
  @IsOptional() @IsString() estimatorId?: string | null;
  /** FK to the WHS Officer User, or `null` to unassign. Emits `TEAM_CHANGED` activity. */
  @IsOptional() @IsString() whsOfficerId?: string | null;
}

const STATUSES = ["MOBILISING", "ACTIVE", "PRACTICAL_COMPLETION", "DEFECTS", "CLOSED"] as const;

/**
 * Request body for `POST /projects/:id/status` — status transition.
 *
 * The forward transitions in the linear graph each require a date payload
 * field: `MOBILISING→ACTIVE` requires `actualStartDate` (or pre-existing),
 * `ACTIVE→PRACTICAL_COMPLETION` requires `practicalCompletionDate`, and
 * `DEFECTS→CLOSED` requires `closedDate`. Reopening (`CLOSED→MOBILISING`)
 * additionally requires `projects.admin`.
 */
export class ProjectStatusDto {
  /** Target `ProjectStatus` value. Must be reachable from the current status (or be `MOBILISING` for a reopen). */
  @IsIn(STATUSES as unknown as string[])
  status!: string;

  /** ISO actual start date — required for `MOBILISING→ACTIVE` if not already set on the project. */
  @IsOptional() @IsDateString() actualStartDate?: string;
  /** ISO practical completion date — required for `ACTIVE→PRACTICAL_COMPLETION`. */
  @IsOptional() @IsDateString() practicalCompletionDate?: string;
  /** ISO closed date — required for `DEFECTS→CLOSED`. */
  @IsOptional() @IsDateString() closedDate?: string;
}

/**
 * Query parameters for `GET /projects` listing with pagination + filters.
 */
export class ListProjectsQueryDto {
  /** Comma-separated list of `ProjectStatus` values (e.g. `"ACTIVE,DEFECTS"`). Empty / missing = no status filter. */
  @IsOptional() @IsString() status?: string;
  /** Exact match on `clientId`. */
  @IsOptional() @IsString() clientId?: string;
  /** Exact match on `projectManagerId`. */
  @IsOptional() @IsString() pmId?: string;
  /** Case-insensitive substring match across `projectNumber` and `name`. */
  @IsOptional() @IsString() search?: string;
  /** 1-indexed page number. Defaults to 1, floored at 1. */
  @IsOptional() @IsNumberString() page?: string;
  /** Page size. Defaults to 25; clamped to [1, 100]. */
  @IsOptional() @IsNumberString() limit?: string;
}
