#!/usr/bin/env tsx
// grants:write  — generate migration SQL for new grants, update the lock.
// grants:check  — compare map to lock; exit 1 with diff if they differ.
// grants:report — read-only DB check; lists map grants missing from DB.
//
// Run via:
//   pnpm --filter @project-ops/api grants:write
//   pnpm --filter @project-ops/api grants:check
//   pnpm --filter @project-ops/api grants:report

import * as fs from "fs";
import * as path from "path";
import { ROLE_GRANTS } from "../src/common/permissions/role-grant-registry";
import { diffGrants, renderGrantMigration } from "../src/common/permissions/role-grant-diff";

const LOCK_PATH = path.join(__dirname, "role-grants.lock.json");
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function readLock(): Record<string, string[]> {
  const raw = fs.readFileSync(LOCK_PATH, "utf8");
  return JSON.parse(raw) as Record<string, string[]>;
}

function writeLock(map: Readonly<Record<string, readonly string[]>>): void {
  const sorted: Record<string, string[]> = {};
  for (const role of Object.keys(map).sort()) {
    sorted[role] = [...map[role]].sort();
  }
  fs.writeFileSync(LOCK_PATH, JSON.stringify(sorted, null, 2) + "\n", "utf8");
}

function utcTimestamp(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    now.getUTCFullYear().toString() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds())
  );
}

function toSlug(role: string): string {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const command = process.argv[2];

if (command === "write") {
  const lock = readLock();
  const diff = diffGrants(ROLE_GRANTS, lock);

  if (diff.removed.length > 0) {
    for (const { role, code } of diff.removed) {
      console.log(`removed from map, NOT revoked in any database: ${role} ${code}`);
    }
  }

  if (diff.added.length > 0) {
    const ts = utcTimestamp();
    const firstRoleSlug = toSlug(diff.added[0].role);
    const migrationDir = path.join(MIGRATIONS_DIR, `${ts}_role_grants_${firstRoleSlug}`);
    fs.mkdirSync(migrationDir, { recursive: true });
    const isoTs = new Date().toISOString();
    const sql = renderGrantMigration(diff.added, isoTs);
    const sqlPath = path.join(migrationDir, "migration.sql");
    fs.writeFileSync(sqlPath, sql, "utf8");
    console.log(`wrote migration: ${sqlPath}`);
  } else {
    console.log("role grants: no new grants — map already matches lock");
  }

  writeLock(ROLE_GRANTS);
  console.log("role-grants.lock.json updated");
} else if (command === "check") {
  const lock = readLock();
  const diff = diffGrants(ROLE_GRANTS, lock);

  if (diff.added.length > 0 || diff.removed.length > 0) {
    console.error(
      "role grants changed without a migration - run: pnpm --filter @project-ops/api grants:write"
    );
    for (const { role, code } of diff.added) {
      console.error(`  + ${role} ${code}`);
    }
    for (const { role, code } of diff.removed) {
      console.error(`  - ${role} ${code}`);
    }
    process.exit(1);
  }

  console.log("role grants: map == lock");
} else if (command === "report") {
  // Read-only DB check. Requires DATABASE_URL in environment.
  // This command never writes. It lists grants in the map that are absent from DB.
  (async () => {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const missing: { role: string; code: string }[] = [];

      for (const [roleName, codes] of Object.entries(ROLE_GRANTS)) {
        for (const code of codes) {
          const row = await prisma.rolePermission.findFirst({
            where: {
              role: { name: roleName },
              permission: { code }
            }
          });
          if (!row) {
            missing.push({ role: roleName, code });
          }
        }
      }

      if (missing.length === 0) {
        console.log("role grants: database matches map — no missing grants");
      } else {
        console.log(`${missing.length} grant(s) in map but absent from DB:`);
        for (const { role, code } of missing) {
          console.log(`  missing: ${role} -> ${code}`);
        }
        const isoTs = new Date().toISOString();
        const sql = renderGrantMigration(missing, isoTs);
        console.log("\nSQL that grants:write would generate:\n");
        console.log(sql);
      }
    } finally {
      await prisma.$disconnect();
    }
  })().catch((err) => {
    console.error("grants:report failed:", err);
    process.exit(1);
  });
} else {
  console.error("Usage: tsx prisma/role-grants.ts <write|check|report>");
  process.exit(1);
}
