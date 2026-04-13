import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AssetsController } from "./assets.controller";
import { AssetsService } from "./assets.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService]
})
export class AssetsModule {}
