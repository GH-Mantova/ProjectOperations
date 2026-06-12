import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

// salt:derivedKey shape matches PasswordService, but the "derived key" is
// random bytes — no password can scrypt to it, so local login is impossible.
function unusablePasswordHash(): string {
  return `${randomBytes(16).toString("hex")}:${randomBytes(64).toString("hex")}`;
}

// Guard for prod provisioning: dev seed users (@projectops.local) in the
// target DB mean this is a dev/demo database, not a fresh production one.
export async function assertNoDevSeedUsers(prisma: PrismaClient): Promise<void> {
  const devUsers = await prisma.user.findMany({
    where: { email: { endsWith: "@projectops.local" } },
    select: { email: true }
  });
  if (devUsers.length > 0) {
    console.error("=".repeat(72));
    console.error("seed:prod REFUSED — dev seed users found in the target database:");
    for (const u of devUsers) console.error(`  - ${u.email}`);
    console.error("This database has been seeded with dev/demo data. Production");
    console.error("provisioning must run against a clean database. Aborting.");
    console.error("=".repeat(72));
    process.exit(1);
  }
}

// Section-1 staff the pilot needs. SSO-only: no usable local password.
// Stable IDs match the dev roster so cross-references (notification trigger
// recipients, estimator workerProfile on quote PDFs) resolve identically.
export async function seedProdUsers(prisma: PrismaClient): Promise<void> {
  const [adminRole, seniorEstimatorRole, whsOfficerRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "Admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Senior Estimator" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "WHS Officer" } })
  ]);

  type ProdUserSeed = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleIds: string[];
    isSuperUser: boolean;
    profile: { id: string; role: string; phone: string };
  };

  const prodUsers: ProdUserSeed[] = [
    {
      id: "user-admin",
      email: "sean@initialservices.net",
      firstName: "Sean",
      lastName: "Lattin",
      roleIds: [adminRole.id],
      isSuperUser: true,
      profile: { id: "wp-user-admin", role: "Company Director", phone: "0400 850 723" }
    },
    {
      id: "user-estimator",
      email: "estimating@initialservices.net",
      firstName: "Raj",
      lastName: "Pudasaini",
      roleIds: [seniorEstimatorRole.id],
      isSuperUser: false,
      profile: { id: "wp-user-estimator", role: "Senior Estimator", phone: "0421 140 248" }
    },
    {
      // Admin for system configuration; WHS Officer adds the explicit
      // safety.admin + compliance.admin grants.
      id: "user-supervisor-001",
      email: "marco@initialservices.net",
      firstName: "Marco",
      lastName: "Mantovaninni",
      roleIds: [adminRole.id, whsOfficerRole.id],
      isSuperUser: false,
      profile: { id: "wp-user-supervisor-001", role: "WHS & Commercial Compliance", phone: "0487 373 415" }
    }
  ];

  for (const seed of prodUsers) {
    const user = await prisma.user.upsert({
      where: { id: seed.id },
      update: {
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        isActive: true,
        isSuperUser: seed.isSuperUser,
        ssoOnly: true
      },
      create: {
        id: seed.id,
        email: seed.email,
        firstName: seed.firstName,
        lastName: seed.lastName,
        isActive: true,
        isSuperUser: seed.isSuperUser,
        ssoOnly: true,
        passwordHash: unusablePasswordHash()
      }
    });

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    for (const roleId of seed.roleIds) {
      await prisma.userRole.create({ data: { userId: user.id, roleId } });
    }

    await prisma.workerProfile.upsert({
      where: { id: seed.profile.id },
      update: {
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.profile.role,
        email: seed.email,
        phone: seed.profile.phone,
        internalUserId: seed.id,
        isActive: true
      },
      create: {
        id: seed.profile.id,
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: seed.profile.role,
        email: seed.email,
        phone: seed.profile.phone,
        internalUserId: seed.id,
        isActive: true
      }
    });

    console.log(`  ✓ ${seed.email} (${seed.profile.role}, SSO-only)`);
  }
}
