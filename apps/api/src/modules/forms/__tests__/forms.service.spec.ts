import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { FormsService } from "../forms.service";

// ─── Fixtures ──────────────────────────────────────────────────────────────

function templateRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "tpl-1",
    name: "Daily Prestart",
    code: "PRESTART",
    description: null,
    status: "ACTIVE",
    geolocationEnabled: false,
    associationScopes: [],
    category: "custom",
    isSystemTemplate: false,
    settings: {},
    versions: [],
    ...overrides
  };
}

function versionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "ver-1",
    templateId: "tpl-1",
    versionNumber: 1,
    status: "ACTIVE",
    sections: [
      {
        id: "sec-1",
        title: "Main",
        sectionOrder: 1,
        fields: [
          {
            id: "fld-notes",
            sectionId: "sec-1",
            fieldKey: "notes",
            label: "Notes",
            fieldType: "textarea",
            fieldOrder: 1,
            isRequired: false
          },
          {
            id: "fld-signoff",
            sectionId: "sec-1",
            fieldKey: "signoff",
            label: "Sign-off",
            fieldType: "text",
            fieldOrder: 2,
            isRequired: true
          }
        ]
      }
    ],
    rules: [],
    ...overrides
  };
}

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    templateVersionId: "ver-1",
    status: "SUBMITTED",
    submittedAt: new Date("2026-06-01T00:00:00Z"),
    submittedById: "user-1",
    jobId: null,
    clientId: null,
    assetId: null,
    workerId: null,
    siteId: null,
    shiftId: null,
    supplierName: null,
    geolocation: null,
    summary: null,
    templateVersion: { id: "ver-1", template: templateRow() },
    job: null,
    client: null,
    asset: null,
    worker: null,
    site: null,
    shift: null,
    values: [],
    attachments: [],
    signatures: [],
    ...overrides
  };
}

const VALID_TEMPLATE_DTO = {
  name: "Daily Prestart",
  code: "PRESTART",
  sections: [
    {
      title: "Main",
      sectionOrder: 1,
      fields: [
        {
          fieldKey: "notes",
          label: "Notes",
          fieldType: "textarea",
          fieldOrder: 1
        }
      ]
    }
  ]
};

// ─── Mock builders ─────────────────────────────────────────────────────────

type TxClient = {
  formTemplate: { create: jest.Mock; update: jest.Mock };
  formTemplateVersion: { create: jest.Mock; findFirst: jest.Mock };
  formSection: { create: jest.Mock };
  formField: { createMany: jest.Mock };
  formRule: { createMany: jest.Mock };
};

function buildTxClient(): TxClient {
  return {
    formTemplate: {
      create: jest.fn().mockResolvedValue({ id: "tpl-new" }),
      update: jest.fn().mockResolvedValue({ id: "tpl-1" })
    },
    formTemplateVersion: {
      create: jest.fn().mockResolvedValue({ id: "ver-new", templateId: "tpl-new", versionNumber: 1 }),
      findFirst: jest.fn().mockResolvedValue(null)
    },
    formSection: { create: jest.fn().mockResolvedValue({ id: "sec-new" }) },
    formField: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    formRule: { createMany: jest.fn().mockResolvedValue({ count: 0 }) }
  };
}

function buildPrismaMock() {
  const tx = buildTxClient();
  const defaultTemplate = templateRow();
  const prisma = {
    formTemplate: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(defaultTemplate),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0)
    },
    formTemplateVersion: {
      findUnique: jest.fn().mockResolvedValue(versionRow())
    },
    formSubmission: {
      findUnique: jest.fn().mockResolvedValue(submissionRow()),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(submissionRow())
    },
    documentLink: {
      findMany: jest.fn().mockResolvedValue([])
    },
    $transaction: jest.fn().mockImplementation(async (input: unknown) => {
      if (typeof input === "function") {
        return (input as (client: TxClient) => Promise<unknown>)(tx);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    })
  };
  return { prisma, tx };
}

