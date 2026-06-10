import { readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

describe("Canonical CP-G5 — applied migrations match the migrations folder", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("the set of applied _prisma_migrations rows equals the set of migration folders", async () => {
    const migrationsDir = join(__dirname, "..", "..", "prisma", "migrations");
    const folders = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();

    const applied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL
    `;
    const appliedNames = applied.map((r) => r.migration_name).sort();

    expect(appliedNames).toEqual(folders);
  });
});
