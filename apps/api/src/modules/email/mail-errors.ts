/**
 * Categorised mail-provider failure types. Callers can branch on `category`
 * (or `instanceof`) without parsing error strings, so retry/back-off/admin-
 * notification decisions stay structural rather than fragile.
 */
export type MailErrorCategory =
  | "auth"
  | "rate-limit"
  | "validation"
  | "server"
  | "network"
  | "unknown";

/** Base class for mail-provider failures. */
export class MailError extends Error {
  constructor(
    message: string,
    public readonly category: MailErrorCategory,
    public readonly upstreamStatus?: number
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class MailAuthError extends MailError {
  constructor(message: string, upstreamStatus?: number) {
    super(message, "auth", upstreamStatus);
  }
}

export class MailRateLimitError extends MailError {
  constructor(
    message: string,
    upstreamStatus?: number,
    public readonly retryAfterSec?: number
  ) {
    super(message, "rate-limit", upstreamStatus);
  }
}

export class MailValidationError extends MailError {
  constructor(message: string, upstreamStatus?: number) {
    super(message, "validation", upstreamStatus);
  }
}

export class MailServerError extends MailError {
  constructor(message: string, upstreamStatus?: number) {
    super(message, "server", upstreamStatus);
  }
}

/** Maps a Graph HTTP response status to its category. */
export function categoriseGraphResponse(status: number): MailErrorCategory {
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate-limit";
  if (status >= 400 && status < 500) return "validation";
  if (status >= 500) return "server";
  return "unknown";
}

/**
 * Strips `<` and `>` characters so error-message text can be safely embedded
 * in downstream logs/UIs without risking HTML injection. Uses character-level
 * stripping rather than tag-matching: a tag-matching regex like `/<[^>]*>/g`
 * is defeated by malformed input such as `<scr<script>ipt>`, where removing
 * the inner tag reconstructs the outer. Error messages have no legitimate
 * need for angle brackets, so this is safe.
 */
export function stripAngleBrackets(s: string): string {
  return s.replace(/[<>]/g, "");
}
