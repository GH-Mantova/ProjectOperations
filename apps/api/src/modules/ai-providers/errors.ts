// Named error class for the missing-provider-config case. Carries the
// resolved provider name (when known) so the user-facing message can
// say "openai is not configured" rather than the previous generic
// "AI provider not configured" — clearer DX when the user picked
// OpenAI but only an Anthropic key exists.
//
// The personas chat endpoint already wraps every error through
// sanitiseProviderError before returning to the client; that
// sanitiser categorises by message keywords ("not configured" → config
// category). The named-provider message preserves the keyword so the
// existing sanitiser still routes correctly.
export class ProviderNotConfiguredError extends Error {
  constructor(public readonly provider: string | null) {
    super(
      provider
        ? `${provider} is not configured. Choose another provider or contact your administrator.`
        : "AI provider not configured. Contact your administrator."
    );
    this.name = "ProviderNotConfiguredError";
  }
}
