import Groq from "groq-sdk";
import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

const MODEL_ID = "llama3-8b-8192";
const MAX_TOKENS = 2048;

export class GroqProvider implements AiProvider {
  readonly name = "groq" as const;
  readonly label = "Llama 3 on Groq";

  constructor(private readonly apiKey: string) {}

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const client = new Groq({ apiKey: this.apiKey });
    const completion = await client.chat.completions.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ]
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    return parseJsonArray(text);
  }
}
