import { Injectable, Logger } from "@nestjs/common";

// Pluggable port for delivering a FIELD-worker OTP code to a personal
// email address. Real production delivery (Microsoft Graph / SMTP) is a
// separate, Marco-supervised step -- this file MUST NOT import Graph,
// Azure, or SMTP libraries. The default implementation logs the code so
// dev/CI environments can complete the flow without a real mailer.
export const OTP_DELIVERY_PORT = Symbol("OTP_DELIVERY_PORT");

// SEC-A3 sentinel: presence of this symbol in the compiled output proves the
// no-credential-log guard is in this revision of the file.
export const SEC_A3_NO_CREDENTIAL_LOGS_V1 = "sec-a3";

export interface OtpDeliveryPort {
  deliverCode(input: { email: string; code: string; expiresAt: Date }): Promise<void>;
}

/**
 * Production guard: used when isProductionRuntime() is true.
 * Throws immediately -- no email is sent and nothing is logged -- so there
 * is no path by which a plaintext code reaches the log.
 * Real email delivery is wired in A2.
 */
@Injectable()
export class DisabledOtpDelivery implements OtpDeliveryPort {
  async deliverCode(_input: { email: string; code: string; expiresAt: Date }): Promise<void> {
    throw new Error("OTP email delivery is not configured in production");
  }
}

@Injectable()
export class LoggingOtpDelivery implements OtpDeliveryPort {
  private readonly logger = new Logger(LoggingOtpDelivery.name);

  async deliverCode(input: { email: string; code: string; expiresAt: Date }) {
    // Dev/CI stub. The code is intentionally logged in full so a
    // developer or e2e test can read it back -- a production adapter
    // (introduced in a later PR) MUST NOT log the plaintext code.
    this.logger.log(
      `[OTP-DEV-STUB] code for ${input.email} = ${input.code} (expires ${input.expiresAt.toISOString()})`
    );
  }
}
