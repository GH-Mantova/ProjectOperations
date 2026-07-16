import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RulesEngineService, type FieldRule } from "./rules-engine.service";

type ValueMap = Record<string, unknown>;

/**
 * Manages FormPublicLink rows and handles the unauthenticated submit
 * pipeline for public and kiosk modes.
 *
 * - createLink / listLinks / updateLink / deleteLink: management CRUD
 *   (authenticated, requires forms.manage).
 * - getPublicTemplate: returns the blank template payload for a token
 *   (unauthenticated, rate-limited).
 * - publicSubmit: validates + persists a public submission without a userId
 *   (unauthenticated, rate-limited).
 *
 * Public submissions land as normal FormSubmission rows with
 * submittedById = null and publicLinkId set.
 */
@Injectable()
export class PublicLinkService {
  private readonly logger = new Logger(PublicLinkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesEngineService
  ) {}

  // ── Management (authenticated) ────────────────────────────────────────

  /**
   * Mint a new public/kiosk link for a template.
   * Generates a cryptographically random URL-safe token.
   */
  async createLink(
    dto: {
      templateId: string;
      mode?: string;
      label?: string;
      expiresAt?: string;
      siteId?: string;
      jobId?: string;
      maxSubmissions?: number;
    },
    actorId: string
  ) {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id: dto.templateId },
      select: { id: true, name: true }
    });
    if (!template) throw new NotFoundException("Form template not found.");

    // Generate a 24-byte (48 hex-char) URL-safe token
    const token = randomBytes(24).toString("hex");

    const link = await this.prisma.formPublicLink.create({
      data: {
        templateId: dto.templateId,
        token,
        mode: dto.mode ?? "public",
        label: dto.label ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        siteId: dto.siteId ?? null,
        jobId: dto.jobId ?? null,
        maxSubmissions: dto.maxSubmissions ?? null,
        createdById: actorId
      },
      include: { template: { select: { id: true, name: true, code: true } } }
    });

    return link;
  }

  /** List all public links for a template (or all links if no templateId). */
  async listLinks(templateId?: string) {
    return this.prisma.formPublicLink.findMany({
      where: templateId ? { templateId } : undefined,
      include: {
        template: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  /** Toggle isActive, update label or expiry. */
  async updateLink(
    id: string,
    dto: {
      isActive?: boolean;
      label?: string;
      expiresAt?: string;
      maxSubmissions?: number;
    }
  ) {
    const existing = await this.prisma.formPublicLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Public link not found.");
    return this.prisma.formPublicLink.update({
      where: { id },
      data: {
        isActive: dto.isActive !== undefined ? dto.isActive : undefined,
        label: dto.label !== undefined ? dto.label : undefined,
        expiresAt:
          dto.expiresAt !== undefined
            ? dto.expiresAt
              ? new Date(dto.expiresAt)
              : null
            : undefined,
        maxSubmissions:
          dto.maxSubmissions !== undefined ? dto.maxSubmissions : undefined
      }
    });
  }

  /** Delete a public link. */
  async deleteLink(id: string) {
    const existing = await this.prisma.formPublicLink.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Public link not found.");
    await this.prisma.formPublicLink.delete({ where: { id } });
    return { ok: true };
  }

  // ── Public / kiosk (unauthenticated) ─────────────────────────────────

  /**
   * Return the blank template payload for a token.
   *
   * Only exposes: template name + code, sections + fields (labels, types,
   * options, required flag). Never returns authenticated data, submission
   * history, or internal configuration.
   *
   * @throws NotFoundException when the token does not exist
   * @throws ForbiddenException when the link is inactive or expired
   * @throws GoneException when the submission cap is reached
   */
  async getPublicTemplate(token: string) {
    const link = await this.resolveActiveLink(token);

    const version = await this.prisma.formTemplateVersion.findFirst({
      where: { templateId: link.templateId, status: "ACTIVE" },
      orderBy: { versionNumber: "desc" },
      include: {
        template: { select: { id: true, name: true, code: true, category: true } },
        sections: {
          orderBy: { sectionOrder: "asc" },
          include: {
            fields: {
              orderBy: { fieldOrder: "asc" },
              select: {
                id: true,
                fieldKey: true,
                label: true,
                fieldType: true,
                fieldOrder: true,
                isRequired: true,
                helpText: true,
                placeholder: true,
                defaultValue: true,
                optionsJson: true,
                config: true,
                conditions: true,
                validations: true
              }
            }
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundException("This form has no active version and cannot be submitted.");
    }

    return {
      linkId: link.id,
      mode: link.mode,
      templateName: version.template.name,
      templateCode: version.template.code,
      templateCategory: version.template.category,
      versionId: version.id,
      versionNumber: version.versionNumber,
      sections: version.sections,
      // Context hints for the kiosk UI (e.g. site name for sign-in sheets)
      siteId: link.siteId,
      jobId: link.jobId
    };
  }

  /**
   * Validate and persist a public-link submission without a userId.
   *
   * Required fields are enforced. On success the link's submissionCount is
   * incremented and, if maxSubmissions is now reached, isActive is set false.
   */
  async publicSubmit(
    token: string,
    dto: {
      values: ValueMap;
      submitterName?: string;
      gpsLat?: number;
      gpsLng?: number;
    }
  ) {
    const link = await this.resolveActiveLink(token);

    // Find the latest active version
    const version = await this.prisma.formTemplateVersion.findFirst({
      where: { templateId: link.templateId, status: "ACTIVE" },
      orderBy: { versionNumber: "desc" },
      include: {
        template: true,
        sections: {
          orderBy: { sectionOrder: "asc" },
          include: { fields: { orderBy: { fieldOrder: "asc" } } }
        }
      }
    });

    if (!version) {
      throw new NotFoundException("This form has no active version.");
    }

    // Validate required fields
    const allFields = version.sections.flatMap((s) => s.fields);
    const missing: string[] = [];
    for (const field of allFields) {
      if (!field.isRequired) continue;
      const conditions = (field.conditions ?? []) as unknown as FieldRule[];
      const isVisible = this.rules.evaluateFieldVisibility(conditions, dto.values);
      if (!isVisible) continue;
      const val = dto.values[field.fieldKey];
      if (val === null || val === undefined || val === "") {
        missing.push(field.label);
      }
    }
    if (missing.length > 0) {
      throw new BadRequestException(`Required fields missing: ${missing.join(", ")}`);
    }

    // Build context blob
    const context: Record<string, unknown> = { isPublic: true };
    if (dto.submitterName) context.submitterName = dto.submitterName;
    if (link.siteId) context.siteId = link.siteId;
    if (link.jobId) context.jobId = link.jobId;

    // Create submission (submittedById = null = anonymous public)
    const submission = await this.prisma.formSubmission.create({
      data: {
        templateVersionId: version.id,
        submittedById: null,
        publicLinkId: link.id,
        siteId: link.siteId ?? null,
        jobId: link.jobId ?? null,
        status: "submitted",
        submittedAt: new Date(),
        gpsLat: dto.gpsLat !== undefined ? new Prisma.Decimal(dto.gpsLat) : null,
        gpsLng: dto.gpsLng !== undefined ? new Prisma.Decimal(dto.gpsLng) : null,
        context: context as Prisma.InputJsonValue
      }
    });

    // Persist values
    const fieldByKey = new Map(allFields.map((f) => [f.fieldKey, f]));
    for (const [fieldKey, raw] of Object.entries(dto.values)) {
      const field = fieldByKey.get(fieldKey);
      if (!field) continue;
      const shaped = this.shapeValue(field.fieldType, raw);
      await this.prisma.formSubmissionValue.create({
        data: {
          submissionId: submission.id,
          fieldKey,
          fieldId: field.id,
          ...shaped
        }
      });
    }

    // Increment count and auto-deactivate if cap reached
    const updatedLink = await this.prisma.formPublicLink.update({
      where: { id: link.id },
      data: { submissionCount: { increment: 1 } }
    });
    if (
      updatedLink.maxSubmissions !== null &&
      updatedLink.submissionCount >= updatedLink.maxSubmissions
    ) {
      await this.prisma.formPublicLink.update({
        where: { id: link.id },
        data: { isActive: false }
      });
    }

    return {
      submissionId: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────

  /**
   * Resolve a token to an active, non-expired, non-capped link.
   * Throws descriptive HTTP exceptions for each failure mode.
   */
  private async resolveActiveLink(token: string) {
    const link = await this.prisma.formPublicLink.findUnique({ where: { token } });
    if (!link) throw new NotFoundException("Form link not found or has expired.");
    if (!link.isActive) throw new ForbiddenException("This form link is no longer active.");
    if (link.expiresAt && link.expiresAt < new Date()) {
      // Auto-deactivate lazily
      void this.prisma.formPublicLink
        .update({ where: { id: link.id }, data: { isActive: false } })
        .catch(() => undefined);
      throw new GoneException("This form link has expired.");
    }
    if (
      link.maxSubmissions !== null &&
      link.submissionCount >= link.maxSubmissions
    ) {
      throw new GoneException("This form link has reached its maximum number of submissions.");
    }
    return link;
  }

  /** Shape a raw value into FormSubmissionValue columns (mirrors FormsEngineService). */
  private shapeValue(fieldType: string, raw: unknown) {
    const empty = {
      valueText: null as string | null,
      valueNumber: null as Prisma.Decimal | null,
      valueBoolean: null as boolean | null,
      valueDateTime: null as Date | null,
      valueJson: Prisma.JsonNull as Prisma.NullableJsonNullValueInput
    };
    if (raw === null || raw === undefined) return empty;
    if (fieldType === "toggle" || fieldType === "checkbox") {
      return { ...empty, valueBoolean: Boolean(raw) };
    }
    if (
      fieldType === "number" ||
      fieldType === "currency" ||
      fieldType === "percentage" ||
      fieldType === "rating" ||
      fieldType === "slider" ||
      fieldType === "nps"
    ) {
      const numVal = typeof raw === "number" ? raw : Number(raw);
      return { ...empty, valueNumber: Number.isFinite(numVal) ? new Prisma.Decimal(numVal) : null };
    }
    if (fieldType === "date" || fieldType === "datetime" || fieldType === "time") {
      const dtVal = typeof raw === "string" || typeof raw === "number" ? new Date(raw) : raw;
      return {
        ...empty,
        valueDateTime: dtVal instanceof Date && !Number.isNaN(dtVal.getTime()) ? dtVal : null
      };
    }
    if (Array.isArray(raw) || (typeof raw === "object" && raw !== null)) {
      return { ...empty, valueJson: raw as Prisma.InputJsonValue };
    }
    return { ...empty, valueText: String(raw) };
  }
}
