import { Injectable, type MessageEvent } from "@nestjs/common";
import { Observable, Subject } from "rxjs";

/**
 * Discriminated event type for the safety realtime channel.
 *
 * Payloads are intentionally minimal — the client refetches on receipt rather
 * than merging event data into local state (matches the plan doc's
 * conflict-safe design: an event says "this changed", the client re-queries).
 */
export type SafetyEventType =
  | "safety.incident.changed"
  | "safety.hazard.changed"
  | "safety.muster.changed";

export type SafetyEvent = {
  type: SafetyEventType;
  /**
   * Site scope for the event. Only populated for `safety.muster.changed`
   * (muster events are always site-scoped); omitted for incident/hazard
   * events which are org-wide.
   */
  siteId?: string | null;
};

/**
 * In-process pub-sub for safety realtime events.
 *
 * `emit` is called by `SafetyService` and `MusterService` strictly AFTER the
 * relevant Prisma write commits — never inside a transaction — so subscribers
 * never see a "changed" signal for a write that later rolls back.
 *
 * `stream()` returns an `Observable<MessageEvent>` shaped for Nest's `@Sse`
 * decorator; the SSE controller subscribes per-connection so a dropped
 * connection tears down its own subscription.
 *
 * Single-instance assumption (per `docs/plans/realtime-websockets-plan.md`):
 * this works while the API runs on a single App Service instance. Scaling
 * out would need a Redis/pub-sub backplane so an emit on instance A reaches
 * subscribers on instance B — out of scope for v1.
 */
@Injectable()
export class SafetyRealtimeEmitter {
  private readonly subject = new Subject<SafetyEvent>();

  emit(event: SafetyEvent): void {
    this.subject.next(event);
  }

  stream(): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const sub = this.subject.subscribe((event) => {
        subscriber.next({ type: event.type, data: event });
      });
      return () => sub.unsubscribe();
    });
  }
}
