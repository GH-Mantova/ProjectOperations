import type { ToolDefinition } from "./types";

// §5A.1 PR 11 — scope sub-mode tool. Produces an array of proposed scope
// items the user can accept / edit / reject. Discipline is constrained to
// the three IS work types (demolition, asbestos, civil) — the AI must NOT
// propose anything outside these.
export const proposeScopeItemsTool: ToolDefinition = {
  name: "propose_scope_items",
  description: [
    "Propose scope items for the current tender based on the conversation",
    "context. Use this when you have enough information to suggest concrete",
    "scope items with disciplines, descriptions, and quantities. If you do",
    "not have enough context, ask clarifying questions first instead of",
    "proposing. Initial Services works in three disciplines only:",
    "demolition, asbestos removal, and civil works — never propose items",
    "outside these disciplines. Each proposal is reviewed by the user before",
    "being committed; the user can accept, edit, or reject each one."
  ].join(" "),
  inputSchema: {
    type: "object",
    properties: {
      proposals: {
        type: "array",
        items: {
          type: "object",
          properties: {
            discipline: {
              type: "string",
              enum: ["demolition", "asbestos", "civil"],
              description: "IS work type — one of demolition, asbestos, civil"
            },
            title: {
              type: "string",
              maxLength: 200,
              description: "Short scope item title, e.g. 'Internal demolition — Level 2'"
            },
            description: {
              type: "string",
              maxLength: 2000,
              description: "Detailed scope of works for this item"
            },
            quantity: {
              type: "number",
              minimum: 0,
              description: "Numeric quantity for the unit (e.g. 250 for 250 sqm)"
            },
            unit: {
              type: "string",
              maxLength: 20,
              description: "Unit of measure, e.g. 'sqm', 'm3', 'lm', 'item', 'tonnes'"
            },
            notes: {
              type: "string",
              maxLength: 1000,
              description:
                "Optional notes — assumptions, exclusions, access constraints, etc."
            }
          },
          required: ["discipline", "title", "description", "quantity", "unit"]
        },
        minItems: 1,
        maxItems: 30
      }
    },
    required: ["proposals"]
  }
};

export type ProposeScopeItemsArgs = {
  proposals: Array<{
    discipline: "demolition" | "asbestos" | "civil";
    title: string;
    description: string;
    quantity: number;
    unit: string;
    notes?: string;
  }>;
};
