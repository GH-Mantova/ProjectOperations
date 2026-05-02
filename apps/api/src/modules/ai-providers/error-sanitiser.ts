// Defence-in-depth: provider error strings (Anthropic/OpenAI HTTP responses,
// network errors, generic Error instances) get categorised into one of six
// known-safe user-facing messages. Raw provider text never reaches the client.
//
// Sanitiser inputs:
//   - Strings yielded by the provider implementations (e.g. "Anthropic API
//     429: ..." from anthropic.provider.ts, "OpenAI API 401: ..." from
//     openai.provider.ts, "Network error: ECONNREFUSED" from either).
//   - Error / exception instances thrown out of resolveProviderConfig,
//     resolveSystemPrompt, fetch, or the streaming loop.
// Closes CodeQL alert #9 (js/xss-through-exception on
// personas.controller.ts:193).

export type ErrorCategory =
  | "auth"
  | "rate-limit"
  | "quota"
  | "server"
  | "network"
  | "config"
  | "unknown";

export interface SanitisedError {
  userMessage: string;
  logMessage: string;
  category: ErrorCategory;
}

const USER_MESSAGES: Record<ErrorCategory, string> = {
  auth: "AI provider authentication failed. Contact your administrator.",
  "rate-limit": "AI provider rate limit reached. Please try again in a moment.",
  quota: "AI provider quota exhausted. Contact your administrator to top up.",
  server: "AI provider temporarily unavailable. Please try again.",
  network: "Could not reach AI provider. Check your connection and try again.",
  config: "AI provider not configured. Contact your administrator.",
  unknown: "An error occurred while processing your request. Please try again."
};

// Quota-specific keyword/phrase patterns. Both Anthropic and OpenAI return 429
// for quota AND for plain rate-limiting; the message text is the
// distinguishing signal.
const QUOTA_KEYWORDS = [
  /credit balance is too low/i,
  /credit balance/i,
  /insufficient_quota/i,
  /quota.*exceeded/i,
  /billing/i
];

const RATE_LIMIT_KEYWORDS = [
  /rate.?limit/i,
  /rate_limit_exceeded/i,
  /too many requests/i
];

const AUTH_KEYWORDS = [
  /invalid_api_key/i,
  /authentication.*fail/i,
  /unauthorized/i
];

const NETWORK_KEYWORDS = [
  /network error:/i,
  /econnrefused/i,
  /etimedout/i,
  /enotfound/i,
  /aborted/i,
  /fetch failed/i,
  /could not reach/i,
  /stream read error/i
];

// Errors the API itself throws (not from a provider) — we control these
// strings, so passing the categorised message through is both safe and more
// useful than a generic "An error occurred". The only signal needed is the
// hardcoded phrase that already lives in our service code.
const CONFIG_KEYWORDS = [/ai provider not configured/i];

// Shape produced by anthropic/openai providers (string body) or thrown
// errors (Error instance). Either way we extract a textual representation.
function extractText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const obj = error as { message?: unknown };
    if (typeof obj.message === "string") return obj.message;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

// HTTP status code derived from messages like "Anthropic API 429: ..." and
// "OpenAI API 401: ...". Returns null if no status code is parseable.
function extractStatusCode(text: string): number | null {
  const match = /\b(?:Anthropic|OpenAI)\s+API\s+(\d{3})\b/.exec(text);
  if (match) {
    const code = Number.parseInt(match[1]!, 10);
    if (!Number.isNaN(code)) return code;
  }
  return null;
}

export function sanitiseProviderError(error: unknown): SanitisedError {
  const text = extractText(error);
  const status = extractStatusCode(text);

  // Order matters — quota and rate-limit both surface as 429, distinguished by
  // body keywords. Check quota keywords FIRST so quota messages don't get
  // mis-categorised as rate-limit.
  let category: ErrorCategory = "unknown";

  if (CONFIG_KEYWORDS.some((re) => re.test(text))) {
    category = "config";
  } else if (QUOTA_KEYWORDS.some((re) => re.test(text))) {
    category = "quota";
  } else if (status === 401 || status === 403 || AUTH_KEYWORDS.some((re) => re.test(text))) {
    category = "auth";
  } else if (status === 429 || RATE_LIMIT_KEYWORDS.some((re) => re.test(text))) {
    category = "rate-limit";
  } else if (status !== null && status >= 500 && status < 600) {
    category = "server";
  } else if (NETWORK_KEYWORDS.some((re) => re.test(text))) {
    category = "network";
  }

  return {
    category,
    userMessage: USER_MESSAGES[category],
    // Truncate at 1000 chars so we don't blow the log line on huge HTML
    // responses leaked from misconfigured upstream services.
    logMessage: text.slice(0, 1000)
  };
}
