import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

const MODEL_ID = "gemini-1.5-flash";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini" as const;
  readonly label = "Gemini (Google)";

  constructor(private readonly apiKey: string) {}

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const client = new GoogleGenerativeAI(this.apiKey);
    const model = client.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: systemPrompt,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4096 }
    });
    const result = await model.generateContent(userMessage);
    const text = result.response.text().trim();
    return parseJsonArray(text);
  }
}
