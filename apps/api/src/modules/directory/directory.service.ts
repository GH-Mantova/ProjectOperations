import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const BANK_FIELDS = ["bankName", "bankAccountName", "bankBsb", "bankAccountNumber"] as const;

const BUSINESS_TYPES = ["company", "sole_trader", "partnership", "trust", "private_person"] as const;
const ENTITY_TYPES = ["subcontractor", "supplier", "both"] as const;
const PREQUAL_STATUSES = ["approved", "pending", "suspended", "rejected"] as const;
const LICENCE_STATUSES = ["active", "expired", "expiring_soon", "not_required"] as const;
const CREDIT_DIRECTIONS = ["outgoing", "incoming"] as const;
const CREDIT_STATUSES = ["draft", "submitted", "under_review", "approved", "rejected"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

type ExpiryBearing = { expiryDate: Date | null; status: string };

function computeStatus<T extends ExpiryBearing>(row: T): T & { status: string } {
  if (row.status === "not_required") return row;
  if (!row.expiryDate) return { ...row, status: "active" };
  const now = Date.now();
  const exp = new Date(row.expiryDate).getTime();
  if (exp < now) return { ...row, status: "expired" };
  if (exp - now <= 30 * DAY_MS) return { ...row, status: "expiring_soon" };
  return { ...row, status: "active" };
}

function maskBank<T extends Record<string, unknown>>(entity: T, canSeeBank: boolean): T {
  if (canSeeBank) return entity;
  const cloned: Record<string, unknown> = { ...entity };
  for (const f of BANK_FIELDS) {
    const v = cloned[f];
    if (typeof v === "string" && v.length > 3 && f === "bankAccountNumber") {
      cloned[f] = `***${v.slice(-3)}`;
    } else if (typeof v === "string" && v.length > 0) {
      cloned[f] = null;
    }
  }
  return cloned as T;
}

/**
 * Bank fields are gated by `directory.finance`. We deliberately strip the
 * fields from the PATCH body when the caller lacks the permission rather
 * than throwing 403 — for two reasons:
 *
 *  1. The PATCH body is a partial update of the full subcontractor record.
 *     Frontends often resend everything they read (including masked bank
 *     fields) without intending a write. Silently dropping bank fields is
 *     forgiving and avoids whack-a-mole 403s during normal edit flows.
 *
 *  2. Bank fields have a separate visibility gate on GET (mask if no
 *     directory.finance). Strip-on-write keeps the field-level model
 *     symmetric with the field-level read masking — neither escapes the
 *     gate, neither blows up the surrounding update.
 *
 * Therefore this stays as an inline subset filter rather than a
 * `@RequirePermissions("directory.finance")` decorator at the route level.
 * Field-level checks are the right tool for field-level permissions.
 */
function stripBankFromInput<T extends Record<string, unknown>>(data: T, canEditBank: boolean): T {
  if (canEditBank) return data;
  const clean = { ...data };
  for (const f of BANK_FIELDS) delete (clean as Record<string, unknown>)[f];
  return clean;
}

@Injectable()
export class DirectoryService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Subcontractor CRUD ─────────────────────────────────────────────────
  async list(filters: {
    type?: string;
    category?: string;
    status?: string;
    prequal?: string;
    q?: string;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.type && filters.type !== "all") where.entityType = filters.type;
    if (filters.category) where.categories = { has: filters.category };
    if (filters.status === "active") where.isActive = true;
    if (filters.status === "inactive") where.isActive = false;
    if (filters.prequal) where.prequalStatus = filters.prequal;
    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: "insensitive" } },
        { tradingName: { contains: filters.q, mode: "insensitive" } },
        { abn: { contains: filters.q } }
      ];
    }

    const items = await this.prisma.subcontractorSupplier.findMany({
      where,
      include: {
        licences: { select: { expiryDate: true, status: true } },
        insurances: { select: { expiryDate: true, status: true } }
      },
      orderBy: { name: "asc" }
    });

    const now = Date.now();
    return items.map((row) => {
      let expiryAlerts = 0;
      for (const list of [row.licences, row.insurances]) {
        for (const item of list) {
          if (!item.expiryDate) continue;
          const diff = item.expiryDate.getTime() - now;
          if (diff < 0 || diff <= 30 * DAY_MS) expiryAlerts += 1;
        }
      }
      const { licences: _l, insurances: _i, ...rest } = row;
      return { ...rest, expiryAlerts };
    });
  }

  async get(id: string, canSeeBank: boolean) {
    const entity = await this.prisma.subcontractorSupplier.findUnique({
      where: { id },
      include: {
        licences: { orderBy: { expiryDate: "asc" } },
        insurances: { orderBy: { expiryDate: "asc" } },
        documents: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: { select: { firstName: true, lastName: true } } } },
        creditApplications: { orderBy: { createdAt: "desc" } }
      }
    });
    if (!entity) throw new NotFoundException("Directory entry not found.");
    // Contacts live in the polymorphic Contact model — look them up by
    // organisationType + organisationId rather than via a Prisma relation.
    const contacts = await this.prisma.contact.findMany({
      where: { organisationType: "SUBCONTRACTOR", organisationId: id },
      orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }]
    });
    const masked = maskBank(entity, canSeeBank);
    return {
      ...masked,
      contacts,
      licences: entity.licences.map(computeStatus),
      insurances: entity.insurances.map(computeStatus)
    };
  }

  async create(dto: Record<string, unknown>, actorId: string, canEditBank: boolean) {
    if (!dto.name || typeof dto.name !== "string") throw new BadRequestException("name is required.");
    this.validateEnum("businessType", dto.businessType, BUSINESS_TYPES, true);
    this.validateEnum("entityType", dto.entityType, ENTITY_TYPES, true);
    this.validateEnum("prequalStatus", dto.prequalStatus, PREQUAL_STATUSES, true);

    const data = stripBankFromInput(dto, canEditBank);
    const entity = await this.prisma.subcontractorSupplier.create({
      data: {
        ...(data as Record<string, unknown>),
        name: dto.name,
        createdById: actorId
      } as never
    });

    // Auto-create primary contact for private_person entities
    if (dto.businessType === "private_person") {
      const [firstName, ...rest] = String(dto.name).split(" ");
      await this.prisma.contact.create({
        data: {
          organisationType: "SUBCONTRACTOR",
          organisationId: entity.id,
          firstName: firstName ?? String(dto.name),
          lastName: rest.join(" ") || "—",
          phone: (dto.phone as string | undefined) ?? null,
          mobile: null,
          email: (dto.email as string | undefined) ?? null,
          isPrimary: true,
          createdById: actorId
        }
      });
    }
    return entity;
  }

  async update(id: string, dto: Record<string, unknown>, canEditBank: boolean) {
    this.validateEnum("businessType", dto.businessType, BUSINESS_TYPES, false);
    this.validateEnum("entityType", dto.entityType, ENTITY_TYPES, false);
    this.validateEnum("prequalStatus", dto.prequalStatus, PREQUAL_STATUSES, false);
    await this.requireEntity(id);
    const data = stripBankFromInput(dto, canEditBank);
    return this.prisma.subcontractorSupplier.update({ where: { id }, data: data as never });
  }

  async softDelete(id: string) {
    await this.requireEntity(id);
    return this.prisma.subcontractorSupplier.update({ where: { id }, data: { isActive: false } });
  }

  async updatePrequal(id: string, actorId: string, dto: { prequalStatus: string; prequalNotes?: string | null }) {
    this.validateEnum("prequalStatus", dto.prequalStatus, PREQUAL_STATUSES, true);
    await this.requireEntity(id);
    return this.prisma.subcontractorSupplier.update({
      where: { id },
      data: {
        prequalStatus: dto.prequalStatus,
        prequalNotes: dto.prequalNotes ?? null,
        prequalReviewedAt: new Date(),
        prequalReviewedBy: actorId
      }
    });
  }

  // ─── Contacts (thin wrappers over the polymorphic Contact model) ────────
  async addContact(subId: string, dto: Record<string, unknown>, actorId?: string) {
    await this.requireEntity(subId);
    if (!dto.firstName || !dto.lastName) throw new BadRequestException("firstName and lastName required.");
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({
          where: { organisationType: "SUBCONTRACTOR", organisationId: subId, isPrimary: true },
          data: { isPrimary: false }
        });
      }
      return tx.contact.create({
        data: {
          ...(dto as Record<string, unknown>),
          organisationType: "SUBCONTRACTOR",
          organisationId: subId,
          createdById: actorId ?? null
        } as never
      });
    });
  }

  async updateContact(subId: string, contactId: string, dto: Record<string, unknown>) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organisationType: "SUBCONTRACTOR", organisationId: subId }
    });
    if (!existing) throw new NotFoundException("Contact not found on this entity.");
    return this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.contact.updateMany({
          where: {
            organisationType: "SUBCONTRACTOR",
            organisationId: subId,
            isPrimary: true,
            id: { not: contactId }
          },
          data: { isPrimary: false }
        });
      }
      return tx.contact.update({ where: { id: contactId }, data: dto as never });
    });
  }

  async deleteContact(subId: string, contactId: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { id: contactId, organisationType: "SUBCONTRACTOR", organisationId: subId }
    });
    if (!existing) throw new NotFoundException("Contact not found on this entity.");
    await this.prisma.contact.delete({ where: { id: contactId } });
    return { id: contactId };
  }

  // ─── Licences (polymorphic) ─────────────────────────────────────────────
  async addLicence(owner: { clientId?: string; subcontractorId?: string }, dto: Record<string, unknown>) {
    if (!dto.licenceType) throw new BadRequestException("licenceType is required.");
    await this.requireOwner(owner);
    const data: Record<string, unknown> = {
      ...dto,
      issueDate: this.parseDate(dto.issueDate),
      expiryDate: this.parseDate(dto.expiryDate)
    };
    if (owner.clientId) data.clientId = owner.clientId;
    if (owner.subcontractorId) data.subcontractorId = owner.subcontractorId;
    const row = await this.prisma.entityLicence.create({ data: data as never });
    return computeStatus(row);
  }

  async updateLicence(owner: { clientId?: string; subcontractorId?: string }, id: string, dto: Record<string, unknown>) {
    const existing = await this.prisma.entityLicence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Licence not found.");
    if (owner.clientId && existing.clientId !== owner.clientId) throw new NotFoundException("Licence not on this client.");
    if (owner.subcontractorId && existing.subcontractorId !== owner.subcontractorId)
      throw new NotFoundException("Licence not on this entity.");
    const data: Record<string, unknown> = { ...dto };
    if (dto.issueDate !== undefined) data.issueDate = this.parseDate(dto.issueDate);
    if (dto.expiryDate !== undefined) data.expiryDate = this.parseDate(dto.expiryDate);
    const row = await this.prisma.entityLicence.update({ where: { id }, data: data as never });
    return computeStatus(row);
  }

  async deleteLicence(owner: { clientId?: string; subcontractorId?: string }, id: string) {
    const existing = await this.prisma.entityLicence.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Licence not found.");
    if (owner.clientId && existing.clientId !== owner.clientId) throw new NotFoundException("Licence not on this client.");
    if (owner.subcontractorId && existing.subcontractorId !== owner.subcontractorId)
      throw new NotFoundException("Licence not on this entity.");
    await this.prisma.entityLicence.delete({ where: { id } });
    return { id };
  }

  // ─── Insurances (polymorphic) ───────────────────────────────────────────
  async addInsurance(owner: { clientId?: string; subcontractorId?: string }, dto: Record<string, unknown>) {
    if (!dto.insuranceType) throw new BadRequestException("insuranceType is required.");
    await this.requireOwner(owner);
    const data: Record<string, unknown> = {
      ...dto,
      expiryDate: this.parseDate(dto.expiryDate)
    };
    if (owner.clientId) data.clientId = owner.clientId;
    if (owner.subcontractorId) data.subcontractorId = owner.subcontractorId;
    const row = await this.prisma.entityInsurance.create({ data: data as never });
    return computeStatus(row);
  }

  async updateInsurance(owner: { clientId?: string; subcontractorId?: string }, id: string, dto: Record<string, unknown>) {
    const existing = await this.prisma.entityInsurance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Insurance not found.");
    if (owner.clientId && existing.clientId !== owner.clientId) throw new NotFoundException("Not on this client.");
    if (owner.subcontractorId && existing.subcontractorId !== owner.subcontractorId)
      throw new NotFoundException("Not on this entity.");
    const data: Record<string, unknown> = { ...dto };
    if (dto.expiryDate !== undefined) data.expiryDate = this.parseDate(dto.expiryDate);
    const row = await this.prisma.entityInsurance.update({ where: { id }, data: data as never });
    return computeStatus(row);
  }

  async deleteInsurance(owner: { clientId?: string; subcontractorId?: string }, id: string) {
    const existing = await this.prisma.entityInsurance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Insurance not found.");
    if (owner.clientId && existing.clientId !== owner.clientId) throw new NotFoundException("Not on this client.");
    if (owner.subcontractorId && existing.subcontractorId !== owner.subcontractorId)
      throw new NotFoundException("Not on this entity.");
    await this.prisma.entityInsurance.delete({ where: { id } });
    return { id };
  }

  // ─── Credit applications (polymorphic) ──────────────────────────────────
  async addCreditApplication(
    owner: { clientId?: string; subcontractorId?: string },
    actorId: string,
    dto: Record<string, unknown>
  ) {
    this.validateEnum("direction", dto.direction, CREDIT_DIRECTIONS, true);
    this.validateEnum("status", dto.status, CREDIT_STATUSES, false);
    await this.requireOwner(owner);
    const data: Record<string, unknown> = {
      ...dto,
      applicationDate: this.parseDate(dto.applicationDate),
      approvedDate: this.parseDate(dto.approvedDate),
      rejectedDate: this.parseDate(dto.rejectedDate),
      createdById: actorId
    };
    if (owner.clientId) data.clientId = owner.clientId;
    if (owner.subcontractorId) data.subcontractorId = owner.subcontractorId;
    return this.prisma.creditApplication.create({ data: data as never });
  }

  async updateCreditApplication(
    owner: { clientId?: string; subcontractorId?: string },
    id: string,
    actorId: string,
    dto: Record<string, unknown>,
    canAdmin: boolean,
    canApprove: boolean
  ) {
    this.validateEnum("status", dto.status, CREDIT_STATUSES, false);
    const existing = await this.prisma.creditApplication.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Credit application not found.");
    if (owner.clientId && existing.clientId !== owner.clientId) throw new NotFoundException("Not on this client.");
    if (owner.subcontractorId && existing.subcontractorId !== owner.subcontractorId)
      throw new NotFoundException("Not on this entity.");

    const next = typeof dto.status === "string" ? dto.status : existing.status;
    this.enforceCreditTransition(existing.status, next, canAdmin, canApprove);

    const data: Record<string, unknown> = { ...dto };
    if (dto.applicationDate !== undefined) data.applicationDate = this.parseDate(dto.applicationDate);
    if (dto.approvedDate !== undefined) data.approvedDate = this.parseDate(dto.approvedDate);
    if (dto.rejectedDate !== undefined) data.rejectedDate = this.parseDate(dto.rejectedDate);
    if (next === "approved" && existing.status !== "approved") {
      data.approvedDate = new Date();
      data.reviewedById = actorId;
    }
    if (next === "rejected" && existing.status !== "rejected") {
      data.rejectedDate = new Date();
      data.reviewedById = actorId;
    }

    const row = await this.prisma.creditApplication.update({ where: { id }, data: data as never });

    // On approval, propagate creditLimit onto the entity
    if (next === "approved" && existing.status !== "approved" && row.creditLimit) {
      if (row.clientId) {
        await this.prisma.client.update({
          where: { id: row.clientId },
          data: { creditLimit: row.creditLimit, creditApproved: true }
        });
      } else if (row.subcontractorId) {
        await this.prisma.subcontractorSupplier.update({
          where: { id: row.subcontractorId },
          data: { creditLimit: row.creditLimit, creditApproved: true }
        });
      }
    }

    return row;
  }

  // ─── Documents (subcontractor only) ─────────────────────────────────────
  async addDocument(subId: string, actorId: string, dto: Record<string, unknown>) {
    await this.requireEntity(subId);
    if (!dto.documentType || !dto.name) throw new BadRequestException("documentType and name required.");
    return this.prisma.subcontractorDocument.create({
      data: { ...(dto as Record<string, unknown>), subcontractorId: subId, uploadedById: actorId } as never
    });
  }

  async updateDocument(subId: string, docId: string, dto: Record<string, unknown>) {
    const existing = await this.prisma.subcontractorDocument.findFirst({
      where: { id: docId, subcontractorId: subId }
    });
    if (!existing) throw new NotFoundException("Document not found on this entity.");
    return this.prisma.subcontractorDocument.update({ where: { id: docId }, data: dto as never });
  }

  async deleteDocument(subId: string, docId: string) {
    const existing = await this.prisma.subcontractorDocument.findFirst({
      where: { id: docId, subcontractorId: subId }
    });
    if (!existing) throw new NotFoundException("Document not found on this entity.");
    await this.prisma.subcontractorDocument.delete({ where: { id: docId } });
    return { id: docId };
  }

  // ─── Expiry alerts ──────────────────────────────────────────────────────
  async expiryAlerts() {
    const cutoff = new Date(Date.now() + 30 * DAY_MS);
    const [licences, insurances] = await Promise.all([
      this.prisma.entityLicence.findMany({
        where: { expiryDate: { not: null, lte: cutoff }, status: { not: "not_required" } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } }
        },
        orderBy: { expiryDate: "asc" }
      }),
      this.prisma.entityInsurance.findMany({
        where: { expiryDate: { not: null, lte: cutoff }, status: { not: "not_required" } },
        include: {
          client: { select: { id: true, name: true } },
          subcontractor: { select: { id: true, name: true } }
        },
        orderBy: { expiryDate: "asc" }
      })
    ]);

    const toAlert = (kind: "licence" | "insurance", row: {
      id: string;
      expiryDate: Date | null;
      status: string;
      licenceType?: string;
      insuranceType?: string;
      client?: { id: string; name: string } | null;
      subcontractor?: { id: string; name: string } | null;
    }) => {
      const entity = row.client ?? row.subcontractor;
      const entityKind = row.client ? "client" : "subcontractor";
      return {
        id: row.id,
        kind,
        entityKind,
        entityId: entity?.id ?? null,
        entityName: entity?.name ?? "—",
        type: row.licenceType ?? row.insuranceType ?? null,
        expiryDate: row.expiryDate,
        status: computeStatus({ expiryDate: row.expiryDate, status: row.status }).status
      };
    };

    return [
      ...licences.map((l) => toAlert("licence", l as never)),
      ...insurances.map((i) => toAlert("insurance", i as never))
    ].sort((a, b) => {
      const ax = a.expiryDate?.getTime() ?? Infinity;
      const bx = b.expiryDate?.getTime() ?? Infinity;
      return ax - bx;
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private async requireEntity(id: string) {
    const exists = await this.prisma.subcontractorSupplier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException("Directory entry not found.");
  }

  private async requireOwner(owner: { clientId?: string; subcontractorId?: string }) {
    if (owner.clientId) {
      const c = await this.prisma.client.findUnique({ where: { id: owner.clientId }, select: { id: true } });
      if (!c) throw new NotFoundException("Client not found.");
    } else if (owner.subcontractorId) {
      await this.requireEntity(owner.subcontractorId);
    } else {
      throw new BadRequestException("Owner required.");
    }
  }

  private validateEnum(field: string, value: unknown, allowed: readonly string[], required: boolean) {
    if (value === undefined || value === null || value === "") {
      if (required) throw new BadRequestException(`${field} is required.`);
      return;
    }
    if (typeof value !== "string" || !allowed.includes(value)) {
      throw new BadRequestException(`${field} must be one of: ${allowed.join(", ")}`);
    }
  }

  private parseDate(v: unknown): Date | null {
    if (v === undefined || v === null || v === "") return null;
    if (v instanceof Date) return v;
    const d = new Date(v as string);
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Invalid date format.");
    return d;
  }

  private enforceCreditTransition(prev: string, next: string, canAdmin: boolean, canApprove: boolean) {
    if (prev === next) return;
    const isAllowed = (p: string, n: string) =>
      (p === "draft" && n === "submitted") ||
      (p === "submitted" && n === "under_review" && canAdmin) ||
      (p === "under_review" && n === "approved" && canAdmin && canApprove) ||
      (p === "under_review" && n === "rejected" && canAdmin);
    if (!isAllowed(prev, next)) {
      throw new ForbiddenException(
        `Credit application transition ${prev} → ${next} not allowed for current user.`
      );
    }
  }
}

export const DIRECTORY_LICENCE_STATUSES = LICENCE_STATUSES;
