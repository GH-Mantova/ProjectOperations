import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormsEngineController } from "./forms-engine.controller";
import { FormsEngineService } from "./forms-engine.service";
import { RulesEngineService } from "./rules-engine.service";

/**
 * §13 Forms and Compliance module — wires the template/submission CRUD
 * (FormsController + FormsService) and the worker-facing engine
 * (FormsEngineController + FormsEngineService + RulesEngineService).
 *
 * RulesEngineService and FormsEngineService are re-exported so other
 * modules (e.g. compliance dashboards, safety auto-creation flows) can
 * reuse the rule evaluator and the lifecycle service without owning a
 * second copy of the contracts.
 */
@Module({
  imports: [PrismaModule, AuditModule, PlatformModule],
  controllers: [FormsController, FormsEngineController],
  providers: [FormsService, FormsEngineService, RulesEngineService],
  exports: [RulesEngineService, FormsEngineService]
})
export class FormsModule {}
