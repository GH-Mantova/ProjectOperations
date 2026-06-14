import { PrismaClient } from "@prisma/client";
import { seedOperationalRoles } from "./seed-initial-services";
import { seedPermissionsAndCoreRoles, seedReferenceData } from "./seed-reference";
import { assertNoDevSeedUsers, seedProdUsers } from "./seed-users-prod";

// Production provisioning: reference data + SSO-only staff users.
// Never creates demo entities. No DATABASE_URL fallback — a prod seed must
// always target an explicitly named database.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("seed:prod requires DATABASE_URL to be set explicitly — refusing to fall back to the dev default.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log("seed:prod — production provisioning (reference + SSO-only users)");
  await assertNoDevSeedUsers(prisma);
  console.log("  ✓ guard passed — no dev seed users in target database");
  await seedPermissionsAndCoreRoles(prisma);
  await seedOperationalRoles(prisma);
  console.log("  ✓ permissions + roles");
  await seedProdUsers(prisma);
  await seedReferenceData(prisma, { listsOwnerId: "user-admin" });
  console.log("  ✓ reference data (rates, densities, lookups, lists, form templates, configs)");
  console.log("seed:prod complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
