import { appConfig, parseCorsOrigin } from "./app.config";

describe("appConfig factory", () => {
  const originalCorsOrigin = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalCorsOrigin === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalCorsOrigin;
    }
  });

  it("exposes corsOrigin as a string[] parsed from CORS_ORIGIN", () => {
    process.env.CORS_ORIGIN = "https://a.example.com, https://b.example.com";

    const config = appConfig();

    expect(Array.isArray(config.corsOrigin)).toBe(true);
    expect(config.corsOrigin).toEqual([
      "https://a.example.com",
      "https://b.example.com"
    ]);
  });

  it("defaults corsOrigin to the localhost Vite origin when CORS_ORIGIN is unset", () => {
    delete process.env.CORS_ORIGIN;

    expect(appConfig().corsOrigin).toEqual(["http://localhost:5173"]);
  });
});

describe("parseCorsOrigin", () => {
  it("returns the default when the env var is undefined", () => {
    expect(parseCorsOrigin(undefined)).toEqual(["http://localhost:5173"]);
  });

  it("returns the default when the env var is empty or whitespace", () => {
    expect(parseCorsOrigin("")).toEqual(["http://localhost:5173"]);
    expect(parseCorsOrigin("   ")).toEqual(["http://localhost:5173"]);
    expect(parseCorsOrigin(",, ,")).toEqual(["http://localhost:5173"]);
  });

  it("wraps a single origin in an array", () => {
    expect(parseCorsOrigin("http://localhost:5173")).toEqual(["http://localhost:5173"]);
  });

  it("parses a comma-separated list into a trimmed array", () => {
    expect(
      parseCorsOrigin("https://operations.initialservices.net,https://demo.azurestaticapps.net")
    ).toEqual([
      "https://operations.initialservices.net",
      "https://demo.azurestaticapps.net"
    ]);
  });

  it("trims surrounding whitespace on each entry", () => {
    expect(
      parseCorsOrigin("  https://a.example.com ,   https://b.example.com  ")
    ).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("drops empty entries produced by trailing or repeated commas", () => {
    expect(parseCorsOrigin("https://a.example.com,,https://b.example.com,")).toEqual([
      "https://a.example.com",
      "https://b.example.com"
    ]);
  });
});
