import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { TenantContextService } from "../common/tenancy/tenant-context";
import { tenantScopingExtension } from "../common/tenancy/tenant-scoping.middleware";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor(private readonly tenantCtx: TenantContextService) {
    // Managed Windows runs have intermittently selected the wrong Prisma engine path.
    // Pin the normal local Node-API engine unless a caller has intentionally overridden it.
    if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
    }

    super();
  }

  async onModuleInit() {
    await this.$connect();

    // Apply the MT-1 tenant-scoping extension.  The extended client wraps every
    // pilot-model read/mutate operation with the tenant filter.  We overwrite
    // the model delegates on `this` so that all existing consumers of
    // `PrismaService` receive scoping automatically, with zero call-site changes.
    const extended = this.$extends(tenantScopingExtension(this.tenantCtx));
    Object.assign(this, extended);
  }
}
