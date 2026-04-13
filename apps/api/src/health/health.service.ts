import { Injectable } from "@nestjs/common";

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: "ok",
      service: "project-operations-api",
      timestamp: new Date().toISOString()
    };
  }
}
