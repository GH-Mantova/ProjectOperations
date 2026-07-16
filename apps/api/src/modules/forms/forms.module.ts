import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { PlatformModule } from "../platform/platform.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormsEngineController } from "./forms-engine.controller";
import { FormsEngineService } from "./forms-engine.service";
import { RulesEngineService } from "./rules-engine.service";
import { CorrectiveActionsController } from "./corrective-actions.controller";
import { CorrectiveActionsService } from "./corrective-actions.service";
import { SubmissionPdfService } from "./submission-pdf.service";

/**
 * §13 Forms and Compliance module — wires the template/submission CRUD
 * (FormsController + FormsService) and the worker-facing engine
 * (FormsEngineController + FormsEngineService + RulesEngineService).
 *
 * Also registers the corrective-action (CAPA) close-out loop:
 * CorrectiveActionsController + CorrectiveActionsService.
 *
 * RulesEngineService and FormsEngineService are re-exported so other
 * modules (e.g. compliance dashboards, safety auto-creation flows) can
 * reuse the rule evaluator and the lifecycle service without owning a
 * second copy of the contracts.
 */
@Module({
  imports: [PrismaModule, AuditModule, PlatformModule, PdfRenderingModule],
  controllers: [FormsController, FormsEngineController, CorrectiveActionsController],
  providers: [
    FormsService,
    FormsEngineService,
    RulesEngineService,
    CorrectiveActionsService,
    SubmissionPdfService
  ],
  exports: [RulesEngineService, FormsEngineService]
})
export class FormsModule {}
