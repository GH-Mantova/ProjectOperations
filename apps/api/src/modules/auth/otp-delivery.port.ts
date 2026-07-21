import { Injectable, Logger } from "@nestjs/common";

// Pluggable port for delivering a FIELD-worker OTP code to a personal
// email address. Real production delivery (Microsoft Graph / SMTP) is a
// separate, Marco-supervised step — this file MUST NOT import Graph,
// Azure, or SMTP libraries. The default implementation logs the code so
// dev/CI environments can complete the flow without a real mailer.
export const OTP_DELIVERY_PORT = Symbol("OTP_DELIVERY_PORT");

export interface OtpDeliveryPort {
  deliverCode(input: { email: string; code: string; expiresAt: Date }): Promise<void>;
}

@Injectable()
export class LoggingOtpDelivery implements OtpDeliveryPort {
  private readonly logger = new Logger(LoggingOtpDelivery.name);

  async deliverCode(input: { email: string; code: string; expiresAt: Date }) {
    // Dev/CI stub. The code is intentionally logged in full so a
    // developer or e2e test can read it back — a production adapter
    // (introduced in a later PR) MUST NOT log the plaintext code.
    this.logger.log(
      `[OTP-DEV-STUB] code for ${input.email} = ${input.code} (expires ${input.expiresAt.toISOString()})`
    );
  }
}
