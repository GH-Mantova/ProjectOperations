import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { HealthService } from "./health.service";

const HEALTH_BODY_EXAMPLE = {
  status: "ok",
  service: "project-operations-api",
  db: "up",
  version: "0.1.3",
  commit: "abc1234",
  uptimeSec: 42,
  timestamp: "2026-06-12T10:00:00.000Z"
};

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({
    summary: "Liveness check — always 200",
    description:
      "Reports process liveness plus DB reachability and build identity. Returns 200 even when the database is down (status: degraded, db: down) so the process itself stays observable. Deploy gates and load balancers should poll /health/ready instead."
  })
  @ApiOkResponse({
    description: "API process is up; body reports DB reachability and build info",
    schema: { example: HEALTH_BODY_EXAMPLE }
  })
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get("ready")
  @ApiOperation({
    summary: "Readiness check — 503 when the database is unreachable",
    description:
      "Returns the same body as /health but with HTTP 503 when the database is down. This is the endpoint deploy gates and load balancers should poll."
  })
  @ApiOkResponse({
    description: "API can serve traffic (database reachable)",
    schema: { example: HEALTH_BODY_EXAMPLE }
  })
  @ApiResponse({
    status: 503,
    description: "Database unreachable — degraded body returned",
    schema: { example: { ...HEALTH_BODY_EXAMPLE, status: "degraded", db: "down" } }
  })
  async getReadiness(@Res({ passthrough: true }) res: Response) {
    const report = await this.healthService.getHealth();
    if (report.db !== "up") {
      // Set the status directly instead of throwing so the degraded report
      // survives — the global exception filter would replace it with the
      // generic error envelope.
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
