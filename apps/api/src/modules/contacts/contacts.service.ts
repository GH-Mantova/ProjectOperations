import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  findDuplicateContacts,
  type ContactCandidateInput,
  type DuplicateContactCandidate
} from "../directory/duplicate-check.util";

/**
 * The fixed vocabulary of organisation types a {@link Contact} can be
 * anchored to via the polymorphic `organisationType` + `organisationId`
 * key. CLIENT contacts point at Client rows; SUBCONTRACTOR and SUPPLIER
 * contacts both point at SubcontractorSupplier rows (the row's own
 * `entityType` disambiguates).
 */
export const ORG_TYPES = ["CLIENT", "SUBCONTRACTOR", "SUPPLIER"] as const;

/** Union of the three organisation-type discriminator values; derived from {@link ORG_TYPES}. */
export type OrgType = (typeof ORG_TYPES)[number];

/**
 * Query parameters accepted by {@link ContactsService.list}. All fields are
 * optional. `search` does a case-insensitive substring match across
 * `firstName`, `lastName`, and `email`. Pagination defaults to page 1,
 * limit 25 (capped at 100).
 */
export type ContactListFilters = {
  organisationType?: string;
  organisationId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
};

/**
 * Shared input shape for {@link ContactsService.create} and
 * {@link ContactsService.update}. On create, `organisationType`,
 * `organisationId`, `firstName`, and `lastName` are required. On update,
 * any field may be omitted; supplying both `organisationType` and
 * `organisationId` together reassigns the contact to a new owning
 * organisation (see PR D FIX 3).
 */
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
  includeInInvoiceEmails?: boolean;
};

/**
 * Service layer for the polymorphic Contact model — a single table that
 * stores CLIENT, SUBCONTRACTOR, and SUPPLIER contacts, discriminated by
 * `organisationType` + `organisationId`. This service is the
 * cross-organisation CRUD surface; module-specific contact endpoints
 * (e.g. {@link DirectoryService.addContact}) ultimately write rows in the
 * same table.
 *
 * The `isPrimary` flag is unique within an organisation: setting it on one
 * contact clears it on all siblings of the same parent inside the same
 * transaction.
 */
@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paginated list of contacts. Filters by `organisationType` (validated
   * against {@link ORG_TYPES}), `organisationId`, `isActive`, and a
   * case-insensitive `search` across `firstName` / `lastName` / `email`.
   * Returns `{ items, total, page, limit }`. Page defaults to 1, limit to
   * 25 (capped at 100).
   *
   * @throws BadRequestException When `organisationType` is supplied but not
   *   in the fixed vocabulary.
   */
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

  /**
   * Fetch a single contact by id.
   *
   * @throws NotFoundException When no contact exists with `id`.
   */
  async get(id: string) {
    const row = await this.prisma.contact.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Contact not found.");
    return row;
  }

  /**
   * Create a contact anchored to a CLIENT, SUBCONTRACTOR, or SUPPLIER
   * organisation. Validates that the owning organisation exists. If
   * `isPrimary` is true, any existing primary contact on the same
   * organisation is demoted in the same transaction.
   *
   * @throws BadRequestException When `organisationType` / `organisationId` /
   *   `firstName` / `lastName` are missing or `organisationType` is invalid.
   * @throws NotFoundException When the owning organisation does not exist.
   */
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

    const created = await this.prisma.$transaction(async (tx) => {
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
          includeInInvoiceEmails: Boolean(input.includeInInvoiceEmails),
          createdById: actorId ?? null
        }
      });
    });

    // Advisory duplicate warning — attached to the create response so the
    // UI can render "similar contacts already exist". Non-blocking.
    const duplicateCandidates = await findDuplicateContacts(this.prisma, {
      organisationType,
      organisationId,
      firstName: created.firstName,
      lastName: created.lastName,
      email: created.email,
      phone: created.phone,
      mobile: created.mobile,
      excludeId: created.id
    });
    return { ...created, duplicateCandidates };
  }

  /**
   * Patch a contact. PATCH semantics — only fields present in `input` are
   * written. Supplying `organisationType` AND `organisationId` together
   * reassigns the contact to a new owning organisation; the target
   * organisation is validated and the `isPrimary` flag is cleared against
   * the destination org, not the source.
   *
   * @throws NotFoundException When the contact (or, on reassignment, the
   *   destination organisation) does not exist.
   * @throws BadRequestException On invalid destination `organisationType`.
   */
  async update(id: string, input: UpsertContactInput) {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found.");

    // PR D FIX 3 — contact reassignment. Either both org fields or neither.
    // When the destination org type/id is supplied, validate the target
    // exists and apply the move atomically with the rest of the update.
    const movingOrg =
      input.organisationType !== undefined && input.organisationId !== undefined &&
      (input.organisationType !== existing.organisationType ||
        input.organisationId !== existing.organisationId);
    if (movingOrg) {
      this.assertOrgType(input.organisationType!);
      await this.requireOrganisation(input.organisationType!, input.organisationId!);
    }

    return this.prisma.$transaction(async (tx) => {
      // After-move org used for primary uniqueness — primary is per-org so
      // moving a contact to a new org needs the new org's primary cleared,
      // not the source org's.
      const orgType = movingOrg ? input.organisationType! : existing.organisationType;
      const orgId = movingOrg ? input.organisationId! : existing.organisationId;
      if (input.isPrimary) {
        await tx.contact.updateMany({
          where: {
            organisationType: orgType,
            organisationId: orgId,
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
        "notes",
        "includeInInvoiceEmails"
      ] as const) {
        if (input[key] !== undefined) data[key] = input[key];
      }
      if (movingOrg) {
        data.organisationType = input.organisationType;
        data.organisationId = input.organisationId;
      }
      return tx.contact.update({ where: { id }, data });
    });
  }

  /**
   * Soft-delete by flipping `isActive` to false. The row is preserved so
   * historical references (audit, email recipients, prior jobs) keep
   * resolving.
   *
   * @throws NotFoundException When no contact exists with `id`.
   */
  async softDelete(id: string) {
    const existing = await this.prisma.contact.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contact not found.");
    return this.prisma.contact.update({ where: { id }, data: { isActive: false } });
  }

  /**
   * Advisory duplicate detection for a proposed Contact. Returns a scored
   * candidate list (see {@link findDuplicateContacts}). Callers surface
   * the result as a soft warning on create screens — the workflow is
   * never blocked.
   */
  async duplicateCheck(input: ContactCandidateInput): Promise<DuplicateContactCandidate[]> {
    if (!input.organisationType) {
      throw new BadRequestException("organisationType is required.");
    }
    this.assertOrgType(input.organisationType);
    return findDuplicateContacts(this.prisma, input);
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