function buildService() {
  const { prisma, tx } = buildPrismaMock();
  const audit = { write: jest.fn().mockResolvedValue(undefined) };
  const service = new FormsService(prisma as never, audit as never);
  return { service, prisma, tx, audit };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FormsService.listTemplates", () => {
  it("applies pagination defaults and an empty where clause when no filters are given", async () => {
    const { service, prisma } = buildService();

    const result = await service.listTemplates({ page: 1, pageSize: 10 } as never);

    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 10 });
    expect(prisma.formTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 10 })
    );
  });

  it("builds the where clause from q and status filters and paginates correctly", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findMany.mockResolvedValueOnce([templateRow()]);
    prisma.formTemplate.count.mockResolvedValueOnce(1);

    await service.listTemplates({ page: 3, pageSize: 5, q: "prestart", status: "ACTIVE" } as never);

    const call = prisma.formTemplate.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
      skip: number;
      take: number;
    };
    expect(call.skip).toBe(10);
    expect(call.take).toBe(5);
    expect(call.where).toMatchObject({
      status: "ACTIVE",
      OR: [
        { name: { contains: "prestart", mode: "insensitive" } },
        { code: { contains: "prestart", mode: "insensitive" } }
      ]
    });
  });
});

describe("FormsService.getTemplate", () => {
  it("returns the template when it exists", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ id: "tpl-42" }));

    const result = await service.getTemplate("tpl-42");

    expect(result.id).toBe("tpl-42");
    expect(prisma.formTemplate.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tpl-42" } })
    );
  });

  it("throws NotFoundException when the template does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(null);

    await expect(service.getTemplate("missing")).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("FormsService.createTemplate", () => {
  it("throws ConflictException when a template with the same name or code already exists", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findFirst.mockResolvedValueOnce({ id: "tpl-existing" });

    await expect(service.createTemplate(VALID_TEMPLATE_DTO as never, "user-1")).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it("creates the template, version, sections, fields, and writes an audit log on the happy path", async () => {
    const { service, prisma, tx, audit } = buildService();
    tx.formTemplate.create.mockResolvedValueOnce({ id: "tpl-new" });
    tx.formTemplateVersion.create.mockResolvedValueOnce({ id: "ver-new", templateId: "tpl-new", versionNumber: 1 });
    tx.formSection.create.mockResolvedValueOnce({ id: "sec-new" });
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ id: "tpl-new" }));

    const result = await service.createTemplate(VALID_TEMPLATE_DTO as never, "user-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.formTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "Daily Prestart", code: "PRESTART", status: "ACTIVE" })
      })
    );
    expect(tx.formTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateId: "tpl-new", versionNumber: 1, status: "ACTIVE" })
      })
    );
    expect(tx.formSection.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionId: "ver-new", title: "Main", sectionOrder: 1 })
      })
    );
    expect(tx.formField.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ fieldKey: "notes", label: "Notes" })
        ])
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        action: "forms.template.create",
        entityType: "FormTemplate",
        entityId: "tpl-new"
      })
    );
    expect(result.id).toBe("tpl-new");
  });

  it("creates form rules when rules are supplied in the DTO", async () => {
    const { service, tx } = buildService();
    tx.formTemplate.create.mockResolvedValueOnce({ id: "tpl-new" });
    tx.formTemplateVersion.create.mockResolvedValueOnce({ id: "ver-new", templateId: "tpl-new", versionNumber: 1 });

    await service.createTemplate(
      {
        ...VALID_TEMPLATE_DTO,
        rules: [
          { sourceFieldKey: "notes", targetFieldKey: "signoff", operator: "EQUALS", comparisonValue: "yes" }
        ]
      } as never,
      "user-1"
    );

    expect(tx.formRule.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            versionId: "ver-new",
            sourceFieldKey: "notes",
            targetFieldKey: "signoff",
            operator: "EQUALS",
            effect: "SHOW"
          })
        ])
      })
    );
  });
});

