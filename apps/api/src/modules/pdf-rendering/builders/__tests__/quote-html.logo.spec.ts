jest.mock("node:fs", () => {
  const actual = jest.requireActual("node:fs");
  return { ...actual, readFileSync: jest.fn(actual.readFileSync) };
});

const { readFileSync } = jest.requireMock("node:fs") as {
  readFileSync: jest.Mock;
};

describe("logoBase64 degradation", () => {
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

  afterEach(() => {
    readFileSync.mockReset();
    warn.mockClear();
  });

  it("renders header without a base64 payload when the logo file is missing", () => {
    readFileSync.mockImplementation(() => {
      throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
    });

    // Re-require after installing the mock so quote-html.builder picks it up.
    jest.isolateModules(() => {
      const { headerTemplate } = require("../quote-html.builder");
      const html = headerTemplate("T260512-BRIS-Rev1");
      expect(html).toContain("INITIAL SERVICES");
      expect(html).toContain("Quote No. T260512-BRIS-Rev1");
      // Empty payload after the "base64," marker means no image data was
      // read from disk — we degrade rather than 500.
      expect(html).toContain('data:image/png;base64," style=');
    });

    expect(warn).toHaveBeenCalled();
  });
});
