import { describe, expect, it } from "vitest";
import {
  ApiError,
  parseApiErrorPayload,
  readApiErrorMessage,
  throwIfApiError
} from "../api-errors";

function jsonResponse(body: unknown, status = 400): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("parseApiErrorPayload", () => {
  it("extracts the human message from the standard envelope", () => {
    const message = parseApiErrorPayload({
      statusCode: 400,
      error: "Bad Request",
      message: "Tender title is required.",
      path: "/api/v1/tenders",
      timestamp: "2026-06-19T00:00:00.000Z"
    });
    expect(message).toBe("Tender title is required.");
  });

  it("joins validation arrays with a separator", () => {
    const message = parseApiErrorPayload({
      statusCode: 400,
      error: "Bad Request",
      message: ["title should not be empty", "dueAt must be a date"],
      path: "/api/v1/tenders",
      timestamp: "2026-06-19T00:00:00.000Z"
    });
    expect(message).toBe("title should not be empty • dueAt must be a date");
  });

  it("parses a JSON-encoded envelope passed as a string", () => {
    const raw = JSON.stringify({
      statusCode: 403,
      error: "Forbidden",
      message: "You don't have permission to view finance fields.",
      path: "/api/v1/directory",
      timestamp: "2026-06-19T00:00:00.000Z"
    });
    expect(parseApiErrorPayload(raw)).toBe("You don't have permission to view finance fields.");
  });

  it("returns the trimmed string when the body is plain text", () => {
    expect(parseApiErrorPayload("  Session expired.  ")).toBe("Session expired.");
  });

  it("falls back when the body is empty or unparseable", () => {
    expect(parseApiErrorPayload("", "fallback msg")).toBe("fallback msg");
    expect(parseApiErrorPayload(null, "fallback msg")).toBe("fallback msg");
    expect(parseApiErrorPayload({ unrelated: true }, "fallback msg")).toBe("fallback msg");
  });

  it("falls back to envelope.error if message is empty", () => {
    expect(
      parseApiErrorPayload({
        statusCode: 500,
        error: "Internal Server Error",
        message: "",
        path: "/api/v1/x",
        timestamp: "t"
      })
    ).toBe("Internal Server Error");
  });
});

describe("readApiErrorMessage", () => {
  it("reads and humanises an envelope from a Response", async () => {
    const response = jsonResponse({
      statusCode: 409,
      error: "Conflict",
      message: "A tender with that number already exists.",
      path: "/api/v1/tenders",
      timestamp: "t"
    });
    await expect(readApiErrorMessage(response)).resolves.toBe(
      "A tender with that number already exists."
    );
  });

  it("uses the fallback when the body is empty", async () => {
    const response = new Response("", { status: 500 });
    await expect(readApiErrorMessage(response, "Could not save.")).resolves.toBe(
      "Could not save."
    );
  });
});

describe("throwIfApiError", () => {
  it("passes through OK responses unchanged", async () => {
    const response = new Response("{}", { status: 200 });
    await expect(throwIfApiError(response)).resolves.toBe(response);
  });

  it("throws an ApiError carrying the envelope on failure", async () => {
    const response = jsonResponse(
      {
        statusCode: 422,
        error: "Unprocessable Entity",
        message: "Cutting columns must sum to roll width.",
        path: "/api/v1/tenders/x/scope",
        timestamp: "t"
      },
      422
    );
    await expect(throwIfApiError(response)).rejects.toMatchObject({
      name: "ApiError",
      message: "Cutting columns must sum to roll width.",
      statusCode: 422
    });
  });

  it("uses the fallback for an opaque non-JSON failure", async () => {
    const response = new Response("<html>nginx 502</html>", { status: 502 });
    try {
      await throwIfApiError(response, "Upstream unavailable.");
      throw new Error("expected to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).message).toBe("<html>nginx 502</html>");
      expect((err as ApiError).statusCode).toBe(502);
    }
  });
});
