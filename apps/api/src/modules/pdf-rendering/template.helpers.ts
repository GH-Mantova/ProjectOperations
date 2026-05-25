import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { PdfRenderError } from "./pdf-render.error";

const TEMPLATES_DIR = join(__dirname, "templates");

export function getTemplatesDir(): string {
  return TEMPLATES_DIR;
}

export async function loadTemplateFile(name: string): Promise<string> {
  const filePath = join(TEMPLATES_DIR, name);
  if (!filePath.startsWith(TEMPLATES_DIR)) {
    throw new PdfRenderError(`Template path traversal rejected: ${name}`);
  }
  try {
    const html = await readFile(filePath, "utf-8");
    const baseUrl = pathToFileURL(TEMPLATES_DIR + "/").href;
    return html.replace(
      /(<head[^>]*>)/i,
      `$1\n<base href="${baseUrl}">`,
    );
  } catch {
    throw new PdfRenderError(`Template not found: ${name}`);
  }
}

export function interpolate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = data[key];
    return value === undefined || value === null ? "" : String(value);
  });
}
