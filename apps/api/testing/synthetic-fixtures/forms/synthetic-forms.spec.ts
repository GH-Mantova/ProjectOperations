import {
  DeliveryAuditEntry,
  IdempotencyStore,
  reapCaseB,
  runCaseA,
  runCaseB,
  withDegrade,
} from "../idempotency-reference";
import { SyntheticFormsError, SyntheticFormIngest } from "./synthetic-forms";

describe("synthetic forms ingestion + idempotency reference", () => {
  let forms: SyntheticFormIngest;
  let store: IdempotencyStore;

  beforeEach(() => {
    forms = new SyntheticFormIngest();
    store = new IdempotencyStore();
  });

  // (A) F1/F3 duplicate-submit gap demonstration.
  //
  // With a clientSubmissionId and a runCaseA / runCaseB guard in place, a
  // second call with the same key returns the stored payload and does NOT land
  // a second submission. WITHOUT the guard the provider records a duplicate —
  // which is the F1/F3 gap the audit (HIGH severity) documents.
  describe("(A) F1 duplicate-submit gap — clientSubmissionId replay", () => {
    it("WITH idempotency guard: second submit returns stored payload; provider has ONE submission", async () => {
      const key = "form-101-csid-abc123";
      const input = {
        formId: "form-101",
        clientSubmissionId: "csid-abc123",
        values: { name: "Test User", answer: "yes" },
      };

      const first = await runCaseA(store, key, () => forms.publicSubmit(input));
      const second = await runCaseA(store, key, () => forms.publicSubmit(input));

      expect(second).toEqual(first);
      expect(second.submissionId).toBe(first.submissionId);
      expect(forms.countSubmissionsWith("csid-abc123")).toBe(1);
      expect(store.get(key)?.status).toBe("COMPLETED");
    });

    it("WITHOUT idempotency guard: same clientSubmissionId lands TWO submissions — the F1/F3 gap", () => {
      // No runCaseA wrapper — calls go straight to the provider, modelling the
      // current unguarded production surface.
      const input = {
        formId: "form-101",
        clientSubmissionId: "csid-dup",
        values: { name: "Kiosk User" },
      };

      forms.publicSubmit(input);
      forms.publicSubmit(input);

      // The gap: two identical calls, two stored submissions.
      expect(forms.countSubmissionsWith("csid-dup")).toBe(2);
    });

    it("F3 legacy path: no clientSubmissionId means every submit is a fresh duplicate", () => {
      // No clientSubmissionId supplied, no guard — this is the zero-protection
      // legacy raw-submit path.
      const input = { formId: "form-legacy", values: { raw: true } };

      forms.legacySubmit(input);
      forms.legacySubmit(input);

      // No clientSubmissionId on either; we cannot even probe — every call is
      // unconditionally recorded. Demonstrate via call count.
      expect(forms.getCallCount()).toBe(2);
    });

    it("business-function failure rolls the key back so a fresh retry can proceed", async () => {
      const key = "form-102-csid-fail";
      await expect(
        runCaseA(store, key, () => {
          throw new Error("transient write failure");
        }),
      ).rejects.toThrow("transient write failure");

      // Key was rolled back — a fresh retry with the same key can proceed.
      expect(store.get(key)).toBeNull();

      const retry = await runCaseA(store, key, () =>
        forms.publicSubmit({
          formId: "form-102",
          clientSubmissionId: "csid-fail",
          values: { retry: true },
        }),
      );
      expect(retry.clientSubmissionId).toBe("csid-fail");
      expect(store.get(key)?.status).toBe("COMPLETED");
    });
  });

  // (B) Partial-write posture — Case B PROCESSING row + probing reaper.
  //
  // `failNextCall({ afterCommit: true })` models the real scenario where the
  // server accepted the write (submission IS recorded) but the client never
  // saw the 200. The caller's record is stuck at PROCESSING. The reaper MUST
  // probe the provider to discover whether the submission landed — it must not
  // blindly assume it did or did not.
  describe("(B) Partial-write posture — PROCESSING row + probing reaper", () => {
    it("failure AFTER commit leaves PROCESSING; probe finds submission; reaper completes it — no re-fire", async () => {
      const key = "form-201-csid-B1";
      forms.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const sub = forms.publicSubmit({
            formId: "form-201",
            clientSubmissionId: "csid-B1",
            values: { q1: "answer" },
          });
          return { providerReference: sub.clientSubmissionId!, payload: sub };
        }),
      ).rejects.toBeInstanceOf(SyntheticFormsError);

      // The PROCESSING record is left behind — the partial-write posture.
      expect(store.get(key)?.status).toBe("PROCESSING");
      // The submission DID land server-side (afterCommit fault).
      expect(forms.countSubmissionsWith("csid-B1")).toBe(1);

      const callsBeforeReap = forms.getCallCount();
      const reaped = await reapCaseB(store, key, () => {
        const found = forms.probe("csid-B1");
        if (found) {
          return {
            landed: true,
            providerReference: found.clientSubmissionId,
            responsePayload: found,
          };
        }
        return { landed: false };
      });

      expect(reaped.status).toBe("COMPLETED");
      expect(reaped.providerReference).toBe("csid-B1");
      // The reaper's probe goes through the inspection path, not execute().
      // Call count must be unchanged — no second submit was fired.
      expect(forms.getCallCount()).toBe(callsBeforeReap);
      expect(forms.countSubmissionsWith("csid-B1")).toBe(1);
    });

    it("failure BEFORE commit leaves PROCESSING; probe finds nothing; reaper marks FAILED — never blind-completes", async () => {
      const key = "form-201-csid-B2";
      forms.failNextCall({ afterCommit: false });

      await expect(
        runCaseB(store, key, async () => {
          const sub = forms.publicSubmit({
            formId: "form-201",
            clientSubmissionId: "csid-B2",
            values: { q1: "answer" },
          });
          return { providerReference: sub.clientSubmissionId!, payload: sub };
        }),
      ).rejects.toBeInstanceOf(SyntheticFormsError);

      expect(store.get(key)?.status).toBe("PROCESSING");
      // Before-commit fault: nothing was recorded.
      expect(forms.countSubmissionsWith("csid-B2")).toBe(0);

      const reaped = await reapCaseB(store, key, () => {
        const found = forms.probe("csid-B2");
        return found ? { landed: true, providerReference: found.clientSubmissionId } : { landed: false };
      });

      // Probe returned nothing → reaper marks FAILED, never blind-completes.
      expect(reaped.status).toBe("FAILED");
      expect(forms.countSubmissionsWith("csid-B2")).toBe(0);
    });

    it("retry against a PROCESSING key does NOT re-fire the external call", async () => {
      const key = "form-201-csid-B3";
      forms.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const sub = forms.publicSubmit({
            formId: "form-201",
            clientSubmissionId: "csid-B3",
            values: { q1: "answer" },
          });
          return { providerReference: sub.clientSubmissionId!, payload: sub };
        }),
      ).rejects.toBeInstanceOf(SyntheticFormsError);

      const callsAfterFirst = forms.getCallCount();
      // A second runCaseB with the same key must throw (PROCESSING guard),
      // not fire the external call again.
      await expect(
        runCaseB(store, key, async () => {
          throw new Error("this callback must not run — key is PROCESSING");
        }),
      ).rejects.toThrow(/PROCESSING/);

      expect(forms.getCallCount()).toBe(callsAfterFirst);
      expect(forms.countSubmissionsWith("csid-B3")).toBe(1);
    });
  });

  // (D) Graceful degrade — Forms v2 §4.4 bar.
  //
  // With the circuit open, `withDegrade` must write a delivery-audit entry and
  // NOT throw. The primary action (the form submit itself, already completed)
  // must survive. The outbound side-effect (e.g. notifying a downstream
  // consumer) is where the circuit failure lands.
  describe("(D) withDegrade — circuit-open logs a delivery-audit and does not throw", () => {
    it("primary result is preserved; side-effect failure surfaces only via the audit sink", async () => {
      const audit: DeliveryAuditEntry[] = [];
      forms.openCircuit();

      // Imagine the submission already succeeded; the side-effect is a
      // downstream notification that tries to re-call into forms.
      const primaryResult = { submissionId: "sub-primary", status: "SUBMITTED" as const };
      const outcome = await withDegrade(
        "forms-notify-sub-primary",
        () => {
          // This call goes through the circuit breaker and throws.
          forms.publicSubmit({ formId: "form-301", values: { q: 1 } });
        },
        audit,
      );

      expect(outcome.ok).toBe(false);
      // Primary state is untouched — the side-effect failure does not undo it.
      expect(primaryResult.status).toBe("SUBMITTED");
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ key: "forms-notify-sub-primary", ok: false });
      expect(audit[0].error).toMatch(/circuit open/i);
      // The failed call did not land any submission.
      expect(forms.countSubmissionsWith("csid-any")).toBe(0);
    });

    it("closed circuit records ok=true and lands the submission", async () => {
      const audit: DeliveryAuditEntry[] = [];
      const outcome = await withDegrade(
        "forms-notify-sub-secondary",
        () => {
          forms.publicSubmit({
            formId: "form-302",
            clientSubmissionId: "csid-ok",
            values: { q: 2 },
          });
        },
        audit,
      );

      expect(outcome.ok).toBe(true);
      expect(audit).toEqual([
        expect.objectContaining({ key: "forms-notify-sub-secondary", ok: true }),
      ]);
      expect(forms.countSubmissionsWith("csid-ok")).toBe(1);
    });
  });
});
