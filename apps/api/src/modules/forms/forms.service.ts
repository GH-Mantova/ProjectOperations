import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { FormsQueryDto, SubmitFormDto, UpsertFormTemplateDto } from "./dto/forms.dto";

const templateInclude = {
  versions: {
    orderBy: { versionNumber: "desc" },
    include: {
      sections: {
        orderBy: { sectionOrder: "asc" },
        include: {
          fields: {
            orderBy: { fieldOrder: "asc" }
          }
        }
      },
      rules: true
    }
  }
} as const;

const submissionInclude = {
  templateVersion: {
    include: {
      template: true,
      sections: {
        orderBy: { sectionOrder: "asc" },
        include: {
          fields: {
            orderBy: { fieldOrder: "asc" }
          }
        }
      }
    }
  },
  job: true,
  client: true,
  asset: true,
  worker: true,
  site: true,
  shift: true,
  values: {
    orderBy: { createdAt: "asc" }
  },
  attachments: true,
  signatures: true
} as const;

/**
 * Persistence layer for form templates, versions and raw submissions.
 *
 * Templates are immutable-by-version: edits always create a new
 * FormTemplateVersion rather than mutating fields in place. Every write
 * method records an audit entry via AuditService.
 */
@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  /**
   * List form templates filtered by name/code search and status.
   *
   * @param query - q matches name or code (case-insensitive); status is exact
   * @returns paginated `{ items, total, page, pageSize }`, newest first
   */
  async listTemplates(query: FormsQueryDto) {
    const where: Prisma.FormTemplateWhereInput = {
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: "insensitive" } },
              { code: { contains: query.q, mode: "insensitive" } }
            ]
          }
        : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.formTemplate.findMany({
        where,
        include: templateInclude,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.formTemplate.count({ where })
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Get a form template with all versions, sections, fields and rules.
   *
   * @param id - form template id
   * @returns the template, versions ordered newest first
   * @throws NotFoundException when the template does not exist
   */
  async getTemplate(id: string) {
    const template = await this.prisma.formTemplate.findUnique({
      where: { id },
      include: templateInclude
    });

    if (!template) {
      throw new NotFoundException("Form template not found.");
    }

    return template;
  }

  /**
   * Create a new form template together with version 1 in one transaction.
   *
   * Writes a `forms.template.create` audit entry after the transaction commits.
   *
   * @param dto - template metadata plus sections/fields/rules for the first version
   * @param actorId - user id recorded against the audit entry
   * @returns the freshly created template via getTemplate
   * @throws ConflictException when a template with the same name or code exists
   */
  async createTemplate(dto: UpsertFormTemplateDto, actorId?: string) {
    const existing = await this.prisma.formTemplate.findFirst({
      where: {
        OR: [{ code: dto.code }, { name: dto.name }]
      }
    });

    if (existing) {
      throw new ConflictException("Form template name or code already exists.");
    }

    const template = await this.prisma.$transaction((tx) =>
      this.createTemplateVersion(tx, undefined, dto, true)
    );

    await this.auditService.write({
      actorId,
      action: "forms.template.create",
      entityType: "FormTemplate",
      entityId: template.id
    });

    return this.getTemplate(template.id);
  }

  /**
   * Append the next version to an existing template.
   *
   * Also updates template-level metadata (name, code, status, scopes) from
   * the dto, then writes a `forms.template.version.create` audit entry.
   *
   * @param templateId - existing template id
   * @param dto - full template payload used for both metadata and the new version
   * @param actorId - user id recorded against the audit entry
   * @returns the template with all versions via getTemplate
   * @throws NotFoundException when the template does not exist
   */
  async createNextVersion(templateId: string, dto: UpsertFormTemplateDto, actorId?: string) {
    await this.requireTemplate(templateId);

    const template = await this.prisma.$transaction((tx) =>
      this.createTemplateVersion(tx, templateId, dto, false)
    );

    await this.auditService.write({
      actorId,
      action: "forms.template.version.create",
      entityType: "FormTemplate",
      entityId: template.id,
      metadata: { templateId }
    });

    return this.getTemplate(template.id);
  }

  /**
   * List form submissions filtered by summary/template-name search and status.
   *
   * @param query - q matches submission summary or template name; status is exact
   * @returns paginated `{ items, total, page, pageSize }`, most recently submitted first
   */
  async listSubmissions(query: FormsQueryDto) {
    const where: Prisma.FormSubmissionWhereInput = {
      ...(query.q
        ? {
            OR: [
              { summary: { contains: query.q, mode: "insensitive" } },
              { templateVersion: { template: { name: { contains: query.q, mode: "insensitive" } } } }
            ]
          }
        : {}),
      ...(query.status ? { status: query.status } : {})
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.formSubmission.findMany({
        where,
        include: submissionInclude,
        orderBy: { submittedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.formSubmission.count({ where })
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Get a submission with values, attachments, signatures and entity links.
   *
   * Also resolves DocumentLink rows pointed at this submission and returns
   * them as a derived `documents` array on the response.
   *
   * @param id - submission id
   * @returns the submission plus `documents`
   * @throws NotFoundException when the submission does not exist
   */
  async getSubmission(id: string) {
    const submission = await this.prisma.formSubmission.findUnique({
      where: { id },
      include: submissionInclude
    });

    if (!submission) {
      throw new NotFoundException("Form submission not found.");
    }

    const documents = await this.prisma.documentLink.findMany({
      where: {
        linkedEntityType: "FormSubmission",
        linkedEntityId: id
      },
      include: {
        fileLink: true,
        tags: true
      },
      orderBy: { createdAt: "desc" }
    });

    return {
      ...submission,
      documents
    };
  }

  /**
   * Create a submission against a specific template version.
   *
   * Enforces presence of every field flagged isRequired, then persists
   * values/attachments/signatures in one create. Writes a
   * `forms.submission.create` audit entry. Status defaults to "SUBMITTED".
   *
   * @param versionId - template version being submitted against
   * @param dto - field values plus optional attachments, signatures and entity links
   * @param actorId - recorded as submittedById and on the audit entry
   * @returns the created submission with full includes
   * @throws NotFoundException when the template version does not exist
   * @throws ConflictException when a required field key is absent from dto.values
   */
  async submit(versionId: string, dto: SubmitFormDto, actorId?: string) {
    const version = await this.requireVersion(versionId);
    const fields = version.sections.flatMap((section) => section.fields);
    const fieldByKey = new Map(fields.map((field) => [field.fieldKey, field]));
    const submittedKeys = new Set(dto.values.map((value) => value.fieldKey));

    for (const field of fields.filter((item) => item.isRequired)) {
      if (!submittedKeys.has(field.fieldKey)) {
        throw new ConflictException(`Required field missing: ${field.label}`);
      }
    }

    const submission = await this.prisma.formSubmission.create({
      data: {
        templateVersionId: versionId,
        status: dto.status ?? "SUBMITTED",
        submittedById: actorId ?? null,
        jobId: dto.jobId ?? null,
        clientId: dto.clientId ?? null,
        assetId: dto.assetId ?? null,
        workerId: dto.workerId ?? null,
        siteId: dto.siteId ?? null,
        shiftId: dto.shiftId ?? null,
        supplierName: dto.supplierName ?? null,
        geolocation: dto.geolocation ?? null,
        summary: dto.summary ?? null,
        values: {
          create: dto.values.map((value) => ({
            fieldId: fieldByKey.get(value.fieldKey)?.id ?? null,
            fieldKey: value.fieldKey,
            valueText: value.valueText ?? null,
            valueNumber: value.valueNumber != null ? new Prisma.Decimal(value.valueNumber) : null,
            valueDateTime: value.valueDateTime ? new Date(value.valueDateTime) : null,
            valueJson: value.valueJson ?? Prisma.JsonNull
          }))
        },
        attachments: {
          create: (dto.attachments ?? []).map((attachment) => ({
            fieldKey: attachment.fieldKey ?? null,
            fileName: attachment.fileName,
            fileUrl: attachment.fileUrl ?? null
          }))
        },
        signatures: {
          create: (dto.signatures ?? []).map((signature) => ({
            fieldKey: signature.fieldKey ?? null,
            signerName: signature.signerName,
            signedAt: signature.signedAt ? new Date(signature.signedAt) : new Date()
          }))
        }
      },
      include: submissionInclude
    });

    await this.auditService.write({
      actorId,
      action: "forms.submission.create",
      entityType: "FormSubmission",
      entityId: submission.id,
      metadata: { versionId }
    });

    return submission;
  }

  private async createTemplateVersion(
    tx: Prisma.TransactionClient | PrismaClient,
    templateId: string | undefined,
    dto: UpsertFormTemplateDto,
    createTemplate: boolean
  ) {
    const template = createTemplate
      ? await tx.formTemplate.create({
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description ?? null,
            status: dto.status ?? "ACTIVE",
            geolocationEnabled: dto.geolocationEnabled ?? false,
            associationScopes: dto.associationScopes ?? []
          }
        })
      : await tx.formTemplate.update({
          where: { id: templateId! },
          data: {
            name: dto.name,
            code: dto.code,
            description: dto.description ?? null,
            status: dto.status ?? "ACTIVE",
            geolocationEnabled: dto.geolocationEnabled ?? false,
            associationScopes: dto.associationScopes ?? []
          }
        });

    const latestVersion = await tx.formTemplateVersion.findFirst({
      where: { templateId: template.id },
      orderBy: { versionNumber: "desc" }
    });

    const version = await tx.formTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: latestVersion ? latestVersion.versionNumber + 1 : 1,
        status: "ACTIVE"
      }
    });

    for (const sectionInput of dto.sections) {
      const section = await tx.formSection.create({
        data: {
          versionId: version.id,
          title: sectionInput.title,
          description: sectionInput.description ?? null,
          sectionOrder: sectionInput.sectionOrder
        }
      });

      if (sectionInput.fields.length > 0) {
        await tx.formField.createMany({
          data: sectionInput.fields.map((field) => ({
            sectionId: section.id,
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            fieldOrder: field.fieldOrder,
            isRequired: field.isRequired ?? false,
            placeholder: field.placeholder ?? null,
            helpText: field.helpText ?? null,
            optionsJson: field.optionsJson ?? Prisma.JsonNull
          }))
        });
      }
    }

    if ((dto.rules ?? []).length > 0) {
      await tx.formRule.createMany({
        data: (dto.rules ?? []).map((rule) => ({
          versionId: version.id,
          sourceFieldKey: rule.sourceFieldKey,
          targetFieldKey: rule.targetFieldKey,
          operator: rule.operator,
          comparisonValue: rule.comparisonValue ?? null,
          effect: rule.effect ?? "SHOW"
        }))
      });
    }

    return template;
  }

  private async requireTemplate(id: string) {
    const template = await this.prisma.formTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException("Form template not found.");
    }
    return template;
  }

  private async requireVersion(id: string) {
    const version = await this.prisma.formTemplateVersion.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            fields: true
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundException("Form template version not found.");
    }

    return version;
  }
}
