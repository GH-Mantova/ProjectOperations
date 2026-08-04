/**
 * Synthetic Xero provider — in-memory test double.
 *
 * Models the surfaces the idempotency audit's X-rows touch (contact upsert,
 * ACCREC invoice, ACCPAY bill), keyed by their natural reference so a caller
 * can detect duplicates. Exposes deterministic fault injection so the tests
 * in `synthetic-xero.spec.ts` can exercise the Case A / Case B / degrade
 * flows in `../idempotency-reference.ts` without touching a real tenant.
 *
 * NOT a wire-level mock. Callers do not go through HTTP; they call the
 * methods on this class directly. HTTP-level mocking is a later slice.
 */

export interface SyntheticContact {
  contactId: string;
  name: string;
}

export interface SyntheticInvoice {
  invoiceId: string;
  reference: string;
  amount: number;
  contactId: string;
}

export interface SyntheticBill {
  billId: string;
  reference: string;
  amount: number;
  contactId: string;
}

export type SyntheticEntity =
  | { kind: "contact"; entity: SyntheticContact }
  | { kind: "invoice"; entity: SyntheticInvoice }
  | { kind: "bill"; entity: SyntheticBill };

export class SyntheticXeroError extends Error {
  constructor(message: string, public readonly code: "circuit-open" | "injected-fault") {
    super(message);
    this.name = "SyntheticXeroError";
  }
}

interface PendingFault {
  afterCommit: boolean;
}

export class SyntheticXeroProvider {
  private contactsByName = new Map<string, SyntheticContact>();
  private invoicesByReference = new Map<string, SyntheticInvoice>();
  private billsByReference = new Map<string, SyntheticBill>();

  private pendingFault: PendingFault | null = null;
  private circuitOpen = false;
  private callCount = 0;
  private nextId = 1;

  // --- fault injection -----------------------------------------------------

  /**
   * Cause the NEXT call to throw once. If `afterCommit` is true, the entity is
   * still recorded on the provider side before the throw — modelling a real
   * network failure where the server accepted the write but the client never
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
   * Answer the question the Case B reaper needs to ask: "did the entity with
   * this reference land?" Returns the entity record if so, null if not.
   */
  probe(reference: string): SyntheticEntity | null {
    const invoice = this.invoicesByReference.get(reference);
    if (invoice) return { kind: "invoice", entity: invoice };
    const bill = this.billsByReference.get(reference);
    if (bill) return { kind: "bill", entity: bill };
    return null;
  }

  probeContact(name: string): SyntheticContact | null {
    return this.contactsByName.get(name) ?? null;
  }

  getCallCount(): number {
    return this.callCount;
  }

  countInvoicesWithReference(reference: string): number {
    return this.invoicesByReference.has(reference) ? 1 : 0;
  }

  countBillsWithReference(reference: string): number {
    return this.billsByReference.has(reference) ? 1 : 0;
  }

  // --- provider surfaces ---------------------------------------------------

  createContact(input: { name: string }): SyntheticContact {
    return this.execute(() => {
      const existing = this.contactsByName.get(input.name);
      if (existing) return existing;
      const contact: SyntheticContact = {
        contactId: this.mintId("contact"),
        name: input.name,
      };
      this.contactsByName.set(input.name, contact);
      return contact;
    });
  }

  createInvoice(input: { reference: string; amount: number; contactId: string }): SyntheticInvoice {
    return this.execute(() => {
      const invoice: SyntheticInvoice = {
        invoiceId: this.mintId("invoice"),
        reference: input.reference,
        amount: input.amount,
        contactId: input.contactId,
      };
      // Modelling Xero: it does NOT dedupe on reference. A second createInvoice
      // with the same reference lands a SECOND invoice. That is the whole
      // reason the caller needs an idempotency guard.
      this.invoicesByReference.set(input.reference, invoice);
      return invoice;
    });
  }

  createBill(input: { reference: string; amount: number; contactId: string }): SyntheticBill {
    return this.execute(() => {
      const bill: SyntheticBill = {
        billId: this.mintId("bill"),
        reference: input.reference,
        amount: input.amount,
        contactId: input.contactId,
      };
      this.billsByReference.set(input.reference, bill);
      return bill;
    });
  }

  // --- internals -----------------------------------------------------------

  private execute<T>(commit: () => T): T {
    this.callCount += 1;
    if (this.circuitOpen) {
      throw new SyntheticXeroError("circuit open", "circuit-open");
    }
    const fault = this.pendingFault;
    if (fault && !fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticXeroError("injected fault before commit", "injected-fault");
    }
    const result = commit();
    if (fault && fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticXeroError("injected fault after commit", "injected-fault");
    }
    return result;
  }

  private mintId(prefix: string): string {
    const id = `${prefix}-${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}
