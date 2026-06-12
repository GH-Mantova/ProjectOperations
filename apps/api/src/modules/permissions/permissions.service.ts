import { Injectable } from "@nestjs/common";
import { permissionRegistry } from "../../common/permissions/permission-registry";
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
   * List all permissions ordered by module then code.
   *
   * Unpaginated — returns the entire catalogue.
   *
   * @returns all Permission records
   */
  list() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }]
    });
  }

  /**
   * Upsert every code-defined registry permission into the database.
   *
   * Existing rows (matched by `code`) get their description and module
   * refreshed; missing rows are created. Rows no longer present in the
   * registry are left in place — nothing is deleted. Idempotent.
   *
   * @returns resolves when all upserts have completed
   */
  async syncRegistry() {
    await Promise.all(
      permissionRegistry.map((permission) =>
        this.prisma.permission.upsert({
          where: { code: permission.code },
          update: {
            description: permission.description,
            module: permission.module
          },
          create: permission
        })
      )
    );
  }
}
