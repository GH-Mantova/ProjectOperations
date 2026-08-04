import {
  IdempotencyStore,
  reapCaseB,
  runCaseA,
  runCaseB,
  withDegrade,
  type DeliveryAuditEntry,
} from "../idempotency-reference";
import { SyntheticXeroError, SyntheticXeroProvider } from "./synthetic-xero";

describe("synthetic Xero + idempotency reference", () => {
  let xero: SyntheticXeroProvider;
  let store: IdempotencyStore;

  beforeEach(() => {
    xero = new SyntheticXeroProvider();
    store = new IdempotencyStore();
  });

  // (A) Case A: retried call with same key replays stored result and creates
  //     exactly ONE downstream Xero entity.
  describe("(A) Case A — same-key retry replays without a second Xero create", () => {
    it("second call with same key returns stored payload; provider sees one create", async () => {
      const key = "expense-42";
      const contact = xero.createContact({ name: "Acme Ltd" });

      const first = await runCaseA(store, key, () =>
        xero.createBill({ reference: "BILL-42", amount: 100, contactId: contact.contactId }),
      );
      const second = await runCaseA(store, key, () =>
        xero.createBill({ reference: "BILL-42", amount: 100, contactId: contact.contactId }),
      );

      expect(second).toEqual(first);
      expect(second.billId).toBe(first.billId);
      expect(xero.countBillsWithReference("BILL-42")).toBe(1);
      expect(store.get(key)?.status).toBe("COMPLETED");
    });

    it("business-function failure rolls the key back so a fresh retry can proceed", async () => {
      const key = "expense-43";
      await expect(
        runCaseA(store, key, () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");

      expect(store.get(key)).toBeNull();

      const retry = await runCaseA(store, key, () =>
        xero.createBill({ reference: "BILL-43", amount: 50, contactId: "contact-x" }),
      );
      expect(retry.reference).toBe("BILL-43");
      expect(store.get(key)?.status).toBe("COMPLETED");
    });
  });

  // (B) Case B: mid-call failure leaves PROCESSING; reaper probes and only
  //     completes iff the entity actually landed. Blind re-fire is a bug.
  describe("(B) Case B — PROCESSING row + probing reaper", () => {
    it("failure AFTER commit leaves PROCESSING; probe finds entity; reaper completes it — no re-fire", async () => {
      const key = "invoice-claim-9";
      xero.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const invoice = xero.createInvoice({
            reference: "PC-9",
            amount: 500,
            contactId: "client-1",
          });
          return { providerReference: invoice.reference, payload: invoice };
        }),
      ).rejects.toBeInstanceOf(SyntheticXeroError);

      expect(store.get(key)?.status).toBe("PROCESSING");
      expect(xero.countInvoicesWithReference("PC-9")).toBe(1);

      const callsBeforeReap = xero.getCallCount();
      const reaped = await reapCaseB(store, key, () => {
        const found = xero.probe("PC-9");
        if (found && found.kind === "invoice") {
          return { landed: true, providerReference: found.entity.reference, responsePayload: found.entity };
        }
        return { landed: false };
      });

      expect(reaped.status).toBe("COMPLETED");
      expect(reaped.providerReference).toBe("PC-9");
      // The reaper's probe is inspection-only — it must not go through the
      // fault-injected execute() path. Call count is unchanged.
      expect(xero.getCallCount()).toBe(callsBeforeReap);
      expect(xero.countInvoicesWithReference("PC-9")).toBe(1);
    });

    it("failure BEFORE commit leaves PROCESSING; probe finds nothing; reaper marks FAILED (never blind-completes)", async () => {
      const key = "invoice-claim-10";
      xero.failNextCall({ afterCommit: false });

      await expect(
        runCaseB(store, key, async () => {
          const invoice = xero.createInvoice({
            reference: "PC-10",
            amount: 500,
            contactId: "client-1",
          });
          return { providerReference: invoice.reference, payload: invoice };
        }),
      ).rejects.toBeInstanceOf(SyntheticXeroError);

      expect(store.get(key)?.status).toBe("PROCESSING");
      expect(xero.countInvoicesWithReference("PC-10")).toBe(0);

      const reaped = await reapCaseB(store, key, () => {
        const found = xero.probe("PC-10");
        return found ? { landed: true, providerReference: "PC-10" } : { landed: false };
      });

      expect(reaped.status).toBe("FAILED");
      expect(xero.countInvoicesWithReference("PC-10")).toBe(0);
    });

    it("retry against a PROCESSING key does NOT re-fire the external call", async () => {
      const key = "invoice-claim-11";
      xero.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const invoice = xero.createInvoice({
            reference: "PC-11",
            amount: 100,
            contactId: "client-1",
          });
          return { providerReference: invoice.reference, payload: invoice };
        }),
      ).rejects.toBeInstanceOf(SyntheticXeroError);

      const callsAfterFirst = xero.getCallCount();
      await expect(
        runCaseB(store, key, async () => {
          throw new Error("this callback must not run — key is PROCESSING");
        }),
      ).rejects.toThrow(/PROCESSING/);

      expect(xero.getCallCount()).toBe(callsAfterFirst);
      expect(xero.countInvoicesWithReference("PC-11")).toBe(1);
    });
  });

  // (D) Degrade path: circuit-open ⇒ audit entry, no throw, primary action
  //     survives.
  describe("(D) withDegrade — circuit-open logs a delivery-audit and does not throw", () => {
    it("primary result is preserved; side-effect failure surfaces only via the audit sink", async () => {
      const audit: DeliveryAuditEntry[] = [];
      xero.openCircuit();

      const primary = { orderId: "ORDER-1", status: "ISSUED" as const };
      const outcome = await withDegrade(
        "po-email-ORDER-1",
        () => {
          xero.createInvoice({ reference: "ORDER-1", amount: 1, contactId: "c" });
        },
        audit,
      );

      expect(outcome.ok).toBe(false);
      expect(primary.status).toBe("ISSUED");
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ key: "po-email-ORDER-1", ok: false });
      expect(audit[0].error).toMatch(/circuit open/i);
      expect(xero.countInvoicesWithReference("ORDER-1")).toBe(0);
    });

    it("closed circuit records ok=true and lands the entity", async () => {
      const audit: DeliveryAuditEntry[] = [];
      const outcome = await withDegrade(
        "po-email-ORDER-2",
        () => {
          xero.createInvoice({ reference: "ORDER-2", amount: 1, contactId: "c" });
        },
        audit,
      );

      expect(outcome.ok).toBe(true);
      expect(audit).toEqual([expect.objectContaining({ key: "po-email-ORDER-2", ok: true })]);
      expect(xero.countInvoicesWithReference("ORDER-2")).toBe(1);
    });
  });
});
