/**
 * Synthetic Graph-mail provider — in-memory test double.
 *
 * Models the Microsoft Graph `sendMail`-style surface the idempotency audit's
 * M-rows touch (M1 sendNotificationEmail, M2 PO issued email, M3 client quote
 * send, M4 access-request notify, M5 tender task-assign). Each accepted send
 * is recorded by a caller-supplied natural key (a `messageReference` / dedupe
 * key), so a caller — or the Case B reaper — can ask "did the message with
 * this reference land?". Critically, the provider does NOT dedupe on its own:
 * a second send with the same reference lands a SECOND message, exactly like
 * slice-1's `createInvoice`. That non-dedupe is the whole reason the caller
 * needs the idempotency guard (see docs/qa/integration-idempotency-audit.md
 * M1: "notification emails have no dedupe").
 *
 * NOT a wire-level mock. Callers do not go through HTTP; they call the
 * methods on this class directly. HTTP-level mocking is a later slice.
 */

export interface SyntheticGraphMessage {
  messageId: string;
  reference: string;
  toRecipients: string[];
  subject: string;
  body: string;
  hasAttachment: boolean;
  sentAt: number;
}

export type SyntheticGraphEntity = { kind: "message"; entity: SyntheticGraphMessage };

export class SyntheticGraphMailError extends Error {
  constructor(message: string, public readonly code: "circuit-open" | "injected-fault") {
    super(message);
    this.name = "SyntheticGraphMailError";
  }
}

interface PendingFault {
  afterCommit: boolean;
}

export interface SendMailInput {
  /**
   * Caller-supplied natural key. In production this is the audit's
   * `messageReference` — e.g. `po-issued:<purchaseOrderId>` or
   * `notify:<eventId>`. The provider records every accepted send under this
   * key without deduping: two identical sends produce two messages.
   */
  reference: string;
  toRecipients: string[];
  subject: string;
  body: string;
  hasAttachment?: boolean;
}

export class SyntheticGraphMailProvider {
  private messagesByReference = new Map<string, SyntheticGraphMessage[]>();

  private pendingFault: PendingFault | null = null;
  private circuitOpen = false;
  private callCount = 0;
  private nextId = 1;

  // --- fault injection -----------------------------------------------------

  /**
   * Cause the NEXT call to throw once. If `afterCommit` is true, the message
   * is still recorded on the provider side before the throw — modelling a
   * real network failure where Graph accepted the send but the client never
   * saw the response. This is the exact case that makes the Case B reaper's
   * "probe before assuming" rule load-bearing ([[LL-39]]).
   */
  failNextCall(opts: { afterCommit?: boolean } = {}): void {
    this.pendingFault = { afterCommit: opts.afterCommit === true };
  }

  openCircuit(): void {
    this.circuitOpen = true;
  }

  closeCircuit(): void {
    this.circuitOpen = false;
  }

  // --- inspection ----------------------------------------------------------

  /**
   * Answer the question the Case B reaper needs to ask: "did the message
   * with this reference land?" Returns the first landed message if so,
   * null if not. Inspection-only — does not go through `execute()`, so it
   * never trips fault injection and does not increment the call count.
   */
  probe(reference: string): SyntheticGraphEntity | null {
    const messages = this.messagesByReference.get(reference);
    if (messages && messages.length > 0) {
      return { kind: "message", entity: messages[0] };
    }
    return null;
  }

  getCallCount(): number {
    return this.callCount;
  }

  countSendsWithReference(reference: string): number {
    return this.messagesByReference.get(reference)?.length ?? 0;
  }

  // --- provider surface ----------------------------------------------------

  sendMail(input: SendMailInput): SyntheticGraphMessage {
    return this.execute(() => {
      const message: SyntheticGraphMessage = {
        messageId: this.mintId("message"),
        reference: input.reference,
        toRecipients: [...input.toRecipients],
        subject: input.subject,
        body: input.body,
        hasAttachment: input.hasAttachment === true,
        sentAt: Date.now(),
      };
      // Modelling Graph: it does NOT dedupe on our reference. A second
      // sendMail with the same reference APPENDS a second message. That is
      // the whole reason the caller needs an idempotency guard.
      const existing = this.messagesByReference.get(input.reference);
      if (existing) {
        existing.push(message);
      } else {
        this.messagesByReference.set(input.reference, [message]);
      }
      return message;
    });
  }

  // --- internals -----------------------------------------------------------

  private execute<T>(commit: () => T): T {
    this.callCount += 1;
    if (this.circuitOpen) {
      throw new SyntheticGraphMailError("circuit open", "circuit-open");
    }
    const fault = this.pendingFault;
    if (fault && !fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticGraphMailError("injected fault before commit", "injected-fault");
    }
    const result = commit();
    if (fault && fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticGraphMailError("injected fault after commit", "injected-fault");
    }
    return result;
  }

  private mintId(prefix: string): string {
    const id = `${prefix}-${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}
