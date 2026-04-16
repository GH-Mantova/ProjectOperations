import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Managed Windows runs have intermittently selected the wrong Prisma engine path.
    // Pin the normal local Node-API engine unless a caller has intentionally overridden it.
    if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
      process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
    }

    super();
  }

  async onModuleInit() {
    await this.$connect();
  }
}
