import { Injectable, Logger } from "@nestjs/common";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";

export type ProviderId = "anthropic" | "openai" | "gemini" | "groq";

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string; category: string };

const TIMEOUT_MS = 5000;

// Live key validation. Each method makes a small test call to the provider;
// a 200 response means the key is valid. Errors are categorised via
// sanitiseProviderError (PR #131) so the UI never sees raw provider text.
//
// Gemini and Groq are out of scope for §5A.1 — their methods throw
// "Not yet implemented" until those providers ship.
@Injectable()
export class KeyValidationService {
  private readonly logger = new Logger(KeyValidationService.name);

  async validateAnthropicKey(key: string): Promise<ValidationResult> {
    return this.runValidation("anthropic", async (signal) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }]
        })
      });
      return response;
    });
  }

  async validateOpenAiKey(key: string): Promise<ValidationResult> {
    return this.runValidation("openai", async (signal) => {
      const response = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        signal,
        headers: { authorization: `Bearer ${key}` }
      });
      return response;
    });
  }

  async validateGeminiKey(_key: string): Promise<ValidationResult> {
    throw new Error("Gemini key validation not yet implemented");
  }

  async validateGroqKey(_key: string): Promise<ValidationResult> {
    throw new Error("Groq key validation not yet implemented");
  }

  async validate(provider: ProviderId, key: string): Promise<ValidationResult> {
    switch (provider) {
      case "anthropic":
        return this.validateAnthropicKey(key);
      case "openai":
        return this.validateOpenAiKey(key);
      case "gemini":
        return this.validateGeminiKey(key);
      case "groq":
        return this.validateGroqKey(key);
    }
  }

  private async runValidation(
    provider: ProviderId,
    call: (signal: AbortSignal) => Promise<Response>
  ): Promise<ValidationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await call(controller.signal);
      if (response.ok) return { valid: true };
      const bodyText = await safeReadText(response);
      // Synthesise the message string the sanitiser expects ("<Provider> API <code>: <body>").
      const providerName = provider === "anthropic" ? "Anthropic" : "OpenAI";
      const synthetic = `${providerName} API ${response.status}: ${bodyText.slice(0, 240)}`;
      const sanitised = sanitiseProviderError(synthetic);
      this.logger.warn(
        `Key validation failed [provider=${provider}, status=${response.status}, category=${sanitised.category}]`
      );
      return { valid: false, reason: sanitised.userMessage, category: sanitised.category };
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      const isAbort = (err as Error)?.name === "AbortError";
      const message = isAbort
        ? "Provider validation timed out. Check your network."
        : sanitised.userMessage;
      const category = isAbort ? "network" : sanitised.category;
      this.logger.warn(`Key validation error [provider=${provider}, category=${category}]`);
      return { valid: false, reason: message, category };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