describe("FormsService.createNextVersion", () => {
  it("throws NotFoundException when the parent template does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createNextVersion("missing", VALID_TEMPLATE_DTO as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("increments versionNumber from the latest existing version and writes audit metadata", async () => {
    const { service, prisma, tx, audit } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ id: "tpl-1" }));
    tx.formTemplate.update.mockResolvedValueOnce({ id: "tpl-1" });
    tx.formTemplateVersion.findFirst.mockResolvedValueOnce({ versionNumber: 4 });
    tx.formTemplateVersion.create.mockResolvedValueOnce({ id: "ver-5", templateId: "tpl-1", versionNumber: 5 });
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ id: "tpl-1" }));

    await service.createNextVersion("tpl-1", VALID_TEMPLATE_DTO as never, "user-1");

    expect(tx.formTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tpl-1" } })
    );
    expect(tx.formTemplateVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ templateId: "tpl-1", versionNumber: 5 })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "forms.template.version.create",
        entityType: "FormTemplate",
        entityId: "tpl-1",
        metadata: { templateId: "tpl-1" }
      })
    );
  });
});

describe("FormsService.updateTemplateMetadata", () => {
  it("rejects edits to system templates with 403", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: true }));

    await expect(
      service.updateTemplateMetadata("tpl-1", { name: "Renamed" }, "user-1")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws ConflictException when a rename collides with another template", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: false }));
    prisma.formTemplate.findFirst.mockResolvedValueOnce({ id: "tpl-other" });

    await expect(
      service.updateTemplateMetadata("tpl-1", { name: "Existing" }, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("patches only the supplied fields and writes an audit log", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: false }));
    const update = jest.fn().mockResolvedValue({ id: "tpl-1" });
    (prisma.formTemplate as unknown as { update: jest.Mock }).update = update;

    await service.updateTemplateMetadata(
      "tpl-1",
      { description: "New desc", geolocationEnabled: true },
      "user-1"
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({ description: "New desc", geolocationEnabled: true })
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.template.update", entityType: "FormTemplate" })
    );
  });
});

describe("FormsService.archiveTemplate / unarchiveTemplate", () => {
  it("archive rejects system templates with 403", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: true }));

    await expect(service.archiveTemplate("tpl-1", "user-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("archive sets status ARCHIVED and audits", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: false }));
    const update = jest.fn().mockResolvedValue({ id: "tpl-1" });
    (prisma.formTemplate as unknown as { update: jest.Mock }).update = update;

    await service.archiveTemplate("tpl-1", "user-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tpl-1" }, data: { status: "ARCHIVED" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.template.archive" })
    );
  });

  it("unarchive rejects templates that are not currently archived", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ status: "ACTIVE" }));

    await expect(service.unarchiveTemplate("tpl-1", "user-1")).rejects.toBeInstanceOf(ConflictException);
  });

  it("unarchive resets status to DRAFT and audits", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ status: "ARCHIVED" }));
    const update = jest.fn().mockResolvedValue({ id: "tpl-1" });
    (prisma.formTemplate as unknown as { update: jest.Mock }).update = update;

    await service.unarchiveTemplate("tpl-1", "user-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "tpl-1" }, data: { status: "DRAFT" } })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.template.unarchive" })
    );
  });
});

describe("FormsService.deleteTemplate", () => {
  it("rejects system templates with 403", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: true }));

    await expect(service.deleteTemplate("tpl-1", "user-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects templates with submissions (409) and never deletes", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: false }));
    prisma.formSubmission.count.mockResolvedValueOnce(3);
    const del = jest.fn();
    (prisma.formTemplate as unknown as { delete: jest.Mock }).delete = del;

    await expect(service.deleteTemplate("tpl-1", "user-1")).rejects.toBeInstanceOf(ConflictException);
    expect(del).not.toHaveBeenCalled();
  });

  it("hard-deletes when no submissions and audits", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: false }));
    prisma.formSubmission.count.mockResolvedValueOnce(0);
    const del = jest.fn().mockResolvedValue({ id: "tpl-1" });
    (prisma.formTemplate as unknown as { delete: jest.Mock }).delete = del;

    const result = await service.deleteTemplate("tpl-1", "user-1");

    expect(del).toHaveBeenCalledWith({ where: { id: "tpl-1" } });
    expect(result).toEqual({ id: "tpl-1" });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({ action: "forms.template.delete" })
    );
  });
});

