import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { CompanyLegalDocumentType, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

// Singleton id — same sentinel as PlatformConfig. A CHECK constraint at the
// DB level also enforces this, so a bug in service code cannot create a
// second row.
export const COMPANY_PROFILE_ID = "singleton";

export type UpdateCompanyProfileDto = Partial<{
  legalName: string;
  tradingName: string;
  abn: string | null;
  acn: string | null;
  entityType: "PTY_LTD" | "SOLE_TRADER" | "PARTNERSHIP" | "TRUST" | "OTHER";

  primaryEmail: string | null;
  primaryPhone: string | null;
  website: string | null;
  registeredAddressLine1: string | null;
  registeredAddressLine2: string | null;
  registeredSuburb: string | null;
  registeredState: string | null;
  registeredPostcode: string | null;
  registeredCountry: string;
  postalAddressLine1: string | null;
  postalAddressLine2: string | null;
  postalSuburb: string | null;
  postalState: string | null;
  postalPostcode: string | null;
  postalCountry: string;
  whsOfficerUserId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;

  gstRate: number;
  currency: string;
  financialYearStartMonth: number;
  timezone: string;
  defaultPaymentTermsDays: number;
  defaultQuoteValidityDays: number;
  defaultMarkupPercent: number;

  tenderNumberPrefix: string;
  quoteNumberPrefix: string;
  jobNumberPrefix: string;
  projectNumberPrefix: string;
  variationNumberPrefix: string;
  claimNumberPrefix: string;
  incidentNumberPrefix: string;

  primaryColorHex: string;
  secondaryColorHex: string;
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  faviconUrl: string | null;
  pdfLetterheadUrl: string | null;
}>;

// Fields we consider "identity-critical" for the audit trail — a change to
// any of these on a contract-facing document is a serious event so we log
// them separately for easy auditing.
const IDENTITY_CRITICAL_FIELDS: Array<keyof UpdateCompanyProfileDto> = [
  "legalName",
  "abn",
  "acn",
  "entityType"
];

// Fields expected on a "complete" profile — used by the completeness
// indicator on the admin UI. Anything nullable in the schema that is
// business-important to fill in belongs here.
const COMPLETENESS_FIELDS = [
  "legalName",
  "tradingName",
  "abn",
  "primaryEmail",
  "primaryPhone",
  "registeredAddressLine1",
  "registeredSuburb",
  "registeredState",
  "registeredPostcode",
  "whsOfficerUserId",
  "logoLightUrl",
  "pdfLetterheadUrl"
] as const;

/**
 * CompanyProfile singleton + effective-dated legal documents + company
 * licences/insurances.
 *
 * The profile is the single home for "who we are" — legalName, ABN,
 * contact, commercial defaults, numbering prefixes, and branding. Every
 * document surface (PDF, Excel, email, ICS) reads from here rather than
 * from hardcoded strings.
 *
 * Legal documents (T&Cs, cover letter, etc.) are versioned and
 * effective-dated. Editing content ALWAYS creates a new version; the
 * old row is closed with `effectiveTo` and `isActive=false`. Issued
 * quotes and contracts pin the exact version they used via a nullable
 * FK, so historical documents forever render the terms actually agreed
 * to. Mutating an already-issued version is treated as a bug — the
 * service does not expose an update endpoint for the `content` field
 * of a document that is `!isActive`.
 */
@Injectable()
export class CompanyProfileService {
  private readonly logger = new Logger(CompanyProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /** Read the singleton profile with completeness indicator. Throws if
   * absent — the seed must have run.
   */
  async getProfile() {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { id: COMPANY_PROFILE_ID },
      include: {
        whsOfficer: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });
    if (!profile) {
      throw new NotFoundException(
        "Company profile has not been seeded. Run `pnpm seed` or POST /admin/company/profile to bootstrap."
      );
    }
    return {
      ...profile,
      completeness: this.computeCompleteness(profile)
    };
  }

  /** Update the singleton with diff-based audit. `updatedById` must be a
   * super-user (guard enforces).
   */
  async updateProfile(actorId: string, dto: UpdateCompanyProfileDto) {
    const before = await this.prisma.companyProfile.findUnique({
      where: { id: COMPANY_PROFILE_ID }
    });
    if (!before) {
      throw new NotFoundException(
        "Company profile has not been seeded — cannot update a missing singleton."
      );
    }

    // Prisma treats undefined as "no change" and null as "set null" — DTO
    // shape mirrors that so callers can PATCH partial payloads. We never
    // let the id be changed.
    const data: Prisma.CompanyProfileUpdateInput = { ...dto, updatedById: actorId };
    delete (data as { id?: unknown }).id;

    const updated = await this.prisma.companyProfile.update({
      where: { id: COMPANY_PROFILE_ID },
      data
    });

    // Audit — one entry per field changed. legalName and abn are highlighted
    // separately because they appear on contracts; a silent change to
    // either is a serious event.
    const changedFields = this.diffFields(before, updated, Object.keys(dto));
    for (const [field, change] of Object.entries(changedFields)) {
      const isIdentityCritical = (IDENTITY_CRITICAL_FIELDS as string[]).includes(field);
      await this.audit.write({
        actorId,
        action: isIdentityCritical
          ? `companyProfile.identity.${field}.update`
          : `companyProfile.${field}.update`,
        entityType: "CompanyProfile",
        entityId: COMPANY_PROFILE_ID,
        metadata: {
          from: this.normalize(change.from),
          to: this.normalize(change.to)
        }
      });
    }

    return this.getProfile();
  }

  // ─── Legal documents ────────────────────────────────────────────────────
  /** List all versions of all legal-document types. */
  async listLegalDocuments() {
    return this.prisma.companyLegalDocument.findMany({
      orderBy: [{ type: "asc" }, { version: "desc" }],
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });
  }

  /** The currently-active version of a given document type. Used at
   * quote-send / contract-create time to pin the FK.
   */
  async getActiveLegalDocument(type: CompanyLegalDocumentType) {
    return this.prisma.companyLegalDocument.findFirst({
      where: { type, isActive: true },
      orderBy: { version: "desc" }
    });
  }

  /** Create a new version of a legal document. The previous active version
   * (if any) is closed with `effectiveTo = now` and `isActive = false` in
   * the same transaction. Version numbers are monotonic per type.
   */
  async createLegalDocumentVersion(
    actorId: string,
    dto: {
      type: CompanyLegalDocumentType;
      content: string;
      effectiveFrom?: Date;
    }
  ) {
    if (!dto.content || dto.content.trim().length === 0) {
      throw new BadRequestException("Legal document content cannot be empty.");
    }
    const effectiveFrom = dto.effectiveFrom ?? new Date();

    const created = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.companyLegalDocument.findFirst({
        where: { type: dto.type, isActive: true },
        orderBy: { version: "desc" }
      });
      const nextVersion = (previous?.version ?? 0) + 1;

      // Close the previous version (if any). Do NOT delete or edit the
      // old row — it may be pinned by historical quotes/contracts.
      if (previous) {
        await tx.companyLegalDocument.update({
          where: { id: previous.id },
          data: { isActive: false, effectiveTo: effectiveFrom }
        });
      }

      return tx.companyLegalDocument.create({
        data: {
          profileId: COMPANY_PROFILE_ID,
          type: dto.type,
          version: nextVersion,
          content: dto.content,
          effectiveFrom,
          isActive: true,
          createdById: actorId
        }
      });
    });

    await this.audit.write({
      actorId,
      action: `companyProfile.legalDocument.${dto.type}.newVersion`,
      entityType: "CompanyLegalDocument",
      entityId: created.id,
      metadata: { type: dto.type, version: created.version }
    });

    return created;
  }

  // ─── Company licences & insurances ─────────────────────────────────────
  /** List all licences owned by the company profile. */
  async listLicences() {
    return this.prisma.entityLicence.findMany({
      where: { companyProfileId: COMPANY_PROFILE_ID },
      orderBy: [{ expiryDate: "asc" }, { licenceType: "asc" }]
    });
  }

  async listInsurances() {
    return this.prisma.entityInsurance.findMany({
      where: { companyProfileId: COMPANY_PROFILE_ID },
      orderBy: [{ expiryDate: "asc" }, { insuranceType: "asc" }]
    });
  }

  async createLicence(
    actorId: string,
    dto: {
      licenceType: string;
      licenceNumber?: string | null;
      issuingAuthority?: string | null;
      issueDate?: Date | null;
      expiryDate?: Date | null;
      documentPath?: string | null;
      notes?: string | null;
    }
  ) {
    const created = await this.prisma.entityLicence.create({
      data: { ...dto, companyProfileId: COMPANY_PROFILE_ID }
    });
    await this.audit.write({
      actorId,
      action: "companyProfile.licence.create",
      entityType: "EntityLicence",
      entityId: created.id,
      metadata: { licenceType: created.licenceType }
    });
    return created;
  }

  async updateLicence(
    actorId: string,
    id: string,
    dto: Partial<{
      licenceType: string;
      licenceNumber: string | null;
      issuingAuthority: string | null;
      issueDate: Date | null;
      expiryDate: Date | null;
      documentPath: string | null;
      notes: string | null;
      status: string;
    }>
  ) {
    const existing = await this.prisma.entityLicence.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== COMPANY_PROFILE_ID) {
      throw new NotFoundException(`Company licence ${id} not found.`);
    }
    const updated = await this.prisma.entityLicence.update({ where: { id }, data: dto });
    await this.audit.write({
      actorId,
      action: "companyProfile.licence.update",
      entityType: "EntityLicence",
      entityId: id
    });
    return updated;
  }

  async deleteLicence(actorId: string, id: string) {
    const existing = await this.prisma.entityLicence.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== COMPANY_PROFILE_ID) {
      throw new NotFoundException(`Company licence ${id} not found.`);
    }
    await this.prisma.entityLicence.delete({ where: { id } });
    await this.audit.write({
      actorId,
      action: "companyProfile.licence.delete",
      entityType: "EntityLicence",
      entityId: id
    });
  }

  async createInsurance(
    actorId: string,
    dto: {
      insuranceType: string;
      insurerName?: string | null;
      policyNumber?: string | null;
      coverageAmount?: number | null;
      expiryDate?: Date | null;
      documentPath?: string | null;
      notes?: string | null;
    }
  ) {
    const created = await this.prisma.entityInsurance.create({
      data: { ...dto, companyProfileId: COMPANY_PROFILE_ID }
    });
    await this.audit.write({
      actorId,
      action: "companyProfile.insurance.create",
      entityType: "EntityInsurance",
      entityId: created.id,
      metadata: { insuranceType: created.insuranceType }
    });
    return created;
  }

  async updateInsurance(
    actorId: string,
    id: string,
    dto: Partial<{
      insuranceType: string;
      insurerName: string | null;
      policyNumber: string | null;
      coverageAmount: number | null;
      expiryDate: Date | null;
      documentPath: string | null;
      notes: string | null;
      status: string;
    }>
  ) {
    const existing = await this.prisma.entityInsurance.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== COMPANY_PROFILE_ID) {
      throw new NotFoundException(`Company insurance ${id} not found.`);
    }
    const updated = await this.prisma.entityInsurance.update({ where: { id }, data: dto });
    await this.audit.write({
      actorId,
      action: "companyProfile.insurance.update",
      entityType: "EntityInsurance",
      entityId: id
    });
    return updated;
  }

  async deleteInsurance(actorId: string, id: string) {
    const existing = await this.prisma.entityInsurance.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== COMPANY_PROFILE_ID) {
      throw new NotFoundException(`Company insurance ${id} not found.`);
    }
    await this.prisma.entityInsurance.delete({ where: { id } });
    await this.audit.write({
      actorId,
      action: "companyProfile.insurance.delete",
      entityType: "EntityInsurance",
      entityId: id
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────
  private computeCompleteness(profile: Record<string, unknown>) {
    const unset: string[] = [];
    for (const field of COMPLETENESS_FIELDS) {
      const value = profile[field];
      if (value === null || value === undefined || value === "") {
        unset.push(field);
      }
    }
    // Flag if tradingName still says "Initial Services" but the operator is
    // a different company — noisy for IS themselves, but the whole point
    // of the completeness indicator is to tell a second company what they
    // still need to change. We surface it as an unset-analog only when the
    // legalName has NOT been changed from the seeded default.
    const usingDefaultLegalName = profile.legalName === "Initial Services Group Pty Ltd";
    return {
      unsetFields: unset,
      total: COMPLETENESS_FIELDS.length,
      complete: COMPLETENESS_FIELDS.length - unset.length,
      usingDefaultIdentity: usingDefaultLegalName
    };
  }

  private diffFields(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    fields: string[]
  ): Record<string, { from: unknown; to: unknown }> {
    const diff: Record<string, { from: unknown; to: unknown }> = {};
    for (const field of fields) {
      // Decimal fields come back as Prisma.Decimal — compare via toString().
      const a = this.normalize(before[field]);
      const b = this.normalize(after[field]);
      if (a !== b) {
        diff[field] = { from: before[field], to: after[field] };
      }
    }
    return diff;
  }

  private normalize(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "object" && value !== null && "toString" in value) {
      return String(value);
    }
    return String(value);
  }

  /** Assert that the actor is a super-user. Server-side enforcement so a
   * direct API call from a non-super-user is rejected — not just the UI.
   */
  assertSuperUser(user: { isSuperUser?: boolean } | undefined) {
    if (!user?.isSuperUser) {
      throw new ForbiddenException(
        "Company profile changes require a super-user account."
      );
    }
  }
}
