import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus
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
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const payload = this.toPayload(exception, request.url);
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
