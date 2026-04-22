import type { EmailProvider } from "../email-provider.interface";

/** Stub — the Google Workspace provider will arrive in a follow-up PR. */
export class GmailEmailProvider implements EmailProvider {
  readonly name = "gmail" as const;
  async sendMail(): Promise<void> {
    throw new Error("Gmail provider not yet configured. Coming soon.");
  }
  async verifyConnection(): Promise<{ message: string }> {
    throw new Error("Gmail provider not yet configured. Coming soon.");
  }
}
