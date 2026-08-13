import { Injectable } from "@nestjs/common";
import type { Response } from "express";

export type PresenceEntry = {
  connectionId: string;
  userId: string;
  name: string;
};

export type SseConnection = {
  connectionId: string;
  userId: string;
  name: string;
  response: Response;
};

/**
 * In-memory registry for active SSE connections on the scheduler realtime
 * channel (RT-3).
 *
 * Single-process, single-instance assumption — the same assumption RT-1
 * documented. No Redis/pub-sub backplane.
 *
 * The registry is responsible for:
 *   1. Tracking who currently has the scheduler grid open (presence).
 *   2. Broadcasting SSE events (allocation change + presence change) to all
 *      open connections.
 *
 * Connection lifecycle:
 *   - `register(conn)`  — called when the SSE stream endpoint opens.
 *   - `unregister(id)` — called when the client disconnects.
 *   - `broadcast(event, data)` — push an SSE event to every live subscriber.
 */
@Injectable()
export class SchedulerPresenceRegistry {
  private readonly connections = new Map<string, SseConnection>();
  private nextId = 1;

  /** Allocate a fresh unique connection ID for this SSE session. */
  allocateId(): string {
    return `sc-${this.nextId++}`;
  }

  /** Register an open SSE connection. Broadcasts a presence-update to all peers. */
  register(conn: SseConnection): void {
    this.connections.set(conn.connectionId, conn);
    this.broadcastPresence();
  }

  /** Remove a connection (on client disconnect). Broadcasts presence-update. */
  unregister(connectionId: string): void {
    this.connections.delete(connectionId);
    this.broadcastPresence();
  }

  /** Current number of active connections. */
  get count(): number {
    return this.connections.size;
  }

  /** Snapshot of all present users (one entry per connection). */
  get roster(): PresenceEntry[] {
    return Array.from(this.connections.values()).map((c) => ({
      connectionId: c.connectionId,
      userId: c.userId,
      name: c.name
    }));
  }

  /**
   * Broadcast an SSE event to every current subscriber.
   *
   * Each message is formatted as:
   *   `event: <eventName>\ndata: <json>\n\n`
   *
   * Connections whose response has already been closed are silently
   * skipped and will be cleaned up on the next heartbeat/disconnect.
   */
  broadcast(eventName: string, data: unknown): void {
    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const conn of this.connections.values()) {
      try {
        if (!conn.response.writableEnded) {
          conn.response.write(payload);
        }
      } catch {
        // Connection gone — ignore; it will unregister via the close handler.
      }
    }
  }

  /** Convenience: push a presence-update event to all subscribers. */
  broadcastPresence(): void {
    this.broadcast("scheduler.presence", {
      count: this.count,
      roster: this.roster
    });
  }

  /**
   * Convenience: push an allocation-changed event to all subscribers.
   *
   * `changedBy` is excluded from callers seeing their own write trigger a
   * nudge — the client hook decides whether to surface it based on whether
   * the current user's id matches.
   */
  broadcastAllocationChanged(payload: {
    changedBy: { userId: string; name: string };
    projectId: string;
    date: string;
    targetType: "WORKER" | "ASSET";
    action: "upsert" | "delete" | "range";
  }): void {
    this.broadcast("scheduler.allocation.changed", payload);
  }
}
