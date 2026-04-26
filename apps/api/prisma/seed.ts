import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { permissionRegistry } from "../src/common/permissions/permission-registry";
import {
  seedBusinessDirectoryDemos,
  seedEstimateRates,
  seedInitialServicesDataset,
  seedSafetyDemos
} from "./seed-initial-services";
import { seedFormTemplates } from "./seed-form-templates";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl
    }
  }
});

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");

  return `${salt}:${derivedKey}`;
}

async function main() {
  await prisma.healthcheckSeedMarker.upsert({
    where: { name: "foundation" },
    update: {},
    create: { name: "foundation" }
  });

  // One-time cleanup: the legacy TEN-2026-### seed tenders were renamed to
  // IS-T009..IS-T014. On any DB that ran the old seed, those rows still exist
  // and their JobConversion records block the new seed's upserts. Deleting
  // them (and letting Prisma cascade their children) restores idempotency
  // on upgrade. No-op on clean DBs.
  const legacySeedTenderNumbers = [
    "TEN-2026-001",
    "TEN-2026-002",
    "TEN-2026-003",
    "TEN-2026-004",
    "TEN-2026-005",
    "TEN-2026-006"
  ];
  const legacyTenders = await prisma.tender.findMany({
    where: { tenderNumber: { in: legacySeedTenderNumbers } },
    select: { id: true }
  });
  if (legacyTenders.length > 0) {
    const legacyTenderIds = legacyTenders.map((t) => t.id);
    // JobConversion has FKs to tender, tender_client, and job — deleting it
    // first avoids the unique(job_id) conflict when the job gets re-pointed
    // at the new tender later in the seed.
    await prisma.jobConversion.deleteMany({ where: { tenderId: { in: legacyTenderIds } } });
    await prisma.tender.deleteMany({ where: { id: { in: legacyTenderIds } } });
  }

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

  await prisma.rolePermission.deleteMany({
    where: {
      roleId: { in: [adminRole.id, plannerRole.id, fieldRole.id] }
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
      {
        roleId: fieldRole.id,
        permissionId: permissionIdByCode.get("permissions.view")!
      }
    ]
  });

  // Only the dev/test admin is seeded here. The real Initial Services staff
  // roster is populated in seed-initial-services.ts with stable IDs and
  // granular roles (Project Manager / Senior Estimator / WHS Officer / Accounts
  // / Warehouse Manager).
  const seedUsers = [
    ["admin@projectops.local", "Alex", "Admin", adminRole.id]
  ] as const;

  for (const [email, firstName, lastName, roleId] of seedUsers) {
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        firstName,
        lastName,
        isActive: true
      },
      create: {
        email,
        firstName,
        lastName,
        isActive: true,
        passwordHash: hashPassword("Password123!")
      }
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId
      }
    });
  }

  // Remove fictional demo users from previous seeds.
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "estimator@projectops.local",
          "pm@projectops.local",
          "scheduler@projectops.local",
          "supervisor@projectops.local",
          "field@projectops.local"
        ]
      }
    }
  });

  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@projectops.local" }
  });

  if (adminUser) {
    const dashboard = await prisma.dashboard.upsert({
      where: { id: "seed-admin-dashboard" },
      update: {
        name: "Operations Overview",
        description: "Live operational dashboard for administrators",
        scope: "USER",
        ownerUserId: adminUser.id,
        ownerRoleId: null,
        isDefault: true
      },
      create: {
        id: "seed-admin-dashboard",
        name: "Operations Overview",
        description: "Live operational dashboard for administrators",
        scope: "USER",
        ownerUserId: adminUser.id,
        ownerRoleId: null,
        isDefault: true
      }
    });

    await prisma.dashboardWidget.deleteMany({ where: { dashboardId: dashboard.id } });
    await prisma.dashboardWidget.createMany({
      data: [
        {
          dashboardId: dashboard.id,
          type: "kpi",
          title: "Tender Pipeline",
          description: "Open tenders still progressing toward award",
          position: 0,
          width: 1,
          height: 1,
          config: { metricKey: "tender.pipeline" }
        },
        {
          dashboardId: dashboard.id,
          type: "kpi",
          title: "Active Jobs",
          description: "Currently active delivery jobs",
          position: 1,
          width: 1,
          height: 1,
          config: { metricKey: "jobs.active" }
        },
        {
          dashboardId: dashboard.id,
          type: "kpi",
          title: "Maintenance Due",
          description: "Assets due within the next 7 days",
          position: 2,
          width: 1,
          height: 1,
          config: { metricKey: "maintenance.due" }
        },
        {
          dashboardId: dashboard.id,
          type: "kpi",
          title: "Compliance Backlog",
          description: "Submitted forms awaiting follow-up visibility",
          position: 3,
          width: 1,
          height: 1,
          config: { metricKey: "forms.overdue" }
        },
        {
          dashboardId: dashboard.id,
          type: "chart",
          title: "Jobs by Status",
          description: "Live operational breakdown of job statuses",
          position: 4,
          width: 2,
          height: 1,
          config: { metricKey: "jobs.byStatus" }
        },
        {
          dashboardId: dashboard.id,
          type: "table",
          title: "Scheduler Summary",
          description: "Upcoming shifts with assignment and conflict counts",
          position: 5,
          width: 2,
          height: 1,
          config: { metricKey: "scheduler.summary" }
        },
        {
          dashboardId: dashboard.id,
          type: "table",
          title: "Maintenance Due List",
          description: "Soonest-due maintenance records",
          position: 6,
          width: 2,
          height: 1,
          config: { metricKey: "maintenance.dueList" }
        }
      ]
    });

    const plannerDashboard = await prisma.dashboard.upsert({
      where: { id: "seed-planner-dashboard" },
      update: {
        name: "Planner Command Centre",
        description: "Role dashboard for planning and allocation users",
        scope: "ROLE",
        ownerUserId: null,
        ownerRoleId: plannerRole.id,
        isDefault: true
      },
      create: {
        id: "seed-planner-dashboard",
        name: "Planner Command Centre",
        description: "Role dashboard for planning and allocation users",
        scope: "ROLE",
        ownerUserId: null,
        ownerRoleId: plannerRole.id,
        isDefault: true
      }
    });

    await prisma.dashboardWidget.deleteMany({ where: { dashboardId: plannerDashboard.id } });
    await prisma.dashboardWidget.createMany({
      data: [
        {
          dashboardId: plannerDashboard.id,
          type: "kpi",
          title: "Scheduler Conflicts",
          description: "Current red and amber planner conflicts",
          position: 0,
          width: 1,
          height: 1,
          config: { metricKey: "scheduler.conflicts" }
        },
        {
          dashboardId: plannerDashboard.id,
          type: "kpi",
          title: "Resource Utilisation",
          description: "Assigned worker load count",
          position: 1,
          width: 1,
          height: 1,
          config: { metricKey: "resources.utilization" }
        },
        {
          dashboardId: plannerDashboard.id,
          type: "chart",
          title: "Tender Status Mix",
          description: "Current tender pipeline status mix",
          position: 2,
          width: 2,
          height: 1,
          config: { metricKey: "tenders.byStatus" }
        }
      ]
    });

    await prisma.notification.deleteMany({
      where: {
        userId: adminUser.id,
        title: {
          in: ["SharePoint mode set to mock", "Dashboard foundation ready"]
        }
      }
    });

    await prisma.notification.createMany({
      data: [
        {
          userId: adminUser.id,
          title: "SharePoint mode set to mock",
          body: "Module 3 uses a mock SharePoint adapter until Graph integration is enabled.",
          severity: "INFO",
          status: "UNREAD",
          linkUrl: "/admin/platform"
        },
        {
          userId: adminUser.id,
          title: "Dashboard foundation ready",
          body: "Dashboard and widget base entities are now available for later operational modules.",
          severity: "SUCCESS",
          status: "UNREAD",
          linkUrl: "/dashboards"
        }
      ]
    });

    await prisma.searchEntry.upsert({
      where: { id: "Dashboard:seed-admin-dashboard" },
      update: {
        title: "Operations Overview",
        subtitle: "Admin dashboard",
        body: "Live dashboard for operational admin, maintenance, scheduler, and compliance visibility",
        module: "dashboards",
        url: "/dashboards"
      },
      create: {
        id: "Dashboard:seed-admin-dashboard",
        entityType: "Dashboard",
        entityId: dashboard.id,
        title: "Operations Overview",
        subtitle: "Admin dashboard",
        body: "Live dashboard for operational admin, maintenance, scheduler, and compliance visibility",
        module: "dashboards",
        url: "/dashboards"
      }
    });

    await prisma.searchEntry.upsert({
      where: { id: "Dashboard:seed-planner-dashboard" },
      update: {
        entityId: plannerDashboard.id,
        title: "Planner Command Centre",
        subtitle: "Role dashboard",
        body: "Planner-oriented dashboard for scheduler conflicts, utilization, and tender pipeline visibility",
        module: "dashboards",
        url: "/dashboards"
      },
      create: {
        id: "Dashboard:seed-planner-dashboard",
        entityType: "Dashboard",
        entityId: plannerDashboard.id,
        title: "Planner Command Centre",
        subtitle: "Role dashboard",
        body: "Planner-oriented dashboard for scheduler conflicts, utilization, and tender pipeline visibility",
        module: "dashboards",
        url: "/dashboards"
      }
    });
  }

  // Seed the Initial Services staff roster + granular roles BEFORE the demo
  // tenders/jobs below so that seedInitialServicesDataset's stable user IDs
  // (user-estimator, user-pm-001, etc.) resolve when demo tenders look them up.
  await seedInitialServicesDataset(prisma);

  const [clientA, clientB] = await Promise.all([
    prisma.client.upsert({
      where: { name: "Acme Infrastructure" },
      update: { code: "ACME", status: "ACTIVE", email: "projects@acme.local" },
      create: { name: "Acme Infrastructure", code: "ACME", status: "ACTIVE", email: "projects@acme.local" }
    }),
    prisma.client.upsert({
      where: { name: "Northside Civil" },
      update: { code: "NORTH", status: "ACTIVE", email: "delivery@northside.local" },
      create: { name: "Northside Civil", code: "NORTH", status: "ACTIVE", email: "delivery@northside.local" }
    })
  ]);

  await prisma.contact.upsert({
    where: { id: "seed-contact-acme" },
    update: {
      organisationType: "CLIENT",
      organisationId: clientA.id,
      firstName: "Cameron",
      lastName: "Blake",
      email: "cameron.blake@acme.local",
      isPrimary: true
    },
    create: {
      id: "seed-contact-acme",
      organisationType: "CLIENT",
      organisationId: clientA.id,
      firstName: "Cameron",
      lastName: "Blake",
      email: "cameron.blake@acme.local",
      isPrimary: true
    }
  });

  await prisma.site.upsert({
    where: { name: "Gateway Depot" },
    update: {
      clientId: clientA.id,
      code: "GATEWAY",
      suburb: "Brisbane",
      state: "QLD",
      postcode: "4000"
    },
    create: {
      name: "Gateway Depot",
      clientId: clientA.id,
      code: "GATEWAY",
      suburb: "Brisbane",
      state: "QLD",
      postcode: "4000"
    }
  });

  const [workerType, assetType, vehicleType] = await Promise.all([
    prisma.resourceType.upsert({
      where: { name: "Worker" },
      update: { category: "LABOUR", code: "WORKER" },
      create: { name: "Worker", category: "LABOUR", code: "WORKER" }
    }),
    prisma.resourceType.upsert({
      where: { name: "Excavator" },
      update: { category: "PLANT", code: "EXC" },
      create: { name: "Excavator", category: "PLANT", code: "EXC" }
    }),
    prisma.resourceType.upsert({
      where: { name: "Utility Vehicle" },
      update: { category: "VEHICLE", code: "UTE" },
      create: { name: "Utility Vehicle", category: "VEHICLE", code: "UTE" }
    })
  ]);

  const [plantCategory, vehicleCategory] = await Promise.all([
    prisma.assetCategory.upsert({
      where: { name: "Plant" },
      update: {
        code: "PLANT",
        description: "Mobile plant and heavy equipment",
        isActive: true
      },
      create: {
        name: "Plant",
        code: "PLANT",
        description: "Mobile plant and heavy equipment",
        isActive: true
      }
    }),
    prisma.assetCategory.upsert({
      where: { name: "Vehicles" },
      update: {
        code: "VEH",
        description: "Light vehicles and transport equipment",
        isActive: true
      },
      create: {
        name: "Vehicles",
        code: "VEH",
        description: "Light vehicles and transport equipment",
        isActive: true
      }
    })
  ]);

  const competency = await prisma.competency.upsert({
    where: { name: "Traffic Control" },
    update: { code: "TC" },
    create: { name: "Traffic Control", code: "TC" }
  });

  const heightsCompetency = await prisma.competency.upsert({
    where: { name: "Working at Heights" },
    update: { code: "WAH" },
    create: { name: "Working at Heights", code: "WAH" }
  });

  const worker = await prisma.worker.upsert({
    where: { employeeCode: "W-001" },
    update: {
      firstName: "Mia",
      lastName: "Turner",
      resourceTypeId: workerType.id,
      status: "ACTIVE"
    },
    create: {
      employeeCode: "W-001",
      firstName: "Mia",
      lastName: "Turner",
      resourceTypeId: workerType.id,
      status: "ACTIVE"
    }
  });

  const crew = await prisma.crew.upsert({
    where: { name: "Civil Crew A" },
    update: { code: "CREW-A", status: "ACTIVE" },
    create: { name: "Civil Crew A", code: "CREW-A", status: "ACTIVE" }
  });

  await prisma.crewWorker.deleteMany({ where: { crewId: crew.id } });
  await prisma.crewWorker.create({
    data: {
      crewId: crew.id,
      workerId: worker.id
    }
  });

  await prisma.asset.upsert({
    where: { assetCode: "EX-001" },
    update: {
      name: "Excavator 1",
      assetCategoryId: plantCategory.id,
      resourceTypeId: assetType.id,
      status: "AVAILABLE",
      homeBase: "Gateway Depot",
      currentLocation: "North Precinct Compound"
    },
    create: {
      assetCode: "EX-001",
      name: "Excavator 1",
      assetCategoryId: plantCategory.id,
      resourceTypeId: assetType.id,
      status: "AVAILABLE",
      homeBase: "Gateway Depot",
      currentLocation: "North Precinct Compound"
    }
  });

  await prisma.asset.upsert({
    where: { assetCode: "UT-001" },
    update: {
      name: "Utility Truck 1",
      assetCategoryId: vehicleCategory.id,
      resourceTypeId: vehicleType.id,
      status: "AVAILABLE",
      homeBase: "Gateway Depot",
      currentLocation: "Workshop Yard"
    },
    create: {
      assetCode: "UT-001",
      name: "Utility Truck 1",
      assetCategoryId: vehicleCategory.id,
      resourceTypeId: vehicleType.id,
      status: "AVAILABLE",
      homeBase: "Gateway Depot",
      currentLocation: "Workshop Yard"
    }
  });

  await prisma.workerCompetency.upsert({
    where: {
      workerId_competencyId: {
        workerId: worker.id,
        competencyId: competency.id
      }
    },
    update: {
      achievedAt: new Date("2026-01-15T00:00:00.000Z")
    },
    create: {
      workerId: worker.id,
      competencyId: competency.id,
      achievedAt: new Date("2026-01-15T00:00:00.000Z")
    }
  });

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

  // Estimator reference: points at the real Senior Estimator (Raj Pudasaini)
  // via the stable IS seed ID. Falls back to the legacy demo email only when
  // the IS dataset hasn't been seeded yet.
  const estimatorUser =
    (await prisma.user.findUnique({ where: { id: "user-estimator" } })) ??
    (await prisma.user.findUnique({ where: { email: "estimating@initialservices.net" } }));

  if (estimatorUser) {
    const primaryContact = await prisma.contact.findFirst({
      where: { organisationType: "CLIENT", organisationId: clientA.id }
    });

    const tender = await prisma.tender.upsert({
      where: { tenderNumber: "IS-T009" },
      update: {
        title: "Gateway civil works package",
        status: "SUBMITTED",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
        proposedStartDate: new Date("2026-05-20T00:00:00.000Z"),
        leadTimeDays: 21,
        probability: 60,
        estimatedValue: new Prisma.Decimal("185000.00"),
        notes: "Seed tender with multiple linked clients."
      },
      create: {
        tenderNumber: "IS-T009",
        title: "Gateway civil works package",
        status: "SUBMITTED",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
        proposedStartDate: new Date("2026-05-20T00:00:00.000Z"),
        leadTimeDays: 21,
        probability: 60,
        estimatedValue: new Prisma.Decimal("185000.00"),
        notes: "Seed tender with multiple linked clients."
      }
    });

    await prisma.tenderClient.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderClient.createMany({
      data: [
        {
          tenderId: tender.id,
          clientId: clientA.id,
          contactId: primaryContact?.id,
          isAwarded: false,
          relationshipType: "PRIMARY"
        },
        {
          tenderId: tender.id,
          clientId: clientB.id,
          isAwarded: false,
          relationshipType: "SECONDARY"
        }
      ]
    });

    await prisma.tenderNote.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderNote.create({
      data: {
        tenderId: tender.id,
        authorUserId: estimatorUser.id,
        body: "Pricing aligned with current labour and plant assumptions."
      }
    });

    await prisma.tenderClarification.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderClarification.create({
      data: {
        tenderId: tender.id,
        subject: "Clarify traffic management inclusions",
        status: "OPEN",
        dueDate: new Date("2026-04-15T00:00:00.000Z")
      }
    });

    await prisma.tenderPricingSnapshot.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderPricingSnapshot.create({
      data: {
        tenderId: tender.id,
        versionLabel: "Initial Submission",
        estimatedValue: new Prisma.Decimal("185000.00"),
        marginPercent: new Prisma.Decimal("18.50"),
        assumptions: "Traffic control and day shift works only."
      }
    });

    await prisma.tenderFollowUp.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderFollowUp.create({
      data: {
        tenderId: tender.id,
        dueAt: new Date("2026-04-18T00:00:00.000Z"),
        status: "OPEN",
        details: "Call client to confirm review panel timing.",
        assignedUserId: estimatorUser.id
      }
    });

    await prisma.tenderOutcome.deleteMany({ where: { tenderId: tender.id } });
    await prisma.tenderOutcome.create({
      data: {
        tenderId: tender.id,
        outcomeType: "UNDER_REVIEW",
        notes: "Awaiting client review outcome."
      }
    });


    const tenderFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-tendering-ten-2026-001"
        }
      },
      update: {
        name: tender.title,
        relativePath: "Project Operations/Tendering/IS-T009_gateway-civil-works-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-001",
        name: tender.title,
        relativePath: "Project Operations/Tendering/IS-T009_gateway-civil-works-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      }
    });

    const tenderFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-file-tender-submission-001"
        }
      },
      update: {
        folderLinkId: tenderFolder.id,
        name: "submission.pdf",
        relativePath: `${tenderFolder.relativePath}/submission.pdf`,
        webUrl: `https://sharepoint.local/${tenderFolder.relativePath}/submission.pdf`,
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      },
      create: {
        folderLinkId: tenderFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-file-tender-submission-001",
        name: "submission.pdf",
        relativePath: `${tenderFolder.relativePath}/submission.pdf`,
        webUrl: `https://sharepoint.local/${tenderFolder.relativePath}/submission.pdf`,
        mimeType: "application/pdf",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      }
    });

    await prisma.tenderDocumentLink.upsert({
      where: { id: "seed-tender-document-1" },
      update: {
        tenderId: tender.id,
        category: "Submission",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      },
      create: {
        id: "seed-tender-document-1",
        tenderId: tender.id,
        category: "Submission",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      }
    });

    await prisma.documentLink.upsert({
      where: { id: "seed-document-link-tender-1" },
      update: {
        linkedEntityType: "Tender",
        linkedEntityId: tender.id,
        module: "tendering",
        category: "Submission",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      },
      create: {
        id: "seed-document-link-tender-1",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id,
        module: "tendering",
        category: "Submission",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      }
    });

    const convertedTender = await prisma.tender.upsert({
      where: { tenderNumber: "IS-T010" },
      update: {
        title: "North precinct services package",
        status: "CONVERTED",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-04-10T00:00:00.000Z"),
        proposedStartDate: new Date("2026-04-28T00:00:00.000Z"),
        leadTimeDays: 14,
        probability: 100,
        estimatedValue: new Prisma.Decimal("246500.00"),
        notes: "Seed tender that has progressed through award, contract, and job conversion."
      },
      create: {
        tenderNumber: "IS-T010",
        title: "North precinct services package",
        status: "CONVERTED",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-04-10T00:00:00.000Z"),
        proposedStartDate: new Date("2026-04-28T00:00:00.000Z"),
        leadTimeDays: 14,
        probability: 100,
        estimatedValue: new Prisma.Decimal("246500.00"),
        notes: "Seed tender that has progressed through award, contract, and job conversion."
      }
    });

    await prisma.jobConversion.deleteMany({ where: { tenderId: convertedTender.id } });
    await prisma.job.deleteMany({ where: { sourceTenderId: convertedTender.id } });
    await prisma.tenderClient.deleteMany({ where: { tenderId: convertedTender.id } });

    const awardedTenderClient = await prisma.tenderClient.create({
      data: {
        tenderId: convertedTender.id,
        clientId: clientA.id,
        contactId: primaryContact?.id,
        isAwarded: true,
        contractIssued: true,
        contractIssuedAt: new Date("2026-04-14T00:00:00.000Z"),
        relationshipType: "PRIMARY"
      }
    });

    await prisma.tenderClient.create({
      data: {
        tenderId: convertedTender.id,
        clientId: clientB.id,
        isAwarded: false,
        contractIssued: false,
        relationshipType: "SECONDARY"
      }
    });

    const extraTenderSeeds = [
      {
        tenderNumber: "IS-T011",
        title: "Riverside drainage remediation",
        status: "DRAFT" as const,
        dueDate: new Date("2026-06-12T00:00:00.000Z"),
        proposedStartDate: new Date("2026-07-01T00:00:00.000Z"),
        leadTimeDays: 28,
        probability: 35,
        estimatedValue: new Prisma.Decimal("98000.00"),
        notes: "Early-stage opportunity awaiting scope confirmation.",
        clientId: clientB.id,
        contactId: null,
        isAwarded: false,
        contractIssued: false,
        clarification: null,
        followUp: {
          dueAt: new Date("2026-04-24T00:00:00.000Z"),
          details: "Confirm whether after-hours access is required.",
          status: "OPEN" as const
        }
      },
      {
        tenderNumber: "IS-T012",
        title: "Airport services trenching package",
        status: "IN_PROGRESS" as const,
        dueDate: new Date("2026-05-05T00:00:00.000Z"),
        proposedStartDate: new Date("2026-05-24T00:00:00.000Z"),
        leadTimeDays: 19,
        probability: 55,
        estimatedValue: new Prisma.Decimal("412000.00"),
        notes: "Estimator is revising plant assumptions after client briefing.",
        clientId: clientA.id,
        contactId: primaryContact?.id ?? null,
        isAwarded: false,
        contractIssued: false,
        clarification: {
          subject: "Confirm night shift allowance treatment",
          dueDate: new Date("2026-04-14T00:00:00.000Z"),
          status: "OPEN" as const
        },
        followUp: {
          dueAt: new Date("2026-04-10T00:00:00.000Z"),
          details: "Chase geotech appendix and updated IFC drawings.",
          status: "OPEN" as const
        }
      },
      {
        tenderNumber: "IS-T013",
        title: "Western corridor traffic switch",
        status: "SUBMITTED" as const,
        dueDate: new Date("2026-04-22T00:00:00.000Z"),
        proposedStartDate: new Date("2026-05-10T00:00:00.000Z"),
        leadTimeDays: 12,
        probability: 72,
        estimatedValue: new Prisma.Decimal("268000.00"),
        notes: "Submitted and waiting on formal review panel feedback.",
        clientId: clientB.id,
        contactId: null,
        isAwarded: false,
        contractIssued: false,
        clarification: {
          subject: "Confirm barrier hire duration",
          dueDate: new Date("2026-04-18T00:00:00.000Z"),
          status: "OPEN" as const
        },
        followUp: {
          dueAt: new Date("2026-04-16T00:00:00.000Z"),
          details: "Call procurement lead after board review.",
          status: "OPEN" as const
        }
      },
      {
        tenderNumber: "IS-T014",
        title: "North yard rehabilitation package",
        status: "SUBMITTED" as const,
        dueDate: new Date("2026-04-20T00:00:00.000Z"),
        proposedStartDate: new Date("2026-05-02T00:00:00.000Z"),
        leadTimeDays: 10,
        probability: 90,
        estimatedValue: new Prisma.Decimal("315000.00"),
        notes: "Preferred supplier status achieved and verbal award received.",
        clientId: clientA.id,
        contactId: primaryContact?.id ?? null,
        isAwarded: true,
        contractIssued: true,
        clarification: null,
        followUp: {
          dueAt: new Date("2026-04-12T00:00:00.000Z"),
          details: "Prepare mobilisation plan for issued contract pack.",
          status: "OPEN" as const
        }
      }
    ];

    for (const seedTender of extraTenderSeeds) {
      const extraTender = await prisma.tender.upsert({
        where: { tenderNumber: seedTender.tenderNumber },
        update: {
          title: seedTender.title,
          status: seedTender.status,
          estimatorUserId: estimatorUser.id,
          dueDate: seedTender.dueDate,
          proposedStartDate: seedTender.proposedStartDate,
          leadTimeDays: seedTender.leadTimeDays,
          probability: seedTender.probability,
          estimatedValue: seedTender.estimatedValue,
          notes: seedTender.notes
        },
        create: {
          tenderNumber: seedTender.tenderNumber,
          title: seedTender.title,
          status: seedTender.status,
          estimatorUserId: estimatorUser.id,
          dueDate: seedTender.dueDate,
          proposedStartDate: seedTender.proposedStartDate,
          leadTimeDays: seedTender.leadTimeDays,
          probability: seedTender.probability,
          estimatedValue: seedTender.estimatedValue,
          notes: seedTender.notes
        }
      });

      await prisma.tenderClient.deleteMany({ where: { tenderId: extraTender.id } });
      await prisma.tenderNote.deleteMany({ where: { tenderId: extraTender.id } });
      await prisma.tenderClarification.deleteMany({ where: { tenderId: extraTender.id } });
      await prisma.tenderFollowUp.deleteMany({ where: { tenderId: extraTender.id } });
      await prisma.tenderOutcome.deleteMany({ where: { tenderId: extraTender.id } });

      await prisma.tenderClient.create({
        data: {
          tenderId: extraTender.id,
          clientId: seedTender.clientId,
          contactId: seedTender.contactId,
          isAwarded: seedTender.isAwarded,
          contractIssued: seedTender.contractIssued,
          contractIssuedAt: seedTender.contractIssued ? new Date("2026-04-13T00:00:00.000Z") : null,
          relationshipType: "PRIMARY"
        }
      });

      await prisma.tenderNote.create({
        data: {
          tenderId: extraTender.id,
          authorUserId: estimatorUser.id,
          body: seedTender.notes
        }
      });

      if (seedTender.clarification) {
        await prisma.tenderClarification.create({
          data: {
            tenderId: extraTender.id,
            subject: seedTender.clarification.subject,
            dueDate: seedTender.clarification.dueDate,
            status: seedTender.clarification.status
          }
        });
      }

      await prisma.tenderFollowUp.create({
        data: {
          tenderId: extraTender.id,
          dueAt: seedTender.followUp.dueAt,
          status: seedTender.followUp.status,
          details: seedTender.followUp.details,
          assignedUserId: estimatorUser.id
        }
      });

      await prisma.tenderOutcome.create({
        data: {
          tenderId: extraTender.id,
          outcomeType: seedTender.isAwarded ? "PREFERRED" : "UNDER_REVIEW",
          notes: seedTender.isAwarded
            ? "Seed dashboard tender showing awarded or contracted work."
            : "Seed dashboard tender for pipeline mix."
        }
      });
    }

    // ── IS-T020 — Brisbane Grammar School demo tender ──────────────────────
    // Walk-through tender for the Monday presentation. Has scope across all
    // five disciplines (SO/Str/Asb/Civ/Prv), a ClientQuote with cost lines,
    // multiple clarifications using the new typed log, and a follow-up.
    const bgsClient = await prisma.client.upsert({
      where: { name: "Brisbane Grammar School" },
      update: {
        email: "facilities@brisbanegrammar.qld.edu.au",
        phone: "(07) 3834 5200",
        physicalAddress: "Gregory Terrace",
        physicalSuburb: "Spring Hill",
        physicalState: "QLD",
        physicalPostcode: "4000",
        abn: "11 123 456 789"
      },
      create: {
        name: "Brisbane Grammar School",
        code: "BGS",
        status: "ACTIVE",
        email: "facilities@brisbanegrammar.qld.edu.au",
        phone: "(07) 3834 5200",
        businessType: "company",
        physicalAddress: "Gregory Terrace",
        physicalSuburb: "Spring Hill",
        physicalState: "QLD",
        physicalPostcode: "4000",
        postalSameAs: true,
        abn: "11 123 456 789",
        gstRegistered: true,
        paymentTermsDays: 25
      }
    });

    // Contact has no composite unique key — use findFirst + create-or-update.
    const bgsContact = await (async () => {
      const existing = await prisma.contact.findFirst({
        where: {
          organisationType: "CLIENT",
          organisationId: bgsClient.id,
          lastName: "Whitfield",
          firstName: "Patricia"
        }
      });
      if (existing) {
        return prisma.contact.update({
          where: { id: existing.id },
          data: { email: "p.whitfield@brisbanegrammar.qld.edu.au", isPrimary: true }
        });
      }
      return prisma.contact.create({
        data: {
          organisationType: "CLIENT",
          organisationId: bgsClient.id,
          firstName: "Patricia",
          lastName: "Whitfield",
          role: "Facilities Manager",
          email: "p.whitfield@brisbanegrammar.qld.edu.au",
          phone: "(07) 3834 5210",
          isPrimary: true
        }
      });
    })();

    const bgsTender = await prisma.tender.upsert({
      where: { tenderNumber: "IS-T020" },
      update: {
        title: "Brisbane Grammar School — Science Block refurbishment",
        status: "IN_PROGRESS",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-05-12T00:00:00.000Z"),
        proposedStartDate: new Date("2026-06-15T00:00:00.000Z"),
        leadTimeDays: 28,
        probability: 65,
        estimatedValue: new Prisma.Decimal("428000.00"),
        notes: "Internal strip-out + asbestos removal + civil works for new science wing. Demo tender for Raj walk-through."
      },
      create: {
        tenderNumber: "IS-T020",
        title: "Brisbane Grammar School — Science Block refurbishment",
        status: "IN_PROGRESS",
        estimatorUserId: estimatorUser.id,
        dueDate: new Date("2026-05-12T00:00:00.000Z"),
        proposedStartDate: new Date("2026-06-15T00:00:00.000Z"),
        leadTimeDays: 28,
        probability: 65,
        estimatedValue: new Prisma.Decimal("428000.00"),
        notes: "Internal strip-out + asbestos removal + civil works for new science wing. Demo tender for Raj walk-through."
      }
    });

    await prisma.tenderClient.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.tenderClient.create({
      data: {
        tenderId: bgsTender.id,
        clientId: bgsClient.id,
        contactId: bgsContact.id,
        isAwarded: false,
        relationshipType: "PRIMARY"
      }
    });

    // Scope items across all 5 disciplines — tight rows that demonstrate
    // each discipline's row-type fields without flooding the table.
    await prisma.scopeOfWorksItem.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.scopeOfWorksItem.createMany({
      data: [
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode:"SO1",
          discipline: "SO",
          itemNumber: 1,
          rowType: "demolition",
          description: "Strip-out internal partitions, ceilings, and joinery to Level 1",
          status: "confirmed",
          men: new Prisma.Decimal("4"),
          days: new Prisma.Decimal("5"),
          shift: "DAY",
          sqm: new Prisma.Decimal("680"),
          measurements: [{ qty: 680, unit: "sqm" }],
          sortOrder: 0
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode:"SO2",
          discipline: "SO",
          itemNumber: 2,
          rowType: "demolition",
          description: "Carpet uplift + skirting removal — corridors and offices",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("2"),
          shift: "DAY",
          sqm: new Prisma.Decimal("420"),
          measurements: [{ qty: 420, unit: "sqm" }],
          sortOrder: 1
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode:"Str1",
          discipline: "Str",
          itemNumber: 1,
          rowType: "demolition",
          description: "Demolish internal masonry walls — non-load-bearing",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("4"),
          shift: "DAY",
          sqm: new Prisma.Decimal("85"),
          materialType: "masonry",
          measurements: [{ qty: 85, unit: "sqm" }],
          sortOrder: 0
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode: "Asb1",
          discipline: "Asb",
          itemNumber: 1,
          rowType: "asbestos",
          description:
            "Remove and dispose of asbestos-containing floor tiles — Class B works",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("4"),
          shift: "DAY",
          acmType: "bonded",
          acmMaterial: "vinyl_tile",
          enclosureRequired: false,
          airMonitoring: false,
          // Populate the legacy sqm column AND the JSON measurements payload
          // so both the new pills UI and the legacy QTY/UNIT scope columns
          // render values for this row (the previous seed left them empty).
          sqm: new Prisma.Decimal("285"),
          measurementQty: new Prisma.Decimal("285"),
          measurementUnit: "m²",
          measurements: [{ qty: 285, unit: "m²" }],
          sortOrder: 0
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode: "Asb2",
          discipline: "Asb",
          itemNumber: 2,
          rowType: "asbestos",
          description:
            "Remove and dispose of asbestos-containing pipe lagging — Class A works",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          acmType: "friable",
          acmMaterial: "pipe_insulation",
          enclosureRequired: true,
          airMonitoring: true,
          lm: new Prisma.Decimal("48"),
          measurementQty: new Prisma.Decimal("48"),
          measurementUnit: "Lm",
          measurements: [{ qty: 48, unit: "Lm" }],
          sortOrder: 1
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode:"Civ1",
          discipline: "Civ",
          itemNumber: 1,
          rowType: "excavation",
          description: "Trench excavation for new services — eastern corridor",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          excavationDepthM: new Prisma.Decimal("1.20"),
          excavationMaterial: "soil",
          machineSize: "5T",
          measurements: [{ qty: 35, unit: "lm" }],
          sortOrder: 0
        },
        {
          tenderId: bgsTender.id,
          createdById: estimatorUser.id,
          wbsCode:"Prv1",
          discipline: "Prv",
          itemNumber: 1,
          rowType: "provisional",
          description: "Provisional sum — unknown ACM discovery during strip-out",
          status: "confirmed",
          provisionalAmount: new Prisma.Decimal("18000.00"),
          sortOrder: 0
        }
      ]
    });

    // Clarifications — one RFI + four typed notes covering the full PR #72 set
    await prisma.tenderClarification.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.tenderClarification.create({
      data: {
        tenderId: bgsTender.id,
        subject: "Confirm hours of work — school holidays vs term time",
        status: "OPEN",
        dueDate: new Date("2026-05-05T00:00:00.000Z")
      }
    });

    await prisma.tenderClarificationNote.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.tenderClarificationNote.createMany({
      data: [
        {
          tenderId: bgsTender.id,
          direction: "outgoing",
          noteType: "email",
          text: "Sent revised SOW asking school to confirm asbestos register access for site walk.",
          occurredAt: new Date("2026-04-22T01:30:00.000Z"),
          createdById: estimatorUser.id
        },
        {
          tenderId: bgsTender.id,
          direction: "incoming",
          noteType: "call",
          text: "Patricia called — confirmed register available, walk booked Friday 26 April 8am.",
          occurredAt: new Date("2026-04-23T04:15:00.000Z"),
          createdById: estimatorUser.id
        },
        {
          tenderId: bgsTender.id,
          direction: "outgoing",
          noteType: "meeting",
          text: "Site walk completed with Patricia + facilities team. Photos uploaded to SharePoint.",
          occurredAt: new Date("2026-04-26T22:00:00.000Z"),
          createdById: estimatorUser.id
        },
        {
          tenderId: bgsTender.id,
          direction: "outgoing",
          noteType: "note",
          text: "Internal: Marco to review Class A enclosure spec before pricing freeze.",
          occurredAt: new Date("2026-04-27T01:00:00.000Z"),
          createdById: estimatorUser.id
        }
      ]
    });

    await prisma.tenderFollowUp.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.tenderFollowUp.create({
      data: {
        tenderId: bgsTender.id,
        dueAt: new Date("2026-05-08T00:00:00.000Z"),
        status: "OPEN",
        details: "Phone Patricia to confirm submission lodged + answer any pre-award queries.",
        assignedUserId: estimatorUser.id
      }
    });

    // ClientQuote with cost lines A/B/C
    const bgsQuoteRef = `${bgsTender.tenderNumber}-R1`;
    await prisma.clientQuote.deleteMany({ where: { tenderId: bgsTender.id } });
    const bgsQuote = await prisma.clientQuote.create({
      data: {
        tenderId: bgsTender.id,
        clientId: bgsClient.id,
        revision: 1,
        quoteRef: bgsQuoteRef,
        status: "DRAFT",
        assumptionMode: "free",
        showProvisional: true,
        showCostOptions: false,
        detailLevel: "detailed",
        createdById: estimatorUser.id
      }
    });

    await prisma.quoteCostLine.createMany({
      data: [
        {
          quoteId: bgsQuote.id,
          label: "Strip-out + structural demolition",
          description: "Internal strip-out, partition demolition, carpet uplift",
          price: new Prisma.Decimal("182000.00"),
          sortOrder: 0
        },
        {
          quoteId: bgsQuote.id,
          label: "Asbestos removal (Class A + B)",
          description: "Friable + bonded ACM removal with enclosure and air monitoring",
          price: new Prisma.Decimal("168000.00"),
          sortOrder: 1
        },
        {
          quoteId: bgsQuote.id,
          label: "Civil works",
          description: "Trench excavation for new services and reinstatement",
          price: new Prisma.Decimal("60000.00"),
          sortOrder: 2
        }
      ]
    });

    await prisma.quoteProvisionalLine.createMany({
      data: [
        {
          quoteId: bgsQuote.id,
          description: "PS — unknown ACM uncovered during strip-out",
          price: new Prisma.Decimal("18000.00"),
          notes: "Provisional sum carried for unknown asbestos discovered after demolition opens.",
          sortOrder: 0
        }
      ]
    });

    // Assumptions and exclusions on the IS-T020 quote — populates the demo
    // tender so Raj can walk through both tabs without seeing empty state.
    await prisma.quoteAssumption.deleteMany({ where: { quoteId: bgsQuote.id } });
    await prisma.quoteAssumption.createMany({
      data: [
        {
          quoteId: bgsQuote.id,
          text: "Works to be carried out during school holiday periods only.",
          sortOrder: 0
        },
        {
          quoteId: bgsQuote.id,
          text: "Client to provide suitable vehicle access to all work areas.",
          sortOrder: 1
        },
        {
          quoteId: bgsQuote.id,
          text: "Slab thickness assumed 150mm maximum — refer drawings if otherwise.",
          sortOrder: 2
        },
        {
          quoteId: bgsQuote.id,
          text: "All services to be isolated and capped by others prior to commencement.",
          sortOrder: 3
        }
      ]
    });

    await prisma.quoteExclusion.deleteMany({ where: { quoteId: bgsQuote.id } });
    await prisma.quoteExclusion.createMany({
      data: [
        { quoteId: bgsQuote.id, text: "Asbestos testing and/or air monitoring.", sortOrder: 0 },
        { quoteId: bgsQuote.id, text: "Engineering or structural design.", sortOrder: 1 },
        { quoteId: bgsQuote.id, text: "Traffic management.", sortOrder: 2 },
        { quoteId: bgsQuote.id, text: "Building permits and council fees.", sortOrder: 3 },
        {
          quoteId: bgsQuote.id,
          text:
            "Hydraulic, electrical, mechanical and fire services works.",
          sortOrder: 4
        },
        {
          quoteId: bgsQuote.id,
          text: "Any works not specifically mentioned in this quotation.",
          sortOrder: 5
        },
        {
          quoteId: bgsQuote.id,
          text: "After-hours or weekend works unless specifically stated.",
          sortOrder: 6
        }
      ]
    });

    const gatewaySite = await prisma.site.findFirst({
      where: { code: "GATEWAY" }
    });

    // PM and supervisor references: point at the real Project Manager
    // (Beau Murphy) and — because there's no dedicated field supervisor in the
    // current roster — also Beau for supervisor assignments.
    const pmUser =
      (await prisma.user.findUnique({ where: { id: "user-pm-001" } })) ??
      (await prisma.user.findUnique({ where: { email: "beau.m@initialservices.net" } }));

    const supervisorUser =
      (await prisma.user.findUnique({ where: { id: "user-pm-001" } })) ??
      (await prisma.user.findUnique({ where: { email: "beau.m@initialservices.net" } }));

    const convertedTenderFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-tendering-ten-2026-002"
        }
      },
      update: {
        name: convertedTender.title,
        relativePath: "Project Operations/Tendering/IS-T010_north-precinct-services-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-002",
        name: convertedTender.title,
        relativePath: "Project Operations/Tendering/IS-T010_north-precinct-services-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      }
    });

    const convertedTenderFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-file-tender-award-002"
        }
      },
      update: {
        folderLinkId: convertedTenderFolder.id,
        name: "award-letter.pdf",
        relativePath: `${convertedTenderFolder.relativePath}/award-letter.pdf`,
        webUrl: `https://sharepoint.local/${convertedTenderFolder.relativePath}/award-letter.pdf`,
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      },
      create: {
        folderLinkId: convertedTenderFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-file-tender-award-002",
        name: "award-letter.pdf",
        relativePath: `${convertedTenderFolder.relativePath}/award-letter.pdf`,
        webUrl: `https://sharepoint.local/${convertedTenderFolder.relativePath}/award-letter.pdf`,
        mimeType: "application/pdf",
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      }
    });

    const convertedTenderDocument = await prisma.tenderDocumentLink.upsert({
      where: { id: "seed-tender-document-2" },
      update: {
        tenderId: convertedTender.id,
        category: "Award",
        title: "Award letter",
        folderLinkId: convertedTenderFolder.id,
        fileLinkId: convertedTenderFile.id
      },
      create: {
        id: "seed-tender-document-2",
        tenderId: convertedTender.id,
        category: "Award",
        title: "Award letter",
        folderLinkId: convertedTenderFolder.id,
        fileLinkId: convertedTenderFile.id
      }
    });

    const job = await prisma.job.upsert({
      where: { jobNumber: "JOB-2026-001" },
      update: {
        name: "North precinct services package",
        description: "Converted awarded tender for live delivery planning.",
        clientId: clientA.id,
        siteId: gatewaySite?.id,
        sourceTenderId: convertedTender.id,
        status: "PLANNING",
        projectManagerId: pmUser?.id,
        supervisorId: supervisorUser?.id
      },
      create: {
        jobNumber: "JOB-2026-001",
        name: "North precinct services package",
        description: "Converted awarded tender for live delivery planning.",
        clientId: clientA.id,
        siteId: gatewaySite?.id,
        sourceTenderId: convertedTender.id,
        status: "PLANNING",
        projectManagerId: pmUser?.id,
        supervisorId: supervisorUser?.id
      }
    });

    await prisma.jobConversion.upsert({
      where: { tenderId: convertedTender.id },
      update: {
        tenderClientId: awardedTenderClient.id,
        jobId: job.id,
        carriedDocuments: true
      },
      create: {
        tenderId: convertedTender.id,
        tenderClientId: awardedTenderClient.id,
        jobId: job.id,
        carriedDocuments: true
      }
    });

    await prisma.jobStage.deleteMany({ where: { jobId: job.id } });
    await prisma.jobIssue.deleteMany({ where: { jobId: job.id } });
    await prisma.jobVariation.deleteMany({ where: { jobId: job.id } });
    await prisma.jobProgressEntry.deleteMany({ where: { jobId: job.id } });
    await prisma.jobStatusHistory.deleteMany({ where: { jobId: job.id } });

    const mobilisationStage = await prisma.jobStage.create({
      data: {
        jobId: job.id,
        name: "Mobilisation",
        description: "Initial setup, inductions, and site establishment.",
        stageOrder: 1,
        status: "ACTIVE",
        startDate: new Date("2026-04-21T00:00:00.000Z"),
        endDate: new Date("2026-04-24T00:00:00.000Z")
      }
    });

    const deliveryStage = await prisma.jobStage.create({
      data: {
        jobId: job.id,
        name: "Delivery",
        description: "Main service delivery and completion works.",
        stageOrder: 2,
        status: "PLANNED",
        startDate: new Date("2026-04-27T00:00:00.000Z"),
        endDate: new Date("2026-05-12T00:00:00.000Z")
      }
    });

    await prisma.jobActivity.createMany({
      data: [
        {
          jobId: job.id,
          jobStageId: mobilisationStage.id,
          name: "Site induction and permit review",
          activityOrder: 1,
          status: "COMPLETE",
          plannedDate: new Date("2026-04-21T00:00:00.000Z"),
          notes: "Supervisor to confirm all inducted workers."
        },
        {
          jobId: job.id,
          jobStageId: deliveryStage.id,
          name: "Install temporary services",
          activityOrder: 1,
          status: "PLANNED",
          plannedDate: new Date("2026-04-28T00:00:00.000Z"),
          notes: "Coordinate plant mobilisation with scheduler."
        }
      ]
    });

    await prisma.jobIssue.create({
      data: {
        jobId: job.id,
        title: "Traffic control permit confirmation",
        description: "Awaiting council confirmation before first live works shift.",
        severity: "HIGH",
        status: "OPEN",
        reportedById: supervisorUser?.id,
        dueDate: new Date("2026-04-24T00:00:00.000Z")
      }
    });

    await prisma.jobVariation.create({
      data: {
        jobId: job.id,
        reference: "VAR-001",
        title: "Additional after-hours access",
        description: "Client requested two after-hours mobilisation windows.",
        status: "PROPOSED",
        amount: new Prisma.Decimal("18500.00"),
        approvedById: pmUser?.id
      }
    });

    await prisma.jobProgressEntry.createMany({
      data: [
        {
          jobId: job.id,
          entryType: "DAILY_NOTE",
          entryDate: new Date("2026-04-21T00:00:00.000Z"),
          summary: "Kickoff completed and all inducted workers briefed.",
          percentComplete: 10,
          details: "No incidents recorded on day one.",
          authorUserId: supervisorUser?.id
        },
        {
          jobId: job.id,
          entryType: "PROGRESS",
          entryDate: new Date("2026-04-22T00:00:00.000Z"),
          summary: "Pre-start planning complete for service installation.",
          percentComplete: 20,
          details: "Ready for scheduler assignment in next module.",
          authorUserId: pmUser?.id
        }
      ]
    });

    await prisma.jobStatusHistory.createMany({
      data: [
        {
          jobId: job.id,
          fromStatus: "PLANNING",
          toStatus: "PLANNING",
          note: "Initial conversion created from awarded tender.",
          changedById: pmUser?.id
        },
        {
          jobId: job.id,
          fromStatus: "PLANNING",
          toStatus: "ACTIVE",
          note: "Mobilisation started.",
          changedById: supervisorUser?.id
        }
      ]
    });

    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "ACTIVE"
      }
    });

    await prisma.shiftWorkerAssignment.deleteMany({
      where: {
        shift: { jobId: job.id }
      }
    });
    await prisma.shiftAssetAssignment.deleteMany({
      where: {
        shift: { jobId: job.id }
      }
    });
    await prisma.schedulingConflict.deleteMany({
      where: {
        shift: { jobId: job.id }
      }
    });
    await prisma.shiftRoleRequirement.deleteMany({
      where: {
        shift: { jobId: job.id }
      }
    });
    await prisma.shift.deleteMany({
      where: { jobId: job.id }
    });
    await prisma.availabilityWindow.deleteMany({
      where: { workerId: worker.id }
    });
    await prisma.workerRoleSuitability.deleteMany({
      where: { workerId: worker.id }
    });

    const activities = await prisma.jobActivity.findMany({
      where: { jobId: job.id },
      orderBy: { activityOrder: "asc" }
    });

    const workerForSchedule = await prisma.worker.findFirst({
      where: { employeeCode: "W-001" }
    });

    const assetForSchedule = await prisma.asset.findFirst({
      where: { assetCode: "EX-001" }
    });
    const utilityAsset = await prisma.asset.findFirst({
      where: { assetCode: "UT-001" }
    });

    if (activities[0] && workerForSchedule && assetForSchedule) {
      const firstShift = await prisma.shift.create({
        data: {
          jobId: job.id,
          jobStageId: activities[0].jobStageId,
          jobActivityId: activities[0].id,
          title: "Induction and permit review",
          startAt: new Date("2026-04-28T06:00:00.000Z"),
          endAt: new Date("2026-04-28T14:00:00.000Z"),
          status: "ASSIGNED",
          notes: "Initial mobilisation shift",
          workInstructions: "Review permits, sign on, and prepare plant access."
        }
      });

      const secondShift = await prisma.shift.create({
        data: {
          jobId: job.id,
          jobStageId: activities[1]?.jobStageId ?? activities[0].jobStageId,
          jobActivityId: activities[1]?.id ?? activities[0].id,
          title: "Temporary services install",
          startAt: new Date("2026-04-28T12:00:00.000Z"),
          endAt: new Date("2026-04-28T20:00:00.000Z"),
          status: "ASSIGNED",
          notes: "Overlaps deliberately for scheduler conflict demo",
          workInstructions: "Coordinate access and install temporary services."
        }
      });

      await prisma.shiftWorkerAssignment.createMany({
        data: [
          {
            shiftId: firstShift.id,
            workerId: workerForSchedule.id,
            roleLabel: "Leading Hand"
          },
          {
            shiftId: secondShift.id,
            workerId: workerForSchedule.id,
            roleLabel: "Leading Hand"
          }
        ]
      });

      await prisma.shiftAssetAssignment.createMany({
        data: [
          {
            shiftId: firstShift.id,
            assetId: assetForSchedule.id
          },
          {
            shiftId: secondShift.id,
            assetId: assetForSchedule.id
          }
        ]
      });

      await prisma.shiftRoleRequirement.createMany({
        data: [
          {
            shiftId: firstShift.id,
            roleLabel: "Leading Hand",
            competencyId: competency.id,
            requiredCount: 1
          },
          {
            shiftId: secondShift.id,
            roleLabel: "Leading Hand",
            competencyId: heightsCompetency.id,
            requiredCount: 1
          }
        ]
      });

      await prisma.availabilityWindow.create({
        data: {
          workerId: workerForSchedule.id,
          startAt: new Date("2026-04-28T11:00:00.000Z"),
          endAt: new Date("2026-04-28T18:00:00.000Z"),
          status: "UNAVAILABLE",
          notes: "Booked for training refresh to exercise scheduler warning logic."
        }
      });

      await prisma.workerRoleSuitability.create({
        data: {
          workerId: workerForSchedule.id,
          roleLabel: "Leading Hand",
          suitability: "UNSUITABLE",
          notes: "Temporary suitability hold pending review."
        }
      });

      await prisma.schedulingConflict.createMany({
        data: [
          {
            shiftId: secondShift.id,
            severity: "RED",
            code: "WORKER_OVERLAP",
            message: "Mia Turner is already allocated on an overlapping shift."
          },
          {
            shiftId: secondShift.id,
            severity: "RED",
            code: "ASSET_OVERLAP",
            message: "Excavator 1 is already allocated on an overlapping shift."
          },
          {
            shiftId: secondShift.id,
            severity: "RED",
            code: "WORKER_UNAVAILABLE",
            message: "Mia Turner is marked unavailable during this shift."
          },
          {
            shiftId: secondShift.id,
            severity: "AMBER",
            code: "ROLE_SUITABILITY",
            message: "Mia Turner is flagged as unsuitable for Leading Hand."
          },
          {
            shiftId: secondShift.id,
            severity: "RED",
            code: "MISSING_COMPETENCY",
            message: "Mia Turner does not hold Working at Heights."
          },
          {
            shiftId: secondShift.id,
            severity: "RED",
            code: "ASSET_MAINTENANCE_BLOCK",
            message: "Excavator 1 is unavailable due to maintenance state OVERDUE."
          }
        ]
      });
    }

    if (assetForSchedule) {
      await prisma.assetMaintenancePlan.deleteMany({ where: { assetId: assetForSchedule.id } });
      await prisma.assetMaintenanceEvent.deleteMany({ where: { assetId: assetForSchedule.id } });
      await prisma.assetInspection.deleteMany({ where: { assetId: assetForSchedule.id } });
      await prisma.assetBreakdown.deleteMany({ where: { assetId: assetForSchedule.id } });
      await prisma.assetStatusHistory.deleteMany({ where: { assetId: assetForSchedule.id } });

      const overduePlan = await prisma.assetMaintenancePlan.create({
        data: {
          assetId: assetForSchedule.id,
          title: "250hr service",
          description: "Routine heavy plant service",
          intervalDays: 30,
          warningDays: 5,
          blockWhenOverdue: true,
          lastCompletedAt: new Date("2026-02-15T00:00:00.000Z"),
          nextDueAt: new Date("2026-03-20T00:00:00.000Z"),
          status: "ACTIVE"
        }
      });

      await prisma.assetMaintenanceEvent.create({
        data: {
          assetId: assetForSchedule.id,
          maintenancePlanId: overduePlan.id,
          eventType: "SERVICE",
          scheduledAt: new Date("2026-03-18T00:00:00.000Z"),
          status: "OVERDUE",
          notes: "Deliberately overdue for scheduler warning demo."
        }
      });

      await prisma.assetInspection.create({
        data: {
          assetId: assetForSchedule.id,
          inspectionType: "PRESTART",
          inspectedAt: new Date("2026-04-01T06:00:00.000Z"),
          status: "PASS",
          notes: "Operational check completed."
        }
      });

      await prisma.assetStatusHistory.create({
        data: {
          assetId: assetForSchedule.id,
          fromStatus: "AVAILABLE",
          toStatus: "AVAILABLE",
          note: "Seed baseline status."
        }
      });
    }

    if (utilityAsset) {
      await prisma.assetMaintenancePlan.deleteMany({ where: { assetId: utilityAsset.id } });
      await prisma.assetMaintenanceEvent.deleteMany({ where: { assetId: utilityAsset.id } });
      await prisma.assetInspection.deleteMany({ where: { assetId: utilityAsset.id } });
      await prisma.assetBreakdown.deleteMany({ where: { assetId: utilityAsset.id } });
      await prisma.assetStatusHistory.deleteMany({ where: { assetId: utilityAsset.id } });

      const dueSoonPlan = await prisma.assetMaintenancePlan.create({
        data: {
          assetId: utilityAsset.id,
          title: "Fleet safety check",
          description: "Monthly vehicle safety check",
          intervalDays: 30,
          warningDays: 7,
          blockWhenOverdue: false,
          lastCompletedAt: new Date("2026-03-10T00:00:00.000Z"),
          nextDueAt: new Date("2026-04-05T00:00:00.000Z"),
          status: "ACTIVE"
        }
      });

      await prisma.assetMaintenanceEvent.create({
        data: {
          assetId: utilityAsset.id,
          maintenancePlanId: dueSoonPlan.id,
          eventType: "CHECK",
          scheduledAt: new Date("2026-04-04T08:00:00.000Z"),
          status: "SCHEDULED",
          notes: "Scheduled in warning window."
        }
      });

      await prisma.assetInspection.create({
        data: {
          assetId: utilityAsset.id,
          inspectionType: "ROADWORTHY",
          inspectedAt: new Date("2026-04-01T08:30:00.000Z"),
          status: "FAIL",
          notes: "Tyre replacement required."
        }
      });

      await prisma.assetBreakdown.create({
        data: {
          assetId: utilityAsset.id,
          reportedAt: new Date("2026-04-01T09:00:00.000Z"),
          severity: "HIGH",
          status: "OPEN",
          summary: "Tyre failure and steering vibration",
          notes: "Blocks field deployment until resolved."
        }
      });

      await prisma.assetStatusHistory.create({
        data: {
          assetId: utilityAsset.id,
          fromStatus: "AVAILABLE",
          toStatus: "MAINTENANCE",
          note: "Moved into workshop for repair."
        }
      });

      await prisma.asset.update({
        where: { id: utilityAsset.id },
        data: {
          status: "MAINTENANCE"
        }
      });
    }

    const existingFormTemplate = await prisma.formTemplate.findUnique({
      where: { code: "DAILY-PRESTART" },
      include: {
        versions: {
          include: {
            submissions: true
          }
        }
      }
    });

    if (existingFormTemplate) {
      const existingVersionIds = existingFormTemplate.versions.map((version) => version.id);
      const existingSubmissionIds = existingFormTemplate.versions.flatMap((version) =>
        version.submissions.map((submission) => submission.id)
      );

      if (existingSubmissionIds.length > 0) {
        await prisma.documentLink.deleteMany({
          where: {
            linkedEntityType: "FormSubmission",
            linkedEntityId: { in: existingSubmissionIds }
          }
        });
      }

      if (existingVersionIds.length > 0) {
        await prisma.formSubmission.deleteMany({
          where: {
            templateVersionId: { in: existingVersionIds }
          }
        });
      }

      await prisma.formTemplate.delete({
        where: { id: existingFormTemplate.id }
      });
    }

    const formTemplate = await prisma.formTemplate.create({
      data: {
        name: "Daily Prestart Checklist",
        code: "DAILY-PRESTART",
        description: "Configurable operational prestart for crews and plant.",
        status: "ACTIVE",
        geolocationEnabled: true,
        associationScopes: ["job", "shift", "asset", "worker", "site"]
      }
    });

    const version1 = await prisma.formTemplateVersion.create({
      data: {
        templateId: formTemplate.id,
        versionNumber: 1,
        status: "SUPERSEDED"
      }
    });

    const v1Section = await prisma.formSection.create({
      data: {
        versionId: version1.id,
        title: "Crew Readiness",
        description: "Basic readiness checks",
        sectionOrder: 1
      }
    });

    const [v1FitField, v1NotesField, v1SignatureField] = await Promise.all([
      prisma.formField.create({
        data: {
          sectionId: v1Section.id,
          fieldKey: "fit_for_work",
          label: "Fit for work",
          fieldType: "multiple_choice",
          fieldOrder: 1,
          isRequired: true,
          optionsJson: ["Yes", "No"]
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v1Section.id,
          fieldKey: "hazard_notes",
          label: "Hazard notes",
          fieldType: "textarea",
          fieldOrder: 2
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v1Section.id,
          fieldKey: "crew_signature",
          label: "Crew signature",
          fieldType: "signature",
          fieldOrder: 3,
          isRequired: true
        }
      })
    ]);

    const version2 = await prisma.formTemplateVersion.create({
      data: {
        templateId: formTemplate.id,
        versionNumber: 2,
        status: "ACTIVE"
      }
    });

    const v2Section1 = await prisma.formSection.create({
      data: {
        versionId: version2.id,
        title: "Crew Readiness",
        description: "Current daily readiness checks",
        sectionOrder: 1
      }
    });

    const v2Section2 = await prisma.formSection.create({
      data: {
        versionId: version2.id,
        title: "Plant and Evidence",
        description: "Asset and evidence capture",
        sectionOrder: 2
      }
    });

    const [v2FitField, v2NotesField, v2AssetField, v2PhotoField, v2SignatureField] = await Promise.all([
      prisma.formField.create({
        data: {
          sectionId: v2Section1.id,
          fieldKey: "fit_for_work",
          label: "Fit for work",
          fieldType: "multiple_choice",
          fieldOrder: 1,
          isRequired: true,
          optionsJson: ["Yes", "No"]
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v2Section1.id,
          fieldKey: "hazard_notes",
          label: "Hazard notes",
          fieldType: "textarea",
          fieldOrder: 2
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v2Section2.id,
          fieldKey: "plant_asset",
          label: "Plant asset",
          fieldType: "asset_picker",
          fieldOrder: 1,
          isRequired: true
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v2Section2.id,
          fieldKey: "site_photo",
          label: "Site photo",
          fieldType: "image_capture",
          fieldOrder: 2
        }
      }),
      prisma.formField.create({
        data: {
          sectionId: v2Section2.id,
          fieldKey: "crew_signature",
          label: "Crew signature",
          fieldType: "signature",
          fieldOrder: 3,
          isRequired: true
        }
      })
    ]);

    await prisma.formRule.create({
      data: {
        versionId: version2.id,
        sourceFieldKey: "fit_for_work",
        targetFieldKey: "hazard_notes",
        operator: "equals",
        comparisonValue: "No",
        effect: "REQUIRE"
      }
    });

    const submittedBy = supervisorUser ?? pmUser ?? estimatorUser;

    const legacyFormSubmission = await prisma.formSubmission.create({
      data: {
        templateVersionId: version1.id,
        status: "SUBMITTED",
        submittedById: submittedBy?.id,
        jobId: job.id,
        shiftId: activities[0] ? (await prisma.shift.findFirst({ where: { jobActivityId: activities[0].id } }))?.id ?? null : null,
        workerId: workerForSchedule?.id,
        siteId: gatewaySite?.id,
        summary: "Version 1 prestart submission",
        values: {
          create: [
            {
              fieldId: v1FitField.id,
              fieldKey: "fit_for_work",
              valueText: "Yes"
            },
            {
              fieldId: v1NotesField.id,
              fieldKey: "hazard_notes",
              valueText: "General traffic interface reviewed."
            },
            {
              fieldId: v1SignatureField.id,
              fieldKey: "crew_signature",
              valueText: "Signed"
            }
          ]
        },
        signatures: {
          create: [
            {
              fieldKey: "crew_signature",
              signerName: "Sophie Supervisor"
            }
          ]
        }
      }
    });

    const currentFormSubmission = await prisma.formSubmission.create({
      data: {
        templateVersionId: version2.id,
        status: "SUBMITTED",
        submittedById: submittedBy?.id,
        jobId: job.id,
        assetId: assetForSchedule?.id,
        workerId: workerForSchedule?.id,
        siteId: gatewaySite?.id,
        geolocation: "-27.4318,153.0795",
        summary: "Version 2 prestart submission",
        values: {
          create: [
            {
              fieldId: v2FitField.id,
              fieldKey: "fit_for_work",
              valueText: "No"
            },
            {
              fieldId: v2NotesField.id,
              fieldKey: "hazard_notes",
              valueText: "Plant service overdue and tyre issue identified."
            },
            {
              fieldId: v2AssetField.id,
              fieldKey: "plant_asset",
              valueText: assetForSchedule?.name ?? "Excavator 1"
            },
            {
              fieldId: v2PhotoField.id,
              fieldKey: "site_photo",
              valueJson: { fileName: "prestart-photo.jpg" }
            },
            {
              fieldId: v2SignatureField.id,
              fieldKey: "crew_signature",
              valueText: "Signed"
            }
          ]
        },
        attachments: {
          create: [
            {
              fieldKey: "site_photo",
              fileName: "prestart-photo.jpg",
              fileUrl: "https://sharepoint.local/mock/prestart-photo.jpg"
            }
          ]
        },
        signatures: {
          create: [
            {
              fieldKey: "crew_signature",
              signerName: "Sophie Supervisor"
            }
          ]
        }
      }
    });

    const jobFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-job-job-2026-001"
        }
      },
      update: {
        name: job.name,
        relativePath: "Project Operations/Jobs/JOB-2026-001_north-precinct-services-package",
        module: "jobs",
        linkedEntityType: "Job",
        linkedEntityId: job.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-job-job-2026-001",
        name: job.name,
        relativePath: "Project Operations/Jobs/JOB-2026-001_north-precinct-services-package",
        module: "jobs",
        linkedEntityType: "Job",
        linkedEntityId: job.id
      }
    });

    await prisma.documentLink.upsert({
      where: { id: "seed-document-link-job-1" },
      update: {
        linkedEntityType: "Job",
        linkedEntityId: job.id,
        module: "jobs",
        category: convertedTenderDocument.category,
        title: convertedTenderDocument.title,
        folderLinkId: jobFolder.id,
        fileLinkId: convertedTenderFile.id
      },
      create: {
        id: "seed-document-link-job-1",
        linkedEntityType: "Job",
        linkedEntityId: job.id,
        module: "jobs",
        category: convertedTenderDocument.category,
        title: convertedTenderDocument.title,
        folderLinkId: jobFolder.id,
        fileLinkId: convertedTenderFile.id
      }
    });

    const assetDocumentsFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-asset-ex-001-documents"
        }
      },
      update: {
        name: assetForSchedule?.name ?? "Excavator 1",
        relativePath: "Project Operations/Assets/EX-001_excavator-1/Documents",
        module: "documents",
        linkedEntityType: "Asset",
        linkedEntityId: assetForSchedule?.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-asset-ex-001-documents",
        name: assetForSchedule?.name ?? "Excavator 1",
        relativePath: "Project Operations/Assets/EX-001_excavator-1/Documents",
        module: "documents",
        linkedEntityType: "Asset",
        linkedEntityId: assetForSchedule?.id
      }
    });

    const assetDocumentFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-file-asset-service-record-ex-001"
        }
      },
      update: {
        folderLinkId: assetDocumentsFolder.id,
        name: "service-record.pdf",
        relativePath: `${assetDocumentsFolder.relativePath}/service-record.pdf`,
        webUrl: `https://sharepoint.local/${assetDocumentsFolder.relativePath}/service-record.pdf`,
        linkedEntityType: "Asset",
        linkedEntityId: assetForSchedule?.id,
        versionLabel: "v1",
        versionNumber: 1
      },
      create: {
        folderLinkId: assetDocumentsFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-file-asset-service-record-ex-001",
        name: "service-record.pdf",
        relativePath: `${assetDocumentsFolder.relativePath}/service-record.pdf`,
        webUrl: `https://sharepoint.local/${assetDocumentsFolder.relativePath}/service-record.pdf`,
        linkedEntityType: "Asset",
        linkedEntityId: assetForSchedule?.id,
        versionLabel: "v1",
        versionNumber: 1
      }
    });

    if (assetForSchedule) {
      await prisma.documentLink.upsert({
        where: { id: "seed-document-link-asset-1" },
        update: {
          linkedEntityType: "Asset",
          linkedEntityId: assetForSchedule.id,
          module: "assets",
          category: "Maintenance",
          title: "Excavator service record",
          description: "Asset maintenance service record — periodic engine and hydraulic checks.",
          versionLabel: "v1",
          versionNumber: 1,
          documentFamilyKey: "seed-family-asset-1",
          isCurrentVersion: true,
          folderLinkId: assetDocumentsFolder.id,
          fileLinkId: assetDocumentFile.id
        },
        create: {
          id: "seed-document-link-asset-1",
          linkedEntityType: "Asset",
          linkedEntityId: assetForSchedule.id,
          module: "assets",
          category: "Maintenance",
          title: "Excavator service record",
          description: "Asset maintenance service record — periodic engine and hydraulic checks.",
          versionLabel: "v1",
          versionNumber: 1,
          documentFamilyKey: "seed-family-asset-1",
          isCurrentVersion: true,
          folderLinkId: assetDocumentsFolder.id,
          fileLinkId: assetDocumentFile.id
        }
      });
    }

    const formsDocumentsFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-form-daily-prestart-documents"
        }
      },
      update: {
        name: "DAILY-PRESTART",
        relativePath: `Project Operations/Forms/DAILY-PRESTART_${currentFormSubmission.id}/Documents`,
        module: "documents",
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-form-daily-prestart-documents",
        name: "DAILY-PRESTART",
        relativePath: `Project Operations/Forms/DAILY-PRESTART_${currentFormSubmission.id}/Documents`,
        module: "documents",
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id
      }
    });

    const formsDocumentFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-file-form-photo-attachment-1"
        }
      },
      update: {
        folderLinkId: formsDocumentsFolder.id,
        name: "prestart-evidence.jpg",
        relativePath: `${formsDocumentsFolder.relativePath}/prestart-evidence.jpg`,
        webUrl: `https://sharepoint.local/${formsDocumentsFolder.relativePath}/prestart-evidence.jpg`,
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id,
        versionLabel: "v1",
        versionNumber: 1
      },
      create: {
        folderLinkId: formsDocumentsFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-file-form-photo-attachment-1",
        name: "prestart-evidence.jpg",
        relativePath: `${formsDocumentsFolder.relativePath}/prestart-evidence.jpg`,
        webUrl: `https://sharepoint.local/${formsDocumentsFolder.relativePath}/prestart-evidence.jpg`,
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id,
        versionLabel: "v1",
        versionNumber: 1
      }
    });

    await prisma.documentLink.upsert({
      where: { id: "seed-document-link-form-1" },
      update: {
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id,
        module: "forms",
        category: "Evidence",
        title: "Prestart evidence photo",
        description: `Historical comparison available against submission ${legacyFormSubmission.id}.`,
        versionLabel: "v1",
        versionNumber: 1,
        documentFamilyKey: "seed-family-form-1",
        isCurrentVersion: true,
        folderLinkId: formsDocumentsFolder.id,
        fileLinkId: formsDocumentFile.id
      },
      create: {
        id: "seed-document-link-form-1",
        linkedEntityType: "FormSubmission",
        linkedEntityId: currentFormSubmission.id,
        module: "forms",
        category: "Evidence",
        title: "Prestart evidence photo",
        description: `Historical comparison available against submission ${legacyFormSubmission.id}.`,
        versionLabel: "v1",
        versionNumber: 1,
        documentFamilyKey: "seed-family-form-1",
        isCurrentVersion: true,
        folderLinkId: formsDocumentsFolder.id,
        fileLinkId: formsDocumentFile.id
      }
    });

    await prisma.searchEntry.upsert({
      where: { id: "Job:seed-job-2026-001" },
      update: {
        entityId: job.id,
        title: `${job.jobNumber} - ${job.name}`,
        subtitle: convertedTender.tenderNumber,
        body: "Converted seed job for module 7.",
        module: "jobs",
        url: "/jobs"
      },
      create: {
        id: "Job:seed-job-2026-001",
        entityType: "Job",
        entityId: job.id,
        title: `${job.jobNumber} - ${job.name}`,
        subtitle: convertedTender.tenderNumber,
        body: "Converted seed job for module 7.",
        module: "jobs",
        url: "/jobs"
      }
    });

    const archivedJob = await prisma.job.upsert({
      where: { jobNumber: "JOB-2025-099" },
      update: {
        name: "South precinct closeout package",
        description: "Historical archived job for closeout and archive visibility.",
        clientId: clientB.id,
        siteId: gatewaySite?.id ?? null,
        status: "COMPLETE",
        projectManagerId: pmUser?.id ?? null,
        supervisorId: supervisorUser?.id ?? null
      },
      create: {
        jobNumber: "JOB-2025-099",
        name: "South precinct closeout package",
        description: "Historical archived job for closeout and archive visibility.",
        clientId: clientB.id,
        siteId: gatewaySite?.id ?? null,
        status: "COMPLETE",
        projectManagerId: pmUser?.id ?? null,
        supervisorId: supervisorUser?.id ?? null
      }
    });

    await prisma.jobCloseout.upsert({
      where: { jobId: archivedJob.id },
      update: {
        status: "ARCHIVED",
        summary: "Archived after final handover, forms review, and document reconciliation.",
        checklistJson: {
          items: [
            { key: "documents_complete", completed: true },
            { key: "forms_complete", completed: true },
            { key: "handover_complete", completed: true }
          ]
        },
        archivedAt: new Date("2026-03-25T00:00:00.000Z"),
        archivedById: adminUser?.id ?? null,
        readOnlyFrom: new Date("2026-03-25T00:00:00.000Z")
      },
      create: {
        jobId: archivedJob.id,
        status: "ARCHIVED",
        summary: "Archived after final handover, forms review, and document reconciliation.",
        checklistJson: {
          items: [
            { key: "documents_complete", completed: true },
            { key: "forms_complete", completed: true },
            { key: "handover_complete", completed: true }
          ]
        },
        archivedAt: new Date("2026-03-25T00:00:00.000Z"),
        archivedById: adminUser?.id ?? null,
        readOnlyFrom: new Date("2026-03-25T00:00:00.000Z")
      }
    });

    await prisma.jobStatusHistory.deleteMany({
      where: {
        jobId: archivedJob.id,
        note: "Historical closeout archive seed entry."
      }
    });

    await prisma.jobStatusHistory.create({
      data: {
        jobId: archivedJob.id,
        fromStatus: "ACTIVE",
        toStatus: "COMPLETE",
        note: "Historical closeout archive seed entry.",
        changedById: adminUser?.id ?? null
      }
    });
  }

  // seedInitialServicesDataset is called early (above, before the demo tenders
  // and jobs that reference its user IDs). The remaining IS-dependent seeds run
  // at the end once every other record exists.
  await seedEstimateRates(prisma);
  await backfillTenderLifecycleTimestamps(prisma);
  await seedUserDashboards(prisma);
  if (adminUser) await seedGlobalLists(prisma, adminUser.id);
  await seedBusinessDirectoryDemos(prisma);
  await seedSafetyDemos(prisma);
  await seedFormTemplates(prisma);
  await seedNotificationTriggerConfigs(prisma);
}

