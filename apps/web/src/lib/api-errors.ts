/**
 * Parses the API error envelope produced by `ApiExceptionFilter`
 * (apps/api/src/common/filters/api-exception.filter.ts) and returns a
 * human-readable message. Centralising this prevents raw JSON envelopes
 * from leaking to the UI when a request fails.
 *
 * Envelope shape:
 *   { statusCode, error, message: string | string[], path, timestamp }
 *
 * `message` can be a string (most HttpExceptions) or an array of strings
 * (class-validator ValidationPipe failures).
 */

export type ApiErrorEnvelope = {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
};

const DEFAULT_FALLBACK = "Something went wrong. Please try again.";

function isEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.statusCode === "number" &&
    (typeof record.message === "string" || Array.isArray(record.message))
  );
}

function normaliseMessage(message: string | string[]): string {
  if (Array.isArray(message)) {
    const cleaned = message.map((m) => String(m).trim()).filter(Boolean);
    return cleaned.join(" • ");
  }
  return message.trim();
}

/**
 * Synchronously turn a payload (already-parsed JSON, a raw string, or
 * anything else) into a human message. Returns `fallback` when nothing
 * usable can be extracted.
 */
export function parseApiErrorPayload(payload: unknown, fallback = DEFAULT_FALLBACK): string {
  if (payload == null) return fallback;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return fallback;
    // The raw body might already be the JSON envelope serialised as text.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return parseApiErrorPayload(JSON.parse(trimmed), fallback);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }

  if (isEnvelope(payload)) {
    const msg = normaliseMessage(payload.message);
    return msg || payload.error || fallback;
  }

  if (typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }
    if (Array.isArray(record.message)) {
      const msg = normaliseMessage(record.message as string[]);
      if (msg) return msg;
    }
    if (typeof record.error === "string" && record.error.trim()) {
      return record.error.trim();
    }
  }

  return fallback;
}

/**
 * Read a `fetch` Response's body and return a human-readable error
 * message. Safe to call on any failed response — never throws, never
 * leaks raw JSON.
 */
export async function readApiErrorMessage(
  response: Response,
  fallback = DEFAULT_FALLBACK
): Promise<string> {
  try {
    const text = await response.text();
    return parseApiErrorPayload(text, fallback);
  } catch {
    return fallback;
  }
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly envelope: ApiErrorEnvelope | null;

  constructor(message: string, statusCode: number, envelope: ApiErrorEnvelope | null = null) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.envelope = envelope;
  }
}

/**
 * Throws an `ApiError` carrying the humanised envelope message when the
 * response is not OK. Returns the response unchanged otherwise so callers
 * can chain `.json()`.
 */
export async function throwIfApiError(
  response: Response,
  fallback = DEFAULT_FALLBACK
): Promise<Response> {
  if (response.ok) return response;
  const text = await response.text().catch(() => "");
  let parsed: unknown = text;
  if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  const message = parseApiErrorPayload(parsed, fallback);
  const envelope = isEnvelope(parsed) ? parsed : null;
  throw new ApiError(message, response.status, envelope);
}
