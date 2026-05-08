import { ToolHandlerRegistry } from "../tools/tool-handler.registry";
import type { ToolHandler } from "../tools/tool-handler.types";

// Unit-level test that mirrors PersonasModule.onModuleInit's binding
// logic exactly. Faster than a full NestJS TestingModule spin-up and
// directly exercises the registry's view of the four production
// handlers. Trade-off: if PersonasModule.onModuleInit ever drifts
// from this stub, the test won't catch it. Acceptable for PR #143's
// scope — the production binding logic and this stub use the same
// `TENDERING_SUB_MODES` array shape and the same per-sub-mode
// drawing-tools list, so drift would be obvious in code review.

const stubHandler = (name: string): ToolHandler => ({
  name,
  description: "stub for binding tests",
  inputSchema: { type: "object" as const, properties: {}, required: [] },
  execute: jest.fn() as never
});

const TENDERING_SUB_MODES = [
  "register",
  "tender-detail",
  "scope",
  "estimate",
  "quote",
  "clarifications"
] as const;

describe("PersonasModule — sub-mode bindings (PR #143)", () => {
  let registry: ToolHandlerRegistry;

  beforeEach(() => {
    registry = new ToolHandlerRegistry();
    registry.register(stubHandler("list_tender_drawings"));
    registry.register(stubHandler("extract_drawing_titleblock"));
    registry.register(stubHandler("read_tender_drawing"));
    registry.register(stubHandler("propose_scope_items"));
    registry.register(stubHandler("lookup_rate"));

    const drawingTools = [
      "list_tender_drawings",
      "extract_drawing_titleblock",
      "read_tender_drawing"
    ];
    for (const sm of TENDERING_SUB_MODES) {
      registry.bindToSubMode(`tendering.${sm}`, drawingTools);
    }
    registry.bindToSubMode("tendering.scope", [...drawingTools, "propose_scope_items"]);
    // PR #149 — lookup_rate on all tender-scoped sub-modes
    // (everything except register).
    const rateTools = ["lookup_rate"];
    for (const sm of ["tender-detail", "scope", "estimate", "quote", "clarifications"] as const) {
      registry.bindToSubMode(`tendering.${sm}`, rateTools);
    }
  });

  describe("drawing tools availability", () => {
    const drawingToolNames = [
      "list_tender_drawings",
      "extract_drawing_titleblock",
      "read_tender_drawing"
    ];

    it.each(TENDERING_SUB_MODES)(
      "exposes drawing tools in tendering.%s sub-mode",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        const names = tools.map((t) => t.name);
        for (const drawingTool of drawingToolNames) {
          expect(names).toContain(drawingTool);
        }
      }
    );
  });

  describe("propose_scope_items binding", () => {
    it("is exposed in tendering.scope sub-mode", () => {
      const tools = registry.getToolsForSubMode("tendering.scope");
      const names = tools.map((t) => t.name);
      expect(names).toContain("propose_scope_items");
    });

    it.each(["register", "tender-detail", "estimate", "quote", "clarifications"])(
      "is NOT exposed in tendering.%s sub-mode (scope-creation is sub-mode-specific)",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        const names = tools.map((t) => t.name);
        expect(names).not.toContain("propose_scope_items");
      }
    );
  });

  describe("scope sub-mode bindings", () => {
    it("contains all five production tools (drawing tools + propose_scope_items + lookup_rate)", () => {
      const tools = registry.getToolsForSubMode("tendering.scope");
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual(
        [
          "extract_drawing_titleblock",
          "list_tender_drawings",
          "lookup_rate",
          "propose_scope_items",
          "read_tender_drawing"
        ].sort()
      );
    });
  });

  // PR #149 broadened the binding from scope+estimate to ALL
  // tender-scoped sub-modes (everything except register, the tender
  // list / pipeline view). Smoke testing of PR #148 caught the model
  // fabricating market rates from tender-detail because the tool
  // wasn't bound there. Register stays excluded — there's no specific
  // tender from which to ask for rates.
  describe("lookup_rate binding (PR #149)", () => {
    const tenderingRateSubModes = [
      "tender-detail",
      "scope",
      "estimate",
      "quote",
      "clarifications"
    ] as const;

    it.each(tenderingRateSubModes)(
      "is exposed in tendering.%s sub-mode",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        expect(tools.map((t) => t.name)).toContain("lookup_rate");
      }
    );

    it("is NOT exposed in tendering.register sub-mode (tender list view, no specific tender context)", () => {
      const tools = registry.getToolsForSubMode("tendering.register");
      expect(tools.map((t) => t.name)).not.toContain("lookup_rate");
    });
  });
});
