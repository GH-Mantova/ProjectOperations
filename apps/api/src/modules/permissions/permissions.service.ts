import { Injectable } from "@nestjs/common";
import { permissionRegistry } from "../../common/permissions/permission-registry";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: "asc" }, { code: "asc" }]
    });
  }

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
