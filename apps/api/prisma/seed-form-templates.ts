import { Prisma, type PrismaClient } from "@prisma/client";

// ────────────────────────────────────────────────────────────────────────
// Forms Engine — IS system templates (PR #97)
// ────────────────────────────────────────────────────────────────────────
// 12 templates seeded with isSystemTemplate=true. Idempotent: re-running pnpm
// seed reconciles via upsert on FormTemplate.code. Each template carries an
// ACTIVE FormTemplateVersion v1 + sections + fields. Approval chains
// reference Marco (WHS) by email lookup so the chain wires up regardless of
// whether the user table seed ran before or after.

type FieldSpec = {
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired?: boolean;
  helpText?: string;
  config?: Record<string, unknown>;
  conditions?: unknown[];
  actions?: unknown[];
};

type SectionSpec = {
  title: string;
  description?: string;
  sortOrder: number;
  fields: FieldSpec[];
};

type TemplateSpec = {
  code: string;
  name: string;
  description: string;
  category: string;
  settings: Record<string, unknown>;
  sections: SectionSpec[];
};

async function upsertSystemTemplate(prisma: PrismaClient, spec: TemplateSpec) {
  const template = await prisma.formTemplate.upsert({
    where: { code: spec.code },
    update: {
      name: spec.name,
      description: spec.description,
      category: spec.category,
      isSystemTemplate: true,
      status: "ACTIVE",
      settings: spec.settings as Prisma.InputJsonValue
    },
    create: {
      name: spec.name,
      code: spec.code,
      description: spec.description,
      category: spec.category,
      isSystemTemplate: true,
      status: "ACTIVE",
      settings: spec.settings as Prisma.InputJsonValue
    }
  });

  // Always work against version 1 — seed templates do not auto-bump versions.
  const version = await prisma.formTemplateVersion.upsert({
    where: { templateId_versionNumber: { templateId: template.id, versionNumber: 1 } },
    update: { status: "ACTIVE" },
    create: { templateId: template.id, versionNumber: 1, status: "ACTIVE" }
  });

  for (const sectionSpec of spec.sections) {
    // Section identity is (versionId + title) for re-seed reconciliation.
    const existingSection = await prisma.formSection.findFirst({
      where: { versionId: version.id, title: sectionSpec.title }
    });
    const section = existingSection
      ? await prisma.formSection.update({
          where: { id: existingSection.id },
          data: {
            description: sectionSpec.description ?? null,
            sectionOrder: sectionSpec.sortOrder
          }
        })
      : await prisma.formSection.create({
          data: {
            versionId: version.id,
            title: sectionSpec.title,
            description: sectionSpec.description ?? null,
            sectionOrder: sectionSpec.sortOrder
          }
        });

    for (const field of sectionSpec.fields) {
      await prisma.formField.upsert({
        where: { sectionId_fieldKey: { sectionId: section.id, fieldKey: field.fieldKey } },
        update: {
          label: field.label,
          fieldType: field.fieldType,
          fieldOrder: field.fieldOrder,
          isRequired: field.isRequired ?? false,
          helpText: field.helpText ?? null,
          config: (field.config ?? {}) as Prisma.InputJsonValue,
          conditions: (field.conditions ?? []) as Prisma.InputJsonValue,
          actions: (field.actions ?? []) as Prisma.InputJsonValue
        },
        create: {
          sectionId: section.id,
          fieldKey: field.fieldKey,
          label: field.label,
          fieldType: field.fieldType,
          fieldOrder: field.fieldOrder,
          isRequired: field.isRequired ?? false,
          helpText: field.helpText ?? null,
          config: (field.config ?? {}) as Prisma.InputJsonValue,
          conditions: (field.conditions ?? []) as Prisma.InputJsonValue,
          actions: (field.actions ?? []) as Prisma.InputJsonValue
        }
      });
    }
  }

  return template;
}

