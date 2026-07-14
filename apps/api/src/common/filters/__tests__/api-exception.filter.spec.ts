import { ForbiddenException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost } from "@nestjs/common";
import { ApiExceptionFilter } from "../api-exception.filter";
import { PdfRenderError } from "../../../modules/pdf-rendering/pdf-render.error";

type CapturedResponse = {
  statusCode: number;
  body: unknown;
};

function makeHost(url = "/tenders/1/quotes/2/pdf"): {
  host: ArgumentsHost;
  captured: CapturedResponse;
} {
  const captured: CapturedResponse = { statusCode: 0, body: null };
  const response = {
    status(code: number) {
      captured.statusCode = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const request = { url, method: "GET" };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe("ApiExceptionFilter", () => {
  const originalStderrWrite = process.stderr.write.bind(process.stderr);

  beforeEach(() => {
    // Silence the stderr side-channel so test output isn't polluted by the
    // deliberate 5xx logging behaviour we're exercising.
    process.stderr.write = (() => true) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalStderrWrite;
  });

  it("surfaces PdfRenderError message and status through the response payload", () => {
    const filter = new ApiExceptionFilter();
    const { host, captured } = makeHost();
    const err = new PdfRenderError(
      "Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome",
      undefined,
      HttpStatus.SERVICE_UNAVAILABLE,
    );

    filter.catch(err, host);

    expect(captured.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: "PDF Rendering Error",
      message:
        "Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome",
      path: "/tenders/1/quotes/2/pdf",
    });
    expect((captured.body as { timestamp: string }).timestamp).toEqual(
      expect.any(String),
    );
  });

  it("preserves extra structured fields from HttpException object bodies", () => {
    // Gated-Entra flow: /auth/sso throws Forbidden with an object body that
    // includes `code`, `email`, and `displayName`; the client branches on
    // those fields, so the filter must pass them through.
    const filter = new ApiExceptionFilter();
    const { host, captured } = makeHost("/auth/sso");

    filter.catch(
      new ForbiddenException({
        code: "ENTRA_NOT_REGISTERED",
        email: "someone@example.com",
        displayName: "Some One",
        message: "Not a registered user."
      }),
      host
    );

    expect(captured.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.FORBIDDEN,
      error: "FORBIDDEN",
      message: "Not a registered user.",
      code: "ENTRA_NOT_REGISTERED",
      email: "someone@example.com",
      displayName: "Some One",
      path: "/auth/sso"
    });
  });

  it("preserves the generic fallback for non-HttpException errors", () => {
    const filter = new ApiExceptionFilter();
    const { host, captured } = makeHost("/some/path");

    filter.catch(new Error("boom"), host);

    expect(captured.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: "An unexpected error occurred.",
      path: "/some/path",
    });
  });
});
