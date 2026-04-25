import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormsEngineController } from "./forms-engine.controller";
import { FormsEngineService } from "./forms-engine.service";
import { RulesEngineService } from "./rules-engine.service";

@Module({
  imports: [PrismaModule, AuditModule, PlatformModule],
  controllers: [FormsController, FormsEngineController],
  providers: [FormsService, FormsEngineService, RulesEngineService],
  exports: [RulesEngineService, FormsEngineService]
})
export class FormsModule {}
