import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const BASE_DATE = new Date("2026-04-20T00:00:00.000Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(BASE_DATE.getTime() - n * MS_PER_DAY);
}

function daysFromNow(n: number): Date {
  return new Date(BASE_DATE.getTime() + n * MS_PER_DAY);
}

function atTime(date: Date, hours: number, minutes: number): Date {
  const d = new Date(date);
  d.setUTCHours(hours, minutes, 0, 0);
  return d;
}

function weekdaysOfWeek(mondayOffsetDays: number): Date[] {
  return [0, 1, 2, 3, 4].map((offset) => daysFromNow(mondayOffsetDays + offset));
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

export async function seedInitialServicesDataset(prisma: PrismaClient): Promise<void> {
  const [adminRole, plannerRole, fieldRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "Admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Planner" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Field" } })
  ]);

  const viewerRole = await prisma.role.upsert({
    where: { name: "Viewer" },
    update: { description: "Read-only visibility across operational modules", isSystem: true },
    create: { name: "Viewer", description: "Read-only visibility across operational modules", isSystem: true }
  });

  const viewPermissionCodes = [
    "users.view",
    "roles.view",
    "permissions.view",
    "dashboards.view",
    "masterdata.view",
    "resources.view",
    "assets.view",
    "maintenance.view",
    "forms.view",
    "documents.view",
    "tenders.view",
    "tenderdocuments.view",
    "jobs.view",
    "scheduler.view",
    "search.view",
    "notifications.view",
    "directory.view"
  ];
  const viewPermissions = await prisma.permission.findMany({ where: { code: { in: viewPermissionCodes } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: viewerRole.id } });
  await prisma.rolePermission.createMany({
    data: viewPermissions.map((permission) => ({ roleId: viewerRole.id, permissionId: permission.id }))
  });

  // ── Operational roles for the real Initial Services staff roster ─────────
  // "projects.manage" is surfaced in this codebase as `jobs.manage`; "scheduling.manage" as
  // `scheduler.manage`; "whs.manage" and "compliance.manage" as `forms.manage` + `audit.view`
  // (compliance lives in the forms module today); "finance.manage" has no module yet so
  // Accounts gets view-scoped access across tenders/jobs + tenderconversion; "warehouse.manage"
  // maps to `assets.manage` + `maintenance.manage`.
  async function seedRoleWithPermissions(
    name: string,
    description: string,
    permissionCodes: string[]
  ) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { description, isSystem: true },
      create: { name, description, isSystem: true }
    });
    const perms = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (perms.length > 0) {
      await prisma.rolePermission.createMany({
        data: perms.map((p) => ({ roleId: role.id, permissionId: p.id }))
      });
    }
    return role;
  }

  const baseView = [
    "users.view",
    "dashboards.view",
    "masterdata.view",
    "search.view",
    "notifications.view"
  ];

  const projectManagerRole = await seedRoleWithPermissions(
    "Project Manager",
    "Project delivery — jobs, scheduling, and resource coordination.",
    [
      ...baseView,
      "jobs.view",
      "jobs.manage",
      "resources.view",
      "resources.manage",
      "scheduler.view",
      "scheduler.manage",
      "tenders.view",
      "tenderconversion.manage",
      "projects.view",
      "projects.manage",
      "assets.view",
      "maintenance.view",
      "forms.view",
      "forms.manage",
      "documents.view",
      "documents.manage",
      "field.manage",
      "finance.view",
      "directory.view",
      "compliance.view"
    ]
  );

  const seniorEstimatorRole = await seedRoleWithPermissions(
    "Senior Estimator",
    "Tendering and estimating — full control of rate library and tender pricing.",
    [
      ...baseView,
      "tenders.view",
      "tenders.manage",
      "tenderdocuments.view",
      "tenderdocuments.manage",
      "estimates.view",
      "estimates.manage",
      "estimates.admin",
      "projects.view",
      "resources.view",
      "documents.view",
      "directory.view",
      "directory.manage"
    ]
  );

  const whsOfficerRole = await seedRoleWithPermissions(
    "WHS Officer",
    "Work Health & Safety + commercial compliance — forms, audits, document control.",
    [
      ...baseView,
      "forms.view",
      "forms.manage",
      "documents.view",
      "documents.manage",
      "audit.view",
      "tenders.view",
      "jobs.view",
      "projects.view",
      "resources.view",
      "field.manage",
      "compliance.view",
      "compliance.manage",
      "compliance.admin"
    ]
  );

  const accountsRole = await seedRoleWithPermissions(
    "Accounts",
    "Accounts payable / receivable — tender + job visibility, contract lifecycle access.",
    [
      ...baseView,
      "tenders.view",
      "tenderdocuments.view",
      "tenderconversion.manage",
      "jobs.view",
      "projects.view",
      "resources.view",
      "documents.view",
      "finance.view",
      "finance.manage",
      "directory.view",
      "directory.manage",
      "directory.finance",
      "compliance.view"
    ]
  );

  const warehouseManagerRole = await seedRoleWithPermissions(
    "Warehouse Manager",
    "Assets and maintenance — warehouse + equipment lifecycle.",
    [
      ...baseView,
      "assets.view",
      "assets.manage",
      "maintenance.view",
      "maintenance.manage",
      "resources.view",
      "resources.manage",
      "jobs.view",
      "projects.view",
      "scheduler.view"
    ]
  );

  // Field Worker role — given to provisioned mobile users only. Access is
  // restricted to the field worker app (their own allocations, pre-starts,
  // timesheets, and project documents).
  await seedRoleWithPermissions(
    "Field Worker",
    "Mobile field access — own allocations, pre-starts, timesheets, documents.",
    ["field.view", "notifications.view"]
  );

  type UserSeed = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    position: string;
    isSuperUser?: boolean;
  };
  // Real Initial Services staff roster. Stable IDs are retained so existing seed
  // references (tender estimator, job PM/supervisor) continue to resolve.
  const userSeeds: UserSeed[] = [
    {
      // Sean is the only Super User. Super Users can manage Admins and other
      // Super Users — the User Management UI + API enforce that tier rule.
      id: "user-admin",
      email: "sean@initialservices.net",
      firstName: "Sean",
      lastName: "Lattin",
      roleId: adminRole.id,
      position: "Company Director",
      isSuperUser: true
    },
    {
      id: "user-pm-002",
      email: "colin@initialservices.net",
      firstName: "Colin",
      lastName: "Hanlon",
      roleId: adminRole.id,
      position: "Operations Manager"
    },
    {
      id: "user-pm-001",
      email: "beau.m@initialservices.net",
      firstName: "Beau",
      lastName: "Murphy",
      roleId: projectManagerRole.id,
      position: "Project Manager"
    },
    {
      // Marco has Admin for system configuration access; WHS permissions
      // inherited via Admin role (which includes all baseView + manage verbs).
      id: "user-supervisor-001",
      email: "marco@initialservices.net",
      firstName: "Marco",
      lastName: "Mantovaninni",
      roleId: adminRole.id,
      position: "WHS & Commercial Compliance · Admin"
    },
    {
      id: "user-estimator",
      email: "estimating@initialservices.net",
      firstName: "Raj",
      lastName: "Pudasaini",
      roleId: seniorEstimatorRole.id,
      position: "Senior Estimator"
    },
    {
      id: "user-supervisor-002",
      email: "admin@initialservices.net",
      firstName: "Amy",
      lastName: "Russian",
      roleId: accountsRole.id,
      position: "Accounts Payable/Receivable"
    },
    {
      id: "user-scheduler",
      email: "warehouse@initialservices.net",
      firstName: "Matthew",
      lastName: "Knox",
      roleId: warehouseManagerRole.id,
      position: "Warehouse Manager"
    }
  ];

  // Clean up the old fictional IS seed users that are no longer in the roster.
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          "admin@initialservices.net",
          "s.mitchell@initialservices.net",
          "j.okafor@initialservices.net",
          "p.sharma@initialservices.net",
          "t.brennan@initialservices.net",
          "d.kowalski@initialservices.net",
          "l.tran@initialservices.net",
          "m.reader@initialservices.net"
        ]
      },
      id: { notIn: userSeeds.map((u) => u.id) }
    }
  });

  for (const seed of userSeeds) {
    const user = await prisma.user.upsert({
      where: { id: seed.id },
      update: {
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        isActive: true,
        isSuperUser: seed.isSuperUser ?? false
      },
      create: {
        id: seed.id,
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        isActive: true,
        isSuperUser: seed.isSuperUser ?? false,
        passwordHash: hashPassword("Password123!")
      }
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: seed.roleId } });
  }

  // WorkerProfile records for office staff who appear on client-facing
  // documents (PDF contact line reads estimator.workerProfile.phone). Only
  // seeded for users where a phone is known — everyone else stays null.
  // Marco's number is the real one from the quote template T1965;
  // placeholders flagged clearly in code comments.
  type OfficeWorkerProfileSeed = {
    id: string;
    internalUserId: string;
    firstName: string;
    lastName: string;
    role: string;
    email: string;
    phone: string;
  };
  const officeWorkerProfiles: OfficeWorkerProfileSeed[] = [
    {
      id: "wp-user-admin",
      internalUserId: "user-admin",
      firstName: "Sean",
      lastName: "Lattin",
      role: "Company Director",
      email: "sean@initialservices.net",
      phone: "0400 850 723"
    },
    {
      id: "wp-user-pm-002",
      internalUserId: "user-pm-002",
      firstName: "Colin",
      lastName: "Hanlon",
      role: "Operations Manager",
      email: "colin@initialservices.net",
      phone: "0447 803 617"
    },
    {
      id: "wp-user-pm-001",
      internalUserId: "user-pm-001",
      firstName: "Beau",
      lastName: "Murphy",
      role: "Project Manager",
      email: "beau.m@initialservices.net",
      phone: "0400 083 565"
    },
    {
      id: "wp-user-supervisor-001",
      internalUserId: "user-supervisor-001",
      firstName: "Marco",
      lastName: "Mantovaninni",
      role: "WHS & Commercial Compliance",
      email: "marco@initialservices.net",
      phone: "0487 373 415"
    },
    {
      id: "wp-user-estimator",
      internalUserId: "user-estimator",
      firstName: "Raj",
      lastName: "Pudasaini",
      role: "Senior Estimator",
      email: "estimating@initialservices.net",
      phone: "0421 140 248"
    },
    {
      id: "wp-user-supervisor-002",
      internalUserId: "user-supervisor-002",
      firstName: "Amy",
      lastName: "Russian",
      role: "Accounts Payable/Receivable",
      email: "admin@initialservices.net",
      phone: "(07) 3888 0539"
    },
    {
      id: "wp-user-scheduler",
      internalUserId: "user-scheduler",
      firstName: "Matthew",
      lastName: "Knox",
      role: "Warehouse Manager",
      email: "warehouse@initialservices.net",
      phone: "0407 923 006"
    }
  ];

  for (const seed of officeWorkerProfiles) {
    await prisma.workerProfile.upsert({
      where: { id: seed.id },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.role,
        email: seed.email,
        phone: seed.phone,
        internalUserId: seed.internalUserId,
        isActive: true
      },
      create: {
        id: seed.id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.role,
        email: seed.email,
        phone: seed.phone,
        internalUserId: seed.internalUserId,
        isActive: true
      }
    });
  }

  type ClientSeed = {
    id: string;
    name: string;
    code: string;
    abn: string;
    type: string;
    industry: string;
    domain: string;
  };
  const clientSeeds: ClientSeed[] = [
    {
      id: "client-001",
      name: "Queensland Transport Infrastructure",
      code: "QTI",
      abn: "12 345 678 901",
      type: "Government",
      industry: "Transport",
      domain: "qti.qld.gov.au"
    },
    {
      id: "client-002",
      name: "Suncoast Property Group",
      code: "SPG",
      abn: "98 765 432 109",
      type: "Private",
      industry: "Property Development",
      domain: "suncoastproperty.com.au"
    },
    {
      id: "client-003",
      name: "Brisbane City Council",
      code: "BCC",
      abn: "34 567 890 123",
      type: "Government",
      industry: "Local Government",
      domain: "brisbane.qld.gov.au"
    },
    {
      id: "client-004",
      name: "Pacific Industrial Holdings",
      code: "PIH",
      abn: "56 789 012 345",
      type: "Private",
      industry: "Industrial",
      domain: "pacificindustrial.com.au"
    },
    {
      id: "client-005",
      name: "Gold Coast Waterways Authority",
      code: "GCWA",
      abn: "78 901 234 567",
      type: "Government",
      industry: "Marine/Waterways",
      domain: "gcwa.qld.gov.au"
    }
  ];

  for (const seed of clientSeeds) {
    await prisma.client.upsert({
      where: { id: seed.id },
      update: {
        name: seed.name,
        code: seed.code,
        status: "ACTIVE",
        email: `contact@${seed.domain}`,
        notes: `ABN ${seed.abn} · ${seed.type} · ${seed.industry}`
      },
      create: {
        id: seed.id,
        name: seed.name,
        code: seed.code,
        status: "ACTIVE",
        email: `contact@${seed.domain}`,
        notes: `ABN ${seed.abn} · ${seed.type} · ${seed.industry}`
      }
    });
  }

  type ContactSeed = {
    id: string;
    clientId: string;
    firstName: string;
    lastName: string;
    phone: string;
    domain: string;
    position: string;
    isPrimary: boolean;
  };
  const contactSeeds: ContactSeed[] = [
    { id: "contact-001-primary", clientId: "client-001", firstName: "Robert", lastName: "Ashby", phone: "0411 222 333", domain: "qti.qld.gov.au", position: "Project Director", isPrimary: true },
    { id: "contact-001-secondary", clientId: "client-001", firstName: "Amelia", lastName: "Hughes", phone: "0422 333 444", domain: "qti.qld.gov.au", position: "Contract Administrator", isPrimary: false },
    { id: "contact-002-primary", clientId: "client-002", firstName: "Cameron", lastName: "Whitfield", phone: "0433 444 555", domain: "suncoastproperty.com.au", position: "Development Manager", isPrimary: true },
    { id: "contact-002-secondary", clientId: "client-002", firstName: "Georgia", lastName: "Pembroke", phone: "0444 555 666", domain: "suncoastproperty.com.au", position: "Construction Coordinator", isPrimary: false },
    { id: "contact-003-primary", clientId: "client-003", firstName: "Daniel", lastName: "Reilly", phone: "0455 666 777", domain: "brisbane.qld.gov.au", position: "Infrastructure Delivery Manager", isPrimary: true },
    { id: "contact-003-secondary", clientId: "client-003", firstName: "Sienna", lastName: "Howard", phone: "0466 777 888", domain: "brisbane.qld.gov.au", position: "Senior Engineer", isPrimary: false },
    { id: "contact-004-primary", clientId: "client-004", firstName: "Oliver", lastName: "Montague", phone: "0477 888 999", domain: "pacificindustrial.com.au", position: "Operations Director", isPrimary: true },
    { id: "contact-004-secondary", clientId: "client-004", firstName: "Isabella", lastName: "Chamberlain", phone: "0488 999 000", domain: "pacificindustrial.com.au", position: "Procurement Lead", isPrimary: false },
    { id: "contact-005-primary", clientId: "client-005", firstName: "Henry", lastName: "Aldridge", phone: "0499 000 111", domain: "gcwa.qld.gov.au", position: "Waterways Program Manager", isPrimary: true },
    { id: "contact-005-secondary", clientId: "client-005", firstName: "Ruby", lastName: "Fitzgerald", phone: "0410 111 222", domain: "gcwa.qld.gov.au", position: "Environmental Officer", isPrimary: false }
  ];

  for (const seed of contactSeeds) {
    const email = `${seed.firstName.toLowerCase()}.${seed.lastName.toLowerCase()}@${seed.domain}`;
    await prisma.contact.upsert({
      where: { id: seed.id },
      update: {
        organisationType: "CLIENT",
        organisationId: seed.clientId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email,
        phone: seed.phone,
        role: seed.position,
        isPrimary: seed.isPrimary
      },
      create: {
        id: seed.id,
        organisationType: "CLIENT",
        organisationId: seed.clientId,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email,
        phone: seed.phone,
        role: seed.position,
        isPrimary: seed.isPrimary
      }
    });
  }

  type SiteSeed = {
    id: string;
    name: string;
    code: string;
    addressLine1: string;
    suburb: string;
    postcode: string;
    clientId: string;
    siteType: string;
  };
  const siteSeeds: SiteSeed[] = [
    { id: "site-001", name: "Ipswich Motorway Corridor — Stage 4", code: "IS-S001", addressLine1: "Ipswich Motorway", suburb: "Darra", postcode: "4076", clientId: "client-001", siteType: "Road" },
    { id: "site-002", name: "Maroochydore Mixed-Use Precinct", code: "IS-S002", addressLine1: "Ocean Street", suburb: "Maroochydore", postcode: "4558", clientId: "client-002", siteType: "Commercial" },
    { id: "site-003", name: "Sandgate Stormwater Upgrade", code: "IS-S003", addressLine1: "Brighton Road", suburb: "Sandgate", postcode: "4017", clientId: "client-003", siteType: "Drainage" },
    { id: "site-004", name: "Eagle Farm Industrial Estate", code: "IS-S004", addressLine1: "Tingal Road", suburb: "Eagle Farm", postcode: "4009", clientId: "client-004", siteType: "Industrial" },
    { id: "site-005", name: "Coomera River Revetment Works", code: "IS-S005", addressLine1: "Foxwell Road", suburb: "Coomera", postcode: "4209", clientId: "client-005", siteType: "Marine" },
    { id: "site-006", name: "Capalaba Retail Centre Carpark", code: "IS-S006", addressLine1: "Old Cleveland Road", suburb: "Capalaba", postcode: "4157", clientId: "client-002", siteType: "Civil" },
    { id: "site-007", name: "Toowoomba Range Service Road", code: "IS-S007", addressLine1: "New England Highway", suburb: "Toowoomba", postcode: "4350", clientId: "client-001", siteType: "Road" }
  ];

  for (const seed of siteSeeds) {
    await prisma.site.upsert({
      where: { id: seed.id },
      update: {
        name: seed.name,
        code: seed.code,
        addressLine1: seed.addressLine1,
        suburb: seed.suburb,
        state: "QLD",
        postcode: seed.postcode,
        clientId: seed.clientId,
        notes: `${seed.siteType} site`
      },
      create: {
        id: seed.id,
        name: seed.name,
        code: seed.code,
        addressLine1: seed.addressLine1,
        suburb: seed.suburb,
        state: "QLD",
        postcode: seed.postcode,
        clientId: seed.clientId,
        notes: `${seed.siteType} site`
      }
    });
  }

  type ResourceTypeSeed = { id: string; name: string; code: string; category: string };
  const resourceTypeSeeds: ResourceTypeSeed[] = [
    { id: "rtype-civil-labour", name: "Civil Labour", code: "CIVIL", category: "LABOUR" },
    { id: "rtype-plant-operator", name: "Plant Operator", code: "PLANT-OP", category: "LABOUR" },
    { id: "rtype-traffic-controller", name: "Traffic Controller", code: "TRAFFIC", category: "LABOUR" },
    { id: "rtype-concretor", name: "Concretor", code: "CONCRETE", category: "LABOUR" },
    { id: "rtype-formworker", name: "Formworker", code: "FORMWORK", category: "LABOUR" },
    { id: "rtype-drainage-specialist", name: "Drainage Specialist", code: "DRAINAGE", category: "LABOUR" },
    { id: "rtype-supervisor", name: "Supervisor", code: "SUPER", category: "LABOUR" }
  ];

  for (const seed of resourceTypeSeeds) {
    await prisma.resourceType.upsert({
      where: { id: seed.id },
      update: { name: seed.name, code: seed.code, category: seed.category },
      create: { id: seed.id, name: seed.name, code: seed.code, category: seed.category }
    });
  }

  type CompetencySeed = { label: string; name: string; code: string; category: string };
  const competencySeeds: CompetencySeed[] = [
    { label: "comp-001", name: "Construction Induction (White Card)", code: "COMP-001", category: "Safety" },
    { label: "comp-002", name: "Working at Heights", code: "COMP-002", category: "Safety" },
    { label: "comp-003", name: "Confined Space Entry", code: "COMP-003", category: "Safety" },
    { label: "comp-004", name: "Traffic Control (TCP)", code: "COMP-004", category: "Licence" },
    { label: "comp-005", name: "Excavator (HR) Licence", code: "COMP-005", category: "Licence" },
    { label: "comp-006", name: "Crane Operator Licence", code: "COMP-006", category: "Licence" },
    { label: "comp-007", name: "Dangerous Goods Handling", code: "COMP-007", category: "Safety" },
    { label: "comp-008", name: "First Aid Certificate", code: "COMP-008", category: "Safety" },
    { label: "comp-009", name: "Asphalt Lay & Compact", code: "COMP-009", category: "Technical" },
    { label: "comp-010", name: "Formwork & Falsework", code: "COMP-010", category: "Technical" },
    { label: "comp-011", name: "Pipe Laying & Bedding", code: "COMP-011", category: "Technical" },
    { label: "comp-012", name: "Concrete Placement", code: "COMP-012", category: "Technical" }
  ];

  const competencyIdByLabel = new Map<string, string>();
  for (const seed of competencySeeds) {
    const record = await prisma.competency.upsert({
      where: { name: seed.name },
      update: { code: seed.code, description: seed.category },
      create: { name: seed.name, code: seed.code, description: seed.category }
    });
    competencyIdByLabel.set(seed.label, record.id);
  }

  type WorkerSeed = {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    resourceTypeId: string;
    competencies: string[];
    status: "ACTIVE" | "ON_LEAVE";
    statusNotes: string | null;
    phone: string;
  };
  const workerSeeds: WorkerSeed[] = [
    { id: "worker-001", firstName: "Ryan", lastName: "O'Brien", role: "Civil Labour", resourceTypeId: "rtype-civil-labour", competencies: ["comp-001", "comp-002", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0412 345 678" },
    { id: "worker-002", firstName: "Jasmine", lastName: "Nguyen", role: "Plant Operator", resourceTypeId: "rtype-plant-operator", competencies: ["comp-001", "comp-005", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0423 456 789" },
    { id: "worker-003", firstName: "Marcus", lastName: "Webb", role: "Traffic Controller", resourceTypeId: "rtype-traffic-controller", competencies: ["comp-001", "comp-004", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0434 567 890" },
    { id: "worker-004", firstName: "Chloe", lastName: "Anderson", role: "Concretor", resourceTypeId: "rtype-concretor", competencies: ["comp-001", "comp-012", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0445 678 901" },
    { id: "worker-005", firstName: "Billy", lastName: "Tran", role: "Formworker", resourceTypeId: "rtype-formworker", competencies: ["comp-001", "comp-010", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0456 789 012" },
    { id: "worker-006", firstName: "Natasha", lastName: "Papadopoulos", role: "Drainage Specialist", resourceTypeId: "rtype-drainage-specialist", competencies: ["comp-001", "comp-011", "comp-003"], status: "ACTIVE", statusNotes: null, phone: "0467 890 123" },
    { id: "worker-007", firstName: "Ethan", lastName: "MacGregor", role: "Plant Operator", resourceTypeId: "rtype-plant-operator", competencies: ["comp-001", "comp-005", "comp-006"], status: "ON_LEAVE", statusNotes: "Annual leave — return in 2 weeks", phone: "0478 901 234" },
    { id: "worker-008", firstName: "Amara", lastName: "Diallo", role: "Civil Labour", resourceTypeId: "rtype-civil-labour", competencies: ["comp-001", "comp-002", "comp-007"], status: "ACTIVE", statusNotes: null, phone: "0489 012 345" },
    { id: "worker-009", firstName: "Jack", lastName: "Sorensen", role: "Supervisor", resourceTypeId: "rtype-supervisor", competencies: ["comp-001", "comp-002", "comp-008", "comp-004"], status: "ACTIVE", statusNotes: null, phone: "0491 123 456" },
    { id: "worker-010", firstName: "Mei-Lin", lastName: "Chen", role: "Concretor", resourceTypeId: "rtype-concretor", competencies: ["comp-001", "comp-012", "comp-010"], status: "ACTIVE", statusNotes: null, phone: "0412 234 567" },
    { id: "worker-011", firstName: "Hassan", lastName: "Al-Farsi", role: "Civil Labour", resourceTypeId: "rtype-civil-labour", competencies: ["comp-001", "comp-011"], status: "ACTIVE", statusNotes: null, phone: "0423 345 678" },
    { id: "worker-012", firstName: "Brooke", lastName: "Sullivan", role: "Traffic Controller", resourceTypeId: "rtype-traffic-controller", competencies: ["comp-001", "comp-004"], status: "ACTIVE", statusNotes: null, phone: "0434 456 789" },
    { id: "worker-013", firstName: "Daniel", lastName: "Ferreira", role: "Plant Operator", resourceTypeId: "rtype-plant-operator", competencies: ["comp-001", "comp-005", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0445 567 890" },
    { id: "worker-014", firstName: "Kylie", lastName: "Drummond", role: "Civil Labour", resourceTypeId: "rtype-civil-labour", competencies: ["comp-001", "comp-009"], status: "ACTIVE", statusNotes: null, phone: "0456 678 901" },
    { id: "worker-015", firstName: "Raj", lastName: "Krishnamurthy", role: "Drainage Specialist", resourceTypeId: "rtype-drainage-specialist", competencies: ["comp-001", "comp-011", "comp-003", "comp-008"], status: "ACTIVE", statusNotes: null, phone: "0467 789 012" },
    { id: "worker-016", firstName: "Tyler", lastName: "Bowen", role: "Formworker", resourceTypeId: "rtype-formworker", competencies: ["comp-001", "comp-010", "comp-002"], status: "ACTIVE", statusNotes: null, phone: "0478 890 123" }
  ];

  for (const seed of workerSeeds) {
    const employeeCode = `IS-${seed.id.replace("worker-", "W")}`;
    const email = `${seed.firstName.toLowerCase().replace(/['-]/g, "")}.${seed.lastName.toLowerCase().replace(/['-]/g, "")}@initialservices.net`;
    await prisma.worker.upsert({
      where: { id: seed.id },
      update: {
        employeeCode,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email,
        phone: seed.phone,
        resourceTypeId: seed.resourceTypeId,
        employmentType: "FULL_TIME",
        status: seed.status,
        notes: seed.statusNotes
      },
      create: {
        id: seed.id,
        employeeCode,
        firstName: seed.firstName,
        lastName: seed.lastName,
        email,
        phone: seed.phone,
        resourceTypeId: seed.resourceTypeId,
        employmentType: "FULL_TIME",
        status: seed.status,
        notes: seed.statusNotes
      }
    });

    await prisma.workerCompetency.deleteMany({ where: { workerId: seed.id } });
    for (const compLabel of seed.competencies) {
      const competencyId = competencyIdByLabel.get(compLabel);
      if (!competencyId) continue;
      await prisma.workerCompetency.create({
        data: {
          workerId: seed.id,
          competencyId,
          achievedAt: daysAgo(365)
        }
      });
    }
  }

  type CrewSeed = {
    id: string;
    name: string;
    code: string;
    supervisorWorkerId: string;
    memberWorkerIds: string[];
  };
  const crewSeeds: CrewSeed[] = [
    { id: "crew-001", name: "Crew Alpha", code: "IS-CREW-A", supervisorWorkerId: "worker-009", memberWorkerIds: ["worker-001", "worker-002", "worker-003", "worker-004"] },
    { id: "crew-002", name: "Crew Beta", code: "IS-CREW-B", supervisorWorkerId: "worker-009", memberWorkerIds: ["worker-005", "worker-006", "worker-008", "worker-010"] },
    { id: "crew-003", name: "Drainage Team", code: "IS-CREW-DRAIN", supervisorWorkerId: "worker-015", memberWorkerIds: ["worker-006", "worker-011"] },
    { id: "crew-004", name: "Plant & Traffic", code: "IS-CREW-PT", supervisorWorkerId: "worker-003", memberWorkerIds: ["worker-002", "worker-007", "worker-013"] }
  ];

  for (const seed of crewSeeds) {
    await prisma.crew.upsert({
      where: { id: seed.id },
      update: { name: seed.name, code: seed.code, status: "ACTIVE" },
      create: { id: seed.id, name: seed.name, code: seed.code, status: "ACTIVE" }
    });
    await prisma.crewWorker.deleteMany({ where: { crewId: seed.id } });
    await prisma.crewWorker.create({
      data: { crewId: seed.id, workerId: seed.supervisorWorkerId, roleLabel: "Supervisor" }
    });
    for (const memberId of seed.memberWorkerIds) {
      if (memberId === seed.supervisorWorkerId) continue;
      await prisma.crewWorker.create({
        data: { crewId: seed.id, workerId: memberId, roleLabel: "Member" }
      });
    }
  }

  type CategorySeed = { id: string; name: string; code: string };
  const categorySeeds: CategorySeed[] = [
    { id: "cat-excavators", name: "Excavators", code: "EXC" },
    { id: "cat-compactors", name: "Compactors", code: "COMP" },
    { id: "cat-concrete-equipment", name: "Concrete Equipment", code: "CONC" },
    { id: "cat-traffic-management", name: "Traffic Management", code: "TM" },
    { id: "cat-light-vehicles", name: "Light Vehicles", code: "LV" },
    { id: "cat-trailers", name: "Trailers", code: "TRL" },
    { id: "cat-pumps-drainage", name: "Pumps & Drainage", code: "PUMP" }
  ];

  for (const seed of categorySeeds) {
    await prisma.assetCategory.upsert({
      where: { id: seed.id },
      update: { name: seed.name, code: seed.code, isActive: true },
      create: { id: seed.id, name: seed.name, code: seed.code, isActive: true }
    });
  }

  type AssetSeed = {
    id: string;
    name: string;
    categoryId: string;
    status: string;
    assetCode: string;
    serialNumber: string | null;
    homeBase: string;
  };
  const assetSeeds: AssetSeed[] = [
    { id: "asset-001", name: "CAT 320 Excavator", categoryId: "cat-excavators", status: "AVAILABLE", assetCode: "IS-A001", serialNumber: "CAT-320-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-002", name: "Komatsu PC210 Excavator", categoryId: "cat-excavators", status: "AVAILABLE", assetCode: "IS-A002", serialNumber: "KOM-PC210-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-003", name: "Dynapac CA2500 Roller", categoryId: "cat-compactors", status: "AVAILABLE", assetCode: "IS-A003", serialNumber: "DYN-CA25-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-004", name: "Wacker Neuson Plate Compactor", categoryId: "cat-compactors", status: "AVAILABLE", assetCode: "IS-A004", serialNumber: "WN-PLATE-001", homeBase: "Sandgate Depot" },
    { id: "asset-005", name: "Concrete Pump — Schwing SP305", categoryId: "cat-concrete-equipment", status: "AVAILABLE", assetCode: "IS-A005", serialNumber: "SCH-SP305-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-006", name: "Concrete Mixer — 9m³", categoryId: "cat-concrete-equipment", status: "AVAILABLE", assetCode: "IS-A006", serialNumber: "MIX-9M3-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-007", name: "Arrow Board Trailer — LED", categoryId: "cat-traffic-management", status: "AVAILABLE", assetCode: "IS-A007", serialNumber: "TM-ARROW-001", homeBase: "Sandgate Depot" },
    { id: "asset-008", name: "Variable Message Sign (VMS)", categoryId: "cat-traffic-management", status: "AVAILABLE", assetCode: "IS-A008", serialNumber: "TM-VMS-001", homeBase: "Sandgate Depot" },
    { id: "asset-009", name: "Toyota HiLux ute — MCV 123", categoryId: "cat-light-vehicles", status: "AVAILABLE", assetCode: "IS-A009", serialNumber: "MCV123", homeBase: "Eagle Farm Depot" },
    { id: "asset-010", name: "Ford Ranger ute — NVG 456", categoryId: "cat-light-vehicles", status: "AVAILABLE", assetCode: "IS-A010", serialNumber: "NVG456", homeBase: "Sandgate Depot" },
    { id: "asset-011", name: "Tag Trailer — 3 axle", categoryId: "cat-trailers", status: "AVAILABLE", assetCode: "IS-A011", serialNumber: "TAG-3AX-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-012", name: "Hydraulic Submersible Pump", categoryId: "cat-pumps-drainage", status: "AVAILABLE", assetCode: "IS-A012", serialNumber: "HSP-001", homeBase: "Sandgate Depot" },
    { id: "asset-013", name: "CAT 308 Mini Excavator", categoryId: "cat-excavators", status: "MAINTENANCE", assetCode: "IS-A013", serialNumber: "CAT-308-001", homeBase: "Eagle Farm Depot" },
    { id: "asset-014", name: "Brokk 170 Demolition Robot", categoryId: "cat-excavators", status: "AVAILABLE", assetCode: "IS-A014", serialNumber: "BRK-170-001", homeBase: "Eagle Farm Depot" }
  ];

  for (const seed of assetSeeds) {
    await prisma.asset.upsert({
      where: { id: seed.id },
      update: {
        name: seed.name,
        assetCode: seed.assetCode,
        serialNumber: seed.serialNumber,
        assetCategoryId: seed.categoryId,
        status: seed.status,
        homeBase: seed.homeBase,
        currentLocation: seed.homeBase
      },
      create: {
        id: seed.id,
        name: seed.name,
        assetCode: seed.assetCode,
        serialNumber: seed.serialNumber,
        assetCategoryId: seed.categoryId,
        status: seed.status,
        homeBase: seed.homeBase,
        currentLocation: seed.homeBase
      }
    });
  }

  type MaintenanceAssetSeed = {
    assetId: string;
    assetName: string;
    lastServiceDaysAgo: number;
    nextServiceDaysFromNow: number;
    nextServiceStatus: "SCHEDULED" | "OVERDUE" | "COMPLETED";
    nextServiceScheduledAt: Date;
    hasBreakdown?: boolean;
  };
  const maintenanceSeeds: MaintenanceAssetSeed[] = [
    {
      assetId: "asset-001",
      assetName: "CAT 320 Excavator",
      lastServiceDaysAgo: 45,
      nextServiceDaysFromNow: 15,
      nextServiceStatus: "SCHEDULED",
      nextServiceScheduledAt: daysFromNow(15)
    },
    {
      assetId: "asset-002",
      assetName: "Komatsu PC210 Excavator",
      lastServiceDaysAgo: 20,
      nextServiceDaysFromNow: 30,
      nextServiceStatus: "SCHEDULED",
      nextServiceScheduledAt: daysFromNow(30)
    },
    {
      assetId: "asset-003",
      assetName: "Dynapac CA2500 Roller",
      lastServiceDaysAgo: 60,
      nextServiceDaysFromNow: -5,
      nextServiceStatus: "OVERDUE",
      nextServiceScheduledAt: daysAgo(5)
    },
    {
      assetId: "asset-005",
      assetName: "Concrete Pump — Schwing SP305",
      lastServiceDaysAgo: 10,
      nextServiceDaysFromNow: 240,
      nextServiceStatus: "SCHEDULED",
      nextServiceScheduledAt: daysFromNow(240)
    },
    {
      assetId: "asset-013",
      assetName: "CAT 308 Mini Excavator",
      lastServiceDaysAgo: 120,
      nextServiceDaysFromNow: -7,
      nextServiceStatus: "OVERDUE",
      nextServiceScheduledAt: daysAgo(7),
      hasBreakdown: true
    }
  ];

  for (const seed of maintenanceSeeds) {
    const planId = `mtplan-${seed.assetId}`;
    await prisma.assetMaintenancePlan.upsert({
      where: { id: planId },
      update: {
        assetId: seed.assetId,
        title: `${seed.assetName} — 250hr Service`,
        description: "Scheduled 250-hour service per OEM schedule",
        intervalDays: 90,
        warningDays: 14,
        blockWhenOverdue: true,
        lastCompletedAt: daysAgo(seed.lastServiceDaysAgo),
        nextDueAt: seed.nextServiceScheduledAt,
        status: "ACTIVE"
      },
      create: {
        id: planId,
        assetId: seed.assetId,
        title: `${seed.assetName} — 250hr Service`,
        description: "Scheduled 250-hour service per OEM schedule",
        intervalDays: 90,
        warningDays: 14,
        blockWhenOverdue: true,
        lastCompletedAt: daysAgo(seed.lastServiceDaysAgo),
        nextDueAt: seed.nextServiceScheduledAt,
        status: "ACTIVE"
      }
    });

    const lastEventId = `mtevent-${seed.assetId}-last`;
    await prisma.assetMaintenanceEvent.upsert({
      where: { id: lastEventId },
      update: {
        assetId: seed.assetId,
        maintenancePlanId: planId,
        eventType: "SERVICE",
        scheduledAt: daysAgo(seed.lastServiceDaysAgo),
        completedAt: daysAgo(seed.lastServiceDaysAgo),
        status: "COMPLETED",
        notes: "Last completed service record"
      },
      create: {
        id: lastEventId,
        assetId: seed.assetId,
        maintenancePlanId: planId,
        eventType: "SERVICE",
        scheduledAt: daysAgo(seed.lastServiceDaysAgo),
        completedAt: daysAgo(seed.lastServiceDaysAgo),
        status: "COMPLETED",
        notes: "Last completed service record"
      }
    });

    const nextEventId = `mtevent-${seed.assetId}-next`;
    await prisma.assetMaintenanceEvent.upsert({
      where: { id: nextEventId },
      update: {
        assetId: seed.assetId,
        maintenancePlanId: planId,
        eventType: "SERVICE",
        scheduledAt: seed.nextServiceScheduledAt,
        completedAt: null,
        status: seed.nextServiceStatus,
        notes: seed.nextServiceStatus === "OVERDUE" ? "Next service overdue" : "Next scheduled service"
      },
      create: {
        id: nextEventId,
        assetId: seed.assetId,
        maintenancePlanId: planId,
        eventType: "SERVICE",
        scheduledAt: seed.nextServiceScheduledAt,
        completedAt: null,
        status: seed.nextServiceStatus,
        notes: seed.nextServiceStatus === "OVERDUE" ? "Next service overdue" : "Next scheduled service"
      }
    });

    const inspectionId = `inspection-${seed.assetId}`;
    await prisma.assetInspection.upsert({
      where: { id: inspectionId },
      update: {
        assetId: seed.assetId,
        inspectionType: "ROUTINE",
        inspectedAt: daysAgo(30),
        status: "PASS",
        notes: `Next inspection due ${daysFromNow(60).toISOString().slice(0, 10)}`
      },
      create: {
        id: inspectionId,
        assetId: seed.assetId,
        inspectionType: "ROUTINE",
        inspectedAt: daysAgo(30),
        status: "PASS",
        notes: `Next inspection due ${daysFromNow(60).toISOString().slice(0, 10)}`
      }
    });

    if (seed.hasBreakdown) {
      const breakdownId = `breakdown-${seed.assetId}`;
      await prisma.assetBreakdown.upsert({
        where: { id: breakdownId },
        update: {
          assetId: seed.assetId,
          reportedAt: daysAgo(7),
          severity: "HIGH",
          status: "UNDER_REPAIR",
          summary: "Hydraulic failure — under repair in workshop",
          notes: "Awaiting replacement hydraulic line. Asset out of service."
        },
        create: {
          id: breakdownId,
          assetId: seed.assetId,
          reportedAt: daysAgo(7),
          severity: "HIGH",
          status: "UNDER_REPAIR",
          summary: "Hydraulic failure — under repair in workshop",
          notes: "Awaiting replacement hydraulic line. Asset out of service."
        }
      });
    }
  }

  const estimatorUserId = "user-estimator";
  const pm001Id = "user-pm-001";
  const pm002Id = "user-pm-002";
  const supervisor001Id = "user-supervisor-001";

  type TenderSeed = {
    id: string;
    tenderNumber: string;
    title: string;
    description: string | null;
    status: string;
    clientId: string;
    contactId: string | null;
    siteId: string | null;
    estimatedValue: string;
    submittedDaysAgo: number | null;
    awardedDaysAgo: number | null;
    probability: number;
    note: string | null;
    clarification: { subject: string; response: string | null; status: "OPEN" | "ANSWERED" } | null;
    pricing: { labour: string; plant: string; materials: string; subcontract: string; margin: string } | null;
    followUp: { details: string; dueInDays: number; status: "OPEN" } | null;
    outcome: { outcomeType: string; notes: string } | null;
    isAwarded: boolean;
    contractIssued: boolean;
  };

  const tenderSeeds: TenderSeed[] = [
    {
      id: "tender-001",
      tenderNumber: "IS-T001",
      title: "Ipswich Motorway Stage 4 — Earthworks Package",
      description: "Bulk earthworks, cut and fill, embankment formation and drainage for the Stage 4 corridor extension between Darra and Wacol.",
      status: "AWARDED",
      clientId: "client-001",
      contactId: "contact-001-primary",
      siteId: "site-001",
      estimatedValue: "4250000.00",
      submittedDaysAgo: 75,
      awardedDaysAgo: 30,
      probability: 100,
      note: "Client requested early mobilisation by end of month. Site access confirmed.",
      clarification: {
        subject: "Is the rock classification included in the geotechnical report?",
        response: "Yes, confirmed Class C material throughout.",
        status: "ANSWERED"
      },
      pricing: { labour: "1800000.00", plant: "950000.00", materials: "1100000.00", subcontract: "200000.00", margin: "200000.00" },
      followUp: { details: "Send updated programme to client by Friday.", dueInDays: 3, status: "OPEN" },
      outcome: { outcomeType: "AWARDED", notes: "Awarded — converted to job-001." },
      isAwarded: true,
      contractIssued: true
    },
    {
      id: "tender-002",
      tenderNumber: "IS-T002",
      title: "Maroochydore Precinct — Civil Works",
      description: "Carpark formation, kerb and channel, stormwater infrastructure, and pavement works for the mixed-use precinct.",
      status: "SUBMITTED",
      clientId: "client-002",
      contactId: "contact-002-primary",
      siteId: "site-002",
      estimatedValue: "2750000.00",
      submittedDaysAgo: 14,
      awardedDaysAgo: null,
      probability: 60,
      note: null,
      clarification: null,
      pricing: null,
      followUp: { details: "Follow up with client on tender evaluation timeline — due response next week.", dueInDays: 7, status: "OPEN" },
      outcome: { outcomeType: "UNDER_REVIEW", notes: "Awaiting client evaluation outcome." },
      isAwarded: false,
      contractIssued: false
    },
    {
      id: "tender-003",
      tenderNumber: "IS-T003",
      title: "Sandgate Stormwater Upgrade — Stage 1",
      description: "Replacement of 450mm RCP drainage lines, headwall construction, and tie-in works along Brighton Road corridor.",
      status: "AWARDED",
      clientId: "client-003",
      contactId: "contact-003-primary",
      siteId: "site-003",
      estimatedValue: "1100000.00",
      submittedDaysAgo: 90,
      awardedDaysAgo: 60,
      probability: 100,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: { outcomeType: "AWARDED", notes: "Awarded — converted to job-002." },
      isAwarded: true,
      contractIssued: true
    },
    {
      id: "tender-004",
      tenderNumber: "IS-T004",
      title: "Eagle Farm Industrial — Hardstand Expansion",
      description: "12,000m² hardstand expansion including subgrade preparation, base course, and asphalt surfacing.",
      status: "IN_PROGRESS",
      clientId: "client-004",
      contactId: "contact-004-primary",
      siteId: "site-004",
      estimatedValue: "890000.00",
      submittedDaysAgo: null,
      awardedDaysAgo: null,
      probability: 45,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: null,
      isAwarded: false,
      contractIssued: false
    },
    {
      id: "tender-005",
      tenderNumber: "IS-T005",
      title: "Coomera River Revetment — Emergency Works",
      description: "Emergency bank stabilisation and rock revetment works following flood damage to 300m of river bank.",
      status: "DRAFT",
      clientId: "client-005",
      contactId: "contact-005-primary",
      siteId: "site-005",
      estimatedValue: "650000.00",
      submittedDaysAgo: null,
      awardedDaysAgo: null,
      probability: 30,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: null,
      isAwarded: false,
      contractIssued: false
    },
    {
      id: "tender-006",
      tenderNumber: "IS-T006",
      title: "Capalaba Retail Carpark Reconstruction",
      description: "Carpark reconstruction including pavement removal, new base course, and linemarking.",
      status: "LOST",
      clientId: "client-002",
      contactId: "contact-002-primary",
      siteId: "site-006",
      estimatedValue: "720000.00",
      submittedDaysAgo: 45,
      awardedDaysAgo: null,
      probability: 0,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: { outcomeType: "LOST", notes: "Lost to lower-priced competitor. Review subcontract rates for future bids." },
      isAwarded: false,
      contractIssued: false
    },
    {
      id: "tender-007",
      tenderNumber: "IS-T007",
      title: "Toowoomba Range — Service Road Stabilisation",
      description: "Subgrade stabilisation, pavement rehabilitation, and line marking for 4.2km of service road.",
      status: "IN_PROGRESS",
      clientId: "client-001",
      contactId: "contact-001-primary",
      siteId: "site-007",
      estimatedValue: "1850000.00",
      submittedDaysAgo: null,
      awardedDaysAgo: null,
      probability: 55,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: null,
      isAwarded: false,
      contractIssued: false
    },
    {
      id: "tender-008",
      tenderNumber: "IS-T008",
      title: "Brisbane City Council — Lane Cove Kerb Renewal",
      description: "Kerb and channel renewal along Lane Cove precinct streets.",
      status: "WITHDRAWN",
      clientId: "client-003",
      contactId: "contact-003-primary",
      siteId: null,
      estimatedValue: "340000.00",
      submittedDaysAgo: null,
      awardedDaysAgo: null,
      probability: 0,
      note: null,
      clarification: null,
      pricing: null,
      followUp: null,
      outcome: { outcomeType: "WITHDRAWN", notes: "Withdrawn — resource constraints during the tender period. Resubmit next financial year." },
      isAwarded: false,
      contractIssued: false
    }
  ];

  for (const seed of tenderSeeds) {
    const dueDate = seed.submittedDaysAgo !== null ? daysAgo(seed.submittedDaysAgo) : daysFromNow(21);
    const proposedStartDate = seed.awardedDaysAgo !== null
      ? daysAgo(Math.max(seed.awardedDaysAgo - 14, 0))
      : daysFromNow(45);

    await prisma.tender.upsert({
      where: { id: seed.id },
      update: {
        tenderNumber: seed.tenderNumber,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        estimatorUserId,
        dueDate,
        proposedStartDate,
        leadTimeDays: 21,
        probability: seed.probability,
        estimatedValue: new Prisma.Decimal(seed.estimatedValue),
        notes: seed.note
      },
      create: {
        id: seed.id,
        tenderNumber: seed.tenderNumber,
        title: seed.title,
        description: seed.description,
        status: seed.status,
        estimatorUserId,
        dueDate,
        proposedStartDate,
        leadTimeDays: 21,
        probability: seed.probability,
        estimatedValue: new Prisma.Decimal(seed.estimatedValue),
        notes: seed.note
      }
    });

    await prisma.tenderClient.deleteMany({ where: { tenderId: seed.id } });
    await prisma.tenderClient.create({
      data: {
        tenderId: seed.id,
        clientId: seed.clientId,
        contactId: seed.contactId,
        isAwarded: seed.isAwarded,
        contractIssued: seed.contractIssued,
        contractIssuedAt: seed.contractIssued && seed.awardedDaysAgo !== null ? daysAgo(seed.awardedDaysAgo) : null,
        relationshipType: "PRIMARY"
      }
    });

    await prisma.tenderNote.deleteMany({ where: { tenderId: seed.id } });
    if (seed.note) {
      await prisma.tenderNote.create({
        data: {
          id: `tender-note-${seed.id}`,
          tenderId: seed.id,
          authorUserId: estimatorUserId,
          body: seed.note
        }
      });
    }

    await prisma.tenderClarification.deleteMany({ where: { tenderId: seed.id } });
    if (seed.clarification) {
      await prisma.tenderClarification.create({
        data: {
          id: `tender-clar-${seed.id}`,
          tenderId: seed.id,
          subject: seed.clarification.subject,
          response: seed.clarification.response,
          status: seed.clarification.status
        }
      });
    }

    await prisma.tenderPricingSnapshot.deleteMany({ where: { tenderId: seed.id } });
    if (seed.pricing) {
      const total =
        Number(seed.pricing.labour) +
        Number(seed.pricing.plant) +
        Number(seed.pricing.materials) +
        Number(seed.pricing.subcontract) +
        Number(seed.pricing.margin);
      await prisma.tenderPricingSnapshot.create({
        data: {
          id: `tender-pricing-${seed.id}`,
          tenderId: seed.id,
          versionLabel: "Submission",
          estimatedValue: new Prisma.Decimal(total.toFixed(2)),
          marginPercent: new Prisma.Decimal(((Number(seed.pricing.margin) / total) * 100).toFixed(2)),
          assumptions: `Labour $${seed.pricing.labour} · Plant $${seed.pricing.plant} · Materials $${seed.pricing.materials} · Subcontract $${seed.pricing.subcontract} · Margin $${seed.pricing.margin}`
        }
      });
    }

    await prisma.tenderFollowUp.deleteMany({ where: { tenderId: seed.id } });
    if (seed.followUp) {
      await prisma.tenderFollowUp.create({
        data: {
          id: `tender-fu-${seed.id}`,
          tenderId: seed.id,
          dueAt: daysFromNow(seed.followUp.dueInDays),
          status: seed.followUp.status,
          details: seed.followUp.details,
          assignedUserId: estimatorUserId
        }
      });
    }

    await prisma.tenderOutcome.deleteMany({ where: { tenderId: seed.id } });
    if (seed.outcome) {
      await prisma.tenderOutcome.create({
        data: {
          id: `tender-outcome-${seed.id}`,
          tenderId: seed.id,
          outcomeType: seed.outcome.outcomeType,
          notes: seed.outcome.notes,
          recordedAt: seed.awardedDaysAgo !== null ? daysAgo(seed.awardedDaysAgo) : daysAgo(7)
        }
      });
    }
  }

  type JobStageSeed = {
    id: string;
    name: string;
    order: number;
    status: "COMPLETE" | "ACTIVE" | "PLANNED";
    activities: { id: string; name: string; order: number; status: "COMPLETE" | "IN_PROGRESS" | "NOT_STARTED" }[];
  };

  type JobSeed = {
    id: string;
    jobNumber: string;
    name: string;
    description: string;
    tenderId: string;
    clientId: string;
    siteId: string;
    projectManagerUserId: string;
    supervisorUserId: string;
    startDaysAgo: number;
    endDaysFromNow: number;
    contractValue: string;
    stages: JobStageSeed[];
    issues: { id: string; title: string; description: string; severity: "HIGH" | "MEDIUM" | "LOW"; status: "OPEN" | "RESOLVED"; reportedBy: string }[];
    variations: { reference: string; title: string; description: string; amount: string; status: "APPROVED" | "SUBMITTED" | "PROPOSED" }[];
    progress: { weekOffsetDays: number; summary: string; percent: number }[];
  };

  const jobSeeds: JobSeed[] = [
    {
      id: "job-001",
      jobNumber: "J-2025-001",
      name: "Ipswich Motorway Stage 4 — Earthworks",
      description: "Bulk earthworks package for the Stage 4 corridor extension between Darra and Wacol.",
      tenderId: "tender-001",
      clientId: "client-001",
      siteId: "site-001",
      projectManagerUserId: pm001Id,
      supervisorUserId: supervisor001Id,
      startDaysAgo: 21,
      endDaysFromNow: 160,
      contractValue: "4250000.00",
      stages: [
        {
          id: "stage-job-001-1",
          name: "Mobilisation",
          order: 1,
          status: "COMPLETE",
          activities: [
            { id: "activity-job-001-1-1", name: "Site establishment and fencing", order: 1, status: "COMPLETE" },
            { id: "activity-job-001-1-2", name: "Traffic management setup", order: 2, status: "COMPLETE" },
            { id: "activity-job-001-1-3", name: "Environmental controls", order: 3, status: "COMPLETE" }
          ]
        },
        {
          id: "stage-job-001-2",
          name: "Bulk Earthworks",
          order: 2,
          status: "ACTIVE",
          activities: [
            { id: "activity-job-001-2-1", name: "Strip and stockpile topsoil", order: 1, status: "COMPLETE" },
            { id: "activity-job-001-2-2", name: "Cut to fill — Zone A", order: 2, status: "IN_PROGRESS" },
            { id: "activity-job-001-2-3", name: "Cut to fill — Zone B", order: 3, status: "NOT_STARTED" },
            { id: "activity-job-001-2-4", name: "Cut to fill — Zone C", order: 4, status: "NOT_STARTED" },
            { id: "activity-job-001-2-5", name: "Import fill", order: 5, status: "NOT_STARTED" }
          ]
        },
        {
          id: "stage-job-001-3",
          name: "Drainage Installation",
          order: 3,
          status: "PLANNED",
          activities: [
            { id: "activity-job-001-3-1", name: "Trench excavation", order: 1, status: "NOT_STARTED" },
            { id: "activity-job-001-3-2", name: "Pipe laying and bedding", order: 2, status: "NOT_STARTED" },
            { id: "activity-job-001-3-3", name: "Headwall construction", order: 3, status: "NOT_STARTED" },
            { id: "activity-job-001-3-4", name: "Backfill and compact", order: 4, status: "NOT_STARTED" }
          ]
        },
        {
          id: "stage-job-001-4",
          name: "Embankment Formation",
          order: 4,
          status: "PLANNED",
          activities: [
            { id: "activity-job-001-4-1", name: "Layer placement and compaction", order: 1, status: "NOT_STARTED" },
            { id: "activity-job-001-4-2", name: "Batter trimming", order: 2, status: "NOT_STARTED" },
            { id: "activity-job-001-4-3", name: "Erosion control", order: 3, status: "NOT_STARTED" }
          ]
        },
        {
          id: "stage-job-001-5",
          name: "Defects and Closeout",
          order: 5,
          status: "PLANNED",
          activities: [
            { id: "activity-job-001-5-1", name: "Defects inspection", order: 1, status: "NOT_STARTED" },
            { id: "activity-job-001-5-2", name: "Final survey", order: 2, status: "NOT_STARTED" },
            { id: "activity-job-001-5-3", name: "Handover documentation", order: 3, status: "NOT_STARTED" }
          ]
        }
      ],
      issues: [
        {
          id: "issue-job-001-1",
          title: "Unexpected rock encountered in Zone A cut — geotechnical review required.",
          description: "Class B rock encountered at RL 42.3m in Zone A cut. Pending geotechnical reclassification.",
          severity: "HIGH",
          status: "OPEN",
          reportedBy: supervisor001Id
        },
        {
          id: "issue-job-001-2",
          title: "Delay in traffic management approvals from TMR — 3-day impact on programme.",
          description: "TMR approval for lane switch configuration took 3 additional days. Programme re-baselined.",
          severity: "MEDIUM",
          status: "RESOLVED",
          reportedBy: pm001Id
        }
      ],
      variations: [
        { reference: "VAR-001", title: "Rock ripping and removal — Zone A", description: "Variation to handle unexpected rock in Zone A cut.", amount: "85000.00", status: "APPROVED" },
        { reference: "VAR-002", title: "Additional imported fill — volume increase", description: "Additional 2,800m³ imported fill required for embankment.", amount: "42000.00", status: "SUBMITTED" }
      ],
      progress: [
        { weekOffsetDays: 14, summary: "Mobilisation complete. Site establishment and traffic management operational. Topsoil strip commenced.", percent: 8 },
        { weekOffsetDays: 7, summary: "Topsoil strip complete across full footprint (2.4ha). Cut commenced Zone A. Rock encountered at RL 42.3m.", percent: 15 },
        { weekOffsetDays: 0, summary: "Rock ripping and removal Zone A underway. Variation 1 submitted and approved. Cut to fill progressing at 60% of planned rate pending geotechnical review.", percent: 20 }
      ]
    },
    {
      id: "job-002",
      jobNumber: "J-2025-002",
      name: "Sandgate Stormwater Upgrade — Stage 1",
      description: "Replacement of 450mm RCP drainage lines, headwall construction, and tie-in works along Brighton Road corridor.",
      tenderId: "tender-003",
      clientId: "client-003",
      siteId: "site-003",
      projectManagerUserId: pm002Id,
      supervisorUserId: supervisor001Id,
      startDaysAgo: 45,
      endDaysFromNow: 50,
      contractValue: "1100000.00",
      stages: [
        {
          id: "stage-job-002-1",
          name: "Preparatory Works",
          order: 1,
          status: "COMPLETE",
          activities: [
            { id: "activity-job-002-1-1", name: "Traffic management setup", order: 1, status: "COMPLETE" },
            { id: "activity-job-002-1-2", name: "Service location and marking", order: 2, status: "COMPLETE" },
            { id: "activity-job-002-1-3", name: "Temporary drainage diversions", order: 3, status: "COMPLETE" }
          ]
        },
        {
          id: "stage-job-002-2",
          name: "Pipe Replacement",
          order: 2,
          status: "ACTIVE",
          activities: [
            { id: "activity-job-002-2-1", name: "Excavation — Chainage 0–150m", order: 1, status: "COMPLETE" },
            { id: "activity-job-002-2-2", name: "Pipe laying — Chainage 0–150m", order: 2, status: "COMPLETE" },
            { id: "activity-job-002-2-3", name: "Excavation — Chainage 150–300m", order: 3, status: "IN_PROGRESS" },
            { id: "activity-job-002-2-4", name: "Pipe laying — Chainage 150–300m", order: 4, status: "NOT_STARTED" },
            { id: "activity-job-002-2-5", name: "Reinstatement — Chainage 0–150m", order: 5, status: "NOT_STARTED" }
          ]
        },
        {
          id: "stage-job-002-3",
          name: "Headwall and Structures",
          order: 3,
          status: "PLANNED",
          activities: [
            { id: "activity-job-002-3-1", name: "Formwork", order: 1, status: "NOT_STARTED" },
            { id: "activity-job-002-3-2", name: "Reinforcement", order: 2, status: "NOT_STARTED" },
            { id: "activity-job-002-3-3", name: "Concrete pour", order: 3, status: "NOT_STARTED" },
            { id: "activity-job-002-3-4", name: "Backfill", order: 4, status: "NOT_STARTED" }
          ]
        },
        {
          id: "stage-job-002-4",
          name: "Reinstatement and Handover",
          order: 4,
          status: "PLANNED",
          activities: [
            { id: "activity-job-002-4-1", name: "Pavement reinstatement", order: 1, status: "NOT_STARTED" },
            { id: "activity-job-002-4-2", name: "Linemarking", order: 2, status: "NOT_STARTED" },
            { id: "activity-job-002-4-3", name: "Final inspection and as-builts", order: 3, status: "NOT_STARTED" }
          ]
        }
      ],
      issues: [
        {
          id: "issue-job-002-1",
          title: "Existing 300mm UPVC pipe in conflict with new alignment at Ch 175m.",
          description: "Unmarked 300mm UPVC pipe discovered at Ch 175m during excavation. Alignment adjustment under review.",
          severity: "MEDIUM",
          status: "OPEN",
          reportedBy: supervisor001Id
        }
      ],
      variations: [],
      progress: [
        { weekOffsetDays: 7, summary: "Preparatory works complete. Excavation commenced Ch 0. Existing services cleared.", percent: 20 },
        { weekOffsetDays: 0, summary: "Pipe laid Ch 0–150m. Excavation progressing Ch 150–300m. Conflict identified at Ch 175m.", percent: 45 }
      ]
    }
  ];

  for (const job of jobSeeds) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: {
        jobNumber: job.jobNumber,
        name: job.name,
        description: job.description,
        clientId: job.clientId,
        siteId: job.siteId,
        sourceTenderId: job.tenderId,
        status: "ACTIVE",
        projectManagerId: job.projectManagerUserId,
        supervisorId: job.supervisorUserId
      },
      create: {
        id: job.id,
        jobNumber: job.jobNumber,
        name: job.name,
        description: job.description,
        clientId: job.clientId,
        siteId: job.siteId,
        sourceTenderId: job.tenderId,
        status: "ACTIVE",
        projectManagerId: job.projectManagerUserId,
        supervisorId: job.supervisorUserId
      }
    });

    const primaryTenderClient = await prisma.tenderClient.findFirst({
      where: { tenderId: job.tenderId, clientId: job.clientId }
    });
    if (primaryTenderClient) {
      await prisma.jobConversion.upsert({
        where: { tenderId: job.tenderId },
        update: {
          tenderClientId: primaryTenderClient.id,
          jobId: job.id,
          carriedDocuments: true
        },
        create: {
          tenderId: job.tenderId,
          tenderClientId: primaryTenderClient.id,
          jobId: job.id,
          carriedDocuments: true
        }
      });
    }

    for (const stage of job.stages) {
      const stageStart = job.startDaysAgo > 0 ? daysAgo(job.startDaysAgo).toISOString() : daysFromNow(0).toISOString();
      const stageEnd = daysFromNow(job.endDaysFromNow).toISOString();
      await prisma.jobStage.upsert({
        where: { id: stage.id },
        update: {
          jobId: job.id,
          name: stage.name,
          stageOrder: stage.order,
          status: stage.status,
          startDate: new Date(stageStart),
          endDate: new Date(stageEnd)
        },
        create: {
          id: stage.id,
          jobId: job.id,
          name: stage.name,
          stageOrder: stage.order,
          status: stage.status,
          startDate: new Date(stageStart),
          endDate: new Date(stageEnd)
        }
      });

      for (const activity of stage.activities) {
        await prisma.jobActivity.upsert({
          where: { id: activity.id },
          update: {
            jobId: job.id,
            jobStageId: stage.id,
            name: activity.name,
            activityOrder: activity.order,
            status: activity.status,
            plannedDate: new Date(stageStart)
          },
          create: {
            id: activity.id,
            jobId: job.id,
            jobStageId: stage.id,
            name: activity.name,
            activityOrder: activity.order,
            status: activity.status,
            plannedDate: new Date(stageStart)
          }
        });
      }
    }

    for (const issue of job.issues) {
      await prisma.jobIssue.upsert({
        where: { id: issue.id },
        update: {
          jobId: job.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          status: issue.status,
          reportedById: issue.reportedBy,
          reportedAt: daysAgo(Math.min(job.startDaysAgo, 10))
        },
        create: {
          id: issue.id,
          jobId: job.id,
          title: issue.title,
          description: issue.description,
          severity: issue.severity,
          status: issue.status,
          reportedById: issue.reportedBy,
          reportedAt: daysAgo(Math.min(job.startDaysAgo, 10))
        }
      });
    }

    await prisma.jobVariation.deleteMany({ where: { jobId: job.id } });
    for (const variation of job.variations) {
      await prisma.jobVariation.create({
        data: {
          id: `var-${job.id}-${variation.reference}`,
          jobId: job.id,
          reference: variation.reference,
          title: variation.title,
          description: variation.description,
          amount: new Prisma.Decimal(variation.amount),
          status: variation.status,
          approvedById: variation.status === "APPROVED" ? job.projectManagerUserId : null,
          approvedAt: variation.status === "APPROVED" ? daysAgo(3) : null
        }
      });
    }

    await prisma.jobProgressEntry.deleteMany({ where: { jobId: job.id } });
    for (const [index, entry] of job.progress.entries()) {
      await prisma.jobProgressEntry.create({
        data: {
          id: `progress-${job.id}-${index}`,
          jobId: job.id,
          entryType: "PROGRESS",
          entryDate: daysAgo(entry.weekOffsetDays),
          summary: entry.summary,
          percentComplete: entry.percent,
          authorUserId: job.projectManagerUserId
        }
      });
    }

    await prisma.jobStatusHistory.deleteMany({ where: { jobId: job.id, note: { startsWith: "Initial Services seed:" } } });
    await prisma.jobStatusHistory.create({
      data: {
        jobId: job.id,
        fromStatus: "PLANNING",
        toStatus: "ACTIVE",
        note: "Initial Services seed: job activated on mobilisation.",
        changedById: job.projectManagerUserId,
        changedAt: daysAgo(job.startDaysAgo)
      }
    });
  }

  const thisWeekMondayOffset = -0;
  const nextWeekMondayOffset = 7;
  const thisWeek = weekdaysOfWeek(thisWeekMondayOffset);
  const nextWeek = weekdaysOfWeek(nextWeekMondayOffset);

  await prisma.availabilityWindow.deleteMany({ where: { workerId: "worker-007" } });
  await prisma.availabilityWindow.create({
    data: {
      id: "avail-worker-007-leave",
      workerId: "worker-007",
      startAt: BASE_DATE,
      endAt: daysFromNow(14),
      status: "UNAVAILABLE",
      notes: "Annual leave — 14 days"
    }
  });

  await prisma.shiftWorkerAssignment.deleteMany({ where: { shift: { jobId: { in: ["job-001", "job-002"] } } } });
  await prisma.shiftAssetAssignment.deleteMany({ where: { shift: { jobId: { in: ["job-001", "job-002"] } } } });
  await prisma.schedulingConflict.deleteMany({ where: { shift: { jobId: { in: ["job-001", "job-002"] } } } });
  await prisma.shiftRoleRequirement.deleteMany({ where: { shift: { jobId: { in: ["job-001", "job-002"] } } } });
  await prisma.shift.deleteMany({ where: { jobId: { in: ["job-001", "job-002"] } } });

  type ShiftPlan = {
    id: string;
    jobId: string;
    activityId: string;
    stageId: string;
    title: string;
    date: Date;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    leadUserId: string;
    workerIds: string[];
    assetIds: string[];
    conflicts: { severity: "RED" | "AMBER"; code: string; message: string }[];
  };

  const job001DayWorkers = ["worker-001", "worker-002", "worker-003", "worker-008", "worker-013"];
  const job001AfternoonWorkers = ["worker-004", "worker-005", "worker-014", "worker-016"];
  const job001DayWorkersNextWeek = ["worker-001", "worker-002", "worker-003", "worker-008"];
  const job002DayWorkers = ["worker-006", "worker-011", "worker-012", "worker-015"];

  const shiftPlans: ShiftPlan[] = [];

  thisWeek.forEach((date, index) => {
    shiftPlans.push({
      id: `shift-j001-day-w1-${index + 1}`,
      jobId: "job-001",
      activityId: "activity-job-001-2-2",
      stageId: "stage-job-001-2",
      title: "Ipswich — Zone A cut to fill (day)",
      date,
      startHour: 6,
      startMinute: 0,
      endHour: 14,
      endMinute: 30,
      leadUserId: supervisor001Id,
      workerIds: job001DayWorkers,
      assetIds: ["asset-001", "asset-003", "asset-007"],
      conflicts: []
    });
    shiftPlans.push({
      id: `shift-j001-afternoon-w1-${index + 1}`,
      jobId: "job-001",
      activityId: "activity-job-001-2-2",
      stageId: "stage-job-001-2",
      title: "Ipswich — Zone A cut to fill (afternoon)",
      date,
      startHour: 14,
      startMinute: 0,
      endHour: 22,
      endMinute: 30,
      leadUserId: supervisor001Id,
      workerIds: job001AfternoonWorkers,
      assetIds: ["asset-002"],
      conflicts: []
    });
  });

  [0, 1, 2].forEach((dayOffset) => {
    const date = nextWeek[dayOffset];
    shiftPlans.push({
      id: `shift-j001-day-w2-${dayOffset + 1}`,
      jobId: "job-001",
      activityId: "activity-job-001-2-2",
      stageId: "stage-job-001-2",
      title: "Ipswich — Zone A cut to fill (day)",
      date,
      startHour: 6,
      startMinute: 0,
      endHour: 14,
      endMinute: 30,
      leadUserId: supervisor001Id,
      workerIds: job001DayWorkersNextWeek,
      assetIds: ["asset-001", "asset-003"],
      conflicts: []
    });
  });

  thisWeek.forEach((date, index) => {
    const dayOfWeek = index;
    const includesOverlapWorker = dayOfWeek >= 3;
    const workerIds = includesOverlapWorker ? [...job002DayWorkers, "worker-001"] : job002DayWorkers;
    const conflicts: { severity: "RED" | "AMBER"; code: string; message: string }[] = [
      {
        severity: "RED",
        code: "ASSET_MAINTENANCE_BLOCK",
        message: "CAT 308 Mini Excavator (asset-013) is under maintenance and cannot be scheduled."
      }
    ];
    if (includesOverlapWorker) {
      conflicts.push({
        severity: "RED",
        code: "WORKER_OVERLAP",
        message: "Ryan O'Brien (worker-001) is already assigned to the Ipswich day shift on this date."
      });
    }

    shiftPlans.push({
      id: `shift-j002-day-w1-${index + 1}`,
      jobId: "job-002",
      activityId: "activity-job-002-2-3",
      stageId: "stage-job-002-2",
      title: "Sandgate — Pipe replacement day shift",
      date,
      startHour: 7,
      startMinute: 0,
      endHour: 15,
      endMinute: 30,
      leadUserId: supervisor001Id,
      workerIds,
      assetIds: ["asset-013", "asset-012", "asset-008"],
      conflicts
    });
  });

  for (const plan of shiftPlans) {
    const startAt = atTime(plan.date, plan.startHour, plan.startMinute);
    const endAt = atTime(plan.date, plan.endHour, plan.endMinute);
    await prisma.shift.upsert({
      where: { id: plan.id },
      update: {
        jobId: plan.jobId,
        jobStageId: plan.stageId,
        jobActivityId: plan.activityId,
        leadUserId: plan.leadUserId,
        title: plan.title,
        startAt,
        endAt,
        status: "PLANNED"
      },
      create: {
        id: plan.id,
        jobId: plan.jobId,
        jobStageId: plan.stageId,
        jobActivityId: plan.activityId,
        leadUserId: plan.leadUserId,
        title: plan.title,
        startAt,
        endAt,
        status: "PLANNED"
      }
    });

    for (const workerId of plan.workerIds) {
      await prisma.shiftWorkerAssignment.upsert({
        where: { shiftId_workerId: { shiftId: plan.id, workerId } },
        update: {},
        create: { shiftId: plan.id, workerId }
      });
    }

    for (const assetId of plan.assetIds) {
      await prisma.shiftAssetAssignment.upsert({
        where: { shiftId_assetId: { shiftId: plan.id, assetId } },
        update: {},
        create: { shiftId: plan.id, assetId }
      });
    }

    for (const conflict of plan.conflicts) {
      await prisma.schedulingConflict.create({
        data: {
          shiftId: plan.id,
          severity: conflict.severity,
          code: conflict.code,
          message: conflict.message
        }
      });
    }
  }

  async function upsertFormTemplate(options: {
    templateId: string;
    name: string;
    code: string;
    description: string;
    sections: {
      sectionId: string;
      title: string;
      description: string;
      order: number;
      fields: {
        fieldId: string;
        fieldKey: string;
        label: string;
        fieldType: string;
        order: number;
        isRequired: boolean;
        options?: string[];
      }[];
    }[];
    rules?: { ruleId: string; sourceFieldKey: string; targetFieldKey: string; operator: string; comparisonValue: string; effect: string }[];
  }): Promise<{ templateVersionId: string; fieldIdByKey: Map<string, string> }> {
    const versionId = `${options.templateId}-v1`;
    const template = await prisma.formTemplate.upsert({
      where: { id: options.templateId },
      update: {
        name: options.name,
        code: options.code,
        description: options.description,
        status: "ACTIVE",
        geolocationEnabled: false,
        associationScopes: ["job", "shift", "asset", "worker", "site"]
      },
      create: {
        id: options.templateId,
        name: options.name,
        code: options.code,
        description: options.description,
        status: "ACTIVE",
        geolocationEnabled: false,
        associationScopes: ["job", "shift", "asset", "worker", "site"]
      }
    });

    await prisma.formTemplateVersion.upsert({
      where: { id: versionId },
      update: {
        templateId: template.id,
        versionNumber: 1,
        status: "ACTIVE"
      },
      create: {
        id: versionId,
        templateId: template.id,
        versionNumber: 1,
        status: "ACTIVE"
      }
    });

    const fieldIdByKey = new Map<string, string>();

    for (const section of options.sections) {
      await prisma.formSection.upsert({
        where: { id: section.sectionId },
        update: {
          versionId,
          title: section.title,
          description: section.description,
          sectionOrder: section.order
        },
        create: {
          id: section.sectionId,
          versionId,
          title: section.title,
          description: section.description,
          sectionOrder: section.order
        }
      });

      for (const field of section.fields) {
        await prisma.formField.upsert({
          where: { id: field.fieldId },
          update: {
            sectionId: section.sectionId,
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            fieldOrder: field.order,
            isRequired: field.isRequired,
            optionsJson: field.options ? field.options : Prisma.JsonNull
          },
          create: {
            id: field.fieldId,
            sectionId: section.sectionId,
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            fieldOrder: field.order,
            isRequired: field.isRequired,
            optionsJson: field.options ? field.options : Prisma.JsonNull
          }
        });
        fieldIdByKey.set(field.fieldKey, field.fieldId);
      }
    }

    await prisma.formRule.deleteMany({ where: { versionId } });
    for (const rule of options.rules ?? []) {
      await prisma.formRule.create({
        data: {
          id: rule.ruleId,
          versionId,
          sourceFieldKey: rule.sourceFieldKey,
          targetFieldKey: rule.targetFieldKey,
          operator: rule.operator,
          comparisonValue: rule.comparisonValue,
          effect: rule.effect
        }
      });
    }

    return { templateVersionId: versionId, fieldIdByKey };
  }

  const prestart = await upsertFormTemplate({
    templateId: "form-tpl-001",
    name: "Daily Prestart Checklist",
    code: "IS-FORM-001-PRESTART",
    description: "Daily prestart checklist covering site details, safety, plant, and sign-off.",
    sections: [
      {
        sectionId: "form-tpl-001-s1",
        title: "Site Details",
        description: "Site identification and conditions",
        order: 1,
        fields: [
          { fieldId: "form-tpl-001-s1-f1", fieldKey: "site_name", label: "Site name", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-001-s1-f2", fieldKey: "prestart_date", label: "Date", fieldType: "date", order: 2, isRequired: true },
          { fieldId: "form-tpl-001-s1-f3", fieldKey: "supervisor_name", label: "Supervisor name", fieldType: "text", order: 3, isRequired: true },
          { fieldId: "form-tpl-001-s1-f4", fieldKey: "weather_conditions", label: "Weather conditions", fieldType: "multiple_choice", order: 4, isRequired: true, options: ["Fine", "Cloudy", "Rain", "Fog"] }
        ]
      },
      {
        sectionId: "form-tpl-001-s2",
        title: "Safety Checks",
        description: "PPE, SWMS, hazards, and emergency posting",
        order: 2,
        fields: [
          { fieldId: "form-tpl-001-s2-f1", fieldKey: "ppe_confirmed", label: "PPE confirmed", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-001-s2-f2", fieldKey: "swms_reviewed", label: "SWMS reviewed", fieldType: "checkbox", order: 2, isRequired: true },
          { fieldId: "form-tpl-001-s2-f3", fieldKey: "hazard_assessment_complete", label: "Hazard assessment complete", fieldType: "checkbox", order: 3, isRequired: true },
          { fieldId: "form-tpl-001-s2-f4", fieldKey: "emergency_contacts_posted", label: "Emergency contacts posted", fieldType: "checkbox", order: 4, isRequired: true },
          { fieldId: "form-tpl-001-s2-f5", fieldKey: "hazard_notes", label: "Hazards noted", fieldType: "textarea", order: 5, isRequired: false }
        ]
      },
      {
        sectionId: "form-tpl-001-s3",
        title: "Plant and Equipment",
        description: "Plant inspection and defect tracking",
        order: 3,
        fields: [
          { fieldId: "form-tpl-001-s3-f1", fieldKey: "plant_inspected", label: "Plant inspected", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-001-s3-f2", fieldKey: "defects_identified", label: "Defects identified", fieldType: "checkbox", order: 2, isRequired: true },
          { fieldId: "form-tpl-001-s3-f3", fieldKey: "defect_details", label: "Defect details", fieldType: "textarea", order: 3, isRequired: false }
        ]
      },
      {
        sectionId: "form-tpl-001-s4",
        title: "Sign-off",
        description: "Worker sign-off",
        order: 4,
        fields: [
          { fieldId: "form-tpl-001-s4-f1", fieldKey: "worker_name", label: "Worker name", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-001-s4-f2", fieldKey: "signature", label: "Signature", fieldType: "signature", order: 2, isRequired: true }
        ]
      }
    ],
    rules: [
      { ruleId: "form-tpl-001-r1", sourceFieldKey: "hazard_assessment_complete", targetFieldKey: "hazard_notes", operator: "equals", comparisonValue: "false", effect: "SHOW" },
      { ruleId: "form-tpl-001-r2", sourceFieldKey: "defects_identified", targetFieldKey: "defect_details", operator: "equals", comparisonValue: "true", effect: "SHOW" }
    ]
  });

  const plantPrestart = await upsertFormTemplate({
    templateId: "form-tpl-002",
    name: "Plant Pre-Start Inspection",
    code: "IS-FORM-002-PLANT-PRESTART",
    description: "Plant pre-start inspection covering visual and operational checks.",
    sections: [
      {
        sectionId: "form-tpl-002-s1",
        title: "Equipment Details",
        description: "Asset identification and operator",
        order: 1,
        fields: [
          { fieldId: "form-tpl-002-s1-f1", fieldKey: "asset_id", label: "Asset ID", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-002-s1-f2", fieldKey: "operator_name", label: "Operator name", fieldType: "text", order: 2, isRequired: true },
          { fieldId: "form-tpl-002-s1-f3", fieldKey: "inspection_date", label: "Date", fieldType: "date", order: 3, isRequired: true },
          { fieldId: "form-tpl-002-s1-f4", fieldKey: "hour_meter", label: "Hour meter reading", fieldType: "number", order: 4, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-002-s2",
        title: "Visual Inspection",
        description: "Visual check items",
        order: 2,
        fields: [
          { fieldId: "form-tpl-002-s2-f1", fieldKey: "fluid_levels_ok", label: "Fluid levels OK", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-002-s2-f2", fieldKey: "lights_signals_ok", label: "Lights and signals OK", fieldType: "checkbox", order: 2, isRequired: true },
          { fieldId: "form-tpl-002-s2-f3", fieldKey: "tracks_tyres_ok", label: "Tracks/tyres OK", fieldType: "checkbox", order: 3, isRequired: true },
          { fieldId: "form-tpl-002-s2-f4", fieldKey: "guards_covers_secure", label: "Guards and covers secure", fieldType: "checkbox", order: 4, isRequired: true },
          { fieldId: "form-tpl-002-s2-f5", fieldKey: "issues_found", label: "Issues found", fieldType: "textarea", order: 5, isRequired: false }
        ]
      },
      {
        sectionId: "form-tpl-002-s3",
        title: "Operational Check",
        description: "Operational readiness",
        order: 3,
        fields: [
          { fieldId: "form-tpl-002-s3-f1", fieldKey: "engine_start_ok", label: "Engine start OK", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-002-s3-f2", fieldKey: "controls_responsive", label: "Controls responsive", fieldType: "checkbox", order: 2, isRequired: true },
          { fieldId: "form-tpl-002-s3-f3", fieldKey: "no_unusual_noises", label: "No unusual noises", fieldType: "checkbox", order: 3, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-002-s4",
        title: "Sign-off",
        description: "Operator sign-off",
        order: 4,
        fields: [
          { fieldId: "form-tpl-002-s4-f1", fieldKey: "operator_signature", label: "Operator signature", fieldType: "signature", order: 1, isRequired: true }
        ]
      }
    ],
    rules: [
      { ruleId: "form-tpl-002-r1", sourceFieldKey: "fluid_levels_ok", targetFieldKey: "issues_found", operator: "equals", comparisonValue: "false", effect: "SHOW" },
      { ruleId: "form-tpl-002-r2", sourceFieldKey: "lights_signals_ok", targetFieldKey: "issues_found", operator: "equals", comparisonValue: "false", effect: "SHOW" },
      { ruleId: "form-tpl-002-r3", sourceFieldKey: "tracks_tyres_ok", targetFieldKey: "issues_found", operator: "equals", comparisonValue: "false", effect: "SHOW" },
      { ruleId: "form-tpl-002-r4", sourceFieldKey: "guards_covers_secure", targetFieldKey: "issues_found", operator: "equals", comparisonValue: "false", effect: "SHOW" }
    ]
  });

  const incidentReport = await upsertFormTemplate({
    templateId: "form-tpl-003",
    name: "Incident / Near Miss Report",
    code: "IS-FORM-003-INCIDENT",
    description: "Incident or near-miss investigation report.",
    sections: [
      {
        sectionId: "form-tpl-003-s1",
        title: "Incident Details",
        description: "Date, location, type, description",
        order: 1,
        fields: [
          { fieldId: "form-tpl-003-s1-f1", fieldKey: "incident_datetime", label: "Date and time", fieldType: "datetime", order: 1, isRequired: true },
          { fieldId: "form-tpl-003-s1-f2", fieldKey: "incident_location", label: "Location/site", fieldType: "text", order: 2, isRequired: true },
          { fieldId: "form-tpl-003-s1-f3", fieldKey: "incident_type", label: "Incident type", fieldType: "multiple_choice", order: 3, isRequired: true, options: ["Near Miss", "First Aid", "LTI", "Property Damage"] },
          { fieldId: "form-tpl-003-s1-f4", fieldKey: "incident_description", label: "Description", fieldType: "textarea", order: 4, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-003-s2",
        title: "Persons Involved",
        description: "Person details and injury status",
        order: 2,
        fields: [
          { fieldId: "form-tpl-003-s2-f1", fieldKey: "person_name", label: "Name", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-003-s2-f2", fieldKey: "person_role", label: "Role", fieldType: "text", order: 2, isRequired: false },
          { fieldId: "form-tpl-003-s2-f3", fieldKey: "person_injured", label: "Injured", fieldType: "checkbox", order: 3, isRequired: false },
          { fieldId: "form-tpl-003-s2-f4", fieldKey: "injury_description", label: "Injury description", fieldType: "textarea", order: 4, isRequired: false }
        ]
      },
      {
        sectionId: "form-tpl-003-s3",
        title: "Immediate Actions",
        description: "Initial response",
        order: 3,
        fields: [
          { fieldId: "form-tpl-003-s3-f1", fieldKey: "area_made_safe", label: "Area made safe", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-003-s3-f2", fieldKey: "first_aid_administered", label: "First aid administered", fieldType: "checkbox", order: 2, isRequired: false },
          { fieldId: "form-tpl-003-s3-f3", fieldKey: "emergency_services_called", label: "Emergency services called", fieldType: "checkbox", order: 3, isRequired: false },
          { fieldId: "form-tpl-003-s3-f4", fieldKey: "supervisor_notified", label: "Supervisor notified", fieldType: "checkbox", order: 4, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-003-s4",
        title: "Investigation",
        description: "Root cause and corrective actions",
        order: 4,
        fields: [
          { fieldId: "form-tpl-003-s4-f1", fieldKey: "root_cause", label: "Root cause", fieldType: "textarea", order: 1, isRequired: true },
          { fieldId: "form-tpl-003-s4-f2", fieldKey: "corrective_actions", label: "Corrective actions", fieldType: "textarea", order: 2, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-003-s5",
        title: "Sign-off",
        description: "Reporter and supervisor",
        order: 5,
        fields: [
          { fieldId: "form-tpl-003-s5-f1", fieldKey: "reported_by", label: "Reported by", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-003-s5-f2", fieldKey: "supervisor_signature", label: "Supervisor signature", fieldType: "signature", order: 2, isRequired: true }
        ]
      }
    ],
    rules: [
      { ruleId: "form-tpl-003-r1", sourceFieldKey: "person_injured", targetFieldKey: "injury_description", operator: "equals", comparisonValue: "true", effect: "SHOW" }
    ]
  });

  const concretePour = await upsertFormTemplate({
    templateId: "form-tpl-004",
    name: "Concrete Pour Record",
    code: "IS-FORM-004-CONCRETE-POUR",
    description: "Concrete pour record covering pour details, mix, quality, and sign-off.",
    sections: [
      {
        sectionId: "form-tpl-004-s1",
        title: "Pour Details",
        description: "Job, element, timing",
        order: 1,
        fields: [
          { fieldId: "form-tpl-004-s1-f1", fieldKey: "job_number", label: "Job number", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-004-s1-f2", fieldKey: "structure_element", label: "Structure/element", fieldType: "text", order: 2, isRequired: true },
          { fieldId: "form-tpl-004-s1-f3", fieldKey: "pour_date", label: "Date", fieldType: "date", order: 3, isRequired: true },
          { fieldId: "form-tpl-004-s1-f4", fieldKey: "start_time", label: "Start time", fieldType: "text", order: 4, isRequired: true },
          { fieldId: "form-tpl-004-s1-f5", fieldKey: "finish_time", label: "Finish time", fieldType: "text", order: 5, isRequired: false }
        ]
      },
      {
        sectionId: "form-tpl-004-s2",
        title: "Mix Details",
        description: "Mix design and supplier",
        order: 2,
        fields: [
          { fieldId: "form-tpl-004-s2-f1", fieldKey: "mix_design_ref", label: "Mix design ref", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-004-s2-f2", fieldKey: "specified_strength", label: "Specified strength", fieldType: "number", order: 2, isRequired: true },
          { fieldId: "form-tpl-004-s2-f3", fieldKey: "slump", label: "Slump", fieldType: "number", order: 3, isRequired: true },
          { fieldId: "form-tpl-004-s2-f4", fieldKey: "supplier_docket_numbers", label: "Supplier docket numbers", fieldType: "textarea", order: 4, isRequired: true },
          { fieldId: "form-tpl-004-s2-f5", fieldKey: "volume_poured", label: "Volume poured", fieldType: "number", order: 5, isRequired: true }
        ]
      },
      {
        sectionId: "form-tpl-004-s3",
        title: "Quality",
        description: "Cylinders, temperature, weather",
        order: 3,
        fields: [
          { fieldId: "form-tpl-004-s3-f1", fieldKey: "cylinders_taken", label: "Cylinders taken", fieldType: "checkbox", order: 1, isRequired: true },
          { fieldId: "form-tpl-004-s3-f2", fieldKey: "cylinder_set_id", label: "Cylinder set ID", fieldType: "text", order: 2, isRequired: false },
          { fieldId: "form-tpl-004-s3-f3", fieldKey: "temperature", label: "Temperature", fieldType: "number", order: 3, isRequired: false },
          { fieldId: "form-tpl-004-s3-f4", fieldKey: "weather", label: "Weather", fieldType: "multiple_choice", order: 4, isRequired: true, options: ["Fine", "Cloudy", "Rain"] }
        ]
      },
      {
        sectionId: "form-tpl-004-s4",
        title: "Sign-off",
        description: "Supervisor sign-off",
        order: 4,
        fields: [
          { fieldId: "form-tpl-004-s4-f1", fieldKey: "supervisor_name", label: "Supervisor name", fieldType: "text", order: 1, isRequired: true },
          { fieldId: "form-tpl-004-s4-f2", fieldKey: "supervisor_signature", label: "Signature", fieldType: "signature", order: 2, isRequired: true }
        ]
      }
    ],
    rules: [
      { ruleId: "form-tpl-004-r1", sourceFieldKey: "cylinders_taken", targetFieldKey: "cylinder_set_id", operator: "equals", comparisonValue: "true", effect: "SHOW" }
    ]
  });

  type PrestartSubmissionSeed = {
    id: string;
    jobId: "job-001" | "job-002";
    workerId: string;
    submitterUserId: string;
    siteId: string;
    daysAgo: number;
    supervisorName: string;
    workerName: string;
  };
  const prestartSubmissions: PrestartSubmissionSeed[] = [
    { id: "form-sub-001", jobId: "job-001", workerId: "worker-001", submitterUserId: supervisor001Id, siteId: "site-001", daysAgo: 1, supervisorName: "Dean Kowalski", workerName: "Ryan O'Brien" },
    { id: "form-sub-002", jobId: "job-001", workerId: "worker-009", submitterUserId: supervisor001Id, siteId: "site-001", daysAgo: 2, supervisorName: "Dean Kowalski", workerName: "Jack Sorensen" },
    { id: "form-sub-003", jobId: "job-001", workerId: "worker-004", submitterUserId: supervisor001Id, siteId: "site-001", daysAgo: 3, supervisorName: "Dean Kowalski", workerName: "Chloe Anderson" },
    { id: "form-sub-004", jobId: "job-002", workerId: "worker-006", submitterUserId: supervisor001Id, siteId: "site-003", daysAgo: 1, supervisorName: "Dean Kowalski", workerName: "Natasha Papadopoulos" },
    { id: "form-sub-005", jobId: "job-002", workerId: "worker-015", submitterUserId: supervisor001Id, siteId: "site-003", daysAgo: 2, supervisorName: "Dean Kowalski", workerName: "Raj Krishnamurthy" }
  ];

  await prisma.formSubmission.deleteMany({
    where: { id: { in: prestartSubmissions.map((s) => s.id) } }
  });
  for (const sub of prestartSubmissions) {
    await prisma.formSubmission.create({
      data: {
        id: sub.id,
        templateVersionId: prestart.templateVersionId,
        status: "SUBMITTED",
        submittedAt: daysAgo(sub.daysAgo),
        submittedById: sub.submitterUserId,
        jobId: sub.jobId,
        siteId: sub.siteId,
        workerId: sub.workerId,
        summary: `Daily prestart for ${sub.workerName}`,
        values: {
          create: [
            { fieldKey: "site_name", valueText: sub.jobId === "job-001" ? "Ipswich Motorway Corridor — Stage 4" : "Sandgate Stormwater Upgrade" },
            { fieldKey: "prestart_date", valueDateTime: daysAgo(sub.daysAgo) },
            { fieldKey: "supervisor_name", valueText: sub.supervisorName },
            { fieldKey: "weather_conditions", valueText: "Fine" },
            { fieldKey: "ppe_confirmed", valueText: "true" },
            { fieldKey: "swms_reviewed", valueText: "true" },
            { fieldKey: "hazard_assessment_complete", valueText: "true" },
            { fieldKey: "emergency_contacts_posted", valueText: "true" },
            { fieldKey: "plant_inspected", valueText: "true" },
            { fieldKey: "defects_identified", valueText: "false" },
            { fieldKey: "worker_name", valueText: sub.workerName },
            { fieldKey: "signature", valueText: "Signed" }
          ]
        },
        signatures: { create: [{ fieldKey: "signature", signerName: sub.workerName }] }
      }
    });
  }

  type PlantPrestartSubmissionSeed = {
    id: string;
    assetId: string;
    workerId: string;
    operatorName: string;
    daysAgo: number;
    hourMeter: number;
  };
  const plantSubmissions: PlantPrestartSubmissionSeed[] = [
    { id: "form-sub-006", assetId: "asset-001", workerId: "worker-002", operatorName: "Jasmine Nguyen", daysAgo: 1, hourMeter: 1245 },
    { id: "form-sub-007", assetId: "asset-002", workerId: "worker-002", operatorName: "Jasmine Nguyen", daysAgo: 2, hourMeter: 980 },
    { id: "form-sub-008", assetId: "asset-003", workerId: "worker-013", operatorName: "Daniel Ferreira", daysAgo: 3, hourMeter: 620 }
  ];

  await prisma.formSubmission.deleteMany({ where: { id: { in: plantSubmissions.map((s) => s.id) } } });
  for (const sub of plantSubmissions) {
    await prisma.formSubmission.create({
      data: {
        id: sub.id,
        templateVersionId: plantPrestart.templateVersionId,
        status: "SUBMITTED",
        submittedAt: daysAgo(sub.daysAgo),
        submittedById: supervisor001Id,
        assetId: sub.assetId,
        workerId: sub.workerId,
        summary: `Plant prestart for ${sub.assetId}`,
        values: {
          create: [
            { fieldKey: "asset_id", valueText: sub.assetId },
            { fieldKey: "operator_name", valueText: sub.operatorName },
            { fieldKey: "inspection_date", valueDateTime: daysAgo(sub.daysAgo) },
            { fieldKey: "hour_meter", valueNumber: new Prisma.Decimal(sub.hourMeter) },
            { fieldKey: "fluid_levels_ok", valueText: "true" },
            { fieldKey: "lights_signals_ok", valueText: "true" },
            { fieldKey: "tracks_tyres_ok", valueText: "true" },
            { fieldKey: "guards_covers_secure", valueText: "true" },
            { fieldKey: "engine_start_ok", valueText: "true" },
            { fieldKey: "controls_responsive", valueText: "true" },
            { fieldKey: "no_unusual_noises", valueText: "true" },
            { fieldKey: "operator_signature", valueText: "Signed" }
          ]
        },
        signatures: { create: [{ fieldKey: "operator_signature", signerName: sub.operatorName }] }
      }
    });
  }

  await prisma.formSubmission.deleteMany({ where: { id: "form-sub-009" } });
  await prisma.formSubmission.create({
    data: {
      id: "form-sub-009",
      templateVersionId: incidentReport.templateVersionId,
      status: "REVIEWED",
      submittedAt: daysAgo(6),
      submittedById: supervisor001Id,
      jobId: "job-001",
      siteId: "site-001",
      workerId: "worker-009",
      summary: "Rock encounter in Zone A cut",
      values: {
        create: [
          { fieldKey: "incident_datetime", valueDateTime: daysAgo(6) },
          { fieldKey: "incident_location", valueText: "Ipswich Motorway Stage 4 — Zone A cut, approx RL 42.3m" },
          { fieldKey: "incident_type", valueText: "Near Miss" },
          { fieldKey: "incident_description", valueText: "Excavator struck unexpected hard rock. No personnel injured. Bucket tooth damaged." },
          { fieldKey: "person_name", valueText: "Jasmine Nguyen" },
          { fieldKey: "person_role", valueText: "Plant Operator" },
          { fieldKey: "person_injured", valueText: "false" },
          { fieldKey: "area_made_safe", valueText: "true" },
          { fieldKey: "supervisor_notified", valueText: "true" },
          { fieldKey: "root_cause", valueText: "Geotechnical report did not flag hard rock at this RL — Class C assumption incorrect." },
          { fieldKey: "corrective_actions", valueText: "Commission revised geotechnical review; update programme and submit variation for rock ripping." },
          { fieldKey: "reported_by", valueText: "Jack Sorensen" },
          { fieldKey: "supervisor_signature", valueText: "Signed" }
        ]
      },
      signatures: { create: [{ fieldKey: "supervisor_signature", signerName: "Dean Kowalski" }] }
    }
  });

  // Voided reference to satisfy "unused variable" lint rule if strict.
  void concretePour;

  const sharepointSiteId = "project-operations-site";
  const sharepointDriveId = "project-operations-library";

  type DocumentSeed = {
    id: string;
    module: string;
    category: string;
    title: string;
    description?: string;
    linkedEntityType: "Job" | "Tender" | "Asset" | "Site";
    linkedEntityId: string;
    folderKey: string;
    folderRelativePath: string;
    fileKey: string;
    fileName: string;
    versionLabel: string;
    versionNumber: number;
    documentFamilyKey: string;
    secondaryEntity?: { type: string; id: string };
  };

  const documentSeeds: DocumentSeed[] = [
    { id: "doc-j001-contract", module: "jobs", category: "Contract", title: "Contract — Ipswich Motorway Stage 4.pdf", linkedEntityType: "Job", linkedEntityId: "job-001", folderKey: "is-folder-job-001", folderRelativePath: "Project Operations/Jobs/J-2025-001_ipswich-motorway-stage-4", fileKey: "is-file-j001-contract", fileName: "contract-ipswich-motorway-stage-4.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j001-contract", secondaryEntity: { type: "Tender", id: "tender-001" } },
    { id: "doc-j001-programme", module: "jobs", category: "Programme", title: "Programme — J-2025-001 Rev B.xlsx", linkedEntityType: "Job", linkedEntityId: "job-001", folderKey: "is-folder-job-001", folderRelativePath: "Project Operations/Jobs/J-2025-001_ipswich-motorway-stage-4", fileKey: "is-file-j001-programme", fileName: "programme-j-2025-001-rev-b.xlsx", versionLabel: "v2", versionNumber: 2, documentFamilyKey: "is-family-j001-programme" },
    { id: "doc-j001-semp", module: "jobs", category: "Environmental", title: "Site Environmental Management Plan.pdf", linkedEntityType: "Job", linkedEntityId: "job-001", folderKey: "is-folder-job-001", folderRelativePath: "Project Operations/Jobs/J-2025-001_ipswich-motorway-stage-4", fileKey: "is-file-j001-semp", fileName: "semp.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j001-semp", secondaryEntity: { type: "Site", id: "site-001" } },
    { id: "doc-j001-swms", module: "jobs", category: "SWMS", title: "SWMS — Earthworks and Excavation.pdf", linkedEntityType: "Job", linkedEntityId: "job-001", folderKey: "is-folder-job-001", folderRelativePath: "Project Operations/Jobs/J-2025-001_ipswich-motorway-stage-4", fileKey: "is-file-j001-swms", fileName: "swms-earthworks.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j001-swms" },
    { id: "doc-j001-geotech", module: "jobs", category: "Geotechnical", title: "Geotechnical Report — Darra to Wacol.pdf", linkedEntityType: "Job", linkedEntityId: "job-001", folderKey: "is-folder-job-001", folderRelativePath: "Project Operations/Jobs/J-2025-001_ipswich-motorway-stage-4", fileKey: "is-file-j001-geotech", fileName: "geotech-darra-wacol.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j001-geotech", secondaryEntity: { type: "Site", id: "site-001" } },
    { id: "doc-j002-contract", module: "jobs", category: "Contract", title: "Contract — Sandgate Stormwater Stage 1.pdf", linkedEntityType: "Job", linkedEntityId: "job-002", folderKey: "is-folder-job-002", folderRelativePath: "Project Operations/Jobs/J-2025-002_sandgate-stormwater-stage-1", fileKey: "is-file-j002-contract", fileName: "contract-sandgate-stormwater-stage-1.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j002-contract", secondaryEntity: { type: "Tender", id: "tender-003" } },
    { id: "doc-j002-programme", module: "jobs", category: "Programme", title: "Programme — J-2025-002 Rev A.xlsx", linkedEntityType: "Job", linkedEntityId: "job-002", folderKey: "is-folder-job-002", folderRelativePath: "Project Operations/Jobs/J-2025-002_sandgate-stormwater-stage-1", fileKey: "is-file-j002-programme", fileName: "programme-j-2025-002-rev-a.xlsx", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j002-programme" },
    { id: "doc-j002-swms", module: "jobs", category: "SWMS", title: "SWMS — Pipe Laying and Confined Space.pdf", linkedEntityType: "Job", linkedEntityId: "job-002", folderKey: "is-folder-job-002", folderRelativePath: "Project Operations/Jobs/J-2025-002_sandgate-stormwater-stage-1", fileKey: "is-file-j002-swms", fileName: "swms-pipe-laying.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j002-swms" },
    { id: "doc-j002-asbuilt", module: "jobs", category: "As-built", title: "As-built Drawings — Chainage 0-150m.pdf", linkedEntityType: "Job", linkedEntityId: "job-002", folderKey: "is-folder-job-002", folderRelativePath: "Project Operations/Jobs/J-2025-002_sandgate-stormwater-stage-1", fileKey: "is-file-j002-asbuilt", fileName: "asbuilt-ch-0-150.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-j002-asbuilt" },
    { id: "doc-t002-submission", module: "tendering", category: "Submission", title: "Tender Submission — Maroochydore Precinct.pdf", linkedEntityType: "Tender", linkedEntityId: "tender-002", folderKey: "is-folder-tender-002", folderRelativePath: "Project Operations/Tendering/IS-T002_maroochydore-precinct-civil-works", fileKey: "is-file-t002-submission", fileName: "tender-submission-maroochydore.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-t002-submission" },
    { id: "doc-t004-pricing", module: "tendering", category: "Pricing", title: "Pricing Schedule — Eagle Farm Hardstand.xlsx", linkedEntityType: "Tender", linkedEntityId: "tender-004", folderKey: "is-folder-tender-004", folderRelativePath: "Project Operations/Tendering/IS-T004_eagle-farm-hardstand", fileKey: "is-file-t004-pricing", fileName: "pricing-eagle-farm-hardstand.xlsx", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-t004-pricing" },
    { id: "doc-a001-registration", module: "assets", category: "Registration", title: "CAT 320 Registration Certificate.pdf", linkedEntityType: "Asset", linkedEntityId: "asset-001", folderKey: "is-folder-asset-001", folderRelativePath: "Project Operations/Assets/IS-A001_cat-320-excavator/Documents", fileKey: "is-file-a001-registration", fileName: "cat-320-registration.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-a001-registration" },
    { id: "doc-a001-service", module: "assets", category: "Maintenance", title: "CAT 320 Service Record.pdf", linkedEntityType: "Asset", linkedEntityId: "asset-001", folderKey: "is-folder-asset-001", folderRelativePath: "Project Operations/Assets/IS-A001_cat-320-excavator/Documents", fileKey: "is-file-a001-service", fileName: "cat-320-service-record.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-a001-service" },
    { id: "doc-a002-registration", module: "assets", category: "Registration", title: "Komatsu PC210 Registration Certificate.pdf", linkedEntityType: "Asset", linkedEntityId: "asset-002", folderKey: "is-folder-asset-002", folderRelativePath: "Project Operations/Assets/IS-A002_komatsu-pc210-excavator/Documents", fileKey: "is-file-a002-registration", fileName: "komatsu-pc210-registration.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-a002-registration" },
    { id: "doc-a005-calibration", module: "assets", category: "Calibration", title: "Schwing SP305 Calibration Certificate.pdf", linkedEntityType: "Asset", linkedEntityId: "asset-005", folderKey: "is-folder-asset-005", folderRelativePath: "Project Operations/Assets/IS-A005_schwing-sp305/Documents", fileKey: "is-file-a005-calibration", fileName: "schwing-sp305-calibration.pdf", versionLabel: "v1", versionNumber: 1, documentFamilyKey: "is-family-a005-calibration" }
  ];

  for (const seed of documentSeeds) {
    const folder = await prisma.sharePointFolderLink.upsert({
      where: { siteId_driveId_itemId: { siteId: sharepointSiteId, driveId: sharepointDriveId, itemId: seed.folderKey } },
      update: {
        name: seed.title,
        relativePath: seed.folderRelativePath,
        module: seed.module,
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId
      },
      create: {
        siteId: sharepointSiteId,
        driveId: sharepointDriveId,
        itemId: seed.folderKey,
        name: seed.title,
        relativePath: seed.folderRelativePath,
        module: seed.module,
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId
      }
    });

    const file = await prisma.sharePointFileLink.upsert({
      where: { siteId_driveId_itemId: { siteId: sharepointSiteId, driveId: sharepointDriveId, itemId: seed.fileKey } },
      update: {
        folderLinkId: folder.id,
        name: seed.fileName,
        relativePath: `${seed.folderRelativePath}/${seed.fileName}`,
        webUrl: `https://sharepoint.local/${seed.folderRelativePath}/${seed.fileName}`,
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId,
        versionLabel: seed.versionLabel,
        versionNumber: seed.versionNumber,
        mimeType: seed.fileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      },
      create: {
        siteId: sharepointSiteId,
        driveId: sharepointDriveId,
        itemId: seed.fileKey,
        folderLinkId: folder.id,
        name: seed.fileName,
        relativePath: `${seed.folderRelativePath}/${seed.fileName}`,
        webUrl: `https://sharepoint.local/${seed.folderRelativePath}/${seed.fileName}`,
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId,
        versionLabel: seed.versionLabel,
        versionNumber: seed.versionNumber,
        mimeType: seed.fileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }
    });

    await prisma.documentLink.upsert({
      where: { id: seed.id },
      update: {
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId,
        module: seed.module,
        category: seed.category,
        title: seed.title,
        description: seed.description ?? null,
        versionLabel: seed.versionLabel,
        versionNumber: seed.versionNumber,
        documentFamilyKey: seed.documentFamilyKey,
        isCurrentVersion: true,
        folderLinkId: folder.id,
        fileLinkId: file.id
      },
      create: {
        id: seed.id,
        linkedEntityType: seed.linkedEntityType,
        linkedEntityId: seed.linkedEntityId,
        module: seed.module,
        category: seed.category,
        title: seed.title,
        description: seed.description ?? null,
        versionLabel: seed.versionLabel,
        versionNumber: seed.versionNumber,
        documentFamilyKey: seed.documentFamilyKey,
        isCurrentVersion: true,
        folderLinkId: folder.id,
        fileLinkId: file.id
      }
    });

    if (seed.secondaryEntity) {
      const secondaryId = `${seed.id}-secondary`;
      await prisma.documentLink.upsert({
        where: { id: secondaryId },
        update: {
          linkedEntityType: seed.secondaryEntity.type,
          linkedEntityId: seed.secondaryEntity.id,
          module: seed.module,
          category: seed.category,
          title: seed.title,
          description: `Cross-linked to primary document ${seed.id}.`,
          versionLabel: seed.versionLabel,
          versionNumber: seed.versionNumber,
          documentFamilyKey: seed.documentFamilyKey,
          isCurrentVersion: true,
          folderLinkId: folder.id,
          fileLinkId: file.id
        },
        create: {
          id: secondaryId,
          linkedEntityType: seed.secondaryEntity.type,
          linkedEntityId: seed.secondaryEntity.id,
          module: seed.module,
          category: seed.category,
          title: seed.title,
          description: `Cross-linked to primary document ${seed.id}.`,
          versionLabel: seed.versionLabel,
          versionNumber: seed.versionNumber,
          documentFamilyKey: seed.documentFamilyKey,
          isCurrentVersion: true,
          folderLinkId: folder.id,
          fileLinkId: file.id
        }
      });
    }
  }

  const adminDashboardId = "seed-admin-dashboard";
  const adminDashboard = await prisma.dashboard.findUnique({ where: { id: adminDashboardId } });
  if (adminDashboard) {
    await prisma.dashboardWidget.deleteMany({ where: { dashboardId: adminDashboard.id } });
    await prisma.dashboardWidget.createMany({
      data: [
        {
          dashboardId: adminDashboard.id,
          type: "kpi",
          title: "Active jobs",
          description: "Jobs currently in ACTIVE status",
          position: 0,
          width: 1,
          height: 1,
          config: { metric: "jobs.active", value: 2, trend: "flat" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "kpi",
          title: "Tender pipeline value",
          description: "Sum of In Progress + Submitted tender value",
          position: 1,
          width: 1,
          height: 1,
          config: { metric: "tenders.pipelineValue", value: "$7,240,000", trend: "up", trendValue: "+12% vs last quarter" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "kpi",
          title: "Open issues",
          description: "Open job issues",
          position: 2,
          width: 1,
          height: 1,
          config: { metric: "jobs.issuesOpen", value: 3, trend: "up", colour: "warning" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "kpi",
          title: "Upcoming maintenance",
          description: "Assets due within 30 days",
          position: 3,
          width: 1,
          height: 1,
          config: { metric: "maintenance.dueSoon", value: 3, trend: "flat" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "donut_chart",
          title: "Jobs by status",
          description: "Active, awarded, completed",
          position: 4,
          width: 2,
          height: 1,
          config: { chart: "jobs.byStatus", data: [{ label: "Active", value: 2 }, { label: "Awarded", value: 0 }, { label: "Completed", value: 0 }] }
        },
        {
          dashboardId: adminDashboard.id,
          type: "donut_chart",
          title: "Tender pipeline by stage",
          description: "Tender status mix",
          position: 5,
          width: 2,
          height: 1,
          config: { chart: "tenders.byStage", data: [{ label: "Identified", value: 1 }, { label: "In Progress", value: 2 }, { label: "Submitted", value: 1 }, { label: "Awarded", value: 2 }, { label: "Lost", value: 1 }, { label: "Withdrawn", value: 1 }] }
        },
        {
          dashboardId: adminDashboard.id,
          type: "line_chart",
          title: "Monthly revenue (last 6 months)",
          description: "Derived from tender awarded dates and contract values",
          position: 6,
          width: 2,
          height: 1,
          config: { chart: "revenue.monthly", source: "tenders.awarded" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "bar_chart",
          title: "Form submissions by week (last 6 weeks)",
          description: "Derived from submission seed data",
          position: 7,
          width: 2,
          height: 1,
          config: { chart: "forms.byWeek", source: "formSubmissions" }
        },
        {
          dashboardId: adminDashboard.id,
          type: "bar_chart",
          title: "Upcoming maintenance by asset (next 30 days)",
          description: "Assets with upcoming or overdue maintenance",
          position: 8,
          width: 2,
          height: 1,
          config: {
            chart: "maintenance.upcoming",
            data: [
              { label: "asset-001", value: 15 },
              { label: "asset-002", value: 30 },
              { label: "asset-003", value: -5 },
              { label: "asset-013", value: -7 }
            ]
          }
        }
      ]
    });
  }

  // Search-entry registry for the Cmd/Ctrl+K palette (7.15).
  type SearchEntrySeed = {
    entityType: string;
    entityId: string;
    title: string;
    subtitle: string;
    module: string;
    url: string;
  };
  const searchSeeds: SearchEntrySeed[] = [
    ...tenderSeeds.map((tender) => ({
      entityType: "Tender",
      entityId: tender.id,
      title: `${tender.tenderNumber} — ${tender.title}`,
      subtitle: `${tender.status} · $${tender.estimatedValue}`,
      module: "tendering",
      url: `/tenders?highlight=${tender.id}`
    })),
    ...clientSeeds.map((client) => ({
      entityType: "Client",
      entityId: client.id,
      title: client.name,
      subtitle: `${client.type} · ${client.industry}`,
      module: "masterdata",
      url: `/master-data?tab=clients&highlight=${client.id}`
    })),
    ...workerSeeds.map((worker) => ({
      entityType: "Worker",
      entityId: worker.id,
      title: `${worker.firstName} ${worker.lastName}`,
      subtitle: `${worker.role}${worker.status === "ON_LEAVE" ? " · On leave" : ""}`,
      module: "resources",
      url: `/resources?highlight=${worker.id}`
    })),
    ...assetSeeds.map((asset) => ({
      entityType: "Asset",
      entityId: asset.id,
      title: asset.name,
      subtitle: `${asset.assetCode} · ${asset.homeBase}`,
      module: "assets",
      url: `/assets?highlight=${asset.id}`
    })),
    {
      entityType: "FormTemplate",
      entityId: "form-tpl-001",
      title: "Daily Prestart Checklist",
      subtitle: "IS-FORM-001-PRESTART · v1",
      module: "forms",
      url: "/forms?highlight=form-tpl-001"
    },
    {
      entityType: "FormTemplate",
      entityId: "form-tpl-002",
      title: "Plant Pre-Start Inspection",
      subtitle: "IS-FORM-002-PLANT-PRESTART · v1",
      module: "forms",
      url: "/forms?highlight=form-tpl-002"
    },
    {
      entityType: "FormTemplate",
      entityId: "form-tpl-003",
      title: "Incident / Near Miss Report",
      subtitle: "IS-FORM-003-INCIDENT · v1",
      module: "forms",
      url: "/forms?highlight=form-tpl-003"
    },
    {
      entityType: "FormTemplate",
      entityId: "form-tpl-004",
      title: "Concrete Pour Record",
      subtitle: "IS-FORM-004-CONCRETE-POUR · v1",
      module: "forms",
      url: "/forms?highlight=form-tpl-004"
    },
    ...jobSeeds.map((job) => ({
      entityType: "Job",
      entityId: job.id,
      title: `${job.jobNumber} — ${job.name}`,
      subtitle: job.description,
      module: "jobs",
      url: `/jobs?highlight=${job.id}`
    }))
  ];

  for (const seed of searchSeeds) {
    const id = `${seed.entityType}:${seed.entityId}`;
    await prisma.searchEntry.upsert({
      where: { id },
      update: {
        entityType: seed.entityType,
        entityId: seed.entityId,
        title: seed.title,
        subtitle: seed.subtitle,
        module: seed.module,
        url: seed.url
      },
      create: {
        id,
        entityType: seed.entityType,
        entityId: seed.entityId,
        title: seed.title,
        subtitle: seed.subtitle,
        module: seed.module,
        url: seed.url
      }
    });
  }
}

export async function seedEstimateRates(prisma: PrismaClient): Promise<void> {
  type LabourRow = { role: string; dayRate: string; nightRate: string; weekendRate: string };
  const labour: LabourRow[] = [
    { role: "Demolition labourer", dayRate: "600.00", nightRate: "1000.00", weekendRate: "900.00" },
    { role: "Demolition supervisor", dayRate: "600.00", nightRate: "1000.00", weekendRate: "900.00" },
    { role: "Asbestos labourer", dayRate: "600.00", nightRate: "1000.00", weekendRate: "900.00" },
    { role: "Asbestos supervisor", dayRate: "600.00", nightRate: "1000.00", weekendRate: "900.00" },
    { role: "Machine operator", dayRate: "600.00", nightRate: "1000.00", weekendRate: "900.00" },
    { role: "Project manager", dayRate: "850.00", nightRate: "1400.00", weekendRate: "1200.00" },
    { role: "Senior supervisor", dayRate: "850.00", nightRate: "1400.00", weekendRate: "1200.00" }
  ];
  for (const [index, row] of labour.entries()) {
    await prisma.estimateLabourRate.upsert({
      where: { role: row.role },
      update: {
        dayRate: new Prisma.Decimal(row.dayRate),
        nightRate: new Prisma.Decimal(row.nightRate),
        weekendRate: new Prisma.Decimal(row.weekendRate),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        role: row.role,
        dayRate: new Prisma.Decimal(row.dayRate),
        nightRate: new Prisma.Decimal(row.nightRate),
        weekendRate: new Prisma.Decimal(row.weekendRate),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }

  type PlantRow = { item: string; unit: string; rate: string; fuelRate?: string };
  const plant: PlantRow[] = [
    { item: "Excavator 16T-25T (wet hire)", unit: "day", rate: "1500.00" },
    { item: "Excavator 01T-03T (dry hire)", unit: "day", rate: "327.75" },
    { item: "Bobcat", unit: "day", rate: "1000.00" },
    { item: "Franna 14T", unit: "day", rate: "3500.00" },
    { item: "Hook truck (10T concrete / 5T C&D)", unit: "day", rate: "1250.00" },
    { item: "Semi tipper (20T concrete / 10T C&D)", unit: "day", rate: "1750.00" },
    { item: "Plant float — over 13T", unit: "each way", rate: "1035.00" },
    { item: "Plant float — under 13T", unit: "each way", rate: "402.50" },
    { item: "Robot excavator", unit: "day", rate: "4000.00" },
    { item: "Attachment 16T-25T", unit: "day", rate: "281.00" }
  ];
  for (const [index, row] of plant.entries()) {
    await prisma.estimatePlantRate.upsert({
      where: { item: row.item },
      update: {
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        fuelRate: new Prisma.Decimal(row.fuelRate ?? "0"),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        item: row.item,
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        fuelRate: new Prisma.Decimal(row.fuelRate ?? "0"),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }

  type WasteRow = {
    wasteType: string;
    facility: string;
    wasteGroup: string;
    unit: string;
    tonRate: string;
    loadRate?: string;
  };
  const waste: WasteRow[] = [
    // Alex Fraser (m³ rates)
    { facility: "Alex Fraser", wasteType: "Asphalt — clean", wasteGroup: "Asphalt", unit: "m³", tonRate: "10.00" },
    { facility: "Alex Fraser", wasteType: "Concrete/Brick — mixed", wasteGroup: "Rubble", unit: "m³", tonRate: "28.00" },
    { facility: "Alex Fraser", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "m³", tonRate: "14.00" },
    { facility: "Alex Fraser", wasteType: "Rock — clean", wasteGroup: "Soil", unit: "m³", tonRate: "22.00" },
    // BMI Acacia Ridge (tonne rates)
    { facility: "BMI Acacia Ridge", wasteType: "C&D — general", wasteGroup: "General waste", unit: "tonne", tonRate: "216.00" },
    { facility: "BMI Acacia Ridge", wasteType: "C&D — non-recyclable", wasteGroup: "General waste", unit: "tonne", tonRate: "256.00" },
    { facility: "BMI Acacia Ridge", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "tonne", tonRate: "18.00", loadRate: "360.00" },
    { facility: "BMI Acacia Ridge", wasteType: "Concrete — dirty", wasteGroup: "Rubble", unit: "tonne", tonRate: "32.00" },
    { facility: "BMI Acacia Ridge", wasteType: "Fill — clean", wasteGroup: "Soil", unit: "tonne", tonRate: "43.00" },
    { facility: "BMI Acacia Ridge", wasteType: "Plasterboard", wasteGroup: "General waste", unit: "tonne", tonRate: "90.00" },
    // BMI Stapylton (hazmat)
    { facility: "BMI Stapylton", wasteType: "Asbestos — Levy Applicable", wasteGroup: "Hazmat", unit: "tonne", tonRate: "360.00" },
    { facility: "BMI Stapylton", wasteType: "Asbestos — Levy Exempt", wasteGroup: "Hazmat", unit: "tonne", tonRate: "218.00" },
    { facility: "BMI Stapylton", wasteType: "Asbestos in C&D — NF Levy Applicable", wasteGroup: "Hazmat", unit: "tonne", tonRate: "400.00" },
    { facility: "BMI Stapylton", wasteType: "Asbestos in C&D — Friable Levy Exempt", wasteGroup: "Hazmat", unit: "tonne", tonRate: "278.00" },
    // BMI Hendra
    { facility: "BMI Hendra", wasteType: "C&D — general", wasteGroup: "General waste", unit: "tonne", tonRate: "222.00" },
    { facility: "BMI Hendra", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "tonne", tonRate: "70.00" },
    // Rowcon (Bells Creek)
    { facility: "Rowcon (Bells Creek)", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "tonne", tonRate: "4.50" },
    { facility: "Rowcon (Bells Creek)", wasteType: "C&D — general", wasteGroup: "General waste", unit: "tonne", tonRate: "263.00" },
    { facility: "Rowcon (Bells Creek)", wasteType: "Asphalt — clean", wasteGroup: "Asphalt", unit: "tonne", tonRate: "4.50" },
    // Cleanaway
    { facility: "Cleanaway", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "tonne", tonRate: "38.00" },
    // Moreton Bay Recycling (m³ rates)
    { facility: "Moreton Bay Recycling", wasteType: "Concrete — clean", wasteGroup: "Rubble", unit: "m³", tonRate: "16.00" },
    { facility: "Moreton Bay Recycling", wasteType: "Concrete — dirty", wasteGroup: "Rubble", unit: "m³", tonRate: "25.00" },
    // Council green waste
    { facility: "Sunshine Coast Council", wasteType: "Green waste", wasteGroup: "Vegetation", unit: "tonne", tonRate: "63.00" }
  ];
  for (const [index, row] of waste.entries()) {
    await prisma.estimateWasteRate.upsert({
      where: { wasteType_facility: { wasteType: row.wasteType, facility: row.facility } },
      update: {
        wasteGroup: row.wasteGroup,
        unit: row.unit,
        tonRate: new Prisma.Decimal(row.tonRate),
        loadRate: new Prisma.Decimal(row.loadRate ?? "0"),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        wasteType: row.wasteType,
        facility: row.facility,
        wasteGroup: row.wasteGroup,
        unit: row.unit,
        tonRate: new Prisma.Decimal(row.tonRate),
        loadRate: new Prisma.Decimal(row.loadRate ?? "0"),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }

  // Cutrite rates — full matrix from IS spreadsheet. Elevation stored as "Floor" for
  // the base rate; Wall/Inverted multipliers applied client-side.
  type CuttingRow = {
    equipment: string;
    elevation: string;
    material: string;
    depthMm: number;
    ratePerM: string;
  };
  const cutting: CuttingRow[] = [
    // Roadsaw — Asphalt (Floor)
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 50, ratePerM: "4.30" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 75, ratePerM: "6.00" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 100, ratePerM: "8.00" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 125, ratePerM: "9.40" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 150, ratePerM: "12.60" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 175, ratePerM: "14.25" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 200, ratePerM: "16.50" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 225, ratePerM: "18.50" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 250, ratePerM: "21.10" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 275, ratePerM: "23.85" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 300, ratePerM: "27.25" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 325, ratePerM: "31.75" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 350, ratePerM: "35.90" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 375, ratePerM: "37.20" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 400, ratePerM: "41.35" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 450, ratePerM: "70.21" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Asphalt", depthMm: 500, ratePerM: "78.03" },
    // Roadsaw — Concrete (Floor)
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 50, ratePerM: "4.85" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 75, ratePerM: "8.40" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 100, ratePerM: "11.10" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 125, ratePerM: "13.70" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 150, ratePerM: "14.30" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 175, ratePerM: "16.40" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 200, ratePerM: "18.95" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 225, ratePerM: "21.40" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 250, ratePerM: "25.55" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 275, ratePerM: "30.70" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 300, ratePerM: "39.35" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 325, ratePerM: "42.15" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 350, ratePerM: "51.30" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 375, ratePerM: "54.35" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 400, ratePerM: "58.70" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 450, ratePerM: "82.60" },
    { equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 500, ratePerM: "91.80" },
    // Demosaw — Any (Floor)
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 25, ratePerM: "7.55" },
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 50, ratePerM: "10.90" },
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 75, ratePerM: "15.35" },
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 100, ratePerM: "22.25" },
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 125, ratePerM: "24.70" },
    { equipment: "Demosaw", elevation: "Floor", material: "Any", depthMm: 150, ratePerM: "28.40" },
    // Demosaw — Brick/Block (Wall)
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 25, ratePerM: "7.90" },
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 50, ratePerM: "13.95" },
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 75, ratePerM: "21.40" },
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 100, ratePerM: "26.80" },
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 125, ratePerM: "34.55" },
    { equipment: "Demosaw", elevation: "Wall", material: "Brick/Block", depthMm: 150, ratePerM: "43.10" },
    // Demosaw — Concrete (Wall)
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 25, ratePerM: "9.95" },
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 50, ratePerM: "17.00" },
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 75, ratePerM: "23.60" },
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 100, ratePerM: "31.70" },
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 125, ratePerM: "39.75" },
    { equipment: "Demosaw", elevation: "Wall", material: "Concrete", depthMm: 150, ratePerM: "48.60" },
    // Ringsaw — Any/Any
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 175, ratePerM: "71.30" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 200, ratePerM: "84.25" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 225, ratePerM: "96.10" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 250, ratePerM: "108.00" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 275, ratePerM: "117.70" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 300, ratePerM: "126.35" },
    { equipment: "Ringsaw", elevation: "Any", material: "Any", depthMm: 320, ratePerM: "141.50" },
    // Flush-cut
    { equipment: "Flush-cut", elevation: "Any", material: "Any", depthMm: 25, ratePerM: "18.00" },
    // Tracksaw
    { equipment: "Tracksaw", elevation: "Any", material: "Any", depthMm: 25, ratePerM: "18.00" }
  ];

  // Cleanup — Roadsaw is Floor-only. If any prior seed added Roadsaw rows
  // for Wall/Any/Inverted, drop them so the rate resolver doesn't match.
  await prisma.estimateCuttingRate.deleteMany({
    where: {
      equipment: "Roadsaw",
      elevation: { notIn: ["Floor"] }
    }
  });

  for (const [index, row] of cutting.entries()) {
    await prisma.estimateCuttingRate.upsert({
      where: {
        equipment_elevation_material_depthMm: {
          equipment: row.equipment,
          elevation: row.elevation,
          material: row.material,
          depthMm: row.depthMm
        }
      },
      update: {
        ratePerM: new Prisma.Decimal(row.ratePerM),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        equipment: row.equipment,
        elevation: row.elevation,
        material: row.material,
        depthMm: row.depthMm,
        ratePerM: new Prisma.Decimal(row.ratePerM),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }

  // Core hole rates ($/hole by diameter)
  type CoreHoleRow = { diameterMm: number; ratePerHole: string };
  const coreHoles: CoreHoleRow[] = [
    { diameterMm: 32, ratePerHole: "1.70" },
    { diameterMm: 50, ratePerHole: "2.05" },
    { diameterMm: 75, ratePerHole: "2.30" },
    { diameterMm: 100, ratePerHole: "2.55" },
    { diameterMm: 125, ratePerHole: "2.75" },
    { diameterMm: 150, ratePerHole: "3.20" },
    { diameterMm: 175, ratePerHole: "3.95" },
    { diameterMm: 200, ratePerHole: "4.85" },
    { diameterMm: 225, ratePerHole: "5.45" },
    { diameterMm: 250, ratePerHole: "6.95" },
    { diameterMm: 275, ratePerHole: "9.40" },
    { diameterMm: 300, ratePerHole: "10.90" },
    { diameterMm: 350, ratePerHole: "12.90" },
    { diameterMm: 375, ratePerHole: "14.50" },
    { diameterMm: 400, ratePerHole: "17.90" },
    { diameterMm: 450, ratePerHole: "23.75" },
    { diameterMm: 500, ratePerHole: "29.15" },
    { diameterMm: 550, ratePerHole: "34.55" },
    { diameterMm: 600, ratePerHole: "41.00" },
    { diameterMm: 650, ratePerHole: "49.70" }
  ];
  for (const row of coreHoles) {
    await prisma.estimateCoreHoleRate.upsert({
      where: { diameterMm: row.diameterMm },
      update: {
        ratePerHole: new Prisma.Decimal(row.ratePerHole),
        isActive: true
      },
      create: {
        diameterMm: row.diameterMm,
        ratePerHole: new Prisma.Decimal(row.ratePerHole),
        isActive: true
      }
    });
  }

  // Cutting "Other" rates (flat-rate catalogue) — 01/04/2026 Cutrite list.
  type OtherRateRow = { description: string; unit: string; rate: string; sortOrder: number };
  const otherRates: OtherRateRow[] = [
    { description: "Establishment fee (BNE up to 80km)", unit: "per visit", rate: "120.00", sortOrder: 1 },
    { description: "Establishment fee (Toowoomba/Sunshine Coast)", unit: "per visit", rate: "680.00", sortOrder: 2 },
    { description: "Wet vacuum", unit: "p/day", rate: "65.00", sortOrder: 3 },
    { description: "HEPA vac", unit: "p/day", rate: "100.00", sortOrder: 4 },
    { description: "Extra man", unit: "p/hr", rate: "135.00", sortOrder: 5 },
    { description: "Stand-down time", unit: "p/hr", rate: "125.00", sortOrder: 6 },
    { description: "Clean-up time", unit: "p/hr/man", rate: "135.00", sortOrder: 7 },
    { description: "Set-out time", unit: "p/hr/man", rate: "135.00", sortOrder: 8 },
    { description: "Relocation", unit: "each", rate: "45.00", sortOrder: 9 },
    { description: "GPR Concrete scanning", unit: "p/hr (min 2hrs)", rate: "225.00", sortOrder: 10 },
    { description: "GPR Concrete scan report", unit: "each", rate: "120.00", sortOrder: 11 },
    { description: "Minimum weekday charge", unit: "per visit", rate: "360.00", sortOrder: 12 },
    { description: "Minimum night charge", unit: "per visit", rate: "1900.00", sortOrder: 13 },
    { description: "Stand-down night", unit: "per visit", rate: "990.00", sortOrder: 14 },
    { description: "Minimum Saturday charge", unit: "per visit", rate: "1200.00", sortOrder: 15 },
    { description: "Minimum Sunday charge", unit: "per visit", rate: "1900.00", sortOrder: 16 },
    { description: "Mini mobile scaffold", unit: "per visit", rate: "170.00", sortOrder: 17 },
    { description: "Jack hammer hire", unit: "per visit", rate: "90.00", sortOrder: 18 },
    { description: "Jack hammer labour", unit: "p/hr", rate: "150.00", sortOrder: 19 },
    { description: "Grinding/scabbling", unit: "p/hr", rate: "165.00", sortOrder: 20 },
    { description: "3-phase grinding/scabbling", unit: "p/hr", rate: "260.00", sortOrder: 21 },
    { description: "Generator 8KVA", unit: "p/day", rate: "110.00", sortOrder: 22 },
    { description: "Generator 12.5KVA", unit: "p/day", rate: "125.00", sortOrder: 23 },
    { description: "Water tank", unit: "per visit", rate: "120.00", sortOrder: 24 },
    { description: "Water/recycling slurry truck", unit: "p/day + disposal", rate: "160.00", sortOrder: 25 },
    { description: "Water/recycling slurry ICB", unit: "p/day + disposal", rate: "85.00", sortOrder: 26 },
    { description: "Excess steel", unit: "per 6mm bar diameter", rate: "3.20", sortOrder: 27 },
    { description: "Overtime hourly charge beyond minimum", unit: "p/hr/man (min 4hrs)", rate: "75.00", sortOrder: 28 }
  ];
  // Upsert by description (unique enough for this small admin list).
  // Existing rows update their rate/unit/sortOrder; missing rows are added.
  for (const row of otherRates) {
    const existing = await prisma.cuttingOtherRate.findFirst({
      where: { description: row.description }
    });
    if (existing) {
      await prisma.cuttingOtherRate.update({
        where: { id: existing.id },
        data: {
          unit: row.unit,
          rate: new Prisma.Decimal(row.rate),
          sortOrder: row.sortOrder,
          isActive: true
        }
      });
    } else {
      await prisma.cuttingOtherRate.create({
        data: {
          description: row.description,
          unit: row.unit,
          rate: new Prisma.Decimal(row.rate),
          sortOrder: row.sortOrder,
          isActive: true
        }
      });
    }
  }

  type FuelRow = { item: string; unit: string; rate: string };
  const fuel: FuelRow[] = [
    { item: "Diesel fuel adjustment", unit: "L", rate: "2.05" }
  ];
  for (const [index, row] of fuel.entries()) {
    await prisma.estimateFuelRate.upsert({
      where: { item: row.item },
      update: {
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        item: row.item,
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }

  type EnclosureRow = { enclosureType: string; unit: string; rate: string };
  const enclosures: EnclosureRow[] = [
    { enclosureType: "ACM enclosure (Class A, friable)", unit: "m²", rate: "185.00" },
    { enclosureType: "ACM enclosure (Class B, non-friable)", unit: "m²", rate: "95.00" },
    { enclosureType: "Air monitoring", unit: "day", rate: "540.00" },
    { enclosureType: "Clearance certificate", unit: "ea", rate: "850.00" }
  ];
  for (const [index, row] of enclosures.entries()) {
    await prisma.estimateEnclosureRate.upsert({
      where: { enclosureType: row.enclosureType },
      update: {
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        isActive: true,
        sortOrder: index + 1
      },
      create: {
        enclosureType: row.enclosureType,
        unit: row.unit,
        rate: new Prisma.Decimal(row.rate),
        isActive: true,
        sortOrder: index + 1
      }
    });
  }
}

export async function seedBusinessDirectoryDemos(prisma: PrismaClient): Promise<void> {
  const admin = await prisma.user.findUnique({ where: { email: "admin@projectops.local" } });
  if (!admin) return;

  const demos: Array<{
    id: string;
    name: string;
    categories: string[];
    entityType: "subcontractor" | "supplier" | "both";
    abn?: string;
    prequalStatus: "approved" | "pending" | "suspended" | "rejected";
    physicalSuburb?: string;
    physicalState?: string;
  }> = [
    {
      id: "sub-cutrite",
      name: "Cutrite Concrete Sawing",
      categories: ["Concrete Cutting"],
      entityType: "supplier",
      abn: "50 155 464 985",
      prequalStatus: "approved",
      physicalSuburb: "Yatala",
      physicalState: "QLD"
    },
    {
      id: "sub-swanbank-waste",
      name: "Swanbank Waste",
      categories: ["Waste Facilities"],
      entityType: "supplier",
      prequalStatus: "approved",
      physicalSuburb: "Swanbank",
      physicalState: "QLD"
    },
    {
      id: "sub-bmi-waste",
      name: "BMI Waste",
      categories: ["Waste Facilities"],
      entityType: "supplier",
      prequalStatus: "approved",
      physicalSuburb: "Ipswich",
      physicalState: "QLD"
    },
    {
      id: "sub-generic-labour-hire",
      name: "Generic Labour Hire Co",
      categories: ["Labour Hire"],
      entityType: "subcontractor",
      prequalStatus: "pending",
      physicalSuburb: "Brisbane",
      physicalState: "QLD"
    }
  ];

  for (const d of demos) {
    await prisma.subcontractorSupplier.upsert({
      where: { id: d.id },
      update: {
        name: d.name,
        categories: d.categories,
        entityType: d.entityType,
        abn: d.abn ?? null,
        prequalStatus: d.prequalStatus,
        physicalSuburb: d.physicalSuburb ?? null,
        physicalState: d.physicalState ?? "QLD"
      },
      create: {
        id: d.id,
        name: d.name,
        categories: d.categories,
        entityType: d.entityType,
        abn: d.abn ?? null,
        prequalStatus: d.prequalStatus,
        physicalSuburb: d.physicalSuburb ?? null,
        physicalState: d.physicalState ?? "QLD",
        createdById: admin.id
      }
    });
  }

  // Demo primary contacts so the polymorphic /contacts list has SUBCONTRACTOR
  // rows out of the box. Fields match the spec from PR #78.
  const contactSeeds: Array<{
    id: string;
    subId: string;
    firstName: string;
    lastName: string;
    role: string;
    phone?: string;
    email?: string;
  }> = [
    {
      id: "sub-contact-cutrite-001",
      subId: "sub-cutrite",
      firstName: "Sales",
      lastName: "Team",
      role: "Sales & Estimating",
      email: "sales@cutrite.net.au",
      phone: "07 3390 2155"
    },
    {
      id: "sub-contact-swanbank-001",
      subId: "sub-swanbank-waste",
      firstName: "Dispatch",
      lastName: "Team",
      role: "Waste disposal booking",
      phone: "07 3464 3700"
    },
    {
      id: "sub-contact-bmi-001",
      subId: "sub-bmi-waste",
      firstName: "BMI",
      lastName: "Acacia Ridge",
      role: "Waste disposal booking",
      phone: "07 3272 1122"
    },
    {
      id: "sub-contact-labour-001",
      subId: "sub-generic-labour-hire",
      firstName: "Account",
      lastName: "Manager",
      role: "Labour hire coordinator"
    }
  ];

  for (const c of contactSeeds) {
    await prisma.contact.upsert({
      where: { id: c.id },
      update: {
        organisationType: "SUBCONTRACTOR",
        organisationId: c.subId,
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        phone: c.phone ?? null,
        email: c.email ?? null,
        isPrimary: true,
        isActive: true
      },
      create: {
        id: c.id,
        organisationType: "SUBCONTRACTOR",
        organisationId: c.subId,
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        phone: c.phone ?? null,
        email: c.email ?? null,
        isPrimary: true,
        createdById: admin.id
      }
    });
  }

  // ─── Demo compliance data (PR #79) ────────────────────────────────────
  // Relative dates so the demo always looks current. All upserts → idempotent.
  const today = new Date();
  const inDays = (n: number): Date => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  const licenceSeeds: Array<{
    id: string;
    subcontractorId: string;
    licenceType: string;
    licenceNumber: string;
    issuingAuthority: string;
    expiryDate: Date;
  }> = [
    {
      id: "lic-cutrite-qbcc",
      subcontractorId: "sub-cutrite",
      licenceType: "qbcc",
      licenceNumber: "QBCC-12345",
      issuingAuthority: "QBCC",
      expiryDate: inDays(45)
    },
    {
      id: "lic-swanbank-waste",
      subcontractorId: "sub-swanbank-waste",
      licenceType: "waste_transport",
      licenceNumber: "EPA-WT-5678",
      issuingAuthority: "QLD EPA",
      expiryDate: inDays(-5) // already expired — drives auto-block demo
    }
  ];
  for (const l of licenceSeeds) {
    await prisma.entityLicence.upsert({
      where: { id: l.id },
      update: {
        licenceType: l.licenceType,
        licenceNumber: l.licenceNumber,
        issuingAuthority: l.issuingAuthority,
        expiryDate: l.expiryDate,
        subcontractorId: l.subcontractorId
      },
      create: {
        id: l.id,
        licenceType: l.licenceType,
        licenceNumber: l.licenceNumber,
        issuingAuthority: l.issuingAuthority,
        expiryDate: l.expiryDate,
        subcontractorId: l.subcontractorId
      }
    });
  }

  await prisma.entityInsurance.upsert({
    where: { id: "ins-cutrite-pl" },
    update: {
      insuranceType: "public_liability",
      insurerName: "QBE Insurance",
      policyNumber: "QBE-2026-001",
      coverageAmount: 20000000,
      expiryDate: inDays(15),
      subcontractorId: "sub-cutrite"
    },
    create: {
      id: "ins-cutrite-pl",
      insuranceType: "public_liability",
      insurerName: "QBE Insurance",
      policyNumber: "QBE-2026-001",
      coverageAmount: 20000000,
      expiryDate: inDays(15),
      subcontractorId: "sub-cutrite"
    }
  });

  // Worker qualifications keyed off the stable WorkerProfile IDs seeded
  // earlier in this file. Raj = wp-user-estimator, Marco = wp-user-supervisor-001.
  const qualSeeds: Array<{
    id: string;
    workerProfileId: string;
    qualType: string;
    licenceNumber: string;
    expiryDate: Date | null;
  }> = [
    {
      id: "qual-raj-whitecard",
      workerProfileId: "wp-user-estimator",
      qualType: "white_card",
      licenceNumber: "QLD-WC-001",
      expiryDate: null
    },
    {
      id: "qual-raj-asbestos-b",
      workerProfileId: "wp-user-estimator",
      qualType: "asbestos_b",
      licenceNumber: "ASB-B-2024-001",
      expiryDate: inDays(20)
    },
    {
      id: "qual-marco-asbestos-a",
      workerProfileId: "wp-user-supervisor-001",
      qualType: "asbestos_a",
      licenceNumber: "ASB-A-2024-001",
      expiryDate: inDays(180)
    },
    {
      id: "qual-marco-firstaid",
      workerProfileId: "wp-user-supervisor-001",
      qualType: "first_aid",
      licenceNumber: "FA-2024-001",
      expiryDate: inDays(10)
    }
  ];
  for (const q of qualSeeds) {
    await prisma.workerQualification.upsert({
      where: { id: q.id },
      update: {
        qualType: q.qualType,
        licenceNumber: q.licenceNumber,
        expiryDate: q.expiryDate,
        workerProfileId: q.workerProfileId
      },
      create: {
        id: q.id,
        qualType: q.qualType,
        licenceNumber: q.licenceNumber,
        expiryDate: q.expiryDate,
        workerProfileId: q.workerProfileId,
        createdById: admin.id
      }
    });
  }
}
