import { Module, OnModuleInit, forwardRef } from "@nestjs/common";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { TenderingModule } from "../tendering/tendering.module";
import { ConversationsService } from "./conversations.service";
import { PersonaDispatcherService } from "./dispatcher/persona-dispatcher.service";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";
import { PersonaPermissionGuard } from "./persona-permission.guard";
import { ProposeScopeItemsHandler } from "./tools/handlers/propose-scope-items.handler";
import {
  GetCurrentTimeHandler,
  GetTestImageHandler
} from "./tools/handlers/test-fixtures.handler";
import { ToolHandlerRegistry } from "./tools/tool-handler.registry";

// §5A.1 multi-turn loop: PersonasModule owns the tool-handler registry
// and registers all production + dev-only handlers in onModuleInit.
// Each handler implements ToolHandler from tool-handler.types.ts;
// register here, bind to sub-modes here. New tools land by adding a
// handler file + a register/bind call below.
@Module({
  imports: [AiProvidersModule, forwardRef(() => TenderingModule)],
  controllers: [PersonasController],
  providers: [
    PersonasService,
    PersonaPermissionGuard,
    ConversationsService,
    ToolHandlerRegistry,
    PersonaDispatcherService,
    ProposeScopeItemsHandler,
    GetCurrentTimeHandler,
    GetTestImageHandler
  ],
  exports: [PersonasService]
})
export class PersonasModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolHandlerRegistry,
    private readonly proposeScopeItems: ProposeScopeItemsHandler,
    private readonly getCurrentTime: GetCurrentTimeHandler,
    private readonly getTestImage: GetTestImageHandler
  ) {}

  onModuleInit(): void {
    // Production handlers
    this.registry.register(this.proposeScopeItems);
    this.registry.bindToSubMode("tendering.scope", [this.proposeScopeItems.name]);

    // Test fixture handlers — non-production only. NODE_ENV=test +
    // development pick them up so unit + e2e + manual smoke can
    // exercise the multi-turn loop end-to-end without coupling to
    // real domain tools.
    if (process.env.NODE_ENV !== "production") {
      this.registry.register(this.getCurrentTime);
      this.registry.register(this.getTestImage);
      // Bind to every tendering sub-mode so devs can exercise the loop
      // from any persona route.
      const tenderingSubModes = ["register", "tender-detail", "scope", "estimate", "quote", "clarifications"];
      for (const sm of tenderingSubModes) {
        this.registry.bindToSubMode(`tendering.${sm}`, [
          this.getCurrentTime.name,
          this.getTestImage.name
        ]);
      }
    }
  }
}
