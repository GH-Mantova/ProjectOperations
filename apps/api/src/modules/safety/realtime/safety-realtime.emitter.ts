import { Injectable } from "@nestjs/common";
import type { Response } from "express";

export type SafetySseConnection = {
  connectionId: string;
  response: Response;
};

/**
 * RT-2 — Safety realtime SSE emitter.
 *
 * Single-process, in-memory registry for `GET /safety/realtime/stream`
 * subscribers. Mirrors the shape of `SchedulerPresenceRegistry` (RT-1) but
 * kept module-local rather than shared: RT-1 stayed scheduler-scoped, so the
 * safety module keeps its own small registry rather than force a premature
 * cross-module abstraction.
 *
 * Event types emitted:
 *   - `safety.incident.changed` — after an incident is created / updated / closed.
 *   - `safety.hazard.changed`   — after a hazard is created / updated / closed.
 *   - `safety.muster.changed`   — after a muster event starts, an attendee is
 *                                 checked, or the event completes / cancels.
 *                                 Payload carries `siteId` so a client viewing
 *                                 site X can filter to muster changes on site X.
 *   - `safety.heartbeat`        — every 30 s (keep-alive; prevents proxy timeouts).
 *
 * Event payloads are intentionally minimal — receivers refetch the resource
 * they're bound to; the payload is a nudge, not the new state. Matches the
 * conflict-safe design RT-1 set for the scheduler grid.
 */
@Injectable()
export class SafetyRealtimeEmitter {
  private readonly connections = new Map<string, SafetySseConnection>();
  private nextId = 1;

  allocateId(): string {
    return `sf-${this.nextId++}`;
  }

  register(conn: SafetySseConnection): void {
    this.connections.set(conn.connectionId, conn);
  }

  unregister(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  get count(): number {
    return this.connections.size;
  }

  /**
   * Broadcast an SSE event to every current subscriber.
   *
   * Each message is formatted as `event: <eventName>\ndata: <json>\n\n`.
   * Closed connections are silently skipped and will be cleaned up on the
   * next heartbeat / close handler.
   */
  broadcast(eventName: string, data: unknown): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const conn of this.connections.values()) {
      try {
        if (!conn.response.writableEnded) {
          conn.response.write(payload);
        }
      } catch {
        // Connection gone — ignore; close handler will unregister.
      }
    }
  }

  incidentChanged(payload: { id: string; action: "create" | "update" | "close" }): void {
    this.broadcast("safety.incident.changed", payload);
  }

  hazardChanged(payload: { id: string; action: "create" | "update" | "close" }): void {
    this.broadcast("safety.hazard.changed", payload);
  }

  musterChanged(payload: {
    siteId: string;
    eventId?: string;
    action: "start" | "check" | "complete" | "cancel";
  }): void {
    this.broadcast("safety.muster.changed", payload);
  }
}
