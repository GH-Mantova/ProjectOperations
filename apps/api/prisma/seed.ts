import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { permissionRegistry } from "../src/common/permissions/permission-registry";
import { seedMantovaDataset } from "./seed-mantova";

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
        roleId: fieldRole.id,
        permissionId: permissionIdByCode.get("permissions.view")!
      }
    ]
  });

  const seedUsers = [
    ["admin@projectops.local", "Alex", "Admin", adminRole.id],
    ["estimator@projectops.local", "Erin", "Estimator", plannerRole.id],
    ["pm@projectops.local", "Paula", "Manager", plannerRole.id],
    ["scheduler@projectops.local", "Sam", "Scheduler", plannerRole.id],
    ["supervisor@projectops.local", "Sophie", "Supervisor", fieldRole.id],
    ["field@projectops.local", "Finn", "Field", fieldRole.id]
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
      clientId: clientA.id,
      firstName: "Cameron",
      lastName: "Blake",
      email: "cameron.blake@acme.local",
      isPrimary: true
    },
    create: {
      id: "seed-contact-acme",
      clientId: clientA.id,
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

  const estimatorUser = await prisma.user.findUnique({
    where: { email: "estimator@projectops.local" }
  });

  if (estimatorUser) {
    const primaryContact = await prisma.contact.findFirst({
      where: { clientId: clientA.id }
    });

    const tender = await prisma.tender.upsert({
      where: { tenderNumber: "TEN-2026-001" },
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
        tenderNumber: "TEN-2026-001",
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
        relativePath: "Project Operations/Tendering/TEN-2026-001_gateway-civil-works-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-001",
        name: tender.title,
        relativePath: "Project Operations/Tendering/TEN-2026-001_gateway-civil-works-package",
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
      where: { tenderNumber: "TEN-2026-002" },
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
        tenderNumber: "TEN-2026-002",
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
        tenderNumber: "TEN-2026-003",
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
        tenderNumber: "TEN-2026-004",
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
        tenderNumber: "TEN-2026-005",
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
        tenderNumber: "TEN-2026-006",
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

    const gatewaySite = await prisma.site.findFirst({
      where: { code: "GATEWAY" }
    });

    const pmUser = await prisma.user.findUnique({
      where: { email: "pm@projectops.local" }
    });

    const supervisorUser = await prisma.user.findUnique({
      where: { email: "supervisor@projectops.local" }
    });

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
        relativePath: "Project Operations/Tendering/TEN-2026-002_north-precinct-services-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-002",
        name: convertedTender.title,
        relativePath: "Project Operations/Tendering/TEN-2026-002_north-precinct-services-package",
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
          description: "Seed maintenance service record for asset detail and documents filtering.",
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
          description: "Seed maintenance service record for asset detail and documents filtering.",
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

  await seedMantovaDataset(prisma);
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
