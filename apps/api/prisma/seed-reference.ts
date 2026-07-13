import { PrismaClient } from "@prisma/client";
import { permissionRegistry } from "../src/common/permissions/permission-registry";
import { seedEstimateRates, seedRateTableProjections } from "./seed-initial-services";
import { seedFormTemplates } from "./seed-form-templates";

export async function seedPermissionsAndCoreRoles(prisma: PrismaClient) {
  await Promise.all(
    permissionRegistry.map((permission) =>
      prisma.permission.upsert({
        where: { code: permission.code },
        update: {
          description: permission.description,
          module: permission.module
        },
        create: permission
      })
    )
  );

  // Clean up orphans: when a permission is removed from the registry we still
  // have its Permission + RolePermission rows from previous seed runs, which
  // surface as stale entries in every Admin JWT. Delete RolePermission first
  // (FK), then the Permission itself. No-op on clean DBs.
  const registryCodes = permissionRegistry.map((p) => p.code);
  await prisma.rolePermission.deleteMany({
    where: { permission: { code: { notIn: registryCodes } } }
  });
  await prisma.permission.deleteMany({
    where: { code: { notIn: registryCodes } }
  });

  const permissions = await prisma.permission.findMany();
  const permissionIdByCode = new Map(permissions.map((permission) => [permission.code, permission.id]));

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {
      description: "Full platform administration",
      isSystem: true
    },
    create: {
      name: "Admin",
      description: "Full platform administration",
      isSystem: true
    }
  });

  const plannerRole = await prisma.role.upsert({
    where: { name: "Planner" },
    update: {
      description: "Planning and coordination access",
      isSystem: true
    },
    create: {
      name: "Planner",
      description: "Planning and coordination access",
      isSystem: true
    }
  });

  const fieldRole = await prisma.role.upsert({
    where: { name: "Field" },
    update: {
      description: "Field operations access",
      isSystem: true
    },
    create: {
      name: "Field",
      description: "Field operations access",
      isSystem: true
    }
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: "Viewer" },
    update: {
      description: "Read-only access across all modules",
      isSystem: true
    },
    create: {
      name: "Viewer",
      description: "Read-only access across all modules",
      isSystem: true
    }
  });

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: [adminRole.id, plannerRole.id, fieldRole.id, viewerRole.id] }
    }
  });

  await prisma.rolePermission.createMany({
    data: [
      ...permissions.map((permission) => ({
        roleId: adminRole.id,
        permissionId: permission.id
      })),
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("users.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("roles.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("permissions.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("tenders.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("tenders.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("tenderdocuments.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("tenderdocuments.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("jobs.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("jobs.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("scheduler.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("scheduler.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("resources.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("resources.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("assets.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("assets.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("maintenance.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("maintenance.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("inventory.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("inventory.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("procurement.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("procurement.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("procurement.approve")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("procurement.receive")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("forms.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("forms.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("documents.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("documents.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("tenderconversion.manage")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("projects.view")!
      },
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("projects.manage")!
      },
      // PR-188b F1: gate /lists creation behind masterdata.manage.
      // Planner role already manages lookups, so grant it here.
      {
        roleId: plannerRole.id,
        permissionId: permissionIdByCode.get("masterdata.manage")!
      },
      {
        roleId: fieldRole.id,
        permissionId: permissionIdByCode.get("permissions.view")!
      }
    ]
  });

  // Viewer role: only permissions whose code ends in ".view" — picked up
  // automatically as new modules add view permissions to the registry.
  const viewerPermissions = permissions.filter((p) => p.code.endsWith(".view"));
  await prisma.rolePermission.createMany({
    data: viewerPermissions.map((p) => ({
      roleId: viewerRole.id,
      permissionId: p.id
    }))
  });

  return { adminRole, plannerRole, fieldRole, viewerRole };
}

export async function seedLookups(prisma: PrismaClient): Promise<void> {
  await prisma.lookupValue.upsert({
    where: {
      category_key: {
        category: "worker_status",
        key: "ACTIVE"
      }
    },
    update: { value: "Active", isActive: true },
    create: {
      category: "worker_status",
      key: "ACTIVE",
      value: "Active",
      isActive: true
    }
  });
}

export async function seedPersonaRegistry(prisma: PrismaClient) {
  const tendering = await prisma.persona.upsert({
    where: { slug: "tendering" },
    update: { displayName: "Tendering Assistant", isActive: true },
    create: { slug: "tendering", displayName: "Tendering Assistant", isActive: true }
  });

  await prisma.personaCompanyInstruction.upsert({
    where: { personaId: tendering.id },
    update: {},
    create: { personaId: tendering.id, instruction: "" }
  });

  await prisma.globalAISettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      allowUserInstructionOverrides: false,
      enabledProviders: ["anthropic"],
      allowBringYourOwnKey: false
    }
  });
}

export async function seedNotificationTriggerConfigs(prisma: PrismaClient) {
  // Trigger catalogue. Three are seeded enabled with Marco (supervisor-001,
  // now Admin) as the sole recipient; the rest are seeded disabled so the
  // admin UI lets Marco opt-in case-by-case. Re-running the seed only
  // upserts label/description — existing isEnabled/recipient state is
  // preserved on re-seed.
  const triggers = [
    {
      trigger: "tender.submitted",
      label: "Tender submitted",
      description: "Sent when a tender is submitted to a client",
      isEnabled: true,
      deliveryMethod: "both",
      recipientUserIds: ["user-supervisor-001"]
    },
    {
      trigger: "worker.allocated",
      label: "Worker allocated",
      description: "Sent when a worker is assigned to a project",
      isEnabled: true,
      deliveryMethod: "both",
      recipientUserIds: ["user-supervisor-001"]
    },
    {
      trigger: "project.status_changed",
      label: "Project status changed",
      description: "Sent when a project moves to a new status",
      isEnabled: true,
      deliveryMethod: "both",
      recipientUserIds: ["user-supervisor-001"]
    },
    {
      trigger: "tender.follow_up_due",
      label: "Follow-up reminder",
      description: "Sent when a tender follow-up is due"
    },
    {
      trigger: "document.expiry_warning",
      label: "Document expiry warning",
      description: "Sent 30 days before a document expires"
    },
    {
      trigger: "prestart.not_completed",
      label: "Pre-start not completed",
      description: "Sent when a worker has not submitted a pre-start by 7am on a work day"
    },
    {
      trigger: "timesheet.submitted",
      label: "Timesheet submitted",
      description: "Sent when a worker submits a timesheet"
    },
    {
      trigger: "timesheet.approved",
      label: "Timesheet approved or rejected",
      description: "Sent when a timesheet is approved or returned"
    },
    {
      trigger: "project.created",
      label: "Project created from tender",
      description: "Sent when a won tender is converted to a project"
    }
  ];
  for (const t of triggers) {
    await prisma.notificationTriggerConfig.upsert({
      where: { trigger: t.trigger },
      // On re-seed only the catalogue fields (label / description) update —
      // the admin's isEnabled + recipient selections are preserved.
      update: { label: t.label, description: t.description },
      create: {
        trigger: t.trigger,
        label: t.label,
        description: t.description,
        isEnabled: t.isEnabled ?? false,
        deliveryMethod: t.deliveryMethod ?? "both",
        recipientRoles: [],
        recipientUserIds: t.recipientUserIds ?? []
      }
    });
  }
}

export async function seedGlobalLists(prisma: PrismaClient, adminUserId: string) {
  type StaticListSpec = {
    slug: string;
    name: string;
    description: string;
    items: Array<{ value?: string; label: string; metadata?: Record<string, unknown> }>;
  };

  const staticLists: StaticListSpec[] = [
    {
      slug: "measurement-units",
      name: "Measurement units",
      description: "Units used across scope, cutting and waste lines.",
      items: [
        { value: "lm", label: "Lm" },
        { value: "sqm", label: "Sqm" },
        { value: "m3", label: "M³" },
        { value: "kg", label: "Kg" },
        { value: "unit", label: "Unit" },
        { value: "tonne", label: "Tonne" },
        { value: "each", label: "Each" },
        { value: "rl", label: "RL" },
        { value: "hr", label: "Hr" }
      ]
    },
    {
      slug: "materials",
      name: "Materials",
      description: "Material categories referenced on scope items and cutting sheets.",
      items: [
        { label: "Concrete (unreinforced)" },
        { label: "Concrete (reinforced)" },
        { label: "Masonry/Brick" },
        { label: "Timber" },
        { label: "Steel" },
        { label: "Plasterboard" },
        { label: "Vinyl/Floor coverings" },
        { label: "Asbestos cement sheet" },
        { label: "Friable asbestos" },
        { label: "Roof sheeting" },
        { label: "Glass" },
        { label: "Mixed rubble" },
        { label: "Asphalt" },
        { label: "Sand" },
        { label: "Soil" },
        { label: "Rock" },
        { label: "Ceramic tiles" },
        { label: "Plywood" },
        { label: "FC sheet" },
        { label: "Super six" }
      ]
    },
    {
      slug: "row-types",
      name: "Scope row types",
      description: "Row types shown in the Scope of Works editor, filtered by discipline.",
      items: [
        { value: "demolition", label: "Demolition", metadata: { disciplines: ["DEM"] } },
        { value: "asbestos-removal", label: "Asbestos removal", metadata: { disciplines: ["ASB"] } },
        { value: "enclosure", label: "Enclosure", metadata: { disciplines: ["ASB"] } },
        { value: "excavation", label: "Excavation", metadata: { disciplines: ["CIV"] } },
        { value: "earthworks", label: "Earthworks", metadata: { disciplines: ["CIV"] } },
        {
          value: "waste-disposal",
          label: "Waste/Disposal",
          metadata: { disciplines: ["DEM", "CIV", "ASB", "Other"] }
        },
        {
          value: "plant-only",
          label: "Plant only",
          metadata: { disciplines: ["DEM", "CIV", "ASB", "Other"] }
        },
        {
          value: "general-labour",
          label: "General/Labour",
          metadata: { disciplines: ["DEM", "CIV", "ASB", "Other"] }
        },
        {
          value: "cutting",
          label: "Cutting (see cutting sheet)",
          metadata: { disciplines: ["DEM", "CIV", "Other"] }
        }
      ]
    },
    {
      slug: "subcontractor-categories",
      name: "Subcontractor & supplier categories",
      description:
        "Trade categories for directory entries — mirrors the IS SharePoint folder structure.",
      items: [
        { label: "Arborist" },
        { label: "Asbestos Removal" },
        { label: "Concrete Cutting" },
        { label: "Credit Applications" },
        { label: "Engineering" },
        { label: "Geotech Testing" },
        { label: "Hygienists" },
        { label: "Labour Hire" },
        { label: "Petrol Station" },
        { label: "Plant Hire" },
        { label: "Service Scanning" },
        { label: "Site Protections" },
        { label: "Survey" },
        { label: "Traffic Control" },
        { label: "Truck Hire" },
        { label: "Vacuum Excavation" },
        { label: "Waste Facilities" }
      ]
    },
    {
      slug: "tender-package-disciplines",
      name: "Tender package disciplines",
      description:
        "Disciplines used to categorise per-tender pricing packages (asbestos, demolition, cutting, civil, …). Director-configurable.",
      items: [
        { value: "asbestos", label: "Asbestos" },
        { value: "demolition", label: "Demolition" },
        { value: "concrete-cutting", label: "Concrete Cutting" },
        { value: "civil", label: "Civil" },
        { value: "other", label: "Other" }
      ]
    }
  ];

  for (const spec of staticLists) {
    const list = await prisma.globalList.upsert({
      where: { slug: spec.slug },
      create: {
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        type: "STATIC",
        isSystem: true,
        createdById: adminUserId
      },
      update: { name: spec.name, description: spec.description, isSystem: true }
    });
    for (let i = 0; i < spec.items.length; i += 1) {
      const item = spec.items[i];
      const value = (item.value ?? slugifyForSeed(item.label)).toLowerCase();
      await prisma.globalListItem.upsert({
        where: { listId_value: { listId: list.id, value } },
        create: {
          listId: list.id,
          value,
          label: item.label,
          metadata: (item.metadata ?? null) as never,
          sortOrder: i,
          createdById: adminUserId
        },
        update: {
          label: item.label,
          metadata: (item.metadata ?? null) as never,
          sortOrder: i,
          isArchived: false
        }
      });
    }
  }

  const dynamicLists: Array<{ slug: string; name: string; sourceModule: string; description: string }> = [
    {
      slug: "equipment",
      name: "Equipment",
      sourceModule: "assets",
      description: "Live list of non-retired assets from the Assets module."
    },
    {
      slug: "plant",
      name: "Plant",
      sourceModule: "assets",
      description: "Assets in Plant/Equipment categories — subset of Equipment."
    }
  ];
  for (const spec of dynamicLists) {
    await prisma.globalList.upsert({
      where: { slug: spec.slug },
      create: {
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        type: "DYNAMIC",
        sourceModule: spec.sourceModule,
        isSystem: true,
        createdById: adminUserId
      },
      update: {
        name: spec.name,
        description: spec.description,
        sourceModule: spec.sourceModule,
        isSystem: true
      }
    });
  }
}

export function slugifyForSeed(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Reference layer aggregate — everything a production database needs that is
// not a user or a demo entity. Roles/permissions are seeded separately
// (seedPermissionsAndCoreRoles + seedOperationalRoles) because prod user
// provisioning must run between roles and global lists.
export async function seedReferenceData(
  prisma: PrismaClient,
  opts: { listsOwnerId?: string } = {}
): Promise<void> {
  await prisma.healthcheckSeedMarker.upsert({
    where: { name: "foundation" },
    update: {},
    create: { name: "foundation" }
  });
  await seedLookups(prisma);
  await seedEstimateRates(prisma);
  await seedRateTableProjections(prisma);
  await seedFormTemplates(prisma);

  const listsOwnerId =
    opts.listsOwnerId ??
    (
      (await prisma.user.findFirst({ where: { isSuperUser: true }, select: { id: true } })) ??
      (await prisma.user.findFirst({ where: { isActive: true }, select: { id: true } }))
    )?.id;
  if (listsOwnerId) {
    await seedGlobalLists(prisma, listsOwnerId);
  } else {
    console.warn(
      "seed:reference — no user exists to own global lists; skipped. Re-run after provisioning users (seed:users:prod or seed:demo)."
    );
  }

  await seedNotificationTriggerConfigs(prisma);
  await seedPersonaRegistry(prisma);
  await seedProcurementConfig(prisma);
  // CompanyProfile singleton — insert-if-absent so manual admin edits
  // survive re-seed (CP-08 discipline).
  const { seedCompanyProfile } = await import("./seed-company-profile.js");
  await seedCompanyProfile(prisma);
}

/**
 * Procurement sourcing-gate thresholds (PR-488 slice 1) per POL 1.2.14.
 *
 * - `< minQuoteThreshold` → no quote evidence required.
 * - `>= minQuoteThreshold` → operator must supply `quoteEvidenceRef` proving
 *   `requiredQuotesAtMin` competing quotes were collected.
 * - `>= rfqThreshold` → formal RFQ + 3 bids expected; the same
 *   `quoteEvidenceRef` field carries the RFQ pack reference.
 *
 * Values live in DB so future changes are a settings edit, not a code
 * change. Idempotent upsert on the singleton row.
 */
async function seedProcurementConfig(prisma: PrismaClient) {
  await prisma.procurementConfig.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      minQuoteThreshold: "5000",
      requiredQuotesAtMin: 3,
      rfqThreshold: "20000"
    }
  });
}
