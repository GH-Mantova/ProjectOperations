import { randomBytes } from "crypto";

/**
 * Generate a strong, URL-safe temporary password for admin-initiated
 * resets and similar one-shot credentials. 12 random bytes encoded as
 * base64url yields ~16 characters from the [A-Za-z0-9_-] alphabet —
 * no ambiguous characters, safe to read aloud or paste in a chat.
 */
export function generateTemporaryPassword(): string {
  return randomBytes(12).toString("base64url");
}
