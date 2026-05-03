// Persona AI integration — provider-agnostic types.
// Anthropic (§5A.1 PR 6) and OpenAI (§5A.1 PR 7) are implemented. Other
// providers register here as new files in providers/ and a new case in
// AiProvidersService.streamChat().

import type { ToolDefinition } from "./tools/types";

export type ProviderId = "anthropic" | "openai";

export interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string;
  model: string;
  // §5A.1 PR 9: where the apiKey came from. "user" = personal BYOK key on
  // the User row; "company" = the platform-wide key on PlatformConfig.
  // Used in audit logs only — not in provider request construction.
  source: "user" | "company";
}

// §5A.1 multi-turn loop: tool_use blocks accompany text in an assistant
// turn; tool_result blocks accompany text in a user turn (the synthesised
// turn the dispatcher inserts after running tools).
export type ChatToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
};

export type ChatToolResultContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      data: string; // base64
    };

export type ChatToolResultBlock = {
  type: "tool_result";
  toolUseId: string;
  content: ChatToolResultContent[];
  isError?: boolean;
};

export type ChatTextBlock = { type: "text"; text: string };

export type ChatMessageBlock = ChatTextBlock | ChatToolUseBlock | ChatToolResultBlock;

// Backward compatible: pre-loop callers pass `content: string`. New
// loop callers pass `content: ChatMessageBlock[]`. Adapters accept both.
export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ChatMessageBlock[];
}

export interface ChatRequest {
  systemPrompt: string;
  messages: ChatMessage[];
  config: ProviderConfig;
  // §5A.1 PR 11: optional tools. When provided, both Anthropic and OpenAI
  // providers translate to their native tool/function-calling format and
  // emit tool_use_* chunks alongside content. When omitted, providers
  // behave exactly as before (no regression).
  tools?: ToolDefinition[];
  // Allow callers to abort an in-flight stream (e.g. user navigates away).
  signal?: AbortSignal;
}

// Each chunk is one SSE event on the wire. `done` always arrives last.
// §5A.1 PR 11 added tool_use_* chunks — both Anthropic and OpenAI providers
// emit this unified shape so the chat endpoint doesn't branch on provider.
// Multi-turn loop adds `stop_reason` so the dispatcher knows whether the
// turn ended naturally or because the model wants to call tools.
export type ChatStreamChunk =
  | { type: "content"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_delta"; id: string; partialJson: string }
  | { type: "tool_use_stop"; id: string; name: string; finalArgs: unknown }
  | { type: "stop_reason"; reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | "other" }
  | { type: "error"; error: string }
  | { type: "done" };

// Thrown by streamChat when the requested provider does not support
// tool calling and the caller passed a non-empty tools array.
// Personas dispatcher catches this at the loop entry and surfaces a
// categorised user-facing error.
export class ToolingNotSupportedError extends Error {
  constructor(public readonly provider: string) {
    super(
      `Tool calling is not yet available for ${provider}. ` +
        "Switch to Anthropic or OpenAI in your AI Settings."
    );
    this.name = "ToolingNotSupportedError";
  }
}
