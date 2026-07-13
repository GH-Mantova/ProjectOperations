import {
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import { existsSync } from "node:fs";
import type { Browser, LaunchOptions } from "puppeteer";
import { PdfRenderError } from "./pdf-render.error";
import { PDF_RENDER_DEFAULTS, type PdfRenderOptions } from "./pdf-render.types";
import { interpolate, loadTemplateFile } from "./template.helpers";

const MAX_CONCURRENT_RENDERS = 4;

const CHROME_INSTALL_HINT =
  "Chrome for PDF rendering is not installed. Run: npx puppeteer browsers install chrome";

const LAUNCH_ARGS: LaunchOptions = {
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--font-render-hinting=none",
  ],
};

@Injectable()
export class PdfRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfRendererService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;
  private inFlight = 0;

  async onModuleDestroy(): Promise<void> {
    await this.closeBrowser();
  }

  async renderHtmlToPdf(
    html: string,
    options?: PdfRenderOptions,
  ): Promise<Buffer> {
    if (this.inFlight >= MAX_CONCURRENT_RENDERS) {
      throw new PdfRenderError(
        `Concurrency limit reached (${MAX_CONCURRENT_RENDERS} renders in flight)`,
      );
    }

    this.inFlight++;
    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      const format = options?.format ?? PDF_RENDER_DEFAULTS.format;
      const margin = { ...PDF_RENDER_DEFAULTS.margin, ...options?.margin };
      const printBackground =
        options?.printBackground ?? PDF_RENDER_DEFAULTS.printBackground;
      const landscape = options?.landscape ?? PDF_RENDER_DEFAULTS.landscape;
      const timeoutMs = options?.timeoutMs ?? PDF_RENDER_DEFAULTS.timeoutMs;
      const displayHeaderFooter =
        options?.displayHeaderFooter ?? PDF_RENDER_DEFAULTS.displayHeaderFooter;

      await page.setContent(html, {
        waitUntil: "load",
        timeout: timeoutMs,
      });
      await page.evaluate(() => document.fonts.ready);

      const pdfUint8 = await page.pdf({
        format: format as "A4",
        margin,
        printBackground,
        landscape,
        displayHeaderFooter,
        headerTemplate: options?.headerHtml ?? "",
        footerTemplate: options?.footerHtml ?? "",
        timeout: timeoutMs,
      });

      return Buffer.from(pdfUint8);
    } catch (err) {
      if (err instanceof PdfRenderError) throw err;
      throw new PdfRenderError("PDF rendering failed", err);
    } finally {
      this.inFlight--;
      await page?.close().catch(() => {});
    }
  }

  async loadTemplate(name: string): Promise<string> {
    return loadTemplateFile(name);
  }

  async renderTemplateToPdf(
    name: string,
    data: Record<string, unknown>,
    options?: PdfRenderOptions,
  ): Promise<Buffer> {
    const template = await this.loadTemplate(name);
    const html = interpolate(template, data);
    return this.renderHtmlToPdf(html, options);
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;

    if (this.launching) return this.launching;

    this.launching = this.launchBrowser();
    try {
      this.browser = await this.launching;
      return this.browser;
    } finally {
      this.launching = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    this.logger.log("Launching Chromium for PDF rendering…");
    const puppeteer = require("puppeteer") as {
      launch: typeof import("puppeteer").launch;
      executablePath: typeof import("puppeteer").executablePath;
    };

    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
    let executablePath: string | undefined;

    if (envPath) {
      executablePath = envPath;
      if (!existsSync(executablePath)) {
        const msg = `PUPPETEER_EXECUTABLE_PATH is set to "${executablePath}" but that file does not exist.`;
        this.logger.error(msg);
        throw new PdfRenderError(msg, undefined, HttpStatus.SERVICE_UNAVAILABLE);
      }
    } else {
      let resolved: string | null = null;
      try {
        resolved = puppeteer.executablePath();
      } catch (err) {
        this.logger.error(CHROME_INSTALL_HINT);
        throw new PdfRenderError(CHROME_INSTALL_HINT, err, HttpStatus.SERVICE_UNAVAILABLE);
      }
      if (!resolved || !existsSync(resolved)) {
        this.logger.error(CHROME_INSTALL_HINT);
        throw new PdfRenderError(CHROME_INSTALL_HINT, undefined, HttpStatus.SERVICE_UNAVAILABLE);
      }
    }

    const cacheDir = process.env.PUPPETEER_CACHE_DIR?.trim() || "(unset)";
    this.logger.log(
      `Chromium launch: executablePath=${executablePath ?? "(puppeteer default)"} PUPPETEER_CACHE_DIR=${cacheDir}`,
    );

    try {
      const browser = await puppeteer.launch(
        executablePath ? { ...LAUNCH_ARGS, executablePath } : LAUNCH_ARGS,
      );

      browser.on("disconnected", () => {
        this.logger.warn("Chromium disconnected — will relaunch on next render");
        this.browser = null;
      });

      return browser;
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err);
      this.logger.error(`Chromium launch failed: ${cause}`);
      throw new PdfRenderError(`Failed to launch Chromium: ${cause}`, err);
    }
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        this.logger.warn("Error closing Chromium (already exited?)");
      }
      this.browser = null;
    }
  }
}
