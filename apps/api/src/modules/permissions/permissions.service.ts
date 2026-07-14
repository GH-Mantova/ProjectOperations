import { Injectable } from "@nestjs/common";
import { permissionRegistry } from "../../common/permissions/permission-registry";
import { permissionModuleRegistry } from "../../common/permissions/module-registry";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Read access and registry synchronisation for the permission catalogue.
 *
 * Permissions are declared in code (`permissionRegistry`) and upserted
 * into the database; this service never deletes permission rows.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all permissions ordered by module then code, joined with their
   * module display label.
   *
   * The join is done in-app against the `permission_modules` lookup
   * table rather than via a Prisma relation, because `Permission.module`
   * is a free string (no hard FK) — unknown modules fall back to the raw
   * slug so removing a module row from the lookup degrades gracefully.
   *
   * @returns all Permission records with `moduleLabel` attached
   */
  async list() {
    const [permissions, modules] = await this.prisma.$transaction([
      this.prisma.permission.findMany({
        orderBy: [{ module: "asc" }, { code: "asc" }]
      }),
      this.prisma.permissionModule.findMany()
    ]);
    const moduleLabelByName = new Map(modules.map((m) => [m.name, m.label]));
    return permissions.map((p) => ({
      ...p,
      moduleLabel: moduleLabelByName.get(p.module) ?? p.module
    }));
  }

  /**
   * Upsert every code-defined registry permission into the database, and
   * every module-display-name entry into `permission_modules`.
   *
   * Existing rows (matched by `code` / `name`) get their descriptive
   * fields refreshed; missing rows are created. Rows no longer present
   * in either registry are left in place — nothing is deleted here. The
   * seed handles orphan removal of permissions dropped from the registry.
   *
   * @returns resolves when all upserts have completed
   */
  async syncRegistry() {
    await Promise.all([
      ...permissionRegistry.map((permission) =>
        this.prisma.permission.upsert({
          where: { code: permission.code },
          update: {
            description: permission.description,
            module: permission.module,
            label: permission.label,
            isHighRisk: ("isHighRisk" in permission ? permission.isHighRisk : false) ?? false
          },
          create: {
            code: permission.code,
            description: permission.description,
            module: permission.module,
            label: permission.label,
            isHighRisk: ("isHighRisk" in permission ? permission.isHighRisk : false) ?? false
          }
        })
      ),
      ...permissionModuleRegistry.map((mod) =>
        this.prisma.permissionModule.upsert({
          where: { name: mod.name },
          update: { label: mod.label },
          create: { name: mod.name, label: mod.label }
        })
      )
    ]);
  }
}
