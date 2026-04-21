import Groq from "groq-sdk";
import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

export const GROQ_DEFAULT_MODEL = "llama3-8b-8192";
const MAX_TOKENS = 2048;

export class GroqProvider implements AiProvider {
  readonly name = "groq" as const;
  readonly label = "Llama 3 on Groq";
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string | null | undefined = GROQ_DEFAULT_MODEL
  ) {
    this.model = (model && model.trim()) || GROQ_DEFAULT_MODEL;
  }

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const client = new Groq({ apiKey: this.apiKey });
    const completion = await client.chat.completions.create({
      model: this.model,
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
