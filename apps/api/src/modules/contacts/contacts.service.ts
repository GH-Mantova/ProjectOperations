import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

export const ORG_TYPES = ["CLIENT", "SUBCONTRACTOR", "SUPPLIER"] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export type ContactListFilters = {
  organisationType?: string;
  organisationId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

export type UpsertContactInput = {
  organisationType?: string;
  organisationId?: string;
  firstName?: string;
  lastName?: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  isPrimary?: boolean;
  isAccountsContact?: boolean;
  isActive?: boolean;
  hasPortalAccess?: boolean;
  notes?: string | null;
};

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ContactListFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
    const where: Record<string, unknown> = {};
    if (filters.organisationType) {
      this.assertOrgType(filters.organisationType);
      where.organisationType = filters.organisationType;
    }
    if (filters.organisationId) where.organisationId = filters.organisationId;
    if (typeof filters.isActive === "boolean") where.isActive = filters.isActive;
    if (filters.search) {
      const q = filters.search.trim();
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } }
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where,
        orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      }),
      this.prisma.contact.count({ where })
    ]);

    return { items, total, page, limit };
  }

  async get(id: string) {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  async create(input: UpsertContactInput, actorId?: string) {
    const organisationType = input.organisationType;
    const organisationId = input.organisationId;
    if (!organisationType || !organisationId) {
      throw new BadRequestException("organisationType and organisationId are required.");
    }
    this.assertOrgType(organisationType);
    if (!input.firstName?.trim() || !input.lastName?.trim()) {
      throw new BadRequestException("firstName and lastName are required.");
    }
    await this.requireOrganisation(organisationType, organisationId);

    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contact.updateMany({
          where: { organisationType, organisationId, isPrimary: true },
          data: { isPrimary: false }
        });
      }
      return tx.contact.create({
        data: {
          organisationType,
          organisationId,
          firstName: input.firstName!.trim(),
          lastName: input.lastName!.trim(),
          role: input.role ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          mobile: input.mobile ?? null,
          isPrimary: Boolean(input.isPrimary),
          isAccountsContact: Boolean(input.isAccountsContact),
          isActive: input.isActive ?? true,
          hasPortalAccess: Boolean(input.hasPortalAccess),
          notes: input.notes ?? null,
          createdById: actorId ?? null
        }
      });
    });
  }

  async update(id: string, input: UpsertContactInput) {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found.");

    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.contact.updateMany({
          where: {
            organisationType: existing.organisationType,
            organisationId: existing.organisationId,
            isPrimary: true,
            id: { not: id }
          },
          data: { isPrimary: false }
        });
      }
      const data: Record<string, unknown> = {};
      for (const key of [
        "firstName",
        "lastName",
        "role",
        "email",
        "phone",
        "mobile",
        "isPrimary",
        "isAccountsContact",
        "isActive",
        "hasPortalAccess",
        "notes"
      ] as const) {
        if (input[key] !== undefined) data[key] = input[key];
      }
      return tx.contact.update({ where: { id }, data });
    });
  }

  async softDelete(id: string) {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found.");
    return this.prisma.contact.update({ where: { id }, data: { isActive: false } });
  }

  private assertOrgType(value: string): asserts value is OrgType {
    if (!ORG_TYPES.includes(value as OrgType)) {
      throw new BadRequestException(`organisationType must be one of: ${ORG_TYPES.join(", ")}`);
    }
  }

  private async requireOrganisation(type: string, id: string): Promise<void> {
    if (type === "CLIENT") {
      const row = await this.prisma.client.findUnique({ where: { id }, select: { id: true } });
      if (!row) throw new NotFoundException(`Client ${id} not found.`);
      return;
    }
    // SUBCONTRACTOR + SUPPLIER both live in subcontractor_suppliers with different entityType values.
    const row = await this.prisma.subcontractorSupplier.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException(`Directory entry ${id} not found.`);
  }
}
