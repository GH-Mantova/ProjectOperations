import { Controller, Sse, UseGuards, type MessageEvent } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import type { Observable } from "rxjs";
import { SafetyRealtimeEmitter } from "./safety-realtime.emitter";
import { SafetyRealtimeAuthGuard } from "./safety-realtime.guard";

/**
 * SSE endpoint for the safety realtime channel.
 *
 * Clients open a long-lived `EventSource("/api/v1/safety/realtime/stream?token=…")`
 * connection. Auth is enforced by `SafetyRealtimeAuthGuard` before the
 * response headers are sent, so an unauthenticated or non-`safety.view`
 * request gets a 401/403 rather than an open stream.
 *
 * The endpoint is intentionally hidden from Swagger — SSE isn't OpenAPI-3
 * expressible and the client uses `EventSource`, not the generated fetch
 * client.
 */
@Controller("safety/realtime")
export class SafetyRealtimeController {
  constructor(private readonly emitter: SafetyRealtimeEmitter) {}

  @Sse("stream")
  @UseGuards(SafetyRealtimeAuthGuard)
  @ApiExcludeEndpoint()
  stream(): Observable<MessageEvent> {
    return this.emitter.stream();
  }
}