async function seedNotificationTriggerConfigs(prisma: PrismaClient) {
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

async function seedGlobalLists(prisma: PrismaClient, adminUserId: string) {
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
        { value: "demolition", label: "Demolition", metadata: { disciplines: ["SO", "Str"] } },
        { value: "asbestos-removal", label: "Asbestos removal", metadata: { disciplines: ["Asb"] } },
        { value: "enclosure", label: "Enclosure", metadata: { disciplines: ["Asb"] } },
        { value: "excavation", label: "Excavation", metadata: { disciplines: ["Civ"] } },
        { value: "earthworks", label: "Earthworks", metadata: { disciplines: ["Civ"] } },
        {
          value: "waste-disposal",
          label: "Waste/Disposal",
          metadata: { disciplines: ["SO", "Str", "Asb", "Civ", "Prv"] }
        },
        {
          value: "plant-only",
          label: "Plant only",
          metadata: { disciplines: ["SO", "Str", "Asb", "Civ", "Prv"] }
        },
        {
          value: "general-labour",
          label: "General/Labour",
          metadata: { disciplines: ["SO", "Str", "Asb", "Civ", "Prv"] }
        },
        {
          value: "cutting",
          label: "Cutting (see cutting sheet)",
          metadata: { disciplines: ["SO", "Str", "Civ", "Prv"] }
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

function slugifyForSeed(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedUserDashboards(prisma: PrismaClient) {
  const users = await prisma.user.findMany({ select: { id: true } });

  const defaults: Array<{ slug: string; name: string; widgets: string[] }> = [
    {
      slug: "operations",
      name: "Operations Overview",
      widgets: [
        "ops_active_jobs_kpi",
        "ops_tender_pipeline_kpi",
        "ops_open_issues_kpi",
        "ops_upcoming_maintenance_kpi",
        "ops_jobs_by_status_donut",
        "ops_tender_pipeline_donut",
        "ops_monthly_revenue_line",
        "ops_form_submissions_bar",
        "ops_maintenance_bar"
      ]
    },
    {
      slug: "tendering",
      name: "Tender Dashboard",
      widgets: [
        "ten_active_pipeline_kpi",
        "ten_submitted_mtd_kpi",
        "ten_win_rate_kpi",
        "ten_avg_lead_time_kpi",
        "ten_due_this_week",
        "ten_follow_up_queue",
        "ten_win_rate_chart",
        "ten_pipeline_by_estimator",
        "ten_recent_wins"
      ]
    }
  ];

  for (const user of users) {
    for (const def of defaults) {
      const config = {
        period: "30d",
        widgets: def.widgets.map((type, order) => ({
          id: `${type}-default`,
          type,
          visible: true,
          order,
          config: { period: null, filters: {} }
        }))
      };
      const existing = await prisma.userDashboard.findUnique({
        where: { userId_slug_isSystem: { userId: user.id, slug: def.slug, isSystem: true } }
      });
      if (existing) {
        await prisma.userDashboard.update({
          where: { id: existing.id },
          data: { name: def.name, config }
        });
      } else {
        await prisma.userDashboard.create({
          data: {
            userId: user.id,
            name: def.name,
            slug: def.slug,
            isSystem: true,
            isDefault: true,
            config
          }
        });
      }
    }
  }
}

// Stable string hash → small integer (for deterministic per-tender offsets)
function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

async function backfillTenderLifecycleTimestamps(prisma: PrismaClient) {
  const tenders = await prisma.tender.findMany({
    select: { id: true, tenderNumber: true, status: true, submittedAt: true, wonAt: true, lostAt: true }
  });
  const now = Date.now();
  const DAY = 86_400_000;

  for (const t of tenders) {
    if (t.tenderNumber.startsWith("TEN-COMP-")) continue; // skip smoke test artifacts
    // Only backdate deterministic IS-T### seed tenders; leave user-created data alone.
    if (!t.tenderNumber.startsWith("IS-T")) continue;

    const seed = stableHash(t.tenderNumber);
    const data: { submittedAt?: Date | null; wonAt?: Date | null; lostAt?: Date | null } = {};

    // createdAt is stamped well BEFORE submittedAt so the lead-time metric
    // (avg of submittedAt - createdAt) renders positive values for the
    // dashboard. Pick a 14–35 day invited-to-submitted gap, deterministic
    // per tenderNumber.
    const invitedGap = 14 + (seed % 22);
    let createdAtOverride: Date | null = null;

    if (t.status === "SUBMITTED") {
      const offset = 3 + (seed % 19);
      data.submittedAt = new Date(now - offset * DAY);
      data.wonAt = null;
      data.lostAt = null;
      createdAtOverride = new Date(data.submittedAt.getTime() - invitedGap * DAY);
    } else if (t.status === "AWARDED" || t.status === "CONTRACT_ISSUED" || t.status === "CONVERTED") {
      const wonOffset = 5 + (seed % 80);
      const won = new Date(now - wonOffset * DAY);
      const submitGap = 20 + ((seed >>> 3) % 40);
      data.wonAt = won;
      data.submittedAt = new Date(won.getTime() - submitGap * DAY);
      data.lostAt = null;
      createdAtOverride = new Date(data.submittedAt.getTime() - invitedGap * DAY);
    } else if (t.status === "LOST") {
      const lostOffset = 10 + (seed % 70);
      const lost = new Date(now - lostOffset * DAY);
      const submitGap = 20 + ((seed >>> 3) % 40);
      data.lostAt = lost;
      data.submittedAt = new Date(lost.getTime() - submitGap * DAY);
      data.wonAt = null;
      createdAtOverride = new Date(data.submittedAt.getTime() - invitedGap * DAY);
    } else {
      data.submittedAt = null;
      data.wonAt = null;
      data.lostAt = null;
    }

    await prisma.tender.update({
      where: { id: t.id },
      data: {
        ...data,
        ...(createdAtOverride ? { createdAt: createdAtOverride } : {})
      }
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
