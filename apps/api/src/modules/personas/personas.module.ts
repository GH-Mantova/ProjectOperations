import { Module, OnModuleInit, forwardRef } from "@nestjs/common";
import { AiProvidersModule } from "../ai-providers/ai-providers.module";
import { PlatformModule } from "../platform/platform.module";
import { TenderingModule } from "../tendering/tendering.module";
import { ConversationsService } from "./conversations.service";
import { PersonaDispatcherService } from "./dispatcher/persona-dispatcher.service";
import { PersonasController } from "./personas.controller";
import { PersonasService } from "./personas.service";
import { PersonaPermissionGuard } from "./persona-permission.guard";
import { DrawingToolsAccessService } from "./tools/handlers/drawing-tools.shared";
import { ExtractDrawingTitleblockHandler } from "./tools/handlers/extract-drawing-titleblock.handler";
import { ListTenderDrawingsHandler } from "./tools/handlers/list-tender-drawings.handler";
import { ProposeScopeItemsHandler } from "./tools/handlers/propose-scope-items.handler";
import { ReadTenderDrawingHandler } from "./tools/handlers/read-tender-drawing.handler";
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
  imports: [AiProvidersModule, PlatformModule, forwardRef(() => TenderingModule)],
  controllers: [PersonasController],
  providers: [
    PersonasService,
    PersonaPermissionGuard,
    ConversationsService,
    ToolHandlerRegistry,
    PersonaDispatcherService,
    DrawingToolsAccessService,
    ProposeScopeItemsHandler,
    ListTenderDrawingsHandler,
    ExtractDrawingTitleblockHandler,
    ReadTenderDrawingHandler,
    GetCurrentTimeHandler,
    GetTestImageHandler
  ],
  exports: [PersonasService]
})
export class PersonasModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolHandlerRegistry,
    private readonly proposeScopeItems: ProposeScopeItemsHandler,
    private readonly listTenderDrawings: ListTenderDrawingsHandler,
    private readonly extractDrawingTitleblock: ExtractDrawingTitleblockHandler,
    private readonly readTenderDrawing: ReadTenderDrawingHandler,
    private readonly getCurrentTime: GetCurrentTimeHandler,
    private readonly getTestImage: GetTestImageHandler
  ) {}

  onModuleInit(): void {
    // Production handlers — Tendering Assistant scope sub-mode tool list.
    // Order matches the system prompt's reading-conventions block:
    //   1. list_tender_drawings (cheap directory)
    //   2. extract_drawing_titleblock (cheap text-layer)
    //   3. read_tender_drawing (vision tokens)
    //   4. propose_scope_items (existing — PR #137 / #141)
    this.registry.register(this.listTenderDrawings);
    this.registry.register(this.extractDrawingTitleblock);
    this.registry.register(this.readTenderDrawing);
    this.registry.register(this.proposeScopeItems);
    this.registry.bindToSubMode("tendering.scope", [
      this.listTenderDrawings.name,
      this.extractDrawingTitleblock.name,
      this.readTenderDrawing.name,
      this.proposeScopeItems.name
    ]);

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
