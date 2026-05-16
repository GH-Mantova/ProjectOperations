import { proposeScopeItemsTool } from "../tools/propose-scope-items.tool";
import { buildSubModeKey, getToolsForSubMode } from "../tools/tool-registry";
import { toolsToAnthropicFormat, toolsToOpenAIFormat } from "../tools/translation";

describe("Tool registry", () => {
  it("returns the propose_scope_items tool for tendering.scope", () => {
    const tools = getToolsForSubMode("tendering.scope");
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe("propose_scope_items");
  });

  it("returns empty array for unknown sub-mode keys", () => {
    expect(getToolsForSubMode("tendering.register")).toEqual([]);
    expect(getToolsForSubMode("nonsense")).toEqual([]);
  });

  it("buildSubModeKey joins persona slug + sub-mode with a dot", () => {
    expect(buildSubModeKey("tendering", "scope")).toBe("tendering.scope");
    expect(buildSubModeKey("tendering", undefined)).toBe("tendering");
    expect(buildSubModeKey("tendering", null)).toBe("tendering");
  });
});

describe("toolsToAnthropicFormat", () => {
  it("preserves name, description, and inputSchema as input_schema", () => {
    const [translated] = toolsToAnthropicFormat([proposeScopeItemsTool]);
    expect(translated!.name).toBe("propose_scope_items");
    expect(translated!.description).toBe(proposeScopeItemsTool.description);
    expect(translated!.input_schema).toBe(proposeScopeItemsTool.inputSchema);
  });
});

describe("toolsToOpenAIFormat", () => {
  it("wraps each tool in { type: 'function', function: { name, description, parameters } }", () => {
    const [translated] = toolsToOpenAIFormat([proposeScopeItemsTool]);
    expect(translated!.type).toBe("function");
    expect(translated!.function.name).toBe("propose_scope_items");
    expect(translated!.function.description).toBe(proposeScopeItemsTool.description);
    expect(translated!.function.parameters).toBe(proposeScopeItemsTool.inputSchema);
  });
});

describe("propose_scope_items tool schema", () => {
  it("constrains discipline to DEM/CIV/ASB/Other (PR A1)", () => {
    const itemsSchema = (
      proposeScopeItemsTool.inputSchema.properties.proposals as {
        items?: { properties?: { discipline?: { enum?: string[] } } };
      }
    ).items;
    expect(itemsSchema?.properties?.discipline?.enum).toEqual([
      "DEM",
      "CIV",
      "ASB",
      "Other"
    ]);
  });

  it("requires discipline, title, description, quantity, unit (notes optional)", () => {
    const itemsSchema = (
      proposeScopeItemsTool.inputSchema.properties.proposals as {
        items?: { required?: string[] };
      }
    ).items;
    expect(itemsSchema?.required).toEqual([
      "discipline",
      "title",
      "description",
      "quantity",
      "unit"
    ]);
  });
});
