import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, Matches } from "class-validator";

/**
 * PR-454 — Availability heatmap query.
 *
 * `month` is YYYY-MM. `skipNonWorkingDays` when true marks weekends and
 * seeded `PublicHoliday` rows as "skipped" — those columns render greyed
 * out and excluded from the totals.
 */
export class AvailabilityReportQueryDto {
  @ApiProperty({ description: "Month (YYYY-MM)." })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "month must be YYYY-MM" })
  month!: string;

  @ApiPropertyOptional({ description: "Skip weekends and public holidays.", default: false })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === true || value === "true" || value === 1 || value === "1")
  skipNonWorkingDays?: boolean;
}
