import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

export const GEMINI_DEFAULT_MODEL = "gemini-1.5-flash";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  readonly label = "Gemini (Google)";
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string | null | undefined = GEMINI_DEFAULT_MODEL
  ) {
    this.model = (model && model.trim()) || GEMINI_DEFAULT_MODEL;
  }

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 }
    });
    const result = await model.generateContent(userMessage);
    const text = result.response.text().trim();
    return parseJsonArray(text);
  }
}
