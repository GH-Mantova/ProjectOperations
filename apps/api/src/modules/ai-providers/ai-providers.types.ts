// Persona AI integration — provider-agnostic types.
// Only Anthropic is implemented in §5A.1 PR 6. Other providers register
// here as new files in providers/ and a new branch in dispatchProvider().

export type ProviderId = "anthropic";

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