describe("FormsService.duplicateTemplate", () => {
  it("clones fields into a new custom draft template", async () => {
    const { service, prisma, tx, audit } = buildService();
    const source = templateRow({
      id: "tpl-src",
      name: "System Prestart",
      code: "SYS-PRESTART",
      isSystemTemplate: true,
      category: "safety",
      versions: [versionRow()]
    });
    // First getTemplate (source), second getTemplate (created)
    prisma.formTemplate.findUnique
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(templateRow({ id: "tpl-new" }));
    // Uniqueness probes: first findFirst call for name → null (unique), then code → null
    prisma.formTemplate.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    tx.formTemplate.create.mockResolvedValueOnce({ id: "tpl-new" });
    tx.formTemplateVersion.create.mockResolvedValueOnce({ id: "ver-new", templateId: "tpl-new", versionNumber: 1 });
    tx.formSection.create.mockResolvedValueOnce({ id: "sec-new" });

    const result = await service.duplicateTemplate("tpl-src", "user-1");

    expect(tx.formTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Copy of System Prestart",
          code: "SYS-PRESTART-COPY",
          status: "DRAFT",
          category: "safety",
          isSystemTemplate: false
        })
      })
    );
    expect(tx.formField.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ fieldKey: "notes" }),
          expect.objectContaining({ fieldKey: "signoff" })
        ])
      })
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "forms.template.duplicate",
        metadata: { sourceTemplateId: "tpl-src" }
      })
    );
    expect(result.id).toBe("tpl-new");
  });
});

describe("FormsService.createNextVersion (system guard)", () => {
  it("rejects edits to system templates with 403", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplate.findUnique.mockResolvedValueOnce(templateRow({ isSystemTemplate: true }));

    await expect(
      service.createNextVersion("tpl-1", VALID_TEMPLATE_DTO as never, "user-1")
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe("FormsService.listSubmissions", () => {
  it("applies pagination defaults and an empty where clause when no filters are given", async () => {
    const { service, prisma } = buildService();

    const result = await service.listSubmissions({ page: 1, pageSize: 10 } as never);

    expect(result).toMatchObject({ items: [], total: 0, page: 1, pageSize: 10 });
    expect(prisma.formSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {}, skip: 0, take: 10 })
    );
  });

  it("builds where clause from q (matches summary and template name) and status", async () => {
    const { service, prisma } = buildService();

    await service.listSubmissions({ page: 1, pageSize: 10, q: "weld", status: "SUBMITTED" } as never);

    const call = prisma.formSubmission.findMany.mock.calls[0][0] as { where: Record<string, unknown> };
    expect(call.where).toMatchObject({
      status: "SUBMITTED",
      OR: [
        { summary: { contains: "weld", mode: "insensitive" } },
        { templateVersion: { template: { name: { contains: "weld", mode: "insensitive" } } } }
      ]
    });
  });
});

describe("FormsService.getSubmission", () => {
  it("throws NotFoundException when the submission does not exist", async () => {
    const { service, prisma } = buildService();
    prisma.formSubmission.findUnique.mockResolvedValueOnce(null);

    await expect(service.getSubmission("missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns the submission with attached documents linked by entity id/type", async () => {
    const { service, prisma } = buildService();
    prisma.formSubmission.findUnique.mockResolvedValueOnce(submissionRow({ id: "sub-42" }));
    prisma.documentLink.findMany.mockResolvedValueOnce([{ id: "doc-1" }]);

    const result = await service.getSubmission("sub-42");

    expect(result.id).toBe("sub-42");
    expect(result.documents).toEqual([{ id: "doc-1" }]);
    expect(prisma.documentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkedEntityType: "FormSubmission", linkedEntityId: "sub-42" }
      })
    );
  });

  it("includes templateVersion sections and nested fields so FormFillPage can render", async () => {
    const { service, prisma } = buildService();
    const submissionWithSections = submissionRow({
      id: "sub-shape",
      templateVersion: {
        id: "ver-1",
        template: templateRow(),
        sections: [
          {
            id: "sec-1",
            title: "Main",
            sectionOrder: 1,
            fields: [
              { id: "fld-1", sectionId: "sec-1", fieldKey: "notes", fieldOrder: 1 }
            ]
          }
        ]
      }
    });
    prisma.formSubmission.findUnique.mockResolvedValueOnce(submissionWithSections);

    const result = await service.getSubmission("sub-shape");

    expect(prisma.formSubmission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          templateVersion: expect.objectContaining({
            include: expect.objectContaining({
              sections: expect.objectContaining({
                orderBy: { sectionOrder: "asc" },
                include: expect.objectContaining({
                  fields: expect.objectContaining({
                    orderBy: { fieldOrder: "asc" }
                  })
                })
              })
            })
          })
        })
      })
    );
    expect(result.templateVersion.sections).toHaveLength(1);
    expect(result.templateVersion.sections[0].fields[0].fieldKey).toBe("notes");
  });
});

