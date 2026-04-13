import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Check API health" })
  @ApiOkResponse({
    schema: {
      example: {
        status: "ok",
        service: "project-operations-api",
        timestamp: "2026-04-01T10:00:00.000Z"
      }
    }
  })
  getHealth() {
    return this.healthService.getHealth();
  }
}
