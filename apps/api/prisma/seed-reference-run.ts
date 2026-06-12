import { PrismaClient } from "@prisma/client";
import { seedOperationalRoles } from "./seed-initial-services";
import { seedPermissionsAndCoreRoles, seedReferenceData } from "./seed-reference";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://project_ops:project_ops@localhost:5432/project_operations?schema=public";

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log("seed:reference — reference data only (no users, no demo entities)");
  await seedPermissionsAndCoreRoles(prisma);
  await seedOperationalRoles(prisma);
  await seedReferenceData(prisma);
  console.log("seed:reference complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
