import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

export const DEFAULT_REGION = "QLD";

export type ListHolidaysInput = {
  region?: string;
  from?: string;
  to?: string;
};

export type CreateHolidayInput = {
  date: string;
  name: string;
  region?: string;
};

function parseDate(value: string, field: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must be an ISO date (YYYY-MM-DD).`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} is not a valid date.`);
  }
  return parsed;
}

@Injectable()
export class PublicHolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async list(input: ListHolidaysInput = {}) {
    const region = (input.region ?? DEFAULT_REGION).trim().toUpperCase();
    const where: Prisma.PublicHolidayWhereInput = { region };
    if (input.from || input.to) {
      where.date = {};
      if (input.from) (where.date as Prisma.DateTimeFilter).gte = parseDate(input.from, "from");
      if (input.to) (where.date as Prisma.DateTimeFilter).lte = parseDate(input.to, "to");
    }
    return this.prisma.publicHoliday.findMany({
      where,
      orderBy: [{ date: "asc" }]
    });
  }

  async create(input: CreateHolidayInput) {
    const name = input.name?.trim();
    if (!name) throw new BadRequestException("name is required.");
    const region = (input.region ?? DEFAULT_REGION).trim().toUpperCase();
    const date = parseDate(input.date, "date");
    try {
      return await this.prisma.publicHoliday.create({
        data: { date, name, region }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new BadRequestException(
          `A public holiday already exists for ${input.date} in region ${region}.`
        );
      }
      throw err;
    }
  }

  /**
   * Hard-delete a holiday. Holidays have no DB back-refs, so there is no
   * in-use guard beyond existence. Every delete writes an AuditLog row so
   * the row can be reconstructed.
   */
  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.publicHoliday.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Public holiday not found.");
    await this.prisma.publicHoliday.delete({ where: { id } });
    await this.auditService.write({
      actorId,
      action: "publicHoliday.delete",
      entityType: "PublicHoliday",
      entityId: id,
      metadata: {
        date: existing.date.toISOString(),
        name: existing.name,
        region: existing.region
      }
    });
    return { id };
  }
}
