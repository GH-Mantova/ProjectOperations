import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { parseDefaultClauses, type TcClause } from "./tc-parser";

const STANDARD_ASSUMPTIONS = [
  "All works to be completed during standard working hours Monday to Friday 6:30am to 4:30pm unless otherwise stated",
  "All consumables, fuel, and waste disposal are included in the quoted price",
  "All works comply with relevant WHS, EPA, and council regulations",
  "Site to be clear of all salvageable items prior to commencement",
  "Lift/loading dock access available within 20m of work area",
  "Wall height assumed at 2.4m unless otherwise stated"
];

const STANDARD_EXCLUSIONS = [
  "Dilapidation reports",
  "Utility disconnection and reconnection",
  "Services locating",
  "Edge protections, scaffolding, and chutes",
  "HVAC removal",
  "Waterproofing",
  "Underground obstructions",
  "Traffic control",
  "Make-safe works",
  "Patching and making good",
  "Any works not explicitly described in this quote"
];

function isClauseArray(value: unknown): value is TcClause[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (c) =>
      c !== null &&
      typeof c === "object" &&
      typeof (c as TcClause).number === "string" &&
      typeof (c as TcClause).heading === "string" &&
      typeof (c as TcClause).body === "string"
  );
}

@Injectable()
export class QuoteService {
  constructor(private readonly prisma: PrismaService) {}

  // ── T&C ──────────────────────────────────────────────────────────────
  async getTandC(tenderId: string) {
    await this.requireTender(tenderId);
    const existing = await this.prisma.tenderTandC.findUnique({ where: { tenderId } });
    if (existing) return existing;
    const clauses = parseDefaultClauses();
    return this.prisma.tenderTandC.create({
      data: {
        tenderId,
        clauses: clauses as unknown as Prisma.InputJsonValue
      }
    });
  }

  async updateTandC(tenderId: string, clauses: TcClause[]) {
    await this.requireTender(tenderId);
    if (!isClauseArray(clauses)) {
      throw new BadRequestException("clauses must be an array of { number, heading, body }");
    }
    const existing = await this.prisma.tenderTandC.findUnique({ where: { tenderId } });
    if (!existing) {
      return this.prisma.tenderTandC.create({
        data: { tenderId, clauses: clauses as unknown as Prisma.InputJsonValue }
      });
    }
    return this.prisma.tenderTandC.update({
      where: { tenderId },
      data: { clauses: clauses as unknown as Prisma.InputJsonValue }
    });
  }

  async resetAllTandC(tenderId: string) {
    await this.requireTender(tenderId);
    const clauses = parseDefaultClauses();
    return this.prisma.tenderTandC.upsert({
      where: { tenderId },
      create: { tenderId, clauses: clauses as unknown as Prisma.InputJsonValue },
      update: { clauses: clauses as unknown as Prisma.InputJsonValue }
    });
  }

  async resetClause(tenderId: string, clauseNumber: string) {
    await this.requireTender(tenderId);
    const defaults = parseDefaultClauses();
    const target = defaults.find((c) => c.number === clauseNumber);
    if (!target) throw new NotFoundException(`Clause ${clauseNumber} is not in the standard T&Cs.`);
    const record = await this.getTandC(tenderId);
    const current = isClauseArray(record.clauses) ? (record.clauses as TcClause[]) : defaults;
    const next = current.map((c) => (c.number === clauseNumber ? { ...target } : c));
    return this.prisma.tenderTandC.update({
      where: { tenderId },
      data: { clauses: next as unknown as Prisma.InputJsonValue }
    });
  }

  // ── Assumptions ──────────────────────────────────────────────────────
  async listAssumptions(tenderId: string) {
    await this.requireTender(tenderId);
    const rows = await this.prisma.tenderAssumption.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
    if (rows.length > 0) return rows;
    // First load: seed with the IS standard set so the UI isn't empty.
    await this.prisma.$transaction(
      STANDARD_ASSUMPTIONS.map((text, i) =>
        this.prisma.tenderAssumption.create({
          data: { tenderId, text, sortOrder: i }
        })
      )
    );
    return this.prisma.tenderAssumption.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
  }

