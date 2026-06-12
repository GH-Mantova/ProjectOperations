import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { brisbaneYYMMDD, clientSlug } from "../../common/id-format/client-slug";

/**
 * Generates canonical job numbers in the format J{YYMMDD}-{SLUG}-{NNN}
 * (pilot G5 — Marco-confirmed spec, supersedes the PR B05 J-YYYY-NNN
 * year-sequence format).
 *
 *   YYMMDD — job creation date in Australia/Brisbane local time
 *   SLUG   — 4-letter uppercase slug from the client's company name,
 *            snapshotted on the Job row (clientSlugSnapshot)
 *   NNN    — cumulative count of jobs for THIS client across all time,
 *            zero-padded to 3 digits (the client's 17th job is -017)
 *
 * Collisions (same client, same day, same NNN — e.g. after a deletion
 * freed an earlier slot) get a -2 / -3 disambiguator suffix.
 *
 * The old JobNumberSequence table is no longer read or incremented —
 * the per-client sequence is computed on demand from the jobs table.
 */
@Injectable()
export class JobNumberService {
  // Canonical format regex. Slug is 1-4 alphanumerics (short client names
  // produce short slugs); optional -N disambiguator for same-day collisions.
  static readonly JOB_NUMBER_REGEX = /^J\d{6}-[A-Z0-9]{1,4}-\d{3,}(-\d+)?$/;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next canonical job number for the given client.
   * NNN is the client's all-time job count + 1.
   */
  async generate(
    clientId: string,
    clientName: string,
    now: Date = new Date()
  ): Promise<{ jobNumber: string; clientSlugSnapshot: string }> {
    const slug = clientSlug(clientName);
    const count = await this.prisma.job.count({ where: { clientId } });
    const candidate = this.format(now, slug, count + 1);
    return { jobNumber: await this.ensureUnique(candidate), clientSlugSnapshot: slug };
  }

  /**
   * Format helper. Public so tests can construct expected values
   * without depending on internal details.
   */
  format(date: Date, slug: string, nnn: number): string {
    return `J${brisbaneYYMMDD(date)}-${slug}-${String(nnn).padStart(3, "0")}`;
  }

  /**
   * Validates a job number against the canonical pattern.
   * Returns null on success, error message string on failure.
   */
  validate(jobNumber: string): string | null {
    if (!jobNumber) return "Job number is required.";
    if (!JobNumberService.JOB_NUMBER_REGEX.test(jobNumber)) {
      return `Job number "${jobNumber}" is not in canonical format JYYMMDD-SLUG-NNN.`;
    }
    return null;
  }

  private async ensureUnique(candidate: string): Promise<string> {
    let proposed = candidate;
    let suffix = 1;
    while (await this.prisma.job.findUnique({ where: { jobNumber: proposed }, select: { id: true } })) {
      suffix += 1;
      proposed = `${candidate}-${suffix}`;
    }
    return proposed;
  }
}
