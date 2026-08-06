import { PrismaClient } from "@prisma/client";

// B-HW-1: Default handover template seed — v1, isActive true.
//
// Idempotent: checks for an existing version-1 template and skips if found.
// Field `key` values are stable identifiers that HandoverValue rows will bind
// to in B-HW-5+. Never change or delete a key — use retiredAt instead.
//
// Derived from docs/plans/contract-handover-wizard-plan.md §3–§5.
// autoBinding values are dot-path references to the auto-prefill source
// (contract / tender / awarded quote) resolved in B-HW-6.

export async function seedHandoverDefaultTemplate(prisma: PrismaClient): Promise<void> {
  const existingV1 = await prisma.handoverTemplate.findFirst({
    where: { version: 1 }
  });
  if (existingV1) {
    // Idempotent: v1 already seeded, nothing to do.
    return;
  }

  const now = new Date();

  const template = await prisma.handoverTemplate.create({
    data: {
      version: 1,
      isActive: true,
      publishedAt: now
    }
  });

  // ── Section definitions ──────────────────────────────────────────────────
  // Each section is inserted with an explicit sortOrder so re-running the
  // seed produces stable ordering regardless of DB insertion timing.
  type FieldDef = {
    key: string;
    label: string;
    type: "text" | "money" | "date" | "list" | "attachment" | "contact";
    sourceType: "auto" | "capture" | "attach" | "derived";
    autoBinding?: string;
    listId?: string;
    required: boolean;
    sortOrder: number;
  };

  type SectionDef = {
    key: string;
    label: string;
    sortOrder: number;
    fields: FieldDef[];
  };

  const sections: SectionDef[] = [
    // ── 1. Project details ──────────────────────────────────────────────────
    {
      key: "project-details",
      label: "Project details",
      sortOrder: 1,
      fields: [
        {
          key: "project-name",
          label: "Project name",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.title",
          required: true,
          sortOrder: 1
        },
        {
          key: "tender-number",
          label: "Tender number",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.tenderNumber",
          required: true,
          sortOrder: 2
        },
        {
          key: "contract-number",
          label: "Contract number",
          type: "text",
          sourceType: "auto",
          autoBinding: "contract.contractNumber",
          required: false,
          sortOrder: 3
        },
        {
          key: "client-name",
          label: "Client name",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.client.name",
          required: true,
          sortOrder: 4
        },
        {
          key: "site-address",
          label: "Site address",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.site.address",
          required: true,
          sortOrder: 5
        },
        {
          key: "project-description",
          label: "Project description / scope summary",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 6
        },
        {
          key: "contract-execution-date",
          label: "Contract execution date",
          type: "date",
          sourceType: "auto",
          autoBinding: "contract.createdAt",
          required: false,
          sortOrder: 7
        }
      ]
    },

    // ── 2. Pricing & budget ─────────────────────────────────────────────────
    // This is wizard step #1 (absorbs item #1 — contract value breakdown).
    // Values prefilled from the awarded ClientQuote; PM may adjust before finalise.
    {
      key: "pricing-budget",
      label: "Pricing & budget",
      sortOrder: 2,
      fields: [
        {
          key: "contract-value",
          label: "Contract value (ex GST)",
          type: "money",
          sourceType: "auto",
          autoBinding: "contract.contractValue",
          required: true,
          sortOrder: 1
        },
        {
          key: "awarded-quote-total",
          label: "Awarded quote total (ex GST)",
          type: "money",
          sourceType: "auto",
          autoBinding: "awardedQuote.total",
          required: false,
          sortOrder: 2
        },
        {
          key: "quote-vs-contract-variance",
          label: "Quote vs contract variance",
          type: "money",
          sourceType: "derived",
          required: false,
          sortOrder: 3
        },
        {
          key: "provisional-sums-total",
          label: "Total provisional sums",
          type: "money",
          sourceType: "auto",
          autoBinding: "awardedQuote.provisionalTotal",
          required: false,
          sortOrder: 4
        },
        {
          key: "cost-plus-items",
          label: "Cost-plus / dayworks allowance",
          type: "money",
          sourceType: "capture",
          required: false,
          sortOrder: 5
        },
        {
          key: "pm-budget-notes",
          label: "Budget handover notes",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 6
        }
      ]
    },

    // ── 3. Scope of works ───────────────────────────────────────────────────
    {
      key: "scope-of-works",
      label: "Scope of works",
      sortOrder: 3,
      fields: [
        {
          key: "scope-summary",
          label: "Scope summary (from tender)",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.scopeOfWorksHeader.description",
          required: false,
          sortOrder: 1
        },
        {
          key: "access-constraints",
          label: "Access constraints",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.scopeOfWorksHeader.accessConstraints",
          required: false,
          sortOrder: 2
        },
        {
          key: "proposed-start-date",
          label: "Proposed start date",
          type: "date",
          sourceType: "auto",
          autoBinding: "tender.scopeOfWorksHeader.proposedStartDate",
          required: false,
          sortOrder: 3
        },
        {
          key: "duration-weeks",
          label: "Estimated duration (weeks)",
          type: "text",
          sourceType: "auto",
          autoBinding: "tender.scopeOfWorksHeader.durationWeeks",
          required: false,
          sortOrder: 4
        },
        {
          key: "scope-exclusions",
          label: "Key exclusions",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 5
        },
        {
          key: "scope-pm-notes",
          label: "PM scope notes / light edits",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 6
        }
      ]
    },

    // ── 4. Key contacts & procurement ───────────────────────────────────────
    {
      key: "key-contacts-procurement",
      label: "Key contacts & procurement",
      sortOrder: 4,
      fields: [
        {
          key: "client-contact",
          label: "Client contact",
          type: "contact",
          sourceType: "auto",
          autoBinding: "tender.client.primaryContact",
          required: false,
          sortOrder: 1
        },
        {
          key: "project-manager",
          label: "Assigned project manager",
          type: "contact",
          sourceType: "capture",
          required: true,
          sortOrder: 2
        },
        {
          key: "site-supervisor",
          label: "Site supervisor",
          type: "contact",
          sourceType: "capture",
          required: false,
          sortOrder: 3
        },
        {
          key: "whs-officer",
          label: "WHS officer",
          type: "contact",
          sourceType: "capture",
          required: false,
          sortOrder: 4
        },
        {
          key: "subcontractors-overview",
          label: "Key subcontractors / suppliers",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 5
        },
        {
          key: "procurement-notes",
          label: "Procurement / PO notes",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 6
        }
      ]
    },

    // ── 5. Documentation, compliance & approvals ────────────────────────────
    // Compliance obligations are suggested from WBS activity types in B-HW-9.
    // This section captures attachment slots and manual confirmation.
    {
      key: "documentation-compliance-approvals",
      label: "Documentation, compliance & approvals",
      sortOrder: 5,
      fields: [
        {
          key: "swms-required",
          label: "SWMS required",
          type: "list",
          sourceType: "capture",
          required: false,
          sortOrder: 1
        },
        {
          key: "swms-attachment",
          label: "SWMS document(s)",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 2
        },
        {
          key: "form-65-required",
          label: "Form 65 (demolition/asbestos) required",
          type: "list",
          sourceType: "capture",
          required: false,
          sortOrder: 3
        },
        {
          key: "form-65-attachment",
          label: "Form 65 document",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 4
        },
        {
          key: "permits-required",
          label: "Permits required (council, EPA, etc.)",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 5
        },
        {
          key: "permits-attachment",
          label: "Permit documents",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 6
        },
        {
          key: "disconnection-certificates",
          label: "Disconnection certificates required",
          type: "list",
          sourceType: "capture",
          required: false,
          sortOrder: 7
        },
        {
          key: "asbestos-register-attachment",
          label: "Asbestos register / hazmat survey",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 8
        },
        {
          key: "contract-documents-attachment",
          label: "Executed contract documents",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 9
        },
        {
          key: "compliance-notes",
          label: "Compliance / approvals notes",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 10
        }
      ]
    },

    // ── 6. Site / logistics / programme ─────────────────────────────────────
    // Client programme is attachment-only (decision §1.5). PM breaks it down
    // on the live job.
    {
      key: "site-logistics-programme",
      label: "Site/logistics/programme",
      sortOrder: 6,
      fields: [
        {
          key: "site-access-details",
          label: "Site access details / contact",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 1
        },
        {
          key: "working-hours",
          label: "Permitted working hours",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 2
        },
        {
          key: "waste-disposal-requirements",
          label: "Waste disposal / tip requirements",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 3
        },
        {
          key: "traffic-management",
          label: "Traffic management requirements",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 4
        },
        {
          key: "client-programme-attachment",
          label: "Client programme (upload)",
          type: "attachment",
          sourceType: "attach",
          required: false,
          sortOrder: 5
        },
        {
          key: "logistics-notes",
          label: "Site / logistics notes",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 6
        }
      ]
    },

    // ── 7. Risk & watch-items / handover notes ──────────────────────────────
    {
      key: "risk-handover-notes",
      label: "Risk & watch-items / handover notes",
      sortOrder: 7,
      fields: [
        {
          key: "key-risks",
          label: "Key risks identified",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 1
        },
        {
          key: "watch-items",
          label: "Watch items / open issues",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 2
        },
        {
          key: "assumptions",
          label: "Assumptions / qualifications",
          type: "text",
          sourceType: "auto",
          autoBinding: "awardedQuote.assumptions",
          required: false,
          sortOrder: 3
        },
        {
          key: "estimator-handover-notes",
          label: "Estimator handover notes",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 4
        },
        {
          key: "pm-acceptance-notes",
          label: "PM acceptance / queries",
          type: "text",
          sourceType: "capture",
          required: false,
          sortOrder: 5
        }
      ]
    }
  ];

  for (const sectionDef of sections) {
    const section = await prisma.handoverTemplateSection.create({
      data: {
        templateId: template.id,
        key: sectionDef.key,
        label: sectionDef.label,
        sortOrder: sectionDef.sortOrder
      }
    });

    for (const fieldDef of sectionDef.fields) {
      await prisma.handoverTemplateField.create({
        data: {
          sectionId: section.id,
          key: fieldDef.key,
          label: fieldDef.label,
          type: fieldDef.type,
          sourceType: fieldDef.sourceType,
          autoBinding: fieldDef.autoBinding ?? null,
          listId: fieldDef.listId ?? null,
          required: fieldDef.required,
          sortOrder: fieldDef.sortOrder
        }
      });
    }
  }
}
