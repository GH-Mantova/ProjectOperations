import type { ProposedScopeItem } from "../tender-scope-drafting.service";

export interface AiProvider {
  /** Stable provider key — "anthropic" | "gemini" | "groq". */
  readonly name: "anthropic" | "gemini" | "groq";
  /** Human label for logs / audit entries. */
  readonly label: string;
  /**
   * Send the system prompt + user message to the provider and return the parsed
   * scope-item array. Providers must return JSON only; implementations strip
   * code fences and slice out the first `[...]` block before JSON.parse.
   */
  draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]>;
}

export function parseJsonArray(raw: string): ProposedScopeItem[] {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
    : trimmed;
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Provider response did not contain a JSON array.");
  }
  const slice = unfenced.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) throw new Error("Provider response was not an array.");
  return parsed as ProposedScopeItem[];
}
