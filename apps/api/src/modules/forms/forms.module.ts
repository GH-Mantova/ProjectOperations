import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PlatformModule } from "../platform/platform.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormsEngineController } from "./forms-engine.controller";
import { FormsEngineService } from "./forms-engine.service";
import { RulesEngineService } from "./rules-engine.service";
import { CorrectiveActionsController } from "./corrective-actions.controller";
import { CorrectiveActionsService } from "./corrective-actions.service";
import { PublicLinkController } from "./public-link.controller";
import { PublicLinkService } from "./public-link.service";

/**
 * §13 Forms and Compliance module — wires the template/submission CRUD
 * (FormsController + FormsService) and the worker-facing engine
 * (FormsEngineController + FormsEngineService + RulesEngineService).
 *
 * Also registers the corrective-action (CAPA) close-out loop:
 * CorrectiveActionsController + CorrectiveActionsService.
 *
 * Also wires the public/kiosk/QR capture layer (PR #621):
 * PublicLinkController + PublicLinkService for unauthenticated form capture.
 *
 * RulesEngineService and FormsEngineService are re-exported so other
 * modules (e.g. compliance dashboards, safety auto-creation flows) can
 * reuse the rule evaluator and the lifecycle service without owning a
 * second copy of the contracts.
 */
@Module({
  imports: [PrismaModule, AuditModule, PlatformModule],
  controllers: [FormsController, FormsEngineController, CorrectiveActionsController, PublicLinkController],
  providers: [FormsService, FormsEngineService, RulesEngineService, CorrectiveActionsService, PublicLinkService],
  exports: [RulesEngineService, FormsEngineService]
})
export class FormsModule {}
