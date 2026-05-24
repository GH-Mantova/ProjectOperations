import { ToolHandlerRegistry } from "../tools/tool-handler.registry";
import type { ToolHandler } from "../tools/tool-handler.types";

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
  "quote"
] as const;

const TENDERING_RATE_SUB_MODES = [
  "tender-detail",
  "scope",
  "quote"
] as const;

describe("PersonasModule — sub-mode bindings", () => {
  let registry: ToolHandlerRegistry;

  beforeEach(() => {
    registry = new ToolHandlerRegistry();
    registry.register(stubHandler("list_tender_drawings"));
    registry.register(stubHandler("extract_drawing_titleblock"));
    registry.register(stubHandler("read_tender_drawing"));
    registry.register(stubHandler("propose_scope_items"));
    registry.register(stubHandler("propose_estimate_items"));
    registry.register(stubHandler("propose_quote_content"));
    registry.register(stubHandler("propose_clarifications"));
    registry.register(stubHandler("list_tender_quotes"));
    registry.register(stubHandler("list_tender_clarifications"));
    registry.register(stubHandler("read_asbestos_register"));
    registry.register(stubHandler("lookup_rate"));

    const drawingTools = [
      "list_tender_drawings",
      "extract_drawing_titleblock",
      "read_tender_drawing"
    ];
    for (const sm of TENDERING_SUB_MODES) {
      registry.bindToSubMode(`tendering.${sm}`, drawingTools);
    }

    const registerTools = ["read_asbestos_register"];
    for (const sm of TENDERING_SUB_MODES) {
      registry.bindToSubMode(`tendering.${sm}`, registerTools);
    }

    registry.bindToSubMode("tendering.scope", [...drawingTools, "propose_scope_items"]);

    registry.bindToSubMode("tendering.quote", [
      "propose_estimate_items",
      "list_tender_quotes",
      "propose_quote_content"
    ]);

    registry.bindToSubMode("tendering.tender-detail", [
      "list_tender_clarifications",
      "propose_clarifications"
    ]);

    const rateTools = ["lookup_rate"];
    for (const sm of TENDERING_RATE_SUB_MODES) {
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
      expect(tools.map((t) => t.name)).toContain("propose_scope_items");
    });

    it.each(["register", "tender-detail", "quote"])(
      "is NOT exposed in tendering.%s sub-mode",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        expect(tools.map((t) => t.name)).not.toContain("propose_scope_items");
      }
    );
  });

  describe("propose_estimate_items binding", () => {
    it("is exposed in tendering.quote sub-mode", () => {
      const tools = registry.getToolsForSubMode("tendering.quote");
      expect(tools.map((t) => t.name)).toContain("propose_estimate_items");
    });

    it.each(["register", "tender-detail", "scope"])(
      "is NOT exposed in tendering.%s sub-mode",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        expect(tools.map((t) => t.name)).not.toContain("propose_estimate_items");
      }
    );
  });

  describe("clarification tools binding", () => {
    it("exposes list_tender_clarifications in tendering.tender-detail", () => {
      const tools = registry.getToolsForSubMode("tendering.tender-detail");
      expect(tools.map((t) => t.name)).toContain("list_tender_clarifications");
    });

    it("exposes propose_clarifications in tendering.tender-detail", () => {
      const tools = registry.getToolsForSubMode("tendering.tender-detail");
      expect(tools.map((t) => t.name)).toContain("propose_clarifications");
    });

    it.each(["register", "scope", "quote"])(
      "does NOT expose propose_clarifications in tendering.%s",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        expect(tools.map((t) => t.name)).not.toContain("propose_clarifications");
      }
    );
  });

  describe("quote tools binding", () => {
    it("exposes list_tender_quotes in tendering.quote", () => {
      const tools = registry.getToolsForSubMode("tendering.quote");
      expect(tools.map((t) => t.name)).toContain("list_tender_quotes");
    });

    it("exposes propose_quote_content in tendering.quote", () => {
      const tools = registry.getToolsForSubMode("tendering.quote");
      expect(tools.map((t) => t.name)).toContain("propose_quote_content");
    });
  });

  describe("lookup_rate binding", () => {
    it.each(TENDERING_RATE_SUB_MODES)(
      "is exposed in tendering.%s sub-mode",
      (subMode) => {
        const tools = registry.getToolsForSubMode(`tendering.${subMode}`);
        expect(tools.map((t) => t.name)).toContain("lookup_rate");
      }
    );

    it("is NOT exposed in tendering.register sub-mode", () => {
      const tools = registry.getToolsForSubMode("tendering.register");
      expect(tools.map((t) => t.name)).not.toContain("lookup_rate");
    });
  });
});
