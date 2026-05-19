import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Generates canonical job numbers in the format J-YYYY-NNN.
 *
 * Year is determined from Australia/Brisbane local time at generation
 * (matches the company's operational timezone — a job created at 11pm
 * Brisbane on Dec 31 should get a December number, not January's).
 *
 * NNN is a per-year sequence backed by JobNumberSequence. We use an
 * upsert+increment which Postgres serialises on the row, so concurrent
 * generators can't collide.
 *
 * PR B05.
 */
@Injectable()
export class JobNumberService {
  // Canonical format regex. Exposed as a static so validation logic
  // in jobs.service.ts can reuse it without re-declaring.
  static readonly JOB_NUMBER_REGEX = /^J-\d{4}-\d{3}$/;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the current Brisbane year as an integer.
   * Brisbane is UTC+10 year-round (no DST).
   */
  private currentBrisbaneYear(): number {
    const now = new Date();
    const yearString = now.toLocaleString("en-AU", {
      timeZone: "Australia/Brisbane",
      year: "numeric"
    });
    return parseInt(yearString, 10);
  }

  /**
   * Generates the next canonical job number for the current Brisbane year.
   * Atomic via row-level lock on JobNumberSequence.
   */
  async generate(): Promise<string> {
    const year = this.currentBrisbaneYear();

    const sequence = await this.prisma.jobNumberSequence.upsert({
      where: { year },
      update: { lastNumber: { increment: 1 } },
      create: { year, lastNumber: 1 }
    });

    return this.format(year, sequence.lastNumber);
  }

  /**
   * Format helper. Public so tests can construct expected values
   * without depending on internal details.
   */
  format(year: number, number: number): string {
    return `J-${year}-${String(number).padStart(3, "0")}`;
  }

  /**
   * Validates a caller-supplied job number against the canonical pattern.
   * Returns null on success, error message string on failure.
   */
  validate(jobNumber: string): string | null {
    if (!jobNumber) return "Job number is required.";
    if (!JobNumberService.JOB_NUMBER_REGEX.test(jobNumber)) {
      return `Job number "${jobNumber}" is not in canonical format J-YYYY-NNN.`;
    }
    return null;
  }
}
