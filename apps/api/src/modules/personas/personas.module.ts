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
import { ListTenderClarificationsHandler } from "./tools/handlers/list-tender-clarifications.handler";
import { ListTenderDrawingsHandler } from "./tools/handlers/list-tender-drawings.handler";
import { ListTenderQuotesHandler } from "./tools/handlers/list-tender-quotes.handler";
import { LookupRateHandler } from "./tools/handlers/lookup-rate.handler";
import { ProposeClarificationsHandler } from "./tools/handlers/propose-clarifications.handler";
import { ProposeEstimateItemsHandler } from "./tools/handlers/propose-estimate-items.handler";
import { ProposeQuoteContentHandler } from "./tools/handlers/propose-quote-content.handler";
import { ProposeScopeItemsHandler } from "./tools/handlers/propose-scope-items.handler";
import { ReadAsbestosRegisterHandler } from "./tools/handlers/read-asbestos-register.handler";
import { ReadTenderDrawingHandler } from "./tools/handlers/read-tender-drawing.handler";
import {
  GetCurrentTimeHandler,
  GetTestImageHandler
} from "./tools/handlers/test-fixtures.handler";
import { ToolHandlerRegistry } from "./tools/tool-handler.registry";

// Canonical Tendering Assistant sub-mode list. Mirrors
// definitions/tendering.persona.ts. Used for tool-binding loops below
// — keep in sync if the persona definition adds or removes sub-modes.
const TENDERING_SUB_MODES = [
  "register",
  "tender-detail",
  "scope",
  "estimate",
  "quote",
  "clarifications"
] as const;

