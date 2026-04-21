import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { Request, Response } from "express";

type ErrorShape = {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ApiExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const payload = this.toPayload(exception, request.url);
    if (payload.statusCode >= 500) {
      // Never swallow a 500 silently — the original error is often the
      // only signal we have that a DB or upstream call went wrong.
      const err = exception as Error;
      const summary = `${request.method} ${request.url} — ${err?.constructor?.name ?? "Error"}: ${err?.message ?? "unknown"}`;
      this.logger.error(summary, err?.stack);
      // Also hit stderr directly so the failure is visible even when
      // Nest's logger is silenced (e.g. in compliance-smoke runs).
      process.stderr.write(`[ApiExceptionFilter] ${summary}\n${err?.stack ?? ""}\n`);
    }
    response.status(payload.statusCode).json(payload);
  }

  private toPayload(exception: unknown, path: string): ErrorShape {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        return {
          statusCode,
          error: this.httpStatusLabel(statusCode),
          message: exceptionResponse,
          path,
          timestamp: new Date().toISOString()
        };
      }

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const record = exceptionResponse as Record<string, unknown>;

        return {
          statusCode,
          error: typeof record.error === "string" ? record.error : this.httpStatusLabel(statusCode),
          message:
            typeof record.message === "string" || Array.isArray(record.message)
              ? (record.message as string | string[])
              : exception.message,
          path,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "An unexpected error occurred.",
      path,
      timestamp: new Date().toISOString()
    };
  }

  private httpStatusLabel(statusCode: number) {
    return HttpStatus[statusCode] ?? "Error";
  }
}
