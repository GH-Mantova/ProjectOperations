import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { resolvePdfCompanyContext } from "../pdf-rendering/company-context.helper";
import { PdfRendererService } from "../pdf-rendering/pdf-renderer.service";
import { FormsService } from "./forms.service";
import {
  buildSubmissionHtml,
  submissionFooterTemplate,
  submissionHeaderTemplate,
  type SubmissionForPdf
} from "./pdf/submission-html.builder";

/**
 * Renders a completed form submission to a branded, printable PDF that
 * doubles as an evidentiary record. Reuses the same PdfRendererService
 * (headless Chromium) the quote-PDF path uses, and the same CompanyProfile-
 * derived letterhead/footer, so field records ship with the same branding
 * as commercial documents.
 *
 * Callers should honour the template's `settings.pdfExport` flag at the
 * controller layer; this service always renders when invoked.
 */
@Injectable()
export class SubmissionPdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly formsService: FormsService,
    private readonly pdfRenderer: PdfRendererService
  ) {}

  async renderSubmissionPdf(
    submissionId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    // FormsService.getSubmission already throws 404 when missing and returns
    // the exact shape (values / attachments / signatures / template) the
    // builder needs — reuse it rather than duplicating the includes here.
    const submission = (await this.formsService.getSubmission(
      submissionId
    )) as unknown as SubmissionForPdf;

    const ctx = await resolvePdfCompanyContext(this.prisma);
    const html = buildSubmissionHtml(submission);

    const buffer = await this.pdfRenderer.renderHtmlToPdf(html, {
      displayHeaderFooter: true,
      headerHtml: submissionHeaderTemplate(
        submission.templateVersion.template.name,
        submission.id.slice(0, 8),
        ctx
      ),
      footerHtml: submissionFooterTemplate(ctx),
      margin: { top: "35mm", bottom: "22mm" }
    });

    const codeSlug =
      submission.templateVersion.template.code.replace(/[^A-Za-z0-9_-]/g, "_") ||
      "submission";
    const filename = `${codeSlug}_${submission.id.slice(0, 8)}.pdf`;
    return { buffer, filename };
  }
}
