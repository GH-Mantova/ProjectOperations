import type { MailAuthMode } from "./providers/outlook.provider";

/**
 * Structured, secret-free diagnostic returned by the admin email-test endpoint.
 *
 * Extends the flat `{ success, message }` shape so admins can tell WHY a test
 * failed — which auth mode was resolved, whether the credential could even be
 * built, and (on the client-secret path) which env var is missing. Follows the
 * failure-honesty rule from #602: name the exact variable, never leak a value.
 */
export type EmailConnectionDiagnosis = {
  /**
   * Resolved provider (`outlook` or `gmail`). `outlook` is the default when
   * `EmailProviderConfig.provider` is unset.
   */
  provider: "outlook" | "gmail";
  /**
   * Resolved `MAIL_AUTH_MODE`. `null` when the mode is not applicable (gmail)
   * or could not be parsed (an invalid MAIL_AUTH_MODE value).
   */
  authMode: MailAuthMode | null;
  /**
   * The mailbox the provider would send from — `EmailProviderConfig.senderAddress`,
   * falling back to `CompanyProfile.primaryEmail`. `null` only when neither is set.
   */
  senderAddress: string | null;
  /**
   * `true` iff the underlying token credential could be constructed (i.e. all
   * required env vars are present for client-secret; managed identity is
   * assumed constructible on any host). Being `true` does not guarantee the
   * credential will succeed at `getToken` — that requires a live IMDS endpoint
   * (managed-identity) or a valid secret (client-secret).
   */
  credentialResolved: boolean;
  /**
   * Human-readable, secret-free explanation of the outcome. Names env vars and
   * modes but never contains a secret value.
   */
  detail: string;
};
