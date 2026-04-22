export type SendMailInput = {
  to: string[];
  subject: string;
  html: string;
  text: string;
};

export interface EmailProvider {
  readonly name: "outlook" | "gmail";
  sendMail(input: SendMailInput): Promise<void>;
  /** Verify the provider can actually send mail. Returns plain text on success; throws with a user-facing message on failure. */
  verifyConnection(): Promise<{ message: string }>;
}
