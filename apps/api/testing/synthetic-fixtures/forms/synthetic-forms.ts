/**
 * Synthetic native-forms ingestion provider — in-memory test double.
 *
 * Models the F1 (public/kiosk unauthenticated submit) and F3 (legacy raw
 * submit) surfaces from the idempotency audit in
 * `docs/qa/integration-idempotency-audit.md`. Both surfaces share the same
 * gap: they have NO `clientSubmissionId` fingerprint, so a retried call from
 * a kiosk with a flaky uplink lands a duplicate submission. This fixture makes
 * that gap deterministically observable.
 *
 * Exposes the same fault-injection / probe / call-count API as the slice-1
 * Xero provider (`../xero/synthetic-xero.ts`) so the spec in
 * `synthetic-forms.spec.ts` can exercise Case A, Case B, and
 * "degrade, never crash" flows against `../idempotency-reference.ts` without
 * touching a real database or HTTP stack.
 *
 * NOT a wire-level mock. Callers call the methods on this class directly.
 */

export interface SyntheticFormSubmission {
  submissionId: string;
  formId: string;
  /** Present when the caller supplied it; absent on unguarded submits. */
  clientSubmissionId?: string;
  values: Record<string, unknown>;
  surface: "F1" | "F3";
  submittedAt: number;
}

export class SyntheticFormsError extends Error {
  constructor(message: string, public readonly code: "circuit-open" | "injected-fault") {
    super(message);
    this.name = "SyntheticFormsError";
  }
}

interface PendingFault {
  afterCommit: boolean;
}

export class SyntheticFormIngest {
  /**
   * All stored submissions in insertion order. Multiple entries with the same
   * `clientSubmissionId` are ALLOWED by design — that is the F1/F3 gap this
   * fixture demonstrates.
   */
  private submissions: SyntheticFormSubmission[] = [];

  private pendingFault: PendingFault | null = null;
  private circuitOpen = false;
  private callCount = 0;
  private nextId = 1;

  // --- fault injection -------------------------------------------------------

  /**
   * Cause the NEXT submit call to throw once. If `afterCommit` is true the
   * submission is still recorded before the throw — modelling a real network
   * failure where the server accepted the write but the client never saw the
   * response. This is the exact scenario that makes the Case B reaper's
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

  // --- inspection ------------------------------------------------------------

  /**
   * Answer the question the Case B reaper needs to ask: "did a submission with
   * this clientSubmissionId actually land?" Returns the first matching
   * submission, or null if none exists. This is inspection-only — it does NOT
   * go through `execute()` and therefore does not increment `callCount` or
   * consume the pending fault.
   */
  probe(clientSubmissionId: string): SyntheticFormSubmission | null {
    return (
      this.submissions.find((s) => s.clientSubmissionId === clientSubmissionId) ?? null
    );
  }

  getCallCount(): number {
    return this.callCount;
  }

  /**
   * Count how many stored submissions share a given `clientSubmissionId`. A
   * count > 1 is evidence of the F1/F3 duplicate-submit gap.
   */
  countSubmissionsWith(clientSubmissionId: string): number {
    return this.submissions.filter((s) => s.clientSubmissionId === clientSubmissionId)
      .length;
  }

  // --- provider surfaces -----------------------------------------------------

  /**
   * F1 — public/kiosk unauthenticated submit.
   *
   * When `clientSubmissionId` is absent (the current production gap): every
   * call creates a NEW submission, so a retried POST from a kiosk with a flaky
   * uplink lands N duplicates.
   *
   * When `clientSubmissionId` IS present (the fix): a caller can detect
   * duplicates via `probe()` and wrap in `runCaseA` / `runCaseB`.
   */
  publicSubmit(input: {
    formId: string;
    clientSubmissionId?: string;
    values: Record<string, unknown>;
  }): SyntheticFormSubmission {
    return this.execute(() => {
      const submission: SyntheticFormSubmission = {
        submissionId: this.mintId("sub"),
        formId: input.formId,
        ...(input.clientSubmissionId !== undefined
          ? { clientSubmissionId: input.clientSubmissionId }
          : {}),
        values: input.values,
        surface: "F1",
        submittedAt: Date.now(),
      };
      // Modelling F1: NO deduplication on clientSubmissionId. A second submit
      // with the SAME clientSubmissionId lands a SECOND submission row. That is
      // the gap the idempotency guard is meant to prevent.
      this.submissions.push(submission);
      return submission;
    });
  }

  /**
   * F3 — legacy raw submit.
   *
   * Same gap as F1: unconditional `formSubmission.create` with no fingerprint
   * check. Retries duplicate.
   */
  legacySubmit(input: {
    formId: string;
    clientSubmissionId?: string;
    values: Record<string, unknown>;
  }): SyntheticFormSubmission {
    return this.execute(() => {
      const submission: SyntheticFormSubmission = {
        submissionId: this.mintId("sub"),
        formId: input.formId,
        ...(input.clientSubmissionId !== undefined
          ? { clientSubmissionId: input.clientSubmissionId }
          : {}),
        values: input.values,
        surface: "F3",
        submittedAt: Date.now(),
      };
      // Modelling F3: same unconditional create, same duplication gap.
      this.submissions.push(submission);
      return submission;
    });
  }

  // --- internals -------------------------------------------------------------

  private execute<T>(commit: () => T): T {
    this.callCount += 1;
    if (this.circuitOpen) {
      throw new SyntheticFormsError("circuit open", "circuit-open");
    }
    const fault = this.pendingFault;
    if (fault && !fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticFormsError("injected fault before commit", "injected-fault");
    }
    const result = commit();
    if (fault && fault.afterCommit) {
      this.pendingFault = null;
      throw new SyntheticFormsError("injected fault after commit", "injected-fault");
    }
    return result;
  }

  private mintId(prefix: string): string {
    const id = `${prefix}-${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}
