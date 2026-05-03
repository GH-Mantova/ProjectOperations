// §5A.1 PR 11 — provider-agnostic tool calling.
// One canonical ToolDefinition shape; per-provider translation lives in
// translation.ts. Both Anthropic (tool_use blocks) and OpenAI
// (function/tool calling) are supported equally.

export type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
}