  async createAssumption(tenderId: string, text: string, sortOrder?: number) {
    await this.requireTender(tenderId);
    const cleaned = text ?? "";
    const nextOrder =
      sortOrder !== undefined
        ? sortOrder
        : await this.prisma.tenderAssumption.count({ where: { tenderId } });
    return this.prisma.tenderAssumption.create({
      data: { tenderId, text: cleaned, sortOrder: nextOrder }
    });
  }

  async updateAssumption(tenderId: string, id: string, patch: { text?: string; sortOrder?: number }) {
    const existing = await this.prisma.tenderAssumption.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Assumption not found.");
    return this.prisma.tenderAssumption.update({ where: { id }, data: patch });
  }

  async deleteAssumption(tenderId: string, id: string) {
    const existing = await this.prisma.tenderAssumption.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Assumption not found.");
    await this.prisma.tenderAssumption.delete({ where: { id } });
    return { id };
  }

  async reorderAssumptions(tenderId: string, order: Array<{ id: string; sortOrder: number }>) {
    await this.requireTender(tenderId);
    if (order.length === 0) return { updated: 0 };
    const ids = order.map((o) => o.id);
    const existing = await this.prisma.tenderAssumption.findMany({
      where: { id: { in: ids }, tenderId },
      select: { id: true }
    });
    const allowed = new Set(existing.map((e) => e.id));
    const invalid = ids.filter((id) => !allowed.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({ message: "Some assumption IDs are not on this tender.", invalid });
    }
    await this.prisma.$transaction(
      order.map((o) =>
        this.prisma.tenderAssumption.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })
      )
    );
    return { updated: order.length };
  }

  // ── Exclusions ───────────────────────────────────────────────────────
  async listExclusions(tenderId: string) {
    await this.requireTender(tenderId);
    const rows = await this.prisma.tenderExclusion.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
    if (rows.length > 0) return rows;
    await this.prisma.$transaction(
      STANDARD_EXCLUSIONS.map((text, i) =>
        this.prisma.tenderExclusion.create({
          data: { tenderId, text, sortOrder: i }
        })
      )
    );
    return this.prisma.tenderExclusion.findMany({
      where: { tenderId },
      orderBy: { sortOrder: "asc" }
    });
  }

  async createExclusion(tenderId: string, text: string, sortOrder?: number) {
    await this.requireTender(tenderId);
    const cleaned = text ?? "";
    const nextOrder =
      sortOrder !== undefined
        ? sortOrder
        : await this.prisma.tenderExclusion.count({ where: { tenderId } });
    return this.prisma.tenderExclusion.create({
      data: { tenderId, text: cleaned, sortOrder: nextOrder }
    });
  }

  async updateExclusion(tenderId: string, id: string, patch: { text?: string; sortOrder?: number }) {
    const existing = await this.prisma.tenderExclusion.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Exclusion not found.");
    return this.prisma.tenderExclusion.update({ where: { id }, data: patch });
  }

  async deleteExclusion(tenderId: string, id: string) {
    const existing = await this.prisma.tenderExclusion.findUnique({ where: { id } });
    if (!existing || existing.tenderId !== tenderId) throw new NotFoundException("Exclusion not found.");
    await this.prisma.tenderExclusion.delete({ where: { id } });
    return { id };
  }

  async reorderExclusions(tenderId: string, order: Array<{ id: string; sortOrder: number }>) {
    await this.requireTender(tenderId);
    if (order.length === 0) return { updated: 0 };
    const ids = order.map((o) => o.id);
    const existing = await this.prisma.tenderExclusion.findMany({
      where: { id: { in: ids }, tenderId },
      select: { id: true }
    });
    const allowed = new Set(existing.map((e) => e.id));
    const invalid = ids.filter((id) => !allowed.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException({ message: "Some exclusion IDs are not on this tender.", invalid });
    }
    await this.prisma.$transaction(
      order.map((o) =>
        this.prisma.tenderExclusion.update({ where: { id: o.id }, data: { sortOrder: o.sortOrder } })
      )
    );
    return { updated: order.length };
  }

  // ── Export history ───────────────────────────────────────────────────
  async listExports(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.estimateExport.findMany({
      where: { tenderId },
      orderBy: { generatedAt: "desc" },
      take: 20,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });
  }

  // ── Private ──────────────────────────────────────────────────────────
  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({ where: { id: tenderId }, select: { id: true } });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }
}
