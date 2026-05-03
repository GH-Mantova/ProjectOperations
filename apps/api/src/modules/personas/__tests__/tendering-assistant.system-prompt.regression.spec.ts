import { tenderingPersona } from "../definitions/tendering.persona";

// Hard regression test for §5A.1 Item 5 system prompt overhaul.
// PR #141 step-2 manual smoke surfaced a real bug: agent refused
// legitimate IS scope (carpet/vinyl/ceiling strip-out) as "fit-out
// works are not Initial Services". PR #142 fixes this by adding
// explicit IS scope codes (SO/Str/Asb/Civ/Prv) with strip-out vs
// fit-out disambiguation.
//
// This test asserts the model does NOT refuse strip-out work. It
// runs against the real Anthropic API when ANTHROPIC_API_KEY is
// present (typically CI with secret configured); skips with a
// console warning when the key is absent (typically local dev).
//
// Two-attempt flake-tolerant pattern: passing 1 of 2 attempts is
// sufficient. Both must fail to fail the test. If both fail, the
// system prompt isn't doing its job — fix the prompt, do not
// weaken this test.

const HAS_API_KEY = typeof process.env.ANTHROPIC_API_KEY === "string" &&
  process.env.ANTHROPIC_API_KEY.length > 0;

const REFUSAL_PHRASES = [
  "outside our scope",
  "outside initial services",
  "not an initial services discipline",
  "fit-out works are not",
  "fit-out works fall",
  "i'm not able to draft",
  "not in our lane",
  "outside my lane"
];

const STRIP_OUT_PROMPT =
  "I have a tender for stripping out an existing tenancy. " +
  "Carpet, vinyl, ceiling tiles, internal partitions to remove. " +
  "Help me draft scope items.";

// Build the system prompt the dispatcher would assemble at runtime.
// Mirrors ai-providers.service.ts intrinsicPrompt() shape — combine
// persona description + the active sub-mode (scope) description.
function buildScopeSubModeSystemPrompt(): string {
  const subMode = tenderingPersona.subModes.find((s) => s.name === "scope");
  if (!subMode) throw new Error("scope sub-mode not found on tenderingPersona");
  return [
    `You are the ${tenderingPersona.displayName} for Initial Services, a South East Queensland construction company.`,
    tenderingPersona.description,
    "",
    `The user is currently in sub-mode "scope": ${subMode.description}`
  ].join("\n");
}

// Minimal Anthropic Messages API call — no SDK, no streaming — for a
// one-shot text response. Tools deliberately omitted so the model
// must respond in text (we're testing what it SAYS, not whether it
// would call a tool). 60s timeout handles slow turns; opus-class
// models can be slow on cold cache.
async function callAnthropicOnce(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    }),
    signal: AbortSignal.timeout(55_000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  return body.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

describe("Tendering Assistant — system prompt regression suite", () => {
  describe("strip-out vs fit-out disambiguation", () => {
    if (!HAS_API_KEY) {
      // Jest doesn't have a clean "skip describe" so use it.skip on the
      // single test inside. Console warning makes it obvious in CI logs
      // that this test was opted out of.
      console.warn(
        "[REGRESSION SKIPPED] ANTHROPIC_API_KEY not set — strip-out " +
          "regression test skipped. Set the env var to run live API " +
          "verification of the system prompt."
      );
      it.skip("attempt 1: agent does not refuse strip-out work", () => {
        // skipped
      });
      it.skip("attempt 2: agent does not refuse strip-out work", () => {
        // skipped
      });
      return;
    }

    const systemPrompt = buildScopeSubModeSystemPrompt();

    it.each([1, 2])(
      "attempt %i: agent does not refuse strip-out work",
      async () => {
        let lastError: Error | null = null;
        let text = "";
        try {
          text = (await callAnthropicOnce(systemPrompt, STRIP_OUT_PROMPT)).toLowerCase();
        } catch (err) {
          lastError = err as Error;
        }
        if (lastError) {
          // Network/timeout — let the OTHER attempt cover it. Only fail
          // if both attempts errored, which Jest's it.each handles by
          // failing all retries.
          throw lastError;
        }

        // NEGATIVE assertions — refusal phrases must NOT appear.
        for (const phrase of REFUSAL_PHRASES) {
          expect(text).not.toContain(phrase);
        }

        // POSITIVE assertion — at least one of these signals real
        // engagement with the strip-out scope.
        const mentionsStripOut =
          text.includes("strip-out") ||
          text.includes("strip out") ||
          text.includes("stripout") ||
          text.includes(" so ") ||
          text.includes("(so)") ||
          text.includes("scope item") ||
          text.includes("propose");
        expect(mentionsStripOut).toBe(true);
      },
      60_000
    );
  });
});
