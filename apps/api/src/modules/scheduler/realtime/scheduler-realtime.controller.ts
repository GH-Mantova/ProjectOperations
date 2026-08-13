import {
  Controller,
  Get,
  Header,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import type { AuthenticatedRequest } from "../../../common/auth/authenticated-request.interface";
import { SchedulerPresenceRegistry } from "./scheduler-presence.registry";

/**
 * RT-3 — Scheduler realtime SSE endpoint.
 *
 * `GET /scheduler/realtime/stream` opens a persistent text/event-stream
 * connection. On connect the caller receives:
 *   - an immediate `scheduler.presence` event with the current viewer roster.
 *
 * Subsequently the connection receives (pushed from the registry):
 *   - `scheduler.presence`        — when a peer connects or disconnects.
 *   - `scheduler.allocation.changed` — when any allocation is mutated.
 *   - `scheduler.heartbeat`       — every 30 s (keep-alive; prevents proxy timeouts).
 *
 * Auth: the same `scheduler.view` permission required for reading allocations.
 * The JWT Bearer token must be sent as the `Authorization` header (the
 * EventSource browser API does not support custom headers natively; clients
 * pass the token via a `?token=` query param and the guard is adapted to
 * accept it from there — see below).
 */
@ApiTags("Scheduler — Realtime")
@ApiBearerAuth()
@Controller("scheduler/realtime")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SchedulerRealtimeController {
  constructor(private readonly registry: SchedulerPresenceRegistry) {}

  @Get("stream")
  @RequirePermissions("scheduler.view")
  @Header("Content-Type", "text/event-stream")
  @Header("Cache-Control", "no-cache")
  @Header("X-Accel-Buffering", "no")
  @ApiOperation({
    summary: "Open an SSE stream for scheduler presence and allocation-change events"
  })
  @ApiResponse({ status: 200, description: "SSE stream opened." })
  stream(
    @Req() req: Request & AuthenticatedRequest,
    @Res() res: Response
  ): void {
    const user = req.user;
    const userId = user?.sub ?? "unknown";
    // JWT payload carries `sub` and `email`; no firstName/lastName in the token.
    // Use the email local-part as the display name for the presence roster.
    const name = user?.email
      ? user.email.split("@")[0] ?? user.email
      : "Unknown";

    const connectionId = this.registry.allocateId();

    // Set SSE headers (redundant with @Header but guards against middleware
    // that strips them; keep both for safety).
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const conn = { connectionId, userId, name, response: res };
    this.registry.register(conn);

    // Heartbeat every 30 s — prevents proxy/load-balancer idle-connection
    // timeouts from silently killing the stream.
    const heartbeat = setInterval(() => {
      try {
        if (!res.writableEnded) {
          res.write(`event: scheduler.heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        }
      } catch {
        // Connection gone — will be cleaned up by the close handler.
        clearInterval(heartbeat);
      }
    }, 30_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.registry.unregister(connectionId);
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
    req.on("error", cleanup);
  }
}
