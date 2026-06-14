import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import PDFDocument from "pdfkit";
import {
  seedGlobalLists,
  seedLookups,
  seedNotificationTriggerConfigs,
  seedPermissionsAndCoreRoles,
  seedPersonaRegistry
} from "./seed-reference";
import {
  seedBusinessDirectoryDemos,
  seedEstimateRates,
  seedInitialServicesDataset,
  seedSafetyDemos
} from "./seed-initial-services";
import { seedFormTemplates } from "./seed-form-templates";
import { SCOPE_CARD_DEFAULTS } from "../src/modules/tendering/scope/card-defaults";

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

// PR #146 — synthetic 2-page demolition drawing PDF for T260512-BRIS-Rev1 demo
// tender. Output is bland by design; ships in repo so the seed is
// hermetic. For richer demo material see roadmap.md PHASE 6 entry.
// Pdfkit's stream-to-buffer flow uses event listeners, so wrap in
// a Promise.
// §5A.1 PR G — synthetic asbestos register PDF for the BGS demo
// tender, so the new read_asbestos_register tool has something to
// detect + read end-to-end. Realistic ACM table rows (location,
// material, class, condition, qty) so the model can cross-reference.
function generateSyntheticAsbestosRegister(opts: {
  project: string;
  client: string;
  surveyDate: string;
  rows: Array<{
    ref: string;
    location: string;
    material: string;
    acmType: string;
    friable: "Friable" | "Non-friable";
    condition: string;
    approxQty: string;
  }>;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolveBuf, rejectBuf) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolveBuf(Buffer.concat(chunks)));
    doc.on("error", rejectBuf);

    doc.fontSize(14).text("ASBESTOS REGISTER / HAZMAT SURVEY", { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Project: ${opts.project}`);
    doc.text(`Client:  ${opts.client}`);
    doc.text(`Survey date: ${opts.surveyDate}`);
    doc.moveDown(0.5);
    doc.fontSize(9).text(
      "This register identifies asbestos-containing materials (ACM) " +
        "and is the authoritative reference for the ASB scope of any " +
        "demolition or refurbishment works on this site. Cross-reference " +
        "every proposed ASB line item against the entries below."
    );
    doc.moveDown(0.7);

    // Header row
    doc.fontSize(9);
    const headers = ["Ref", "Location", "Material", "ACM Type", "Class", "Condition", "Approx Qty"];
    doc.text(headers.join(" | "));
    doc.text("-".repeat(110));

    for (const r of opts.rows) {
      doc.text(
        [r.ref, r.location, r.material, r.acmType, r.friable, r.condition, r.approxQty].join(
          " | "
        )
      );
    }

    doc.moveDown(0.7);
    doc.fontSize(8).text(
      "Notes: Quantities are indicative. Class B materials may be " +
        "removed under standard non-friable controls; Class A (friable) " +
        "requires Class A licence + full encapsulation. Refer to AS 2601 " +
        "and the SafeWork QLD Code of Practice for removal methodology."
    );

    doc.end();
  });
}

function generateSyntheticDrawing(opts: {
  drawingNumber: string;
  title: string;
  scale: string;
  revision: string;
  date: string;
  project: string;
  client: string;
}): Promise<Buffer> {
  return new Promise<Buffer>((resolveBuf, rejectBuf) => {
    const doc = new PDFDocument({ size: "A3", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolveBuf(Buffer.concat(chunks)));
    doc.on("error", rejectBuf);

    // Page 1 — header + faux drawing area + titleblock (bottom-right per
    // real-world convention).
    doc.fontSize(14).text(opts.project, 30, 30);
    doc.fontSize(10).text(opts.title, 30, 50);
    doc.rect(30, 80, 800, 400).stroke();
    doc.fontSize(9).text("(Synthetic drawing content area)", 400, 280);

    const tbX = 660;
    const tbY = 500;
    doc.fontSize(8);
    doc.text("DRAWING NO.", tbX, tbY);
    doc.text(opts.drawingNumber, tbX + 100, tbY);
    doc.text("TITLE", tbX, tbY + 15);
    doc.text(opts.title, tbX + 100, tbY + 15);
    doc.text("SCALE", tbX, tbY + 30);
    doc.text(opts.scale, tbX + 100, tbY + 30);
    doc.text("REVISION", tbX, tbY + 45);
    doc.text(opts.revision, tbX + 100, tbY + 45);
    doc.text("DATE", tbX, tbY + 60);
    doc.text(opts.date, tbX + 100, tbY + 60);
    doc.text("PROJECT", tbX, tbY + 75);
    doc.text(opts.project, tbX + 100, tbY + 75);
    doc.text("CLIENT", tbX, tbY + 90);
    doc.text(opts.client, tbX + 100, tbY + 90);

    // Page 2 — gives drawing tools a multi-page surface to exercise
    // pageNumber parameters.
    doc.addPage();
    doc.fontSize(14).text(`${opts.project} - Page 2`, 30, 30);
    doc.fontSize(10).text("Notes", 30, 60);
    doc.fontSize(8).text(
      "1. Contractor to verify all dimensions on site.\n" +
        "2. Refer to demolition specification for full scope.\n" +
        "3. All asbestos materials to be removed in accordance with AS 2601.",
      30,
      80
    );

    doc.end();
  });
}

// Mirror of MockSharePointAdapter.resolveMockStoragePath. Kept inline
// to avoid pulling Nest DI into the seed script. If the mock storage
// path layout ever changes (e.g. partitioning by site/drive), update
// both this function and the adapter together.
//
// Path is `.local-storage/sharepoint-mock` relative to cwd. The seed
// runs from apps/api, so resolves to apps/api/.local-storage/...,
// matching the adapter at runtime.
function resolveSeedMockStoragePath(): string {
  return (
    process.env.SHAREPOINT_MOCK_STORAGE_PATH ??
    resolve(process.cwd(), ".local-storage/sharepoint-mock")
  );
}

async function persistMockFileBytes(itemId: string, content: Buffer): Promise<void> {
  const dir = resolveSeedMockStoragePath();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, itemId), content);
}

// G5 — derives the 4-letter slug embedded in a canonical tender/job number
// literal (T260520-ACME-Rev1 -> ACME).
function slugOfNumber(number: string): string {
  return number.split("-")[1];
}

// G5 — YYMMDD date stamp for "today" in Brisbane local time (UTC+10, no DST).
function brisbaneStamp(): string {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Brisbane",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

// Allocates a canonical J{YYMMDD}-{SLUG}-{NNN} job number for a seeded job,
// idempotently. Mirrors JobNumberService.generate() since the seed runs
// outside Nest DI: NNN is the client's all-time job count + 1, and same-day
// collisions get a -2/-3 suffix. Re-running the seed reuses the previous
// number via the stable seed id lookup, so allocation happens once per DB.
// JobNumberSequence is intentionally no longer touched (retired by G5; the
// per-client sequence is computed from the jobs table on demand).
async function allocateSeedJobNumber(
  seedId: string,
  clientId: string,
  clientName: string
): Promise<{ jobNumber: string; clientSlugSnapshot: string }> {
  const existing = await prisma.job.findUnique({
    where: { id: seedId },
    select: { jobNumber: true, clientSlugSnapshot: true }
  });
  if (existing) {
    return {
      jobNumber: existing.jobNumber,
      clientSlugSnapshot: existing.clientSlugSnapshot ?? slugOfNumber(existing.jobNumber)
    };
  }

  const slug = clientName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "XXXX";
  const count = await prisma.job.count({ where: { clientId } });
  const base = `J${brisbaneStamp()}-${slug}-${String(count + 1).padStart(3, "0")}`;

  let candidate = base;
  let suffix = 1;
  while (await prisma.job.findUnique({ where: { jobNumber: candidate }, select: { id: true } })) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return { jobNumber: candidate, clientSlugSnapshot: slug };
}

async function main() {
  await prisma.healthcheckSeedMarker.upsert({
    where: { name: "foundation" },
    update: {},
    create: { name: "foundation" }
  });

  // One-time cleanup: the legacy TEN-2026-### seed tenders were renamed to
  // T260501-ACME-Rev1..T260508-ACME-Rev1. On any DB that ran the old seed, those rows still exist
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

  const { adminRole, plannerRole, viewerRole } = await seedPermissionsAndCoreRoles(prisma);

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

  // Canonical test viewer — stable minimal-grant user for CP-18 permission 403 tests.
  const viewerUser = await prisma.user.upsert({
    where: { email: "viewer@projectops.local" },
    update: { firstName: "Vera", lastName: "Viewer", isActive: true },
    create: {
      email: "viewer@projectops.local",
      firstName: "Vera",
      lastName: "Viewer",
      isActive: true,
      passwordHash: hashPassword("Password123!")
    }
  });
  await prisma.userRole.deleteMany({ where: { userId: viewerUser.id } });
  await prisma.userRole.create({ data: { userId: viewerUser.id, roleId: viewerRole.id } });

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

  await seedLookups(prisma);

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
      where: { tenderNumber: "T260501-ACME-Rev1" },
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
        tenderNumber: "T260501-ACME-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "ACME",
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
        relativePath: "Project Operations/Tendering/T260501-ACME-Rev1_gateway-civil-works-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-001",
        name: tender.title,
        relativePath: "Project Operations/Tendering/T260501-ACME-Rev1_gateway-civil-works-package",
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
        category: "Submissions",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      },
      create: {
        id: "seed-tender-document-1",
        tenderId: tender.id,
        category: "Submissions",
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
        category: "Submissions",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      },
      create: {
        id: "seed-document-link-tender-1",
        linkedEntityType: "Tender",
        linkedEntityId: tender.id,
        module: "tendering",
        category: "Submissions",
        title: "Tender submission",
        folderLinkId: tenderFolder.id,
        fileLinkId: tenderFile.id
      }
    });

    const convertedTender = await prisma.tender.upsert({
      where: { tenderNumber: "T260410-ACME-Rev1" },
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
        tenderNumber: "T260410-ACME-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "ACME",
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
        tenderNumber: "T260505-NORT-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "NORT",
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
        tenderNumber: "T260506-ACME-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "ACME",
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
        tenderNumber: "T260507-NORT-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "NORT",
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
        tenderNumber: "T260508-ACME-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "ACME",
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
          revisionNumber: 1,
          clientSlugSnapshot: slugOfNumber(seedTender.tenderNumber),
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

    // ── T260512-BRIS-Rev1 — Brisbane Grammar School demo tender ──────────────────────
    // Walk-through tender for the Monday presentation. Has scope across all
    // four disciplines (DEM/CIV/ASB/Other), a ClientQuote with cost lines,
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
      where: { tenderNumber: "T260512-BRIS-Rev1" },
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
        tenderNumber: "T260512-BRIS-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "BRIS",
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

    // PR #146 — T260512-BRIS-Rev1 demo drawing for Tendering Assistant smoke
    // testing. The mock SharePoint adapter persists bytes locally; this
    // seed mirrors the upload write-path so smoke tests have something
    // to read regardless of whether anyone has uploaded via the UI.
    // itemId is deterministic so re-seeds overwrite the same file.
    const bgsDrawingFolderItemId = "mock-folder-tendering-bgs-t020-drawings";
    const bgsDrawingFileItemId = "mock-file-tender-bgs-t020-demo-drawing";
    const bgsDrawingFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: bgsDrawingFolderItemId
        }
      },
      update: {
        name: "Drawings",
        relativePath: "Project Operations/Tendering/T260512-BRIS-Rev1_brisbane-grammar-school/Drawings",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: bgsDrawingFolderItemId,
        name: "Drawings",
        relativePath: "Project Operations/Tendering/T260512-BRIS-Rev1_brisbane-grammar-school/Drawings",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      }
    });

    // Generate bytes first so we can populate size_bytes accurately on
    // the file_link row (PR #147 fix — was null prior, because the row
    // got created before bytes existed).
    const bgsDrawingBytes = await generateSyntheticDrawing({
      drawingNumber: "IS-DEMO-001",
      title: "Demolition Plan - Level 1",
      scale: "1:100",
      revision: "A",
      date: "20.05.2026",
      project: "T260512-BRIS-Rev1 Brisbane Grammar School Science Block",
      client: "Brisbane Grammar School"
    });
    const bgsDrawingSizeBytes = bgsDrawingBytes.byteLength;

    const bgsDrawingFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: bgsDrawingFileItemId
        }
      },
      update: {
        folderLinkId: bgsDrawingFolder.id,
        name: "IS-DEMO-001 - Demolition Plan Level 1.pdf",
        relativePath: `${bgsDrawingFolder.relativePath}/IS-DEMO-001 - Demolition Plan Level 1.pdf`,
        webUrl: `https://sharepoint.local/${bgsDrawingFolder.relativePath}/IS-DEMO-001 - Demolition Plan Level 1.pdf`,
        sizeBytes: bgsDrawingSizeBytes,
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      },
      create: {
        folderLinkId: bgsDrawingFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: bgsDrawingFileItemId,
        name: "IS-DEMO-001 - Demolition Plan Level 1.pdf",
        relativePath: `${bgsDrawingFolder.relativePath}/IS-DEMO-001 - Demolition Plan Level 1.pdf`,
        webUrl: `https://sharepoint.local/${bgsDrawingFolder.relativePath}/IS-DEMO-001 - Demolition Plan Level 1.pdf`,
        mimeType: "application/pdf",
        sizeBytes: bgsDrawingSizeBytes,
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      }
    });

    await prisma.tenderDocumentLink.upsert({
      where: { id: "seed-tender-document-bgs-drawing-1" },
      update: {
        tenderId: bgsTender.id,
        category: "Drawings",
        title: "Demolition Plan — Level 1",
        folderLinkId: bgsDrawingFolder.id,
        fileLinkId: bgsDrawingFile.id
      },
      create: {
        id: "seed-tender-document-bgs-drawing-1",
        tenderId: bgsTender.id,
        category: "Drawings",
        title: "Demolition Plan — Level 1",
        folderLinkId: bgsDrawingFolder.id,
        fileLinkId: bgsDrawingFile.id
      }
    });

    await persistMockFileBytes(bgsDrawingFileItemId, bgsDrawingBytes);

    // §5A.1 PR G — synthetic asbestos register PDF for the BGS demo
    // tender. Filename hits the read_asbestos_register detection keyword
    // set (`asbestos register`, `hazmat`). Shares the bgsDrawingFolder so
    // it lands alongside the drawings.
    const bgsRegisterFileItemId = "mock-file-tender-bgs-t020-asbestos-register";
    const bgsRegisterBytes = await generateSyntheticAsbestosRegister({
      project: "T260512-BRIS-Rev1 Brisbane Grammar School Science Block",
      client: "Brisbane Grammar School",
      surveyDate: "15.04.2026",
      rows: [
        {
          ref: "ACM-01",
          location: "Level 1 plant room - pipe lagging",
          material: "Pipe insulation",
          acmType: "Amosite",
          friable: "Friable",
          condition: "Damaged",
          approxQty: "12 lm"
        },
        {
          ref: "ACM-02",
          location: "Level 1 ceiling cavity above lab 1.04",
          material: "Vinyl floor tile 9\"x9\"",
          acmType: "Chrysotile",
          friable: "Non-friable",
          condition: "Stable",
          approxQty: "48 sqm"
        },
        {
          ref: "ACM-03",
          location: "Roof - eaves soffit lining (south wing)",
          material: "Super-6 cement sheeting",
          acmType: "Chrysotile",
          friable: "Non-friable",
          condition: "Weathered",
          approxQty: "110 sqm"
        },
        {
          ref: "ACM-04",
          location: "Level 2 wet area - vinyl skirting",
          material: "Vinyl skirting + adhesive",
          acmType: "Chrysotile",
          friable: "Non-friable",
          condition: "Good",
          approxQty: "65 lm"
        }
      ]
    });
    const bgsRegisterSizeBytes = bgsRegisterBytes.byteLength;

    const bgsRegisterFile = await prisma.sharePointFileLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: bgsRegisterFileItemId
        }
      },
      update: {
        folderLinkId: bgsDrawingFolder.id,
        name: "BGS-T020 Asbestos Register - Hazmat Survey.pdf",
        relativePath: `${bgsDrawingFolder.relativePath}/BGS-T020 Asbestos Register - Hazmat Survey.pdf`,
        webUrl: `https://sharepoint.local/${bgsDrawingFolder.relativePath}/BGS-T020 Asbestos Register - Hazmat Survey.pdf`,
        sizeBytes: bgsRegisterSizeBytes,
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      },
      create: {
        folderLinkId: bgsDrawingFolder.id,
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: bgsRegisterFileItemId,
        name: "BGS-T020 Asbestos Register - Hazmat Survey.pdf",
        relativePath: `${bgsDrawingFolder.relativePath}/BGS-T020 Asbestos Register - Hazmat Survey.pdf`,
        webUrl: `https://sharepoint.local/${bgsDrawingFolder.relativePath}/BGS-T020 Asbestos Register - Hazmat Survey.pdf`,
        mimeType: "application/pdf",
        sizeBytes: bgsRegisterSizeBytes,
        linkedEntityType: "Tender",
        linkedEntityId: bgsTender.id
      }
    });

    await prisma.tenderDocumentLink.upsert({
      where: { id: "seed-tender-document-bgs-asbestos-register" },
      update: {
        tenderId: bgsTender.id,
        category: "Asbestos",
        title: "Asbestos Register / Hazmat Survey",
        folderLinkId: bgsDrawingFolder.id,
        fileLinkId: bgsRegisterFile.id
      },
      create: {
        id: "seed-tender-document-bgs-asbestos-register",
        tenderId: bgsTender.id,
        category: "Asbestos",
        title: "Asbestos Register / Hazmat Survey",
        folderLinkId: bgsDrawingFolder.id,
        fileLinkId: bgsRegisterFile.id
      }
    });

    await persistMockFileBytes(bgsRegisterFileItemId, bgsRegisterBytes);

    // Scope cards (PR A2) — one per discipline that has items. Created
    // BEFORE scope items so each item's cardId can reference the parent
    // card. Deterministic IDs keep the seed idempotent.
    await prisma.scopeOfWorksItem.deleteMany({ where: { tenderId: bgsTender.id } });
    await prisma.scopeCard.deleteMany({ where: { tenderId: bgsTender.id } });
    const cardIdByDiscipline = Object.fromEntries(
      SCOPE_CARD_DEFAULTS.map((c) => [c.discipline, `${bgsTender.id}-card-${c.discipline}`])
    ) as Record<(typeof SCOPE_CARD_DEFAULTS)[number]["discipline"], string>;
    const bgsCardDemId = cardIdByDiscipline.DEM;
    const bgsCardCivId = cardIdByDiscipline.CIV;
    const bgsCardAsbId = cardIdByDiscipline.ASB;
    const bgsCardOtherId = cardIdByDiscipline.Other;
    await prisma.scopeCard.createMany({
      data: SCOPE_CARD_DEFAULTS.map((c) => ({
        id: cardIdByDiscipline[c.discipline],
        tenderId: bgsTender.id,
        name: c.name,
        discipline: c.discipline,
        cardNumber: c.cardNumber,
        sortOrder: c.sortOrder,
        createdById: estimatorUser.id
      }))
    });

    // Scope items across all 4 disciplines — tight rows that demonstrate
    // each discipline's row-type fields without flooding the table.
    await prisma.scopeOfWorksItem.createMany({
      data: [
        {
          tenderId: bgsTender.id,
          cardId: bgsCardDemId,
          createdById: estimatorUser.id,
          wbsCode:"DEM1.1",
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
          cardId: bgsCardDemId,
          createdById: estimatorUser.id,
          wbsCode:"DEM1.2",
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
          cardId: bgsCardDemId,
          createdById: estimatorUser.id,
          wbsCode:"DEM1.3",
          itemNumber: 3,
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
          cardId: bgsCardAsbId,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.1",
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
          cardId: bgsCardAsbId,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.2",
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
          cardId: bgsCardCivId,
          createdById: estimatorUser.id,
          wbsCode:"CIV1.1",
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
          cardId: bgsCardOtherId,
          createdById: estimatorUser.id,
          wbsCode:"Other1.1",
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

    // Assumptions and exclusions on the T260512-BRIS-Rev1 quote — populates the demo
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

    // ── T260520-ACME-Rev1 — Full-Feature Template Tender ────────────────────────────
    // A reference tender the owner copies when building real quotes.
    // Exercises every quote feature: all 4 discipline groups, provisional
    // sums, cost options, linked assumptions, exclusions, referenced
    // drawings, and QuoteScopeItems. detailLevel=detailed,
    // assumptionMode=linked, all show-flags ON.
    const templateTenderId = "seed-tender-template-100";
    const templateTender = await prisma.tender.upsert({
      where: { tenderNumber: "T260520-ACME-Rev1" },
      update: {
        title: "TEMPLATE — Full-Feature Reference Quote",
        status: "DRAFT",
        estimatorUserId: estimatorUser.id,
        probability: 0,
        estimatedValue: new Prisma.Decimal("0"),
        notes: "Template tender — do not submit. Copy this tender to start a new quote with all sections pre-populated."
      },
      create: {
        id: templateTenderId,
        tenderNumber: "T260520-ACME-Rev1",
        revisionNumber: 1,
        clientSlugSnapshot: "ACME",
        title: "TEMPLATE — Full-Feature Reference Quote",
        status: "DRAFT",
        estimatorUserId: estimatorUser.id,
        probability: 0,
        estimatedValue: new Prisma.Decimal("0"),
        notes: "Template tender — do not submit. Copy this tender to start a new quote with all sections pre-populated."
      }
    });

    await prisma.tenderClient.upsert({
      where: {
        tenderId_clientId: {
          tenderId: templateTender.id,
          clientId: clientA.id
        }
      },
      update: { relationshipType: "PRIMARY" },
      create: {
        tenderId: templateTender.id,
        clientId: clientA.id,
        relationshipType: "PRIMARY"
      }
    });

    // Scope cards — all 4 disciplines
    await prisma.scopeOfWorksItem.deleteMany({ where: { tenderId: templateTender.id } });
    await prisma.scopeCard.deleteMany({ where: { tenderId: templateTender.id } });
    const tplCardIds = Object.fromEntries(
      SCOPE_CARD_DEFAULTS.map((c) => [c.discipline, `${templateTender.id}-card-${c.discipline}`])
    ) as Record<(typeof SCOPE_CARD_DEFAULTS)[number]["discipline"], string>;
    await prisma.scopeCard.createMany({
      data: SCOPE_CARD_DEFAULTS.map((c) => ({
        id: tplCardIds[c.discipline],
        tenderId: templateTender.id,
        name: c.name,
        discipline: c.discipline,
        cardNumber: c.cardNumber,
        sortOrder: c.sortOrder,
        createdById: estimatorUser.id
      }))
    });

    // Scope items — DEM, ASB, CIV, Other (incl. cutting/coring/grinding)
    await prisma.scopeOfWorksItem.createMany({
      data: [
        // ── DEM ──
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.DEM,
          createdById: estimatorUser.id,
          wbsCode: "DEM1.1",
          itemNumber: 1,
          rowType: "demolition",
          description: "Internal strip-out — remove partitions, ceilings, joinery, and fixtures",
          status: "confirmed",
          men: new Prisma.Decimal("4"),
          days: new Prisma.Decimal("6"),
          shift: "DAY",
          sqm: new Prisma.Decimal("750"),
          measurements: [{ qty: 750, unit: "sqm" }],
          notes: "Ground floor and Level 1 combined",
          sortOrder: 0
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.DEM,
          createdById: estimatorUser.id,
          wbsCode: "DEM1.2",
          itemNumber: 2,
          rowType: "demolition",
          description: "Structural demolition — load-bearing masonry walls and lintels",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("5"),
          shift: "DAY",
          sqm: new Prisma.Decimal("120"),
          materialType: "masonry",
          measurements: [{ qty: 120, unit: "sqm" }],
          notes: "Engineer cert required prior to commencement",
          sortOrder: 1
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.DEM,
          createdById: estimatorUser.id,
          wbsCode: "DEM1.3",
          itemNumber: 3,
          rowType: "demolition",
          description: "Slab removal — 150mm reinforced concrete ground slab",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("4"),
          shift: "DAY",
          sqm: new Prisma.Decimal("85"),
          depth: new Prisma.Decimal("0.150"),
          materialType: "Concrete reinforced",
          measurements: [{ qty: 85, unit: "sqm" }],
          sortOrder: 2
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.DEM,
          createdById: estimatorUser.id,
          wbsCode: "DEM1.4",
          itemNumber: 4,
          rowType: "demolition",
          description: "Masonry demolition — non-load-bearing block dividing walls",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          sqm: new Prisma.Decimal("65"),
          materialType: "masonry",
          measurements: [{ qty: 65, unit: "sqm" }],
          sortOrder: 3
        },
        // ── CIV ──
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.CIV,
          createdById: estimatorUser.id,
          wbsCode: "CIV1.1",
          itemNumber: 1,
          rowType: "excavation",
          description: "Trench excavation for new stormwater and sewer services",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("4"),
          shift: "DAY",
          excavationDepthM: new Prisma.Decimal("1.50"),
          excavationMaterial: "soil",
          machineSize: "5T",
          measurements: [{ qty: 60, unit: "lm" }],
          notes: "Assume dry conditions — dewatering excluded",
          sortOrder: 0
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.CIV,
          createdById: estimatorUser.id,
          wbsCode: "CIV1.2",
          itemNumber: 2,
          rowType: "excavation",
          description: "Service reinstatement — backfill, compact, and reinstate surfaces",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          measurements: [{ qty: 60, unit: "lm" }],
          sortOrder: 1
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.CIV,
          createdById: estimatorUser.id,
          wbsCode: "CIV1.3",
          itemNumber: 3,
          rowType: "excavation",
          description: "Hardstand works — new concrete hardstand to loading dock area",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          sqm: new Prisma.Decimal("180"),
          depth: new Prisma.Decimal("0.200"),
          measurements: [{ qty: 180, unit: "sqm" }],
          sortOrder: 2
        },
        // ── ASB ──
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.ASB,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.1",
          itemNumber: 1,
          rowType: "asbestos",
          description: "Class A friable removal — pipe lagging and duct insulation",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("5"),
          shift: "DAY",
          acmType: "friable",
          acmMaterial: "pipe_insulation",
          enclosureRequired: true,
          airMonitoring: true,
          lm: new Prisma.Decimal("55"),
          measurementQty: new Prisma.Decimal("55"),
          measurementUnit: "Lm",
          measurements: [{ qty: 55, unit: "Lm" }],
          notes: "Full negative-pressure enclosure — decontamination unit required",
          sortOrder: 0
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.ASB,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.2",
          itemNumber: 2,
          rowType: "asbestos",
          description: "Class B bonded removal — floor tiles and adhesive, eaves soffit sheets",
          status: "confirmed",
          men: new Prisma.Decimal("3"),
          days: new Prisma.Decimal("4"),
          shift: "DAY",
          acmType: "bonded",
          acmMaterial: "vinyl_tile",
          enclosureRequired: false,
          airMonitoring: false,
          sqm: new Prisma.Decimal("310"),
          measurementQty: new Prisma.Decimal("310"),
          measurementUnit: "m²",
          measurements: [{ qty: 310, unit: "m²" }],
          sortOrder: 1
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.ASB,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.3",
          itemNumber: 3,
          rowType: "asbestos",
          description: "Air monitoring — background, control, and clearance sampling",
          status: "confirmed",
          men: new Prisma.Decimal("1"),
          days: new Prisma.Decimal("5"),
          shift: "DAY",
          airMonitoring: true,
          measurements: [{ qty: 15, unit: "samples" }],
          notes: "Licensed assessor — results within 24 hours",
          sortOrder: 2
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.ASB,
          createdById: estimatorUser.id,
          wbsCode: "ASB1.4",
          itemNumber: 4,
          rowType: "asbestos",
          description: "Form 65 submission and WH&S Qld notification",
          status: "confirmed",
          men: new Prisma.Decimal("1"),
          days: new Prisma.Decimal("1"),
          shift: "DAY",
          measurements: [{ qty: 1, unit: "ea" }],
          notes: "Minimum 5 business days prior to commencement",
          sortOrder: 3
        },
        // ── Other — concrete cutting, core drilling, grinding ──
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.Other,
          createdById: estimatorUser.id,
          wbsCode: "Other1.1",
          itemNumber: 1,
          rowType: "cutting",
          description: "Concrete cutting — wall saw cuts to slab penetrations",
          status: "confirmed",
          men: new Prisma.Decimal("2"),
          days: new Prisma.Decimal("2"),
          shift: "DAY",
          cuttingEquipment: "Wall saw",
          elevation: "Floor",
          depthMm: 200,
          lm: new Prisma.Decimal("24"),
          materialType: "Concrete reinforced",
          cuttingIncluded: true,
          measurements: [{ qty: 24, unit: "lm" }],
          notes: "200mm reinforced slab — wall saw both sides",
          sortOrder: 0
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.Other,
          createdById: estimatorUser.id,
          wbsCode: "Other1.2",
          itemNumber: 2,
          rowType: "cutting",
          description: "Core drilling — new service penetrations through RC walls and slab",
          status: "confirmed",
          men: new Prisma.Decimal("1"),
          days: new Prisma.Decimal("3"),
          shift: "DAY",
          cuttingEquipment: "Core drill",
          elevation: "Wall",
          coreHoleDiameterMm: 150,
          coreHoleQty: new Prisma.Decimal("18"),
          materialType: "Concrete reinforced",
          cuttingIncluded: true,
          measurements: [{ qty: 18, unit: "ea" }],
          notes: "150mm dia cores — GPR scan prior to each core",
          sortOrder: 1
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.Other,
          createdById: estimatorUser.id,
          wbsCode: "Other1.3",
          itemNumber: 3,
          rowType: "cutting",
          description: "Concrete grinding / flush-cutting — trip hazard elimination and surface prep",
          status: "confirmed",
          men: new Prisma.Decimal("1"),
          days: new Prisma.Decimal("2"),
          shift: "DAY",
          cuttingEquipment: "Grinder",
          elevation: "Floor",
          depthMm: 5,
          sqm: new Prisma.Decimal("40"),
          materialType: "Concrete unreinforced",
          cuttingIncluded: true,
          measurements: [{ qty: 40, unit: "sqm" }],
          notes: "Grind to level with adjacent surfaces",
          sortOrder: 2
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.Other,
          createdById: estimatorUser.id,
          wbsCode: "Other1.4",
          itemNumber: 4,
          rowType: "provisional",
          description: "Provisional sum — unknown ACM discovery during strip-out",
          status: "confirmed",
          provisionalAmount: new Prisma.Decimal("25000.00"),
          sortOrder: 3
        },
        {
          tenderId: templateTender.id,
          cardId: tplCardIds.Other,
          createdById: estimatorUser.id,
          wbsCode: "Other1.5",
          itemNumber: 5,
          rowType: "provisional",
          description: "Provisional sum — rock encountered during excavation",
          status: "confirmed",
          provisionalAmount: new Prisma.Decimal("15000.00"),
          sortOrder: 4
        }
      ]
    });

    // Referenced drawings — TenderDocumentLink entries (render as "Referenced Drawings" on PDF)
    await prisma.tenderDocumentLink.deleteMany({
      where: { tenderId: templateTender.id }
    });
    await prisma.tenderDocumentLink.createMany({
      data: [
        {
          id: "seed-tpl-doc-demolition-plan",
          tenderId: templateTender.id,
          category: "Drawings",
          title: "Demolition Plan — Ground Floor (DA-100 Rev C)"
        },
        {
          id: "seed-tpl-doc-services-layout",
          tenderId: templateTender.id,
          category: "Drawings",
          title: "Services Layout — Hydraulic + Electrical (ME-200 Rev B)"
        },
        {
          id: "seed-tpl-doc-asbestos-register",
          tenderId: templateTender.id,
          category: "Asbestos",
          title: "Asbestos Register / Hazmat Survey — Building A (Rev 2, March 2026)"
        }
      ]
    });

    // ClientQuote — full-feature overlay with all show-flags ON
    const tplQuoteId = "seed-template-quote-100";
    await prisma.clientQuote.deleteMany({ where: { tenderId: templateTender.id } });
    const tplQuote = await prisma.clientQuote.create({
      data: {
        id: tplQuoteId,
        tenderId: templateTender.id,
        clientId: clientA.id,
        revision: 1,
        quoteRef: "T260520-ACME-Rev1-R1",
        status: "DRAFT",
        assumptionMode: "linked",
        detailLevel: "detailed",
        showProvisional: true,
        showCostOptions: true,
        showScopeTable: true,
        showAssumptions: true,
        showExclusions: true,
        showReferencedDrawings: true,
        createdById: estimatorUser.id
      }
    });

    // Cost lines — one per discipline group
    const tplCostLineIds = {
      dem: "seed-tpl-cl-dem",
      asb: "seed-tpl-cl-asb",
      civ: "seed-tpl-cl-civ",
      cutting: "seed-tpl-cl-cutting"
    };
    await prisma.quoteCostLine.createMany({
      data: [
        {
          id: tplCostLineIds.dem,
          quoteId: tplQuote.id,
          label: "Demolition",
          description: "Internal strip-out, structural demolition, slab removal, and masonry demolition",
          price: new Prisma.Decimal("245000.00"),
          sortOrder: 0
        },
        {
          id: tplCostLineIds.asb,
          quoteId: tplQuote.id,
          label: "Asbestos Removal",
          description: "Class A friable removal, Class B bonded removal, air monitoring, and Form 65",
          price: new Prisma.Decimal("185000.00"),
          sortOrder: 1
        },
        {
          id: tplCostLineIds.civ,
          quoteId: tplQuote.id,
          label: "Civil Works",
          description: "Trench excavation, service reinstatement, and hardstand works",
          price: new Prisma.Decimal("92000.00"),
          sortOrder: 2
        },
        {
          id: tplCostLineIds.cutting,
          quoteId: tplQuote.id,
          label: "Concrete Cutting & Coring",
          description: "Wall saw cuts, core drilling for service penetrations, and surface grinding",
          price: new Prisma.Decimal("38000.00"),
          sortOrder: 3
        }
      ]
    });

    // Provisional sums
    await prisma.quoteProvisionalLine.createMany({
      data: [
        {
          quoteId: tplQuote.id,
          description: "PS — unknown ACM discovered during strip-out works",
          price: new Prisma.Decimal("25000.00"),
          notes: "Provisional sum for asbestos-containing materials not identified in the register.",
          sortOrder: 0
        },
        {
          quoteId: tplQuote.id,
          description: "PS — rock or unexpected subsurface obstruction during excavation",
          price: new Prisma.Decimal("15000.00"),
          notes: "Provisional sum for rock breaking if encountered during trench excavation.",
          sortOrder: 1
        }
      ]
    });

    // Cost options — two alternative / optional items
    await prisma.quoteCostOption.createMany({
      data: [
        {
          quoteId: tplQuote.id,
          label: "Option A",
          description: "Weekend works premium — all trades working Saturday 6am–2pm",
          price: new Prisma.Decimal("18500.00"),
          notes: "Applicable if client requires Saturday shift to meet programme.",
          sortOrder: 0
        },
        {
          quoteId: tplQuote.id,
          label: "Option B",
          description: "Additional GPR scanning for post-tension slab investigation",
          price: new Prisma.Decimal("4200.00"),
          notes: "Recommended where as-built drawings are unavailable.",
          sortOrder: 1
        }
      ]
    });

    // Assumptions — linked to cost lines (assumptionMode = "linked")
    await prisma.quoteAssumption.deleteMany({ where: { quoteId: tplQuote.id } });
    await prisma.quoteAssumption.createMany({
      data: [
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.dem,
          text: "All services isolated and capped by others prior to demolition commencement.",
          sortOrder: 0
        },
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.dem,
          text: "Slab thickness assumed 150mm maximum — variations priced separately.",
          sortOrder: 1
        },
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.asb,
          text: "Asbestos register provided is current — IS not liable for unregistered ACM.",
          sortOrder: 2
        },
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.asb,
          text: "Client to provide minimum 5 business days' notice for Class A commencement.",
          sortOrder: 3
        },
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.civ,
          text: "Dry conditions assumed — dewatering is excluded from this price.",
          sortOrder: 4
        },
        {
          quoteId: tplQuote.id,
          costLineId: tplCostLineIds.cutting,
          text: "GPR scan included for core drilling locations only — full floor scan excluded.",
          sortOrder: 5
        },
        {
          quoteId: tplQuote.id,
          text: "Standard working hours: Monday–Friday 7am–3:30pm.",
          sortOrder: 6
        },
        {
          quoteId: tplQuote.id,
          text: "Client to provide suitable vehicle access and laydown area.",
          sortOrder: 7
        }
      ]
    });

    // Exclusions
    await prisma.quoteExclusion.deleteMany({ where: { quoteId: tplQuote.id } });
    await prisma.quoteExclusion.createMany({
      data: [
        { quoteId: tplQuote.id, text: "Engineering or structural design and certification.", sortOrder: 0 },
        { quoteId: tplQuote.id, text: "Traffic management plans and implementation.", sortOrder: 1 },
        { quoteId: tplQuote.id, text: "Building permits and council / regulatory fees.", sortOrder: 2 },
        { quoteId: tplQuote.id, text: "Hydraulic, electrical, mechanical, and fire services works.", sortOrder: 3 },
        { quoteId: tplQuote.id, text: "Soil contamination testing and remediation.", sortOrder: 4 },
        { quoteId: tplQuote.id, text: "After-hours or weekend works unless stated in cost options.", sortOrder: 5 },
        { quoteId: tplQuote.id, text: "Any works not specifically mentioned in this quotation.", sortOrder: 6 }
      ]
    });

    // QuoteScopeItems — detailed scope table for the PDF (detailLevel=detailed)
    await prisma.quoteScopeItem.deleteMany({ where: { quoteId: tplQuote.id } });
    await prisma.quoteScopeItem.createMany({
      data: [
        { quoteId: tplQuote.id, label: "DEM1.1", description: "Internal strip-out — partitions, ceilings, joinery, fixtures", qty: "750", unit: "sqm", sortOrder: 0 },
        { quoteId: tplQuote.id, label: "DEM1.2", description: "Structural demolition — load-bearing masonry walls and lintels", qty: "120", unit: "sqm", sortOrder: 1 },
        { quoteId: tplQuote.id, label: "DEM1.3", description: "Slab removal — 150mm reinforced concrete ground slab", qty: "85", unit: "sqm", sortOrder: 2 },
        { quoteId: tplQuote.id, label: "DEM1.4", description: "Masonry demolition — non-load-bearing block walls", qty: "65", unit: "sqm", sortOrder: 3 },
        { quoteId: tplQuote.id, label: "CIV1.1", description: "Trench excavation — stormwater and sewer services", qty: "60", unit: "lm", sortOrder: 4 },
        { quoteId: tplQuote.id, label: "CIV1.2", description: "Service reinstatement — backfill, compact, and surface reinstate", qty: "60", unit: "lm", sortOrder: 5 },
        { quoteId: tplQuote.id, label: "CIV1.3", description: "Hardstand works — new concrete to loading dock area", qty: "180", unit: "sqm", sortOrder: 6 },
        { quoteId: tplQuote.id, label: "ASB1.1", description: "Class A friable removal — pipe lagging and duct insulation", qty: "55", unit: "Lm", sortOrder: 7 },
        { quoteId: tplQuote.id, label: "ASB1.2", description: "Class B bonded removal — floor tiles, adhesive, eaves soffits", qty: "310", unit: "m²", sortOrder: 8 },
        { quoteId: tplQuote.id, label: "ASB1.3", description: "Air monitoring — background, control, and clearance sampling", qty: "15", unit: "samples", sortOrder: 9 },
        { quoteId: tplQuote.id, label: "ASB1.4", description: "Form 65 submission and WH&S Qld notification", qty: "1", unit: "ea", sortOrder: 10 },
        { quoteId: tplQuote.id, label: "Other1.1", description: "Concrete cutting — wall saw cuts to slab penetrations", qty: "24", unit: "lm", notes: "200mm RC slab — wall saw both sides", sortOrder: 11 },
        { quoteId: tplQuote.id, label: "Other1.2", description: "Core drilling — service penetrations through RC walls and slab", qty: "18", unit: "ea", notes: "150mm dia — GPR scan prior to each core", sortOrder: 12 },
        { quoteId: tplQuote.id, label: "Other1.3", description: "Concrete grinding / flush-cutting — trip hazard elimination", qty: "40", unit: "sqm", sortOrder: 13 }
      ]
    });

    console.log("  ✓ T260520-ACME-Rev1 template tender + full-feature quote seeded");

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
        relativePath: "Project Operations/Tendering/T260410-ACME-Rev1_north-precinct-services-package",
        module: "tendering",
        linkedEntityType: "Tender",
        linkedEntityId: convertedTender.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-tendering-ten-2026-002",
        name: convertedTender.title,
        relativePath: "Project Operations/Tendering/T260410-ACME-Rev1_north-precinct-services-package",
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
        category: "Correspondence",
        title: "Award letter",
        folderLinkId: convertedTenderFolder.id,
        fileLinkId: convertedTenderFile.id
      },
      create: {
        id: "seed-tender-document-2",
        tenderId: convertedTender.id,
        category: "Correspondence",
        title: "Award letter",
        folderLinkId: convertedTenderFolder.id,
        fileLinkId: convertedTenderFile.id
      }
    });

    const { jobNumber: convertedJobNumber, clientSlugSnapshot: convertedJobSlug } =
      await allocateSeedJobNumber("seed-job-converted", clientA.id, clientA.name);
    const job = await prisma.job.upsert({
      where: { id: "seed-job-converted" },
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
        id: "seed-job-converted",
        jobNumber: convertedJobNumber,
        clientSlugSnapshot: convertedJobSlug,
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

    const jobFolderRelativePath = `Project Operations/Jobs/${job.jobNumber}_north-precinct-services-package`;
    const jobFolder = await prisma.sharePointFolderLink.upsert({
      where: {
        siteId_driveId_itemId: {
          siteId: "project-operations-site",
          driveId: "project-operations-library",
          itemId: "mock-folder-seed-job-converted"
        }
      },
      update: {
        name: job.name,
        relativePath: jobFolderRelativePath,
        module: "jobs",
        linkedEntityType: "Job",
        linkedEntityId: job.id
      },
      create: {
        siteId: "project-operations-site",
        driveId: "project-operations-library",
        itemId: "mock-folder-seed-job-converted",
        name: job.name,
        relativePath: jobFolderRelativePath,
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

    const { jobNumber: archivedJobNumber, clientSlugSnapshot: archivedJobSlug } =
      await allocateSeedJobNumber("seed-job-archived", clientB.id, clientB.name);
    const archivedJob = await prisma.job.upsert({
      where: { id: "seed-job-archived" },
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
        id: "seed-job-archived",
        jobNumber: archivedJobNumber,
        clientSlugSnapshot: archivedJobSlug,
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
  await seedPersonaRegistry(prisma);
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
