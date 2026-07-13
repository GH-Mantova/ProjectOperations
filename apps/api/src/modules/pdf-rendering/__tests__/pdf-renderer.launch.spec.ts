// Mock node:fs at the module level so the service's existsSync guard is
// controllable per-test. jest.resetModules() between tests re-runs this
// factory, so we always read the fresh mock inside each test rather than
// caching a top-level reference.
jest.mock("node:fs", () => {
  const actual = jest.requireActual("node:fs");
  return { ...actual, existsSync: jest.fn(actual.existsSync) };
});

function getFsMock() {
  return jest.requireMock("node:fs") as { existsSync: jest.Mock };
}

import { HttpStatus } from "@nestjs/common";

// NOTE: we intentionally don't import PdfRenderError at the top level here —
// jest.resetModules() in afterEach re-loads pdf-render.error for each test,
// which would give the fresh copy a different class identity than any
// top-level import. Duck-check via getStatus() / getResponse() / name instead.

describe("PdfRendererService.launchBrowser (unit)", () => {
  const OLD_ENV = process.env.PUPPETEER_EXECUTABLE_PATH;

  afterEach(() => {
    jest.resetModules();
    if (OLD_ENV === undefined) {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      process.env.PUPPETEER_EXECUTABLE_PATH = OLD_ENV;
    }
  });

  function loadService() {
    const mod = require("../pdf-renderer.service");
    return new mod.PdfRendererService();
  }

  function mockPuppeteer(opts: {
    executablePath: () => string;
    launch?: jest.Mock;
  }) {
    const launch =
      opts.launch ??
      jest.fn().mockResolvedValue({
        connected: true,
        on: jest.fn(),
        close: jest.fn(),
      });
    jest.doMock("puppeteer", () => ({
      __esModule: false,
      executablePath: opts.executablePath,
      launch,
    }));
    return { launch };
  }

  it("throws the actionable install hint when the resolved executable is missing", async () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    getFsMock().existsSync.mockReturnValue(false);
    const { launch } = mockPuppeteer({
      executablePath: () => "/nonexistent/chrome",
    });
    const service = loadService();

    const promise = service.renderHtmlToPdf("<p>x</p>");
    await expect(promise).rejects.toThrow(
      /Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome/,
    );
    const err = await promise.catch((e: Error) => e);
    expect(err.name).toBe("PdfRenderError");
    expect((err as { getStatus: () => number }).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((err as { getResponse: () => unknown }).getResponse()).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: "PDF Rendering Error",
      message:
        "Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome",
    });
    expect(launch).not.toHaveBeenCalled();
  });

  it("throws the actionable install hint when executablePath() itself throws", async () => {
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
    const { launch } = mockPuppeteer({
      executablePath: () => {
        throw new Error("Could not find Chrome (ver. 131.0.6778.204)");
      },
    });
    const service = loadService();

    const promise = service.renderHtmlToPdf("<p>x</p>");
    await expect(promise).rejects.toThrow(
      /Chrome for PDF rendering is not installed/,
    );
    const err = await promise.catch((e: Error) => e);
    expect(err.name).toBe("PdfRenderError");
    expect((err as { getStatus: () => number }).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((err as { getResponse: () => unknown }).getResponse()).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: "PDF Rendering Error",
      message:
        "Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome",
    });
    expect(launch).not.toHaveBeenCalled();
  });

  it("honours PUPPETEER_EXECUTABLE_PATH when it points to an existing file", async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/opt/chrome/chrome";
    getFsMock().existsSync.mockReturnValue(true);
    const { launch } = mockPuppeteer({
      executablePath: () => "/should/not/be/used",
      launch: jest
        .fn()
        .mockRejectedValue(new Error("stubbed launch failure")),
    });
    const service = loadService();

    await expect(service.renderHtmlToPdf("<p>x</p>")).rejects.toThrow(
      /Failed to launch Chromium/,
    );
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch.mock.calls[0][0]).toMatchObject({
      executablePath: "/opt/chrome/chrome",
    });
  });

  it("surfaces the underlying launch error verbatim in the PdfRenderError message", async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/opt/chrome/chrome";
    getFsMock().existsSync.mockReturnValue(true);
    mockPuppeteer({
      executablePath: () => "/should/not/be/used",
      launch: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "error while loading shared libraries: libnss3.so: cannot open shared object file",
          ),
        ),
    });
    const service = loadService();

    const err = await service
      .renderHtmlToPdf("<p>x</p>")
      .catch((e: Error) => e);
    expect(err.name).toBe("PdfRenderError");
    expect((err as { getResponse: () => unknown }).getResponse()).toMatchObject({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "PDF Rendering Error",
      message:
        "Failed to launch Chromium: error while loading shared libraries: libnss3.so: cannot open shared object file",
    });
  });

  it("rejects when PUPPETEER_EXECUTABLE_PATH points to a missing file", async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = "/opt/chrome/chrome";
    getFsMock().existsSync.mockReturnValue(false);
    const { launch } = mockPuppeteer({
      executablePath: () => "/should/not/be/used",
    });
    const service = loadService();

    const promise = service.renderHtmlToPdf("<p>x</p>");
    await expect(promise).rejects.toThrow(
      /PUPPETEER_EXECUTABLE_PATH is set to "\/opt\/chrome\/chrome" but that file does not exist/,
    );
    const err = await promise.catch((e: Error) => e);
    expect(err.name).toBe("PdfRenderError");
    expect((err as { getStatus: () => number }).getStatus()).toBe(
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    expect((err as { getResponse: () => unknown }).getResponse()).toMatchObject({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      error: "PDF Rendering Error",
      message:
        'PUPPETEER_EXECUTABLE_PATH is set to "/opt/chrome/chrome" but that file does not exist.',
    });
    expect(launch).not.toHaveBeenCalled();
  });
});
