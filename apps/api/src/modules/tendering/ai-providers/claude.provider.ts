import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

const MODEL_ID = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

export class ClaudeProvider implements AiProvider {
  readonly name = "anthropic" as const;
  readonly label = "Claude (Anthropic)";

  constructor(private readonly apiKey: string) {}

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${errorText.slice(0, 400)}`);
    }
    const body = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = body.content.map((block) => block.text ?? "").join("").trim();
    return parseJsonArray(text);
  }
}
