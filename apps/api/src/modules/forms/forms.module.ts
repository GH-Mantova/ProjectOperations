import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { AuditModule } from "../audit/audit.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { PdfRenderingModule } from "../pdf-rendering/pdf-rendering.module";
import { PlatformModule } from "../platform/platform.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { EmailModule } from "../email/email.module";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";
import { FormNumberSequenceService } from "./form-number-sequence.service";
import { FormsEngineController } from "./forms-engine.controller";
import { FormsEngineService } from "./forms-engine.service";
import { RulesEngineService } from "./rules-engine.service";
import { SystemContextResolverService } from "./system-context-resolver.service";
import { FormsSnippetsController } from "./forms-snippets.controller";
import { FormsSnippetsService } from "./forms-snippets.service";
import { CorrectiveActionsController } from "./corrective-actions.controller";
import { CorrectiveActionsService } from "./corrective-actions.service";
import { InspectionBuilderController } from "./inspection-builder.controller";
import { InspectionBuilderService } from "./inspection-builder.service";
import { SubmissionPdfService } from "./submission-pdf.service";
import { PublicLinkController } from "./public-link.controller";
import { PublicLinkService } from "./public-link.service";
import { PushExecutorService } from "./push-executor.service";
import { PushHandlersService } from "./push-handlers.service";
import { AiFormFillAssistService } from "./ai-form-fill-assist.service";

/**
 * §13 Forms and Compliance module — wires the template/submission CRUD
 * (FormsController + FormsService), the worker-facing engine
 * (FormsEngineController + FormsEngineService + RulesEngineService),
 * and the reusable content-snippet library
 * (FormsSnippetsController + FormsSnippetsService).
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
  imports: [
    PrismaModule,
    AiProvidersModule,
    AuditModule,
    PlatformModule,
    PdfRenderingModule,
    ComplianceModule,
    EmailModule,
    MaintenanceModule
  ],
  controllers: [
    FormsController,
    FormsEngineController,
    FormsSnippetsController,
    CorrectiveActionsController,
    InspectionBuilderController,
    PublicLinkController
  ],
  providers: [
    FormsService,
    FormNumberSequenceService,
    FormsEngineService,
    RulesEngineService,
    SystemContextResolverService,
    FormsSnippetsService,
    CorrectiveActionsService,
    InspectionBuilderService,
    SubmissionPdfService,
    PublicLinkService,
    PushExecutorService,
    PushHandlersService,
    AiFormFillAssistService
  ],
  exports: [
    RulesEngineService,
    FormsEngineService,
    FormsSnippetsService,
    PushExecutorService,
    SystemContextResolverService
  ]
})
export class FormsModule {}
