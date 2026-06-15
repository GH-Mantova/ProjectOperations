export type CorrespondenceSendInput = {
  to: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  /**
   * Reference token to embed (e.g. "[ref:abc123]") so inbound replies can be
   * matched back to the originating thread regardless of the recipient's
   * mail client behaviour.
   */
  referenceKey: string;
};

export type CorrespondenceSendResult = {
  externalId: string;
  sentAt: Date;
};

export type CorrespondenceInboundRaw = {
  externalId?: string;
  from: string;
  to?: string[];
  cc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  receivedAt?: Date;
};

export type CorrespondenceInboundParsed = CorrespondenceInboundRaw & {
  /** Reference token extracted from subject (or null if no match). */
  referenceKey: string | null;
};

export const CORRESPONDENCE_ADAPTER = Symbol("CORRESPONDENCE_ADAPTER");

export interface CorrespondenceAdapter {
  readonly mode: "mock" | "live";
  send(input: CorrespondenceSendInput): Promise<CorrespondenceSendResult>;
}