// Tender-scoped sub-modes — every Tendering sub-mode EXCEPT register.
// register is the tender list / pipeline view (not scoped to a single
// tender); rate lookups don't apply there. PR #149 binds lookup_rate
// to this set so all five tender-scoped sub-modes have rate access.
const TENDERING_RATE_SUB_MODES = [
  "tender-detail",
  "scope",
  "estimate",
  "quote",
  "clarifications"
] as const;

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
    ProposeEstimateItemsHandler,
    ProposeQuoteContentHandler,
    ProposeClarificationsHandler,
    ListTenderDrawingsHandler,
    ListTenderQuotesHandler,
    ListTenderClarificationsHandler,
    ExtractDrawingTitleblockHandler,
    ReadTenderDrawingHandler,
    ReadAsbestosRegisterHandler,
    LookupRateHandler,
    GetCurrentTimeHandler,
    GetTestImageHandler
  ],
  exports: [PersonasService]
})
export class PersonasModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolHandlerRegistry,
    private readonly proposeScopeItems: ProposeScopeItemsHandler,
    private readonly proposeEstimateItems: ProposeEstimateItemsHandler,
    private readonly proposeQuoteContent: ProposeQuoteContentHandler,
    private readonly proposeClarifications: ProposeClarificationsHandler,
    private readonly listTenderDrawings: ListTenderDrawingsHandler,
    private readonly listTenderQuotes: ListTenderQuotesHandler,
    private readonly listTenderClarifications: ListTenderClarificationsHandler,
    private readonly extractDrawingTitleblock: ExtractDrawingTitleblockHandler,
    private readonly readTenderDrawing: ReadTenderDrawingHandler,
    private readonly readAsbestosRegister: ReadAsbestosRegisterHandler,
    private readonly lookupRate: LookupRateHandler,
    private readonly getCurrentTime: GetCurrentTimeHandler,
    private readonly getTestImage: GetTestImageHandler
  ) {}

  onModuleInit(): void {
    // Production handlers — register all four globally. Per-sub-mode
    // exposure is decided by the bindToSubMode calls below.
    this.registry.register(this.listTenderDrawings);
    this.registry.register(this.extractDrawingTitleblock);
    this.registry.register(this.readTenderDrawing);
    this.registry.register(this.proposeScopeItems);
    this.registry.register(this.proposeEstimateItems);
    this.registry.register(this.proposeQuoteContent);
    this.registry.register(this.proposeClarifications);
    this.registry.register(this.listTenderQuotes);
    this.registry.register(this.listTenderClarifications);
    this.registry.register(this.readAsbestosRegister);
    this.registry.register(this.lookupRate);

    // Drawing tools are reference material — useful from any Tendering
    // Assistant sub-mode. A user drafting a quote, clarification, or
    // estimate may legitimately need to consult a drawing. Bind to all
    // six sub-modes.
    //
    // PR #143 fix: PR #142 bound drawing tools to scope only. The
    // controller defaults dto.subMode to "register" when the frontend
    // doesn't specify, so the model received zero tools and asked the
    // user to paste drawing data manually. Multi-sub-mode binding
    // restores the intended UX while keeping propose_scope_items
    // scope-restricted.
    //
    // propose_scope_items, by contrast, is scope-creation work. Restrict
    // it to the scope sub-mode where it belongs. Loose binding would let
    // the model propose scope items from inside the quote sub-mode,
    // which is the wrong UX.
    const drawingTools = [
      this.listTenderDrawings.name,
      this.extractDrawingTitleblock.name,
      this.readTenderDrawing.name
    ];
    for (const sm of TENDERING_SUB_MODES) {
      this.registry.bindToSubMode(`tendering.${sm}`, drawingTools);
    }

    // §5A.1 PR G — read_asbestos_register is reference material, same
    // shape as the drawing tools: useful from any Tendering Assistant
    // sub-mode. Scope (proposing ASB items), estimate (pricing ASB),
    // quote (the standard exclusion clause references "asbestos not
    // noted in the asbestos register"), tender-detail / clarifications
    // (drafting RFIs about the register). The register sub-mode
    // (pipeline / tender list) has no specific tender; the tool returns
    // a clean "needs a tender" message there, mirroring the drawing-
    // tools convention.
    const registerTools = [this.readAsbestosRegister.name];
    for (const sm of TENDERING_SUB_MODES) {
      this.registry.bindToSubMode(`tendering.${sm}`, registerTools);
    }
    // propose_scope_items lands only on the scope sub-mode.
    // bindToSubMode is idempotent (dedups), so this safely extends the
    // scope binding established by the loop above.
    this.registry.bindToSubMode("tendering.scope", [
      ...drawingTools,
      this.proposeScopeItems.name
    ]);

    // §5A.1 PR D — propose_estimate_items lands only on the estimate
    // sub-mode. Same per-sub-mode-restriction rationale as
    // propose_scope_items: estimate-creation work belongs in the
    // estimate tab, not the scope/quote/clarifications tabs.
    this.registry.bindToSubMode("tendering.estimate", [
      this.proposeEstimateItems.name
    ]);

    // §5A.1 PR E — quote sub-mode tools. list_tender_quotes lets the
    // model discover which ClientQuote the user is referring to;
    // propose_quote_content writes the AI's suggested cost-line
    // structure / exclusions / assumptions into that quote for
    // Accept/Edit/Reject review. Both bound to the quote sub-mode
    // ONLY — the scope and estimate tabs have their own creation
    // tools and shouldn't surface quote tools.
    this.registry.bindToSubMode("tendering.quote", [
      this.listTenderQuotes.name,
      this.proposeQuoteContent.name
    ]);

    // §5A.1 PR F — clarifications sub-mode tools.
    // list_tender_clarifications lets the model see open RFIs and the
    // comms log so it can draft responses and avoid duplicates;
    // propose_clarifications writes new RFIs / log entries / RFI
    // responses into the tender for Accept/Edit/Reject review. Both
    // bound to the clarifications sub-mode ONLY.
    this.registry.bindToSubMode("tendering.clarifications", [
      this.listTenderClarifications.name,
      this.proposeClarifications.name
    ]);

    // PR #149 — lookup_rate is bound to ALL tender-scoped tendering
    // sub-modes (tender-detail, scope, estimate, quote, clarifications).
    // PR #148 narrowly bound it to scope + estimate; smoke testing
    // surfaced two failure modes: (1) from the natural tender-detail
    // landing tab the tool wasn't bound, so the model had no awareness
    // it existed, and (2) when asked for a rate without the tool the
    // model fabricated market ranges with fake citations. Broadening
    // matches the drawing-tools pattern — rate lookup is reference
    // material useful from any tender-scoped sub-mode. The register
    // sub-mode (tender list / pipeline) is intentionally excluded —
    // there is no specific tender from which to ask for rates there.
    const rateTools = [this.lookupRate.name];
    for (const sm of TENDERING_RATE_SUB_MODES) {
      this.registry.bindToSubMode(`tendering.${sm}`, rateTools);
    }

    // Test fixture handlers — non-production only. NODE_ENV=test +
    // development pick them up so unit + e2e + manual smoke can
    // exercise the multi-turn loop end-to-end without coupling to
    // real domain tools.
    if (process.env.NODE_ENV !== "production") {
      this.registry.register(this.getCurrentTime);
      this.registry.register(this.getTestImage);
      // Bind to every tendering sub-mode so devs can exercise the loop
      // from any persona route.
      for (const sm of TENDERING_SUB_MODES) {
        this.registry.bindToSubMode(`tendering.${sm}`, [
          this.getCurrentTime.name,
          this.getTestImage.name
        ]);
      }
    }
  }
}
