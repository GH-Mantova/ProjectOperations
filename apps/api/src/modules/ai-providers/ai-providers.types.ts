// Persona AI integration — provider-agnostic types.
// Anthropic (§5A.1 PR 6) and OpenAI (§5A.1 PR 7) are implemented. Other
// providers register here as new files in providers/ and a new case in
// AiProvidersService.streamChat().

export type ProviderId = "anthropic" | "openai";

export interface ProviderConfig {
  providerId: ProviderId;
  apiKey: string;
  model: string;
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
