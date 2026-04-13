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
      template: true
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

@Injectable()
export class FormsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

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
