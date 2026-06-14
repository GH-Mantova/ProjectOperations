import { PrismaClient } from "@prisma/client";
import { assertNoDevSeedUsers, seedProdUsers } from "./seed-users-prod";

// Standalone prod-user provisioning. Requires roles to exist already
// (run seed:reference first). Same no-fallback rule as seed:prod.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("seed:users:prod requires DATABASE_URL to be set explicitly — refusing to fall back to the dev default.");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

async function main() {
  console.log("seed:users:prod — SSO-only staff provisioning");
  await assertNoDevSeedUsers(prisma);
  await seedProdUsers(prisma);
  console.log("seed:users:prod complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
