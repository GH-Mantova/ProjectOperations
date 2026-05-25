import { join } from "node:path";
import { interpolate, loadTemplateFile } from "../template.helpers";

describe("loadTemplateFile", () => {
  it("loads the sample template", async () => {
    const html = await loadTemplateFile("sample.html");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("{{title}}");
  });

  it("throws PdfRenderError for missing templates", async () => {
    await expect(loadTemplateFile("nonexistent.html")).rejects.toThrow(
      "Template not found: nonexistent.html",
    );
  });

  it("throws PdfRenderError for path traversal attempts", async () => {
    await expect(loadTemplateFile("../../app.module.ts")).rejects.toThrow(
      "Template path traversal rejected",
    );
  });
});

describe("interpolate", () => {
  it("replaces {{key}} placeholders with data values", () => {
    const result = interpolate("Hello {{name}}, you have {{count}} items.", {
      name: "Marco",
      count: 5,
    });
    expect(result).toBe("Hello Marco, you have 5 items.");
  });

  it("replaces missing keys with empty string", () => {
    const result = interpolate("Hello {{name}}!", {});
    expect(result).toBe("Hello !");
  });

  it("replaces null/undefined values with empty string", () => {
    const result = interpolate("A={{a}} B={{b}}", { a: null, b: undefined });
    expect(result).toBe("A= B=");
  });

  it("leaves non-matching patterns untouched", () => {
    const result = interpolate("{{valid}} and {invalid} and {{ spaced }}", {
      valid: "yes",
    });
    expect(result).toBe("yes and {invalid} and {{ spaced }}");
  });

  it("handles templates with no placeholders", () => {
    const result = interpolate("<p>Static content</p>", { foo: "bar" });
    expect(result).toBe("<p>Static content</p>");
  });
});
