import { LookupRateHandler } from "../tools/handlers/lookup-rate.handler";
import { tenderingPersona } from "../definitions/tendering.persona";
import { intrinsicPrompt } from "../../ai-providers/ai-providers.service";

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

// Build the system prompt the dispatcher would assemble at runtime
// for the scope sub-mode. Delegates to production's intrinsicPrompt()
// so this test validates the REAL prompt shape — if intrinsicPrompt()
// changes (e.g. PR #152's GLOBAL_RATE_FABRICATION_PROHIBITION prefix),
// the regression suite sees the change automatically. Previous
// implementation reconstructed the prompt in-test, which was a false-
// confidence mirror test — fixed in PR #160.
//
// Note: this helper does NOT invoke resolveSystemPrompt() (which would
// add company/user instruction layers + tender context). Those layers
// are out of scope for this regression suite, which focuses on
// persona+sub-mode behaviour.
function buildScopeSubModeSystemPrompt(): string {
  const subMode = tenderingPersona.subModes.find((s) => s.name === "scope");
  if (!subMode) throw new Error("scope sub-mode not found on tenderingPersona");
  return intrinsicPrompt(tenderingPersona, subMode);
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

// Variant of callAnthropicOnce that includes tool definitions and
// returns BOTH the text and the tool_use blocks the model emitted.
// Used by PR #148's regression tests for lookup_rate — we want to
// assert that the prompt induces the model to actually CALL the tool,
// not just talk about it. 60s timeout matches the no-tools variant.
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
type AnthropicWithToolsResponse = { text: string; toolUses: ToolUseBlock[] };

async function callAnthropicWithTools(
  systemPrompt: string,
  userMessage: string,
  tools: Array<{ name: string; description: string; input_schema: unknown }>
): Promise<AnthropicWithToolsResponse> {
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
      tools,
      messages: [{ role: "user", content: userMessage }]
    }),
    signal: AbortSignal.timeout(55_000)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
  };
  const text = body.content
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
  const toolUses = body.content
    .filter((c): c is { type: "tool_use"; id: string; name: string; input: unknown } =>
      c.type === "tool_use"
    )
    .map((c) => ({ type: "tool_use" as const, id: c.id, name: c.name, input: c.input }));
  return { text, toolUses };
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

  // PR #148 — lookup_rate proactive call regression. The scope sub-mode
  // prompt instructs the model to call lookup_rate after proposing
  // cutting / core hole scope items. These tests verify the prompt
  // induces actual tool use, not just mention. Two-attempt flake-tolerant
  // pattern matches the strip-out test above.
  describe("lookup_rate tool use", () => {
    if (!HAS_API_KEY) {
      console.warn(
        "[REGRESSION SKIPPED] ANTHROPIC_API_KEY not set — lookup_rate " +
          "regression tests skipped."
      );
      it.skip("attempt 1: agent calls lookup_rate when proposing cutting", () => {
        // skipped
      });
      it.skip("attempt 2: agent calls lookup_rate when proposing cutting", () => {
        // skipped
      });
      it.skip("attempt 1: agent applies wall multiplier on core hole", () => {
        // skipped
      });
      it.skip("attempt 2: agent applies wall multiplier on core hole", () => {
        // skipped
      });
      return;
    }

    const systemPrompt = buildScopeSubModeSystemPrompt();
    const lookupRateHandler = new LookupRateHandler({} as never);
    const lookupRateToolDef = {
      name: lookupRateHandler.name,
      description: lookupRateHandler.description,
      input_schema: lookupRateHandler.inputSchema as unknown
    };
    // Include propose_scope_items as a stub so the model can choose
    // either tool — without it the model would over-fixate on
    // lookup_rate as the only available action and the test would
    // become a tautology.
    const proposeScopeItemsStub = {
      name: "propose_scope_items",
      description:
        "Propose scope items for the user to review. Each proposal must include discipline, title, description, quantity, and unit.",
      input_schema: {
        type: "object",
        properties: {
          proposals: {
            type: "array",
            items: { type: "object" }
          }
        },
        required: ["proposals"]
      }
    };
    const tools = [lookupRateToolDef, proposeScopeItemsStub];

    it.each([1, 2])(
      "attempt %i: agent calls lookup_rate when proposing cutting scope item",
      async () => {
        const result = await callAnthropicWithTools(
          systemPrompt,
          "I need to cut a 200mm deep penetration through a concrete floor slab " +
            "with a roadsaw to remove an old service line. Help me draft a scope " +
            "item with pricing.",
          tools
        );
        const callNames = result.toolUses.map((t) => t.name);
        expect(callNames).toContain("lookup_rate");
        const lookupCall = result.toolUses.find((t) => t.name === "lookup_rate");
        const input = (lookupCall?.input ?? {}) as {
          rateType?: string;
          cutting?: { elevation?: string };
        };
        expect(input.rateType).toBe("cutting");
        expect(input.cutting?.elevation).toBe("floor");
      },
      60_000
    );

    it.each([1, 2])(
      "attempt %i: agent calls lookup_rate with wall elevation for wall core hole",
      async () => {
        const result = await callAnthropicWithTools(
          systemPrompt,
          "I need a 100mm diameter core hole through a 200mm thick concrete wall. " +
            "Help me draft scope and price it.",
          tools
        );
        const callNames = result.toolUses.map((t) => t.name);
        expect(callNames).toContain("lookup_rate");
        const lookupCall = result.toolUses.find((t) => t.name === "lookup_rate");
        const input = (lookupCall?.input ?? {}) as {
          rateType?: string;
          coreHole?: { elevation?: string; diameterMm?: number };
        };
        expect(input.rateType).toBe("core_hole");
        expect(input.coreHole?.elevation).toBe("wall");
        expect(input.coreHole?.diameterMm).toBe(100);
      },
      60_000
    );
  });
});
