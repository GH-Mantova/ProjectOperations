/**
 * Mirrors Xero's contact payment-terms vocabulary.
 *
 * Examples:
 * - day=20, type=DAY_OF_FOLLOWING_MONTH → "due on 20th of the following month"
 * - day=30, type=DAYS_AFTER_INVOICE     → "due 30 days after invoice date"
 * - day=14, type=DAYS_AFTER_END_OF_MONTH → "due 14 days after end of month"
 * - day=15, type=DAY_OF_CURRENT_MONTH   → "due on the 15th of the current month"
 *
 * Falls back to `paymentTermsDays` (legacy field) when day+type are null.
 */
export const PAYMENT_TERMS_TYPES = [
  "DAYS_AFTER_INVOICE",
  "DAYS_AFTER_END_OF_MONTH",
  "DAY_OF_CURRENT_MONTH",
  "DAY_OF_FOLLOWING_MONTH"
] as const;

export type PaymentTermsType = (typeof PAYMENT_TERMS_TYPES)[number];
