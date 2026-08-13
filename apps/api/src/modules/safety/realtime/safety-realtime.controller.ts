import { Controller, Get, Header, Req, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { JwtAuthGuard } from "../../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../../common/auth/permissions.guard";
import { RequirePermissions } from "../../../common/auth/permissions.decorator";
import type { AuthenticatedRequest } from "../../../common/auth/authenticated-request.interface";
import { SafetyRealtimeEmitter } from "./safety-realtime.emitter";

/**
 * RT-2 — Safety realtime SSE endpoint.
 *
 * `GET /safety/realtime/stream` opens a persistent `text/event-stream`
 * connection. Subscribers receive push events for incident / hazard / muster
 * changes plus a keep-alive heartbeat every 30 s.
 *
 * Auth: `safety.view` — same permission required to read the safety board or
 * the muster headcount. Bearer token is passed via the `Authorization`
 * header (the web client uses `fetch()` + ReadableStream rather than native
 * `EventSource` so it can set the header — matches RT-1).
 */
@ApiTags("Safety — Realtime")
@ApiBearerAuth()
@Controller("safety/realtime")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SafetyRealtimeController {
  constructor(private readonly emitter: SafetyRealtimeEmitter) {}

  @Get("stream")
  @RequirePermissions("safety.view")
  @Header("Content-Type", "text/event-stream")
  @Header("Cache-Control", "no-cache")
  @Header("X-Accel-Buffering", "no")
  @ApiOperation({
    summary: "Open an SSE stream for safety incident / hazard / muster change events"
  })
  @ApiResponse({ status: 200, description: "SSE stream opened." })
  stream(
    @Req() req: Request & AuthenticatedRequest,
    @Res() res: Response
  ): void {
    const connectionId = this.emitter.allocateId();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    this.emitter.register({ connectionId, response: res });

    const heartbeat = setInterval(() => {
      try {
        if (!res.writableEnded) {
          res.write(`event: safety.heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
        }
      } catch {
        clearInterval(heartbeat);
      }
    }, 30_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.emitter.unregister(connectionId);
    };

    req.on("close", cleanup);
    req.on("end", cleanup);
    req.on("error", cleanup);
  }
}
