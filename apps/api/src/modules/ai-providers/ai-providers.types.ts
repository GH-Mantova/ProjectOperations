// Persona AI integration — provider-agnostic types.
// Anthropic (§5A.1 PR 6) and OpenAI (§5A.1 PR 7) are implemented. Other
// providers register here as new files in providers/ and a new case in
// AiProvidersService.streamChat().

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
  // Allow callers to abort an in-flight stream (e.g. user navigates away).
  signal?: AbortSignal;
}

// Each chunk is one SSE event on the wire. `done` always arrives last.
export type ChatStreamChunk =
  | { type: "content"; text: string }
  | { type: "error"; error: string }
  | { type: "done" };
