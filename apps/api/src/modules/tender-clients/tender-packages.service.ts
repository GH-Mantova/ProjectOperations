import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import type { TenderPricingBasis } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const DISCIPLINE_LIST_SLUG = "tender-package-disciplines";

@Injectable()
export class TenderPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  async listPackages(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.tenderPackage.findMany({
      where: { tenderId },
      include: {
        disciplineItem: {
          select: { id: true, value: true, label: true, sortOrder: true, isArchived: true }
        }
      },
      orderBy: [{ disciplineItem: { sortOrder: "asc" } }, { createdAt: "asc" }]
    });
  }

  async addPackage(tenderId: string, disciplineItemId: string) {
    await this.requireTender(tenderId);
    await this.requireDisciplineItem(disciplineItemId);

    const existing = await this.prisma.tenderPackage.findUnique({
      where: { tenderId_disciplineItemId: { tenderId, disciplineItemId } }
    });
    if (existing) {
      throw new ConflictException("This package is already added to the tender.");
    }
    await this.prisma.tenderPackage.create({
      data: { tenderId, disciplineItemId }
    });
    return this.listPackages(tenderId);
  }

  async removePackage(tenderId: string, packageId: string) {
    await this.requireTender(tenderId);
    const pkg = await this.prisma.tenderPackage.findUnique({ where: { id: packageId } });
    if (!pkg || pkg.tenderId !== tenderId) {
      throw new NotFoundException("Package not found on this tender.");
    }
    await this.prisma.tenderPackage.delete({ where: { id: packageId } });
    return this.listPackages(tenderId);
  }

  async listMatrix(tenderId: string) {
    await this.requireTender(tenderId);
    return this.prisma.tenderClientPackage.findMany({
      where: { tenderClient: { tenderId } },
      include: {
        tenderClient: { select: { id: true, clientId: true } },
        tenderPackage: {
          select: {
            id: true,
            disciplineItemId: true,
            disciplineItem: { select: { id: true, value: true, label: true } }
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async attachCell(
    tenderId: string,
    tenderClientId: string,
    tenderPackageId: string,
    pricingBasis?: TenderPricingBasis,
    basisNote?: string | null
  ) {
    await this.requireTender(tenderId);
    await this.requireSameTender(tenderId, tenderClientId, tenderPackageId);

    const existing = await this.prisma.tenderClientPackage.findUnique({
      where: { tenderClientId_tenderPackageId: { tenderClientId, tenderPackageId } }
    });
    if (existing) {
      throw new ConflictException("This client is already pricing this package.");
    }
    return this.prisma.tenderClientPackage.create({
      data: {
        tenderClientId,
        tenderPackageId,
        pricingBasis: pricingBasis ?? "DOCUMENTS",
        basisNote: basisNote ?? null
      }
    });
  }

  async updateCell(
    tenderId: string,
    cellId: string,
    pricingBasis?: TenderPricingBasis,
    basisNote?: string | null
  ) {
    await this.requireTender(tenderId);
    const cell = await this.findCellOnTender(tenderId, cellId);
    return this.prisma.tenderClientPackage.update({
      where: { id: cell.id },
      data: {
        ...(pricingBasis ? { pricingBasis } : {}),
        ...(basisNote !== undefined ? { basisNote } : {})
      }
    });
  }

  async detachCell(tenderId: string, cellId: string) {
    await this.requireTender(tenderId);
    const cell = await this.findCellOnTender(tenderId, cellId);
    await this.prisma.tenderClientPackage.delete({ where: { id: cell.id } });
    return { id: cell.id };
  }

  async setSubmissionDate(tenderId: string, tenderClientId: string, submissionDate: Date | null) {
    await this.requireTender(tenderId);
    const tc = await this.prisma.tenderClient.findUnique({ where: { id: tenderClientId } });
    if (!tc || tc.tenderId !== tenderId) {
      throw new NotFoundException("Tender client not found on this tender.");
    }
    return this.prisma.tenderClient.update({
      where: { id: tenderClientId },
      data: { submissionDate }
    });
  }

  // Union of every package that any client on the tender is pricing. This is
  // the set of document buckets the tender's shared document upload should
  // present (dedup: documents are one shared set across all clients).
  async documentBuckets(tenderId: string) {
    await this.requireTender(tenderId);
    const cells = await this.prisma.tenderClientPackage.findMany({
      where: { tenderClient: { tenderId } },
      select: {
        tenderPackage: {
          select: {
            id: true,
            disciplineItemId: true,
            disciplineItem: { select: { id: true, value: true, label: true, sortOrder: true } }
          }
        }
      }
    });
    const seen = new Map<string, { packageId: string; disciplineItemId: string; value: string; label: string; sortOrder: number }>();
    for (const c of cells) {
      const pkg = c.tenderPackage;
      if (!seen.has(pkg.id)) {
        seen.set(pkg.id, {
          packageId: pkg.id,
          disciplineItemId: pkg.disciplineItem.id,
          value: pkg.disciplineItem.value,
          label: pkg.disciplineItem.label,
          sortOrder: pkg.disciplineItem.sortOrder
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async requireTender(tenderId: string) {
    const t = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: { id: true }
    });
    if (!t) throw new NotFoundException("Tender not found.");
    return t;
  }

  private async requireDisciplineItem(disciplineItemId: string) {
    const item = await this.prisma.globalListItem.findUnique({
      where: { id: disciplineItemId },
      include: { list: { select: { slug: true } } }
    });
    if (!item) throw new NotFoundException("Discipline not found.");
    if (item.list.slug !== DISCIPLINE_LIST_SLUG) {
      throw new BadRequestException("Item is not a tender package discipline.");
    }
    if (item.isArchived) {
      throw new BadRequestException("Discipline is archived.");
    }
    return item;
  }

  private async requireSameTender(
    tenderId: string,
    tenderClientId: string,
    tenderPackageId: string
  ) {
    const [tc, pkg] = await Promise.all([
      this.prisma.tenderClient.findUnique({
        where: { id: tenderClientId },
        select: { id: true, tenderId: true }
      }),
      this.prisma.tenderPackage.findUnique({
        where: { id: tenderPackageId },
        select: { id: true, tenderId: true }
      })
    ]);
    if (!tc) throw new NotFoundException("Tender client not found.");
    if (!pkg) throw new NotFoundException("Tender package not found.");
    if (tc.tenderId !== tenderId || pkg.tenderId !== tenderId) {
      throw new BadRequestException("Client and package must belong to the same tender.");
    }
  }

  private async findCellOnTender(tenderId: string, cellId: string) {
    const cell = await this.prisma.tenderClientPackage.findUnique({
      where: { id: cellId },
      include: { tenderClient: { select: { tenderId: true } } }
    });
    if (!cell || cell.tenderClient.tenderId !== tenderId) {
      throw new NotFoundException("Matrix cell not found on this tender.");
    }
    return cell;
  }
}
