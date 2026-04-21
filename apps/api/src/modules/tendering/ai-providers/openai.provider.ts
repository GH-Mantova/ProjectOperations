import OpenAI from "openai";
import type { ProposedScopeItem } from "../tender-scope-drafting.service";
import { parseJsonArray, type AiProvider } from "./ai-provider.interface";

export const OPENAI_DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai" as const;
  readonly label = "ChatGPT (OpenAI)";
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model: string | null | undefined = OPENAI_DEFAULT_MODEL
  ) {
    this.model = (model && model.trim()) || OPENAI_DEFAULT_MODEL;
  }

  async draftScope(systemPrompt: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const client = new OpenAI({ apiKey: this.apiKey });
    // Some newer reasoning models (o1/o3) don't support response_format yet;
    // we request JSON mode but also include explicit "JSON only" in the user
    // message so parseJsonArray can recover if the model returns plain text.
    const completion = await client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userMessage}\n\nRespond with a JSON object shaped as { "proposals": [ ... scope items ... ] } or a bare JSON array. No prose, no code fences.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    // JSON mode wraps the array in an object — try to pull the first array
    // we find, else fall back to parseJsonArray's fence/bracket recovery.
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed as ProposedScopeItem[];
      if (parsed && typeof parsed === "object") {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (Array.isArray(value)) return value as ProposedScopeItem[];
        }
      }
    } catch {
      // fall through
    }
    return parseJsonArray(text);
  }
}

export class MockAiProvider implements AiProvider {
  readonly name = "mock" as const;
  readonly label = "Mock (no provider configured)";
  readonly model = "mock";

  async draftScope(_systemPrompt: string, _userMessage: string): Promise<ProposedScopeItem[]> {
    return [
      {
        code: "SO",
        title: "Internal strip-out — existing fit-out",
        description:
          "Remove all non-structural internal fit-out including partitions, ceilings, floor coverings, joinery, fixtures, and services ready for the next trade.",
        estimatedLabourDays: 8,
        estimatedLabourRole: "Demolition labourer",
        estimatedPlantItems: [{ item: "Bobcat", days: 3 }],
        estimatedWasteTonnes: [{ type: "General C&D", tonnes: 12 }],
        confidence: "low",
        sourceReference: "Mock fallback — configure an AI provider in Admin → AI & Integrations"
      }
    ];
  }
}
