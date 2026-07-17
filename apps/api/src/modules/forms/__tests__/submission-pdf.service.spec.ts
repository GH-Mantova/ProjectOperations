import { NotFoundException } from "@nestjs/common";
import { SubmissionPdfService } from "../submission-pdf.service";
import type { SubmissionForPdf } from "../pdf/submission-html.builder";

function makeSubmission(): SubmissionForPdf & { id: string } {
  return {
    id: "sub-deadbeef1234",
    status: "submitted",
    submittedAt: new Date("2026-06-01T00:00:00Z"),
    submittedBy: { firstName: "Ada", lastName: "Lovelace" },
    gpsLat: null,
    gpsLng: null,
    templateVersion: {
      versionNumber: 1,
      template: { name: "Daily Pre-start", code: "PRESTART", category: "prestart" },
      sections: [
        {
          id: "s1",
          title: "Main",
          sectionOrder: 1,
          fields: [{ id: "f1", fieldKey: "notes", label: "Notes", fieldType: "text", fieldOrder: 1 }]
        }
      ]
    },
    values: [{ fieldKey: "notes", valueText: "All good" }],
    attachments: [],
    signatures: []
  };
}

describe("SubmissionPdfService.renderSubmissionPdf", () => {
  it("fetches the submission via FormsService, resolves branding, and renders HTML through PdfRendererService", async () => {
    const submission = makeSubmission();
    const forms = { getSubmission: jest.fn().mockResolvedValue(submission) };
    const prisma = {
      companyProfile: {
        findUnique: jest.fn().mockResolvedValue({
          tradingName: "Acme Ltd",
          licences: [{ licenceType: "Demolition", licenceNumber: "D-1" }],
          registeredAddressLine1: "1 Main",
          registeredSuburb: "Suburbia",
          registeredState: "QLD",
          registeredPostcode: "4000",
          primaryPhone: "07",
          primaryEmail: "hello@acme",
          abn: "111"
        })
      }
    };
    const renderer = {
      renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-fake"))
    };

    const svc = new SubmissionPdfService(prisma as never, forms as never, renderer as never);
    const result = await svc.renderSubmissionPdf(submission.id);

    expect(forms.getSubmission).toHaveBeenCalledWith(submission.id);
    expect(renderer.renderHtmlToPdf).toHaveBeenCalledTimes(1);

    const [html, opts] = renderer.renderHtmlToPdf.mock.calls[0];
    expect(html).toContain("Daily Pre-start");
    expect(html).toContain("All good");
    expect(opts.displayHeaderFooter).toBe(true);
    expect(opts.headerHtml).toContain("ACME LTD");
    expect(opts.headerHtml).toContain("Demolition: D-1");
    expect(opts.footerHtml).toContain("A.B.N: 111");

    expect(result.buffer).toBeInstanceOf(Buffer);
    // filename = <code>_<first-8-of-id>.pdf
    expect(result.filename).toBe(`PRESTART_${submission.id.slice(0, 8)}.pdf`);
  });

  it("propagates NotFoundException from FormsService", async () => {
    const forms = {
      getSubmission: jest.fn().mockRejectedValue(new NotFoundException("Form submission not found."))
    };
    const prisma = { companyProfile: { findUnique: jest.fn() } };
    const renderer = { renderHtmlToPdf: jest.fn() };

    const svc = new SubmissionPdfService(prisma as never, forms as never, renderer as never);
    await expect(svc.renderSubmissionPdf("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(renderer.renderHtmlToPdf).not.toHaveBeenCalled();
  });

  it("falls back to default IS branding when no CompanyProfile is seeded", async () => {
    const forms = { getSubmission: jest.fn().mockResolvedValue(makeSubmission()) };
    const prisma = { companyProfile: { findUnique: jest.fn().mockResolvedValue(null) } };
    const renderer = { renderHtmlToPdf: jest.fn().mockResolvedValue(Buffer.from("%PDF-")) };

    const svc = new SubmissionPdfService(prisma as never, forms as never, renderer as never);
    await svc.renderSubmissionPdf("sub-xyz");
    const [, opts] = renderer.renderHtmlToPdf.mock.calls[0];
    expect(opts.headerHtml).toContain("INITIAL SERVICES");
  });
});