describe("FormsService.submit", () => {
  it("throws NotFoundException when the template version is missing", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplateVersion.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.submit("missing-version", { values: [] } as never, "user-1")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws ConflictException when a required field is not present in the submitted values", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplateVersion.findUnique.mockResolvedValueOnce(versionRow());

    await expect(
      service.submit("ver-1", { values: [{ fieldKey: "notes", valueText: "ok" }] } as never, "user-1")
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("creates the submission with mapped values, defaults status to SUBMITTED, and writes an audit log", async () => {
    const { service, prisma, audit } = buildService();
    prisma.formTemplateVersion.findUnique.mockResolvedValueOnce(versionRow());
    prisma.formSubmission.create.mockResolvedValueOnce(submissionRow({ id: "sub-new" }));

    await service.submit(
      "ver-1",
      {
        values: [
          { fieldKey: "notes", valueText: "All good" },
          { fieldKey: "signoff", valueText: "Marco" }
        ],
        attachments: [{ fileName: "evidence.pdf" }],
        signatures: [{ signerName: "Marco" }]
      } as never,
      "user-1"
    );

    const createArgs = prisma.formSubmission.create.mock.calls[0][0] as {
      data: { status: string; values: { create: Array<Record<string, unknown>> } };
    };
    expect(createArgs.data.status).toBe("SUBMITTED");
    expect(createArgs.data.values.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldKey: "notes", fieldId: "fld-notes", valueText: "All good" }),
        expect.objectContaining({ fieldKey: "signoff", fieldId: "fld-signoff", valueText: "Marco" })
      ])
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "forms.submission.create",
        entityType: "FormSubmission",
        entityId: "sub-new",
        metadata: { versionId: "ver-1" }
      })
    );
  });

  it("converts numeric and date inputs into Prisma.Decimal and Date instances", async () => {
    const { service, prisma } = buildService();
    prisma.formTemplateVersion.findUnique.mockResolvedValueOnce(
      versionRow({
        sections: [
          {
            id: "sec-1",
            title: "Main",
            sectionOrder: 1,
            fields: [
              { id: "fld-temp", sectionId: "sec-1", fieldKey: "temp", label: "Temp", fieldType: "number", fieldOrder: 1, isRequired: false },
              { id: "fld-when", sectionId: "sec-1", fieldKey: "when", label: "When", fieldType: "datetime", fieldOrder: 2, isRequired: false }
            ]
          }
        ]
      })
    );

    await service.submit(
      "ver-1",
      {
        values: [
          { fieldKey: "temp", valueNumber: 23.5 },
          { fieldKey: "when", valueDateTime: "2026-06-01T08:30:00Z" }
        ]
      } as never,
      "user-1"
    );

    const createArgs = prisma.formSubmission.create.mock.calls[0][0] as {
      data: { values: { create: Array<Record<string, unknown>> } };
    };
    const tempValue = createArgs.data.values.create.find((v) => v.fieldKey === "temp");
    const whenValue = createArgs.data.values.create.find((v) => v.fieldKey === "when");
    expect(tempValue?.valueNumber).toBeInstanceOf(Prisma.Decimal);
    expect((tempValue?.valueNumber as Prisma.Decimal).toString()).toBe("23.5");
    expect(whenValue?.valueDateTime).toBeInstanceOf(Date);
    expect((whenValue?.valueDateTime as Date).toISOString()).toBe("2026-06-01T08:30:00.000Z");
  });
});
