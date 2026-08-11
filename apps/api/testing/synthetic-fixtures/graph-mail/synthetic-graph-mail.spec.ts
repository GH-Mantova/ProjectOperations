import {
  IdempotencyStore,
  reapCaseB,
  runCaseA,
  runCaseB,
  withDegrade,
  type DeliveryAuditEntry,
} from "../idempotency-reference";
import { SyntheticGraphMailError, SyntheticGraphMailProvider } from "./synthetic-graph-mail";

describe("synthetic Graph-mail + idempotency reference", () => {
  let graph: SyntheticGraphMailProvider;
  let store: IdempotencyStore;

  beforeEach(() => {
    graph = new SyntheticGraphMailProvider();
    store = new IdempotencyStore();
  });

  // (M1) The audit's headline finding for the Graph-mail surface:
  //      `sendNotificationEmail` has NO dedupe. Two identical raw sends land
  //      two messages. Wrapping the send in a Case A guard collapses a retry
  //      down to exactly one wire send + one replayed payload.
  describe("(M1) no-dedupe raw double-send vs Case A guarded send", () => {
    it("raw provider: two identical sends land TWO messages", () => {
      const input = {
        reference: "notify:event-42",
        toRecipients: ["approver@example.com"],
        subject: "Approval needed",
        body: "Please approve request #42",
      };

      const first = graph.sendMail(input);
      const second = graph.sendMail(input);

      expect(second.messageId).not.toBe(first.messageId);
      expect(graph.countSendsWithReference("notify:event-42")).toBe(2);
    });

    it("Case A guarded: second call with same key replays payload; provider sees ONE send", async () => {
      const key = "notify:event-42";
      const input = {
        reference: key,
        toRecipients: ["approver@example.com"],
        subject: "Approval needed",
        body: "Please approve request #42",
      };

      const first = await runCaseA(store, key, () => graph.sendMail(input));
      const second = await runCaseA(store, key, () => graph.sendMail(input));

      expect(second).toEqual(first);
      expect(second.messageId).toBe(first.messageId);
      expect(graph.countSendsWithReference(key)).toBe(1);
      expect(graph.getCallCount()).toBe(1);
      expect(store.get(key)?.status).toBe("COMPLETED");
    });
  });

  // (M2/M3) Case B: mid-call failure AFTER Graph accepted the send leaves a
  //         PROCESSING record. The reaper PROBES the provider ("did this
  //         reference land?") and completes WITHOUT re-firing the wire. This
  //         matches the PO-issued (M2) and quote-send (M3) shape where a
  //         retried endpoint call must not send a duplicate supplier/client
  //         email ([[LL-39]]: prove the instrument).
  describe("(M2/M3) Case B — PROCESSING + probing reaper on Graph-mail", () => {
    it("failure AFTER commit leaves PROCESSING; probe finds the message; reaper completes without a second wire send", async () => {
      const key = "po-issued:PO-9";
      graph.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const message = graph.sendMail({
            reference: key,
            toRecipients: ["supplier@example.com"],
            subject: "PO PO-9 issued",
            body: "Please find attached PO PO-9",
            hasAttachment: true,
          });
          return { providerReference: message.reference, payload: message };
        }),
      ).rejects.toBeInstanceOf(SyntheticGraphMailError);

      expect(store.get(key)?.status).toBe("PROCESSING");
      expect(graph.countSendsWithReference(key)).toBe(1);

      const callsBeforeReap = graph.getCallCount();
      const reaped = await reapCaseB(store, key, () => {
        const found = graph.probe(key);
        if (found && found.kind === "message") {
          return {
            landed: true,
            providerReference: found.entity.reference,
            responsePayload: found.entity,
          };
        }
        return { landed: false };
      });

      expect(reaped.status).toBe("COMPLETED");
      expect(reaped.providerReference).toBe(key);
      // The reaper's probe is inspection-only — no re-fire of the wire send.
      expect(graph.getCallCount()).toBe(callsBeforeReap);
      expect(graph.countSendsWithReference(key)).toBe(1);
    });

    it("failure BEFORE commit leaves PROCESSING; probe finds nothing; reaper marks FAILED (never blind-completes)", async () => {
      const key = "quote-send:Q-10";
      graph.failNextCall({ afterCommit: false });

      await expect(
        runCaseB(store, key, async () => {
          const message = graph.sendMail({
            reference: key,
            toRecipients: ["client@example.com"],
            subject: "Your quote Q-10",
            body: "PDF attached",
            hasAttachment: true,
          });
          return { providerReference: message.reference, payload: message };
        }),
      ).rejects.toBeInstanceOf(SyntheticGraphMailError);

      expect(store.get(key)?.status).toBe("PROCESSING");
      expect(graph.countSendsWithReference(key)).toBe(0);

      const reaped = await reapCaseB(store, key, () => {
        const found = graph.probe(key);
        return found ? { landed: true, providerReference: key } : { landed: false };
      });

      expect(reaped.status).toBe("FAILED");
      expect(graph.countSendsWithReference(key)).toBe(0);
    });

    it("retry against a PROCESSING key does NOT re-fire the Graph send", async () => {
      const key = "tender-assign:T-11";
      graph.failNextCall({ afterCommit: true });

      await expect(
        runCaseB(store, key, async () => {
          const message = graph.sendMail({
            reference: key,
            toRecipients: ["assignee@example.com"],
            subject: "Tender T-11 assigned",
            body: "Please review",
          });
          return { providerReference: message.reference, payload: message };
        }),
      ).rejects.toBeInstanceOf(SyntheticGraphMailError);

      const callsAfterFirst = graph.getCallCount();
      await expect(
        runCaseB(store, key, async () => {
          throw new Error("this callback must not run — key is PROCESSING");
        }),
      ).rejects.toThrow(/PROCESSING/);

      expect(graph.getCallCount()).toBe(callsAfterFirst);
      expect(graph.countSendsWithReference(key)).toBe(1);
    });
  });

  // (M4) Graceful degrade — the Forms v2 §4.4 bar. When Graph is down
  //      (circuit open), the primary action (e.g. access-request created)
  //      must survive and the failed side-effect must surface only through
  //      the delivery-audit sink.
  describe("(M4) withDegrade — Graph outage logs an audit and does not throw", () => {
    it("primary result is preserved; send failure surfaces only via the audit sink", async () => {
      const audit: DeliveryAuditEntry[] = [];
      graph.openCircuit();

      const primary = { accessRequestId: "AR-1", status: "PENDING" as const };
      const outcome = await withDegrade(
        "access-request-notify:AR-1",
        () => {
          graph.sendMail({
            reference: "access-request-notify:AR-1",
            toRecipients: ["admin@example.com"],
            subject: "Access request AR-1",
            body: "Please approve",
          });
        },
        audit,
      );

      expect(outcome.ok).toBe(false);
      // Primary action was NOT rolled back by the outbound failure.
      expect(primary.status).toBe("PENDING");
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ key: "access-request-notify:AR-1", ok: false });
      expect(audit[0].error).toMatch(/circuit open/i);
      expect(graph.countSendsWithReference("access-request-notify:AR-1")).toBe(0);
    });

    it("closed circuit records ok=true and lands the message", async () => {
      const audit: DeliveryAuditEntry[] = [];
      const outcome = await withDegrade(
        "notify:event-2",
        () => {
          graph.sendMail({
            reference: "notify:event-2",
            toRecipients: ["approver@example.com"],
            subject: "Approval needed",
            body: "See details",
          });
        },
        audit,
      );

      expect(outcome.ok).toBe(true);
      expect(audit).toEqual([expect.objectContaining({ key: "notify:event-2", ok: true })]);
      expect(graph.countSendsWithReference("notify:event-2")).toBe(1);
    });
  });
});
