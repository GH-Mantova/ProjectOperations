import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { RulesEngineService } from "./rules-engine.service";

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [FormsController],
  providers: [FormsService, RulesEngineService],
  exports: [RulesEngineService]
})
export class FormsModule {}
