import type { ToolDefinition } from "./types";

// Anthropic Messages API tool format. The wire shape is { name, description,
// input_schema } — the inner schema is JSON Schema verbatim.
// Reference: https://docs.anthropic.com/en/docs/build-with-claude/tool-use
export type AnthropicToolWireFormat = {
  name: string;
  description: string;
  input_schema: ToolDefinition["inputSchema"];
};

export function toolsToAnthropicFormat(tools: ToolDefinition[]): AnthropicToolWireFormat[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema
  }));
}

// OpenAI Chat Completions tool format. The wire shape is
// { type: 'function', function: { name, description, parameters } }.
// Reference: https://platform.openai.com/docs/guides/function-calling
export type OpenAIToolWireFormat = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolDefinition["inputSchema"];
  };
};

export function toolsToOpenAIFormat(tools: ToolDefinition[]): OpenAIToolWireFormat[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema
    }
  }));
}
