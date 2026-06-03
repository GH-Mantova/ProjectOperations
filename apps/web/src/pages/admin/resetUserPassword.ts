/**
 * POST helper for the admin reset-password endpoint.
 *
 * Extracted from `AdminUsersTab.tsx` so the request/response shape
 * is unit-testable without a DOM. The component just renders the
 * confirm modal, calls this helper, and routes the result into the
 * follow-up "temporary password" CenteredModal.
 */
export type ResetPasswordResponse = {
  userId: string;
  temporaryPassword: string;
  message?: string;
};

export type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

export class ResetPasswordError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ResetPasswordError";
  }
}

export async function performAdminResetPassword(
  authFetch: AuthFetch,
  userId: string
): Promise<ResetPasswordResponse> {
  const response = await authFetch(`/admin/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST"
  });

  if (!response.ok) {
    const text = await safeReadText(response);
    throw new ResetPasswordError(response.status, text || `Reset failed (${response.status}).`);
  }

  const body = (await response.json()) as Partial<ResetPasswordResponse>;
  if (!body || typeof body.userId !== "string" || typeof body.temporaryPassword !== "string") {
    throw new ResetPasswordError(
      500,
      "Reset succeeded but the response was missing the temporary password. Check server logs."
    );
  }
  return {
    userId: body.userId,
    temporaryPassword: body.temporaryPassword,
    message: typeof body.message === "string" ? body.message : undefined
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Tiny copy-to-clipboard helper. Uses the async Clipboard API where
 * available and falls back to a hidden textarea + execCommand so the
 * admin can still grab the temporary password on older browsers.
 * Returns true on success.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }
  if (typeof document === "undefined") return false;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}
