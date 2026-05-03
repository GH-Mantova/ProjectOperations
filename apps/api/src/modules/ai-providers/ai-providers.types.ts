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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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
export type ChatStreamChunk =
  | { type: "content"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_delta"; id: string; partialJson: string }
  | { type: "tool_use_stop"; id: string; name: string; finalArgs: unknown }
  | { type: "error"; error: string }
  | { type: "done" };
