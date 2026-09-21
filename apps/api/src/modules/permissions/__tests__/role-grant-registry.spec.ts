import * as fs from "fs";
import * as path from "path";
import { permissionRegistry } from "../../../common/permissions/permission-registry";
import { ROLE_GRANTS } from "../../../common/permissions/role-grant-registry";
import { diffGrants, renderGrantMigration } from "../../../common/permissions/role-grant-diff";

// ── Lock file helpers ───────────────────────────────────────────────────────

function readLock(): Record<string, string[]> {
  const lockPath = path.join(__dirname, "../../../../prisma/role-grants.lock.json");
  const raw = fs.readFileSync(lockPath, "utf8");
  return JSON.parse(raw) as Record<string, string[]>;
}

// ── 1. map == lock ──────────────────────────────────────────────────────────

describe("role-grant-registry: map vs lock", () => {
  it("map must equal lock — diff must be empty", () => {
    const lock = readLock();
    const diff = diffGrants(ROLE_GRANTS, lock);

    if (diff.added.length > 0 || diff.removed.length > 0) {
      const lines = [
        "role grants changed without a migration - run: pnpm --filter @project-ops/api grants:write"
      ];
      for (const { role, code } of diff.added) {
        lines.push(`  + ${role} ${code}`);
      }
      for (const { role, code } of diff.removed) {
        lines.push(`  - ${role} ${code}`);
      }
      fail(lines.join("\n"));
    }

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});

// ── 2. every code in map exists in PERMISSION_REGISTRY ─────────────────────

describe("role-grant-registry: all codes are known permissions", () => {
  const knownCodes = new Set<string>(permissionRegistry.map((p) => p.code));

  for (const [role, codes] of Object.entries(ROLE_GRANTS)) {
    for (const code of codes) {
      it(`${role} -> ${code} must exist in permissionRegistry`, () => {
        expect(knownCodes.has(code)).toBe(true);
      });
    }
  }
});

// ── 3. renderGrantMigration snapshot ───────────────────────────────────────

describe("renderGrantMigration", () => {
  const fixture = [
    { role: "Project Manager", code: "new.permission" },
    { role: "WHS Officer", code: "another.thing" }
  ];

  it("contains ON CONFLICT DO NOTHING", () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).toContain("ON CONFLICT DO NOTHING");
  });

  it("contains RAISE NOTICE", () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).toContain("RAISE NOTICE");
  });

  it("does not contain DELETE", () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).not.toContain("DELETE");
  });

  it("does not contain UPDATE", () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).not.toContain("UPDATE");
  });

  it("does not contain TRUNCATE", () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).not.toContain("TRUNCATE");
  });

  it('does not contain INSERT INTO "roles"', () => {
    const sql = renderGrantMigration(fixture, "2026-01-01T00:00:00.000Z");
    expect(sql).not.toContain('INSERT INTO "roles"');
  });
});

// ── 4. diffGrants reports removal without SQL ───────────────────────────────

describe("diffGrants", () => {
  it("reports a removal without producing SQL for it", () => {
    const map = { "Test Role": ["a.view"] };
    const lock = { "Test Role": ["a.view", "b.manage"] };
    const diff = diffGrants(map, lock);

    expect(diff.removed).toEqual([{ role: "Test Role", code: "b.manage" }]);
    expect(diff.added).toHaveLength(0);

    // renderGrantMigration is only called with diff.added — removals produce no SQL
    expect(() => renderGrantMigration(diff.added, "2026-01-01T00:00:00.000Z")).toThrow(
      "renderGrantMigration: added list is empty"
    );
  });

  it("reports an addition correctly", () => {
    const map = { "Test Role": ["a.view", "c.new"] };
    const lock = { "Test Role": ["a.view"] };
    const diff = diffGrants(map, lock);

    expect(diff.added).toEqual([{ role: "Test Role", code: "c.new" }]);
    expect(diff.removed).toHaveLength(0);
  });

  it("returns empty diff when map equals lock", () => {
    const map = { "Test Role": ["a.view", "b.manage"] };
    const lock = { "Test Role": ["b.manage", "a.view"] };
    const diff = diffGrants(map, lock);

    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});
