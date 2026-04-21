import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const DIRECTIONS = ["sent", "received"] as const;
type Direction = (typeof DIRECTIONS)[number];

@Injectable()
export class TenderClarificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.tenderClarificationNote.findMany({
      where: { tenderId },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { occurredAt: "desc" }
    });
  }

  async create(
    tenderId: string,
    actorId: string,
    dto: { direction: string; text: string; date?: string | null }
  ) {
    await this.requireTender(tenderId);
    if (!DIRECTIONS.includes(dto.direction as Direction)) {
      throw new BadRequestException(`direction must be one of ${DIRECTIONS.join(", ")}.`);
    }
    const clean = dto.text?.trim();
    if (!clean) throw new BadRequestException("text cannot be empty.");
    return this.prisma.tenderClarificationNote.create({
      data: {
        tenderId,
        direction: dto.direction,
        text: clean,
        occurredAt: dto.date ? new Date(dto.date) : new Date(),
        createdById: actorId
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } }
    });
  }

  async remove(tenderId: string, id: string) {
    const existing = await this.prisma.tenderClarificationNote.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) {
      throw new NotFoundException("Clarification not found on this tender.");
    }
    await this.prisma.tenderClarificationNote.delete({ where: { id } });
    return { id };
  }

  private async requireTender(tenderId: string) {
    const tender = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!tender) throw new NotFoundException("Tender not found.");
    return tender;
  }
}