export async function seedFormTemplates(prisma: PrismaClient): Promise<void> {
  const marco = await prisma.user.findFirst({ where: { email: "marco@initialservices.net" } });
  const marcoId = marco?.id;

  // 1 — Daily Pre-Start Safety Meeting
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-PRE-START",
    name: "Daily Pre-Start Safety Meeting",
    description: "Site morning safety briefing — attendees, hazards, PPE, SWMS.",
    category: "daily",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Pre-Start Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 1, config: { source: "job" } },
          { fieldKey: "supervisor", label: "Supervisor", fieldType: "system_field", fieldOrder: 2, config: { source: "supervisor" } },
          { fieldKey: "attendees", label: "Attendees", fieldType: "multi_select", fieldOrder: 3, config: { lookupEntity: "Worker" } },
          {
            fieldKey: "weather",
            label: "Weather conditions",
            fieldType: "dropdown",
            fieldOrder: 4,
            config: { options: ["Fine", "Cloudy", "Windy", "Rainy", "Hot"] }
          }
        ]
      },
      {
        title: "Safety Checks",
        sortOrder: 1,
        fields: [
          { fieldKey: "site_hazards", label: "Site hazards identified", fieldType: "long_text", fieldOrder: 0 },
          {
            fieldKey: "ppe_check",
            label: "PPE check",
            fieldType: "checkbox",
            fieldOrder: 1,
            config: {
              options: ["Hard hat", "Safety glasses", "Hi-vis", "Steel caps", "Gloves", "P2 mask", "Tyvek suit"]
            }
          },
          { fieldKey: "swms_reviewed", label: "SWMS reviewed", fieldType: "toggle", fieldOrder: 2 },
          {
            fieldKey: "swms_reference",
            label: "SWMS reference",
            fieldType: "short_text",
            fieldOrder: 3,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "swms_reviewed", operator: "equals", value: true }]
                },
                actions: [{ type: "require" }]
              }
            ]
          },
          { fieldKey: "incidents_since_last", label: "Any incidents since last meeting", fieldType: "toggle", fieldOrder: 4 },
          {
            fieldKey: "incident_details",
            label: "Incident details",
            fieldType: "long_text",
            fieldOrder: 5,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "incidents_since_last", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              },
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "incidents_since_last", operator: "equals", value: false }]
                },
                actions: [{ type: "hide" }]
              }
            ]
          }
        ]
      },
      {
        title: "Sign-off",
        sortOrder: 2,
        fields: [
          { fieldKey: "supervisor_signature", label: "Supervisor signature", fieldType: "signature", fieldOrder: 0, isRequired: true }
        ]
      }
    ]
  });

  // 2 — Take 5
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-TAKE-5",
    name: "Take 5 \u2014 Stop Think Act",
    description: "Pre-task hazard assessment \u2014 every worker, every task.",
    category: "safety",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Task Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "datetime", label: "Date/time", fieldType: "datetime", fieldOrder: 0, isRequired: true },
          { fieldKey: "worker_name", label: "Worker", fieldType: "system_field", fieldOrder: 1, config: { source: "worker" } },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 2, config: { source: "job" } },
          { fieldKey: "task", label: "Task being performed", fieldType: "short_text", fieldOrder: 3, isRequired: true }
        ]
      },
      {
        title: "Hazards & Controls",
        sortOrder: 1,
        fields: [
          { fieldKey: "hazards", label: "Hazards identified", fieldType: "long_text", fieldOrder: 0, isRequired: true },
          {
            fieldKey: "risk_rating_before",
            label: "Risk rating before controls",
            fieldType: "dropdown",
            fieldOrder: 1,
            isRequired: true,
            config: { options: ["Low", "Medium", "High", "Extreme"] },
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "risk_rating_before", operator: "equals", value: "Extreme" }]
                },
                actions: [
                  {
                    type: "send_notification",
                    notificationTarget: "supervisor",
                    notificationMessage: "Take 5 reported Extreme pre-control risk \u2014 review immediately."
                  }
                ]
              }
            ]
          },
          { fieldKey: "controls", label: "Controls applied", fieldType: "long_text", fieldOrder: 2 },
          {
            fieldKey: "risk_rating_after",
            label: "Risk rating after controls",
            fieldType: "dropdown",
            fieldOrder: 3,
            config: { options: ["Low", "Medium", "High"] }
          },
          {
            fieldKey: "ppe",
            label: "PPE worn",
            fieldType: "checkbox",
            fieldOrder: 4,
            config: { options: ["Hard hat", "Safety glasses", "Hi-vis", "Steel caps", "Gloves", "P2 mask"] }
          },
          { fieldKey: "worker_signature", label: "Worker signature", fieldType: "signature", fieldOrder: 5, isRequired: true }
        ]
      }
    ]
  });

  // 3 — Plant Pre-Start Inspection
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-PLANT-PRESTART",
    name: "Plant Pre-Start Inspection",
    description: "Daily plant/equipment safety checks before operation.",
    category: "plant",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Equipment",
        sortOrder: 0,
        fields: [
          { fieldKey: "date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "operator", label: "Operator", fieldType: "system_field", fieldOrder: 1, config: { source: "worker" } },
          { fieldKey: "equipment", label: "Equipment", fieldType: "lookup", fieldOrder: 2, config: { lookupEntity: "Asset" }, isRequired: true },
          { fieldKey: "hour_meter", label: "Hour meter reading", fieldType: "number", fieldOrder: 3 }
        ]
      },
      {
        title: "Checks",
        sortOrder: 1,
        fields: [
          { fieldKey: "fuel_level", label: "Fuel level", fieldType: "dropdown", fieldOrder: 0, config: { options: ["Full", "3/4", "Half", "1/4", "Empty", "N/A"] } },
          { fieldKey: "engine_oil", label: "Engine oil", fieldType: "dropdown", fieldOrder: 1, config: { options: ["OK", "Low", "N/A"] } },
          { fieldKey: "hydraulic_oil", label: "Hydraulic oil", fieldType: "dropdown", fieldOrder: 2, config: { options: ["OK", "Low", "N/A"] } },
          { fieldKey: "coolant", label: "Coolant", fieldType: "dropdown", fieldOrder: 3, config: { options: ["OK", "Low", "N/A"] } },
          { fieldKey: "tyres_tracks", label: "Tyres / tracks", fieldType: "dropdown", fieldOrder: 4, config: { options: ["OK", "Damaged", "N/A"] } },
          { fieldKey: "lights", label: "Lights", fieldType: "dropdown", fieldOrder: 5, config: { options: ["OK", "Faulty", "N/A"] } },
          { fieldKey: "horn", label: "Horn", fieldType: "dropdown", fieldOrder: 6, config: { options: ["OK", "Faulty", "N/A"] } },
          { fieldKey: "seatbelt", label: "Seatbelt", fieldType: "dropdown", fieldOrder: 7, config: { options: ["OK", "Faulty", "N/A"] } }
        ]
      },
      {
        title: "Defects & Sign-off",
        sortOrder: 2,
        fields: [
          { fieldKey: "defects_noted", label: "Any defects noted", fieldType: "toggle", fieldOrder: 0 },
          {
            fieldKey: "defect_details",
            label: "Defect details",
            fieldType: "long_text",
            fieldOrder: 1,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "defects_noted", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          {
            fieldKey: "safe_to_operate",
            label: "Equipment safe to operate",
            fieldType: "radio",
            fieldOrder: 2,
            isRequired: true,
            config: { options: ["Yes", "No"] },
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "safe_to_operate", operator: "equals", value: "No" }]
                },
                actions: [
                  { type: "create_record", recordType: "maintenance_job" },
                  {
                    type: "send_notification",
                    notificationTarget: "supervisor",
                    notificationMessage: "Plant pre-start flagged defective \u2014 see breakdown record."
                  }
                ]
              }
            ]
          },
          { fieldKey: "operator_signature", label: "Operator signature", fieldType: "signature", fieldOrder: 3, isRequired: true }
        ]
      }
    ]
  });

  // 4 — Site Induction
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-INDUCTION",
    name: "Site Induction",
    description: "Mandatory site induction before any work commences.",
    category: "induction",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Inductee",
        sortOrder: 0,
        fields: [
          { fieldKey: "date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "inductee_name", label: "Inductee name", fieldType: "short_text", fieldOrder: 1, isRequired: true },
          { fieldKey: "company", label: "Company", fieldType: "short_text", fieldOrder: 2 },
          { fieldKey: "role", label: "Role on site", fieldType: "short_text", fieldOrder: 3 }
        ]
      },
      {
        title: "Site Briefing",
        sortOrder: 1,
        fields: [
          { fieldKey: "assembly_point", label: "Emergency assembly point", fieldType: "short_text", fieldOrder: 0 },
          { fieldKey: "emergency_contacts_reviewed", label: "Emergency contacts reviewed", fieldType: "toggle", fieldOrder: 1 },
          {
            fieldKey: "site_rules",
            label: "Site rules acknowledged",
            fieldType: "checkbox",
            fieldOrder: 2,
            config: {
              options: [
                "No smoking",
                "No alcohol",
                "PPE required at all times",
                "Follow supervisor directions",
                "Report all incidents immediately"
              ]
            }
          },
          { fieldKey: "asbestos_awareness", label: "Asbestos awareness understood", fieldType: "toggle", fieldOrder: 3 },
          { fieldKey: "swms_location", label: "SWMS location", fieldType: "short_text", fieldOrder: 4 },
          { fieldKey: "photo_id_sighted", label: "Photo ID sighted", fieldType: "toggle", fieldOrder: 5 }
        ]
      },
      {
        title: "Sign-off",
        sortOrder: 2,
        fields: [
          { fieldKey: "inductee_signature", label: "Inductee signature", fieldType: "signature", fieldOrder: 0, isRequired: true },
          { fieldKey: "supervisor_signature", label: "Supervisor signature", fieldType: "signature", fieldOrder: 1, isRequired: true }
        ]
      }
    ]
  });

  // 5 — Near Miss Report
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-NEAR-MISS",
    name: "Near Miss Report",
    description: "Capture near misses to drive corrective actions.",
    category: "safety",
    settings: {
      requiresApproval: true,
      approvalChain: [
        { stepNumber: 1, assignToRole: "project_manager", dueHours: 24 },
        ...(marcoId ? [{ stepNumber: 2, assignToUserId: marcoId, dueHours: 48 }] : [])
      ],
      allowOffline: true,
      pdfExport: true
    },
    sections: [
      {
        title: "Event",
        sortOrder: 0,
        fields: [
          { fieldKey: "datetime", label: "Date/time", fieldType: "datetime", fieldOrder: 0, isRequired: true },
          { fieldKey: "reporter", label: "Reporter", fieldType: "system_field", fieldOrder: 1, config: { source: "worker" } },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 2, config: { source: "job" } },
          { fieldKey: "location", label: "Location on site", fieldType: "short_text", fieldOrder: 3 },
          {
            fieldKey: "near_miss_description",
            label: "Near miss description",
            fieldType: "long_text",
            fieldOrder: 4,
            isRequired: true,
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: { logic: "AND", conditions: [] },
                actions: [
                  { type: "create_record", recordType: "hazard_observation" },
                  {
                    type: "send_notification",
                    notificationTarget: "safety_admin",
                    notificationMessage: "Near miss reported \u2014 see hazard register."
                  }
                ]
              }
            ]
          },
          { fieldKey: "people_involved", label: "People involved", fieldType: "short_text", fieldOrder: 5 },
          { fieldKey: "what_could_have_happened", label: "What could have happened", fieldType: "long_text", fieldOrder: 6, isRequired: true },
          { fieldKey: "immediate_actions", label: "Immediate actions taken", fieldType: "long_text", fieldOrder: 7 },
          {
            fieldKey: "root_cause",
            label: "Root cause",
            fieldType: "dropdown",
            fieldOrder: 8,
            config: {
              options: [
                "Procedure not followed",
                "Inadequate procedure",
                "Equipment failure",
                "Environmental",
                "Inadequate training",
                "Other"
              ]
            }
          },
          { fieldKey: "root_cause_details", label: "Root cause details", fieldType: "long_text", fieldOrder: 9 },
          { fieldKey: "corrective_actions", label: "Corrective actions required", fieldType: "long_text", fieldOrder: 10, isRequired: true },
          { fieldKey: "reporter_signature", label: "Reporter signature", fieldType: "signature", fieldOrder: 11, isRequired: true }
        ]
      }
    ]
  });

  // 6 — Incident Report
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-INCIDENT",
    name: "Incident Report",
    description: "Formal incident reporting \u2014 auto-creates IS-INC record.",
    category: "safety",
    settings: {
      requiresApproval: true,
      approvalChain: [
        { stepNumber: 1, assignToRole: "project_manager", dueHours: 2 },
        ...(marcoId ? [{ stepNumber: 2, assignToUserId: marcoId, dueHours: 24 }] : [])
      ],
      allowOffline: true,
      pdfExport: true
    },
    sections: [
      {
        title: "Incident Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "incident_datetime", label: "Date/time of incident", fieldType: "datetime", fieldOrder: 0, isRequired: true },
          { fieldKey: "reporter", label: "Reporter", fieldType: "system_field", fieldOrder: 1, config: { source: "worker" } },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 2, config: { source: "job" } },
          {
            fieldKey: "incident_type",
            label: "Incident type",
            fieldType: "dropdown",
            fieldOrder: 3,
            isRequired: true,
            config: {
              options: ["Near miss", "First aid", "Medical treatment", "Lost time", "Dangerous occurrence", "Property damage"]
            }
          },
          {
            fieldKey: "severity",
            label: "Severity",
            fieldType: "dropdown",
            fieldOrder: 4,
            isRequired: true,
            config: { options: ["Low", "Medium", "High", "Critical"] },
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "severity", operator: "equals", value: "Critical" }]
                },
                actions: [
                  {
                    type: "send_notification",
                    notificationTarget: "all_admins",
                    notificationMessage: "CRITICAL incident reported \u2014 review immediately."
                  }
                ]
              }
            ]
          },
          { fieldKey: "location", label: "Location", fieldType: "short_text", fieldOrder: 5 },
          {
            fieldKey: "description",
            label: "Description",
            fieldType: "long_text",
            fieldOrder: 6,
            isRequired: true,
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: { logic: "AND", conditions: [] },
                actions: [{ type: "create_record", recordType: "safety_incident" }]
              }
            ]
          },
          { fieldKey: "people_injured", label: "People injured", fieldType: "short_text", fieldOrder: 7 },
          { fieldKey: "injury_type", label: "Injury type", fieldType: "short_text", fieldOrder: 8 },
          { fieldKey: "immediate_actions", label: "Immediate actions", fieldType: "long_text", fieldOrder: 9 },
          { fieldKey: "witnesses", label: "Witnesses", fieldType: "short_text", fieldOrder: 10 },
          { fieldKey: "emergency_services_called", label: "Were emergency services called", fieldType: "toggle", fieldOrder: 11 },
          { fieldKey: "equipment", label: "Equipment involved", fieldType: "lookup", fieldOrder: 12, config: { lookupEntity: "Asset" } },
          { fieldKey: "root_cause", label: "Root cause", fieldType: "long_text", fieldOrder: 13 },
          { fieldKey: "photos", label: "Photos", fieldType: "photo", fieldOrder: 14, config: { maxCount: 5 } },
          { fieldKey: "reporter_signature", label: "Reporter signature", fieldType: "signature", fieldOrder: 15 }
        ]
      }
    ]
  });

  // 7 — Asbestos Work Plan (compliance gate)
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-ASBESTOS-WORK-PLAN",
    name: "Asbestos Work Plan",
    description: "Class A/B asbestos removal work plan \u2014 gate-controlled.",
    category: "asbestos",
    settings: {
      requiresApproval: true,
      approvalChain: marcoId ? [{ stepNumber: 1, assignToUserId: marcoId, dueHours: 4 }] : [],
      complianceGates: ["asbestos_qualification"],
      allowOffline: true,
      pdfExport: true
    },
    sections: [
      {
        title: "Plan Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "project", label: "Project", fieldType: "system_field", fieldOrder: 1, config: { source: "project" } },
          { fieldKey: "supervisor", label: "Supervisor", fieldType: "system_field", fieldOrder: 2, config: { source: "supervisor" } },
          { fieldKey: "licence_number", label: "Licence number", fieldType: "short_text", fieldOrder: 3, isRequired: true },
          {
            fieldKey: "licence_class",
            label: "Licence class",
            fieldType: "dropdown",
            fieldOrder: 4,
            isRequired: true,
            config: { options: ["Class A", "Class B"] }
          },
          { fieldKey: "location", label: "Location of asbestos", fieldType: "long_text", fieldOrder: 5, isRequired: true },
          {
            fieldKey: "asbestos_type",
            label: "Type of asbestos",
            fieldType: "dropdown",
            fieldOrder: 6,
            config: { options: ["Friable", "Non-friable", "Unknown"] }
          },
          { fieldKey: "estimated_quantity", label: "Estimated quantity (m\u00b2)", fieldType: "number", fieldOrder: 7 },
          { fieldKey: "removal_method", label: "Removal method", fieldType: "long_text", fieldOrder: 8, isRequired: true },
          { fieldKey: "decon_procedure", label: "Decontamination procedure", fieldType: "long_text", fieldOrder: 9 },
          { fieldKey: "waste_disposal", label: "Waste disposal method", fieldType: "long_text", fieldOrder: 10 },
          { fieldKey: "air_monitoring", label: "Air monitoring required", fieldType: "toggle", fieldOrder: 11 },
          {
            fieldKey: "air_monitoring_provider",
            label: "Air monitoring provider",
            fieldType: "short_text",
            fieldOrder: 12,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "air_monitoring", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          {
            fieldKey: "ppe_required",
            label: "PPE required",
            fieldType: "checkbox",
            fieldOrder: 13,
            config: {
              options: ["P2 mask", "Full face respirator", "Tyvek suit", "Gloves", "Safety glasses", "Disposable boots"]
            }
          },
          { fieldKey: "swms_reference", label: "SWMS reference", fieldType: "short_text", fieldOrder: 14, isRequired: true },
          { fieldKey: "supervisor_signature", label: "Supervisor signature", fieldType: "signature", fieldOrder: 15, isRequired: true }
        ]
      }
    ]
  });

  // 8a — Permit-to-Work (permit_to_work — WHS template pack)
  // Single template covers all high-risk permit classes: hot work, confined
  // space, working at heights, excavation, electrical isolation, live-services.
  // Zone + type drive downstream conditional requirements (gas test, isolation
  // tag, atmospheric monitoring).
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-PERMIT-TO-WORK",
    name: "Permit-to-Work",
    description: "High-risk work permit — hot work, confined space, heights, excavation, electrical.",
    category: "permits",
    settings: {
      requiresApproval: true,
      approvalChain: [
        { stepNumber: 1, assignToRole: "project_manager", dueHours: 2 },
        ...(marcoId ? [{ stepNumber: 2, assignToUserId: marcoId, dueHours: 4 }] : [])
      ],
      allowOffline: true,
      pdfExport: true
    },
    sections: [
      {
        title: "Permit Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "permit_to_work_date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "valid_from", label: "Valid from", fieldType: "datetime", fieldOrder: 1, isRequired: true },
          { fieldKey: "valid_to", label: "Valid to", fieldType: "datetime", fieldOrder: 2, isRequired: true },
          { fieldKey: "project", label: "Project", fieldType: "system_field", fieldOrder: 3, config: { source: "project" } },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 4, config: { source: "job" } },
          {
            fieldKey: "permit_type",
            label: "Permit type",
            fieldType: "dropdown",
            fieldOrder: 5,
            isRequired: true,
            config: {
              options: [
                "Hot work",
                "Confined space",
                "Working at heights",
                "Excavation",
                "Electrical isolation",
                "Live services",
                "Roof access"
              ]
            }
          },
          { fieldKey: "permit_zone", label: "Permit zone / location", fieldType: "short_text", fieldOrder: 6, isRequired: true },
          { fieldKey: "work_description", label: "Description of work", fieldType: "long_text", fieldOrder: 7, isRequired: true },
          { fieldKey: "permit_issuer", label: "Permit issuer", fieldType: "system_field", fieldOrder: 8, config: { source: "supervisor" } },
          { fieldKey: "permit_receiver", label: "Permit receiver", fieldType: "short_text", fieldOrder: 9, isRequired: true }
        ]
      },
      {
        title: "Hazards & Controls",
        sortOrder: 1,
        fields: [
          { fieldKey: "hazards_identified", label: "Hazards identified", fieldType: "long_text", fieldOrder: 0, isRequired: true },
          { fieldKey: "isolation_required", label: "Isolation required", fieldType: "toggle", fieldOrder: 1 },
          {
            fieldKey: "isolation_tag_number",
            label: "Isolation tag number",
            fieldType: "short_text",
            fieldOrder: 2,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "isolation_required", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          { fieldKey: "gas_test_required", label: "Gas test required", fieldType: "toggle", fieldOrder: 3 },
          {
            fieldKey: "gas_test_result",
            label: "Gas test result (O₂ / LEL / CO / H₂S)",
            fieldType: "short_text",
            fieldOrder: 4,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "gas_test_required", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          { fieldKey: "fire_watch_required", label: "Fire watch required", fieldType: "toggle", fieldOrder: 5 },
          {
            fieldKey: "fire_watch_name",
            label: "Fire watch name",
            fieldType: "short_text",
            fieldOrder: 6,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "fire_watch_required", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          {
            fieldKey: "ppe_required",
            label: "PPE required",
            fieldType: "checkbox",
            fieldOrder: 7,
            config: {
              options: [
                "Hard hat",
                "Safety glasses",
                "Hi-vis",
                "Steel caps",
                "Gloves",
                "P2 mask",
                "Full face respirator",
                "Harness",
                "Face shield",
                "Arc flash suit"
              ]
            }
          },
          { fieldKey: "controls", label: "Controls in place", fieldType: "long_text", fieldOrder: 8, isRequired: true },
          { fieldKey: "swms_reference", label: "SWMS reference", fieldType: "short_text", fieldOrder: 9, isRequired: true }
        ]
      },
      {
        title: "Sign-off",
        sortOrder: 2,
        fields: [
          { fieldKey: "issuer_signature", label: "Permit issuer signature", fieldType: "signature", fieldOrder: 0, isRequired: true },
          { fieldKey: "receiver_signature", label: "Permit receiver signature", fieldType: "signature", fieldOrder: 1, isRequired: true },
          { fieldKey: "close_out_notes", label: "Close-out notes", fieldType: "long_text", fieldOrder: 2 },
          { fieldKey: "close_out_signature", label: "Close-out signature", fieldType: "signature", fieldOrder: 3 }
        ]
      }
    ]
  });

  // 8b — Pre-Task Plan / JHA (pre_task_plan — WHS template pack)
  // Job Hazard Analysis for tasks below the Permit-to-Work threshold.
  // Repeating "Task Step" section lets the crew break the job into steps and
  // record hazard + control per step.
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-PRE-TASK-PLAN",
    name: "Pre-Task Plan / JHA",
    description: "Job hazard analysis — step-by-step hazards and controls before starting work.",
    category: "safety",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Task Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "pre_task_plan_date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 1, config: { source: "job" } },
          { fieldKey: "supervisor", label: "Supervisor", fieldType: "system_field", fieldOrder: 2, config: { source: "supervisor" } },
          { fieldKey: "crew", label: "Crew / attendees", fieldType: "multi_select", fieldOrder: 3, config: { lookupEntity: "Worker" } },
          { fieldKey: "task_description", label: "Task description", fieldType: "long_text", fieldOrder: 4, isRequired: true },
          {
            fieldKey: "swms_reviewed",
            label: "SWMS reviewed with crew",
            fieldType: "toggle",
            fieldOrder: 5,
            isRequired: true
          },
          { fieldKey: "swms_reference", label: "SWMS reference", fieldType: "short_text", fieldOrder: 6 }
        ]
      },
      {
        title: "Task Steps",
        description: "Break the job into steps. Record hazard and control per step.",
        sortOrder: 1,
        fields: [
          { fieldKey: "step_1", label: "Step 1 — description", fieldType: "short_text", fieldOrder: 0 },
          { fieldKey: "step_1_hazard", label: "Step 1 — hazard", fieldType: "short_text", fieldOrder: 1 },
          { fieldKey: "step_1_control", label: "Step 1 — control", fieldType: "short_text", fieldOrder: 2 },
          { fieldKey: "step_2", label: "Step 2 — description", fieldType: "short_text", fieldOrder: 3 },
          { fieldKey: "step_2_hazard", label: "Step 2 — hazard", fieldType: "short_text", fieldOrder: 4 },
          { fieldKey: "step_2_control", label: "Step 2 — control", fieldType: "short_text", fieldOrder: 5 },
          { fieldKey: "step_3", label: "Step 3 — description", fieldType: "short_text", fieldOrder: 6 },
          { fieldKey: "step_3_hazard", label: "Step 3 — hazard", fieldType: "short_text", fieldOrder: 7 },
          { fieldKey: "step_3_control", label: "Step 3 — control", fieldType: "short_text", fieldOrder: 8 },
          { fieldKey: "step_4", label: "Step 4 — description", fieldType: "short_text", fieldOrder: 9 },
          { fieldKey: "step_4_hazard", label: "Step 4 — hazard", fieldType: "short_text", fieldOrder: 10 },
          { fieldKey: "step_4_control", label: "Step 4 — control", fieldType: "short_text", fieldOrder: 11 },
          { fieldKey: "additional_hazards", label: "Additional hazards / notes", fieldType: "long_text", fieldOrder: 12 }
        ]
      },
      {
        title: "PPE & Sign-off",
        sortOrder: 2,
        fields: [
          {
            fieldKey: "ppe_required",
            label: "PPE required",
            fieldType: "checkbox",
            fieldOrder: 0,
            config: {
              options: [
                "Hard hat",
                "Safety glasses",
                "Hi-vis",
                "Steel caps",
                "Gloves",
                "P2 mask",
                "Harness",
                "Hearing protection"
              ]
            }
          },
          {
            fieldKey: "overall_risk_rating",
            label: "Overall risk rating",
            fieldType: "dropdown",
            fieldOrder: 1,
            isRequired: true,
            config: { options: ["Low", "Medium", "High", "Extreme"] },
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "overall_risk_rating", operator: "equals", value: "Extreme" }]
                },
                actions: [
                  {
                    type: "send_notification",
                    notificationTarget: "supervisor",
                    notificationMessage: "Pre-Task Plan rated Extreme risk — escalate before work commences."
                  }
                ]
              }
            ]
          },
          { fieldKey: "supervisor_signature", label: "Supervisor signature", fieldType: "signature", fieldOrder: 2, isRequired: true }
        ]
      }
    ]
  });

  // 8c — Toolbox Talk sign-on (toolbox_talk — WHS template pack)
  // Presenter records topic + key points; each attendee signs. Downstream
  // analytics can tally attendance by worker for compliance reporting.
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-TOOLBOX-TALK",
    name: "Toolbox Talk",
    description: "Toolbox talk record with topic, key points, and attendee sign-on.",
    category: "safety",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Talk Details",
        sortOrder: 0,
        fields: [
          { fieldKey: "toolbox_talk_date", label: "Date", fieldType: "date", fieldOrder: 0, isRequired: true },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 1, config: { source: "job" } },
          { fieldKey: "presenter", label: "Presenter", fieldType: "system_field", fieldOrder: 2, config: { source: "supervisor" } },
          { fieldKey: "topic", label: "Topic", fieldType: "short_text", fieldOrder: 3, isRequired: true },
          {
            fieldKey: "topic_category",
            label: "Topic category",
            fieldType: "dropdown",
            fieldOrder: 4,
            config: {
              options: [
                "Manual handling",
                "Working at heights",
                "Electrical safety",
                "PPE",
                "Housekeeping",
                "Emergency procedures",
                "Environmental",
                "Recent incident",
                "Other"
              ]
            }
          },
          { fieldKey: "duration_minutes", label: "Duration (minutes)", fieldType: "number", fieldOrder: 5 }
        ]
      },
      {
        title: "Content",
        sortOrder: 1,
        fields: [
          { fieldKey: "key_points", label: "Key points discussed", fieldType: "long_text", fieldOrder: 0, isRequired: true },
          { fieldKey: "questions_raised", label: "Questions raised", fieldType: "long_text", fieldOrder: 1 },
          { fieldKey: "actions_agreed", label: "Actions agreed", fieldType: "long_text", fieldOrder: 2 }
        ]
      },
      {
        title: "Attendee Sign-on",
        sortOrder: 2,
        fields: [
          { fieldKey: "attendees", label: "Attendees", fieldType: "multi_select", fieldOrder: 0, config: { lookupEntity: "Worker" }, isRequired: true },
          { fieldKey: "attendee_count", label: "Number of attendees", fieldType: "number", fieldOrder: 1 },
          { fieldKey: "presenter_signature", label: "Presenter signature", fieldType: "signature", fieldOrder: 2, isRequired: true },
          { fieldKey: "attendees_signed", label: "All attendees signed the sign-on sheet", fieldType: "toggle", fieldOrder: 3, isRequired: true }
        ]
      }
    ]
  });

  // 8d — Site Bulletin acknowledgement (site bulletin — WHS template pack)
  // Broadcast a safety alert/bulletin and require each recipient to acknowledge
  // they have read and understood. Used for post-incident learnings and
  // regulator-driven communications.
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-SITE-BULLETIN",
    name: "Site Bulletin Acknowledgement",
    description: "Safety bulletin broadcast — recipient acknowledges reading and understanding.",
    category: "safety",
    settings: { requiresApproval: false, allowOffline: true, pdfExport: true },
    sections: [
      {
        title: "Bulletin",
        sortOrder: 0,
        fields: [
          { fieldKey: "bulletin_reference", label: "Bulletin reference", fieldType: "short_text", fieldOrder: 0, isRequired: true },
          { fieldKey: "issued_date", label: "Issued date", fieldType: "date", fieldOrder: 1, isRequired: true },
          { fieldKey: "issued_by", label: "Issued by", fieldType: "short_text", fieldOrder: 2, isRequired: true },
          {
            fieldKey: "bulletin_type",
            label: "Bulletin type",
            fieldType: "dropdown",
            fieldOrder: 3,
            isRequired: true,
            config: {
              options: [
                "Safety alert",
                "Lessons learned",
                "Regulatory change",
                "Procedure update",
                "Environmental notice",
                "General information"
              ]
            }
          },
          { fieldKey: "title", label: "Title", fieldType: "short_text", fieldOrder: 4, isRequired: true },
          { fieldKey: "summary", label: "Summary", fieldType: "long_text", fieldOrder: 5, isRequired: true },
          { fieldKey: "actions_required", label: "Actions required", fieldType: "long_text", fieldOrder: 6 },
          { fieldKey: "attachment_reference", label: "Attachment reference", fieldType: "short_text", fieldOrder: 7 }
        ]
      },
      {
        title: "Acknowledgement",
        sortOrder: 1,
        fields: [
          { fieldKey: "recipient", label: "Recipient", fieldType: "system_field", fieldOrder: 0, config: { source: "worker" } },
          {
            fieldKey: "read_and_understood",
            label: "I have read and understood the bulletin",
            fieldType: "toggle",
            fieldOrder: 1,
            isRequired: true
          },
          {
            fieldKey: "questions_or_concerns",
            label: "Questions or concerns",
            fieldType: "long_text",
            fieldOrder: 2
          },
          { fieldKey: "recipient_signature", label: "Recipient signature", fieldType: "signature", fieldOrder: 3, isRequired: true },
          { fieldKey: "acknowledged_at", label: "Acknowledged at", fieldType: "datetime", fieldOrder: 4, isRequired: true }
        ]
      }
    ]
  });

  // 9 — Environmental Incident Report
  await upsertSystemTemplate(prisma, {
    code: "IS-FORM-ENV-INCIDENT",
    name: "Environmental Incident Report",
    description: "Spill/dust/noise/waste/water incident reporting.",
    category: "environmental",
    settings: {
      requiresApproval: true,
      approvalChain: marcoId ? [{ stepNumber: 1, assignToUserId: marcoId, dueHours: 24 }] : [],
      allowOffline: true,
      pdfExport: true
    },
    sections: [
      {
        title: "Incident",
        sortOrder: 0,
        fields: [
          { fieldKey: "datetime", label: "Date/time", fieldType: "datetime", fieldOrder: 0, isRequired: true },
          { fieldKey: "reporter", label: "Reporter", fieldType: "system_field", fieldOrder: 1, config: { source: "worker" } },
          { fieldKey: "job", label: "Job", fieldType: "system_field", fieldOrder: 2, config: { source: "job" } },
          {
            fieldKey: "incident_type",
            label: "Incident type",
            fieldType: "dropdown",
            fieldOrder: 3,
            isRequired: true,
            config: { options: ["Spill", "Dust", "Noise", "Waste", "Water", "Other"] }
          },
          {
            fieldKey: "description",
            label: "Description",
            fieldType: "long_text",
            fieldOrder: 4,
            isRequired: true,
            actions: [
              {
                trigger: "on_submit",
                conditionGroup: { logic: "AND", conditions: [] },
                actions: [
                  {
                    type: "send_notification",
                    notificationTarget: "safety_admin",
                    notificationMessage: "Environmental incident reported."
                  }
                ]
              }
            ]
          },
          { fieldKey: "quantity_affected", label: "Quantity affected", fieldType: "short_text", fieldOrder: 5 },
          { fieldKey: "containment_actions", label: "Immediate containment actions", fieldType: "long_text", fieldOrder: 6 },
          { fieldKey: "council_epa_notified", label: "Council/EPA notified", fieldType: "toggle", fieldOrder: 7 },
          {
            fieldKey: "notification_reference",
            label: "Notification reference",
            fieldType: "short_text",
            fieldOrder: 8,
            conditions: [
              {
                trigger: "on_change",
                conditionGroup: {
                  logic: "AND",
                  conditions: [{ fieldKey: "council_epa_notified", operator: "equals", value: true }]
                },
                actions: [{ type: "show" }, { type: "require" }]
              }
            ]
          },
          { fieldKey: "photos", label: "Photos", fieldType: "photo", fieldOrder: 9, config: { maxCount: 5 } },
          { fieldKey: "reporter_signature", label: "Reporter signature", fieldType: "signature", fieldOrder: 10 }
        ]
      }
    ]
  });
}
