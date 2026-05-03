// §5A.1 Item 5 multi-turn loop foundation. Provider-agnostic shapes
// for the tool-handler registry pattern. Adapters in
// ai-providers/providers/* translate ToolResultContent[] into native
// tool_result block shapes (Anthropic's native blocks, OpenAI's
// text-summary + follow-up image_url message pattern).

import type { AuthenticatedUser } from "../../../common/auth/authenticated-request.interface";

export type ToolResultContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      data: string; // base64
    };

export type ToolResult = {
  content: ToolResultContent[];
  isError?: boolean;
};

// Side effects a tool handler can declare. The dispatcher emits these
// as SSE events to the client in addition to feeding the result back
// to the model. propose_scope_items uses this to keep its PR #137 wire
// shape (`type: "proposals"`) while also returning a text confirmation
// to the model.
export type ToolSideEffect = {
  type: "sse";
  event: string;
  data: Record<string, unknown>;
};

export type ToolHandlerContext = {
  actor: AuthenticatedUser;
  conversationId: string;
  // Tender-scoped sub-modes (scope/estimate/quote/clarifications) carry
  // the tender id via the chat request's contextKey field; the dispatcher
  // forwards it here so handlers don't need to plumb it through inputs.
  contextKey: string | null;
  // The model-emitted id for this tool call. Threaded through so handlers
  // that persist call provenance (e.g. propose_scope_items writing
  // tool_call/tool_result rows under the same toolUseId) can use the
  // real id rather than synthesising one. PR #142 fix — PR #141 left
  // ProposeScopeItemsHandler synthesising the id because the dispatcher
  // didn't expose it.
  toolUseId: string;
};

export type ToolHandlerExecuteResult = {
  result: ToolResult;
  sideEffects?: ToolSideEffect[];
};

// JSON Schema for the tool's input. Same shape as ToolDefinition.inputSchema
// from PR #137 — kept structurally compatible so the existing tool registry
// can be deleted in favour of this richer one without changing the wire
// contract to the provider APIs.
export type JsonSchemaObject = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
};

export interface ToolHandler<TInput = unknown> {
  name: string;
  description: string;
  inputSchema: JsonSchemaObject;
  execute(input: TInput, ctx: ToolHandlerContext): Promise<ToolHandlerExecuteResult>;
}

// Sub-mode → tool names. Each persona+sub-mode declares which registered
// handlers it exposes to the model. Handlers can be shared across
// sub-modes; the registry holds them once.
export type SubModeToolBindings = Record<string, string[]>;
