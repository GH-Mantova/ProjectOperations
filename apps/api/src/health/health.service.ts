import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../prisma/prisma.service";

const DB_CHECK_TIMEOUT_MS = 2000;

// __dirname sits at src/health in dev and dist/src/health in the built
// artifact, so walk upward to the nearest package.json instead of hardcoding
// a relative depth.
function readApiVersion(): string {
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(candidate, "utf8")) as { version?: string };
        return parsed.version ?? "unknown";
      } catch {
        return "unknown";
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return "unknown";
}

const API_VERSION = readApiVersion();

export type HealthReport = {
  status: "ok" | "degraded";
  service: string;
  db: "up" | "down";
  version: string;
  commit: string;
  uptimeSec: number;
  timestamp: string;
};

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthReport> {
    const dbUp = await this.isDbUp();
    return {
      status: dbUp ? "ok" : "degraded",
      service: "project-operations-api",
      db: dbUp ? "up" : "down",
      version: API_VERSION,
      commit: process.env.GIT_SHA ?? "unknown",
      uptimeSec: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    };
  }

  private async isDbUp(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("DB health check timed out")), DB_CHECK_TIMEOUT_MS);
    });
    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return true;
    } catch {
      return false;
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}
