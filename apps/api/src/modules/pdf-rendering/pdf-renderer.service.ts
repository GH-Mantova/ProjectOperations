import {
  Injectable,
  Logger,
  OnModuleDestroy,
} from "@nestjs/common";
import type { Browser, LaunchOptions } from "puppeteer";
import { PdfRenderError } from "./pdf-render.error";
import { PDF_RENDER_DEFAULTS, type PdfRenderOptions } from "./pdf-render.types";
import { interpolate, loadTemplateFile } from "./template.helpers";

const MAX_CONCURRENT_RENDERS = 4;

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

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    this.inFlight++;

    try {
      const format = options?.format ?? PDF_RENDER_DEFAULTS.format;
      const margin = { ...PDF_RENDER_DEFAULTS.margin, ...options?.margin };
      const printBackground =
        options?.printBackground ?? PDF_RENDER_DEFAULTS.printBackground;
      const landscape = options?.landscape ?? PDF_RENDER_DEFAULTS.landscape;
      const timeoutMs = options?.timeoutMs ?? PDF_RENDER_DEFAULTS.timeoutMs;
      const displayHeaderFooter =
        options?.displayHeaderFooter ?? PDF_RENDER_DEFAULTS.displayHeaderFooter;

      await page.setContent(html, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

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
      throw new PdfRenderError("PDF rendering failed", err);
    } finally {
      this.inFlight--;
      await page.close().catch(() => {});
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
    try {
      const puppeteer = require("puppeteer") as { launch: typeof import("puppeteer").launch };
      const browser = await puppeteer.launch(LAUNCH_ARGS);

      browser.on("disconnected", () => {
        this.logger.warn("Chromium disconnected — will relaunch on next render");
        this.browser = null;
      });

      return browser;
    } catch (err) {
      throw new PdfRenderError("Failed to launch Chromium", err);
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
