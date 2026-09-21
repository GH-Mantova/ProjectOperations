import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  EstimateExportService,
  resolveLiveClauses,
  resolvePinnedClauses,
  type ExportPayload
} from "../estimate-export/estimate-export.service";
import {
  buildQuoteHtml,
  headerTemplate,
  footerTemplate,
  type QuoteOverlay,
} from "../pdf-rendering/builders/quote-html.builder";
import { PdfRendererService } from "../pdf-rendering/pdf-renderer.service";
import { ClientQuotesService } from "./client-quotes.service";

function toNum(v: { toString(): string } | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class QuotePdfService {
  private readonly logger = new Logger(QuotePdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly quotes: ClientQuotesService,
    private readonly exportSvc: EstimateExportService,
    private readonly pdfRenderer: PdfRendererService,
  ) {}

  async generate(
    tenderId: string,
    quoteId: string,
    userId: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Base payload (tender meta, scope, cutting, T&C, etc.) reuses the same
    // fetch the EstimateExportService does — this keeps site details, scope
    // grouping, and T&C clauses identical to the tender-level PDF.
    const base: ExportPayload = await this.exportSvc.fetchTenderForExport(tenderId);

    const quote = await this.prisma.clientQuote.findUnique({
      where: { id: quoteId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        costLines: { orderBy: { sortOrder: "asc" } },
        provisionalLines: { orderBy: { sortOrder: "asc" } },
        costOptions: { orderBy: { sortOrder: "asc" } },
        assumptions: { orderBy: [{ sortOrder: "asc" }] },
        exclusions: { orderBy: { sortOrder: "asc" } },
        scopeItems: { orderBy: { sortOrder: "asc" } },
        issuedTerms: { select: { content: true } },
        // QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- cost groups for PDF.
        costGroups: { orderBy: { sortOrder: "asc" } }
      }
    });
    if (!quote || quote.tenderId !== tenderId) throw new NotFoundException("Quote not found.");

    // Pull the client + contact for the cover page so per-quote PDFs address
    // the right client, not the first one linked to the tender.
    const tenderClientRecord = await this.prisma.tenderClient.findFirst({
      where: { tenderId, clientId: quote.clientId },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        contact: { select: { firstName: true, lastName: true, email: true, phone: true } }
      }
    });

    const summary = await this.quotes.summary(tenderId, quoteId);

    const overlay: QuoteOverlay = {
      quoteRef: quote.quoteRef,
      revision: quote.revision,
      assumptionMode: (quote.assumptionMode === "linked" ? "linked" : "free") as "linked" | "free",
      showProvisional: quote.showProvisional,
      showCostOptions: quote.showCostOptions,
      showScopeTable: quote.showScopeTable,
      showAssumptions: quote.showAssumptions,
      showExclusions: quote.showExclusions,
      showReferencedDrawings: quote.showReferencedDrawings,
      clientFacingTotal: summary.clientFacingTotal,
      detailLevel: quote.detailLevel === "detailed" ? "detailed" : "simple",
      scopeItems: quote.scopeItems
        .filter((r) => r.isVisible)
        .map((r) => ({
          label: r.label,
          description: r.description,
          qty: r.qty,
          unit: r.unit,
          notes: r.notes,
          quoteDiscipline: r.quoteDiscipline
        })),
      costLines: quote.costLines
        .filter((l) => l.isVisible)
        .map((l) => {
          const approp = summary.lineAppropriations.find((a) => a.lineId === l.id);
          return {
            id: l.id,
            label: l.label,
            description: l.description,
            displayDescription: l.displayDescription,
            price: approp ? approp.displayedAmount : toNum(l.price),
            sortOrder: l.sortOrder,
            // QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- pass groupId.
            groupId: l.groupId
          };
        }),
      // QUOTE_PUSH_BY_DESTINATION_V1 (scopecards-s4a) -- cost groups for PDF.
      costGroups: quote.costGroups.map((g) => ({
        id: g.id,
        label: g.label,
        name: g.name,
        printMode: g.printMode,
        sortOrder: g.sortOrder
      })),
      provisionalLines: quote.provisionalLines.map((l) => ({
        description: l.description,
        price: toNum(l.price),
        notes: l.notes
      })),
      costOptions: quote.costOptions.map((l) => ({
        label: l.label,
        description: l.description,
        price: toNum(l.price),
        notes: l.notes
      })),
      assumptions: quote.assumptions.map((a) => ({
        text: a.text,
        costLineId: a.costLineId
      })),
      exclusions: quote.exclusions.map((e) => ({ text: e.text }))
    };

    // If this quote is for a specific client, replace the client block on
    // the cover page with that client (the base payload uses the first
    // tenderClient, which may be different).
    if (tenderClientRecord) {
      const contact = tenderClientRecord.contact;
      base.tender.clients = [
        {
          id: tenderClientRecord.client.id,
          name: tenderClientRecord.client.name,
          contactName: contact ? `${contact.firstName} ${contact.lastName}`.trim() : null,
          contactEmail: contact?.email ?? tenderClientRecord.client.email ?? null,
          contactPhone: contact?.phone ?? tenderClientRecord.client.phone ?? null
        }
      ];
    }

    // Fallback ladder for T&C clause resolution (QPDF-4):
    //   1. Unsent quote (sentAt null)        → live clauses from tender / defaults
    //   2. Sent, issuedTermsDocumentId null  → live clauses (pre-#549 or no active row)
    //   3. Pinned row found, parses empty    → live clauses + logger.warn
    //   4. Pinned row found, parses ≥1 clause → pinned clauses (the #549 spec)
    // A quote PDF with no terms is worse than one with the wrong terms.
    {
      const liveClauses = resolveLiveClauses(base.tandc);
      if (quote.sentAt !== null && quote.issuedTerms !== null) {
        const { clauses, usedPinned } = resolvePinnedClauses(
          quote.issuedTerms.content,
          liveClauses
        );
        if (!usedPinned) {
          this.logger.warn(
            `Quote ${quoteId}: pinned T&C document (issuedTermsDocumentId=${quote.issuedTermsDocumentId}) ` +
            `parsed 0 clauses — falling back to live terms.`
          );
        }
        base.tandc = { clauses };
      } else {
        // Draft or pre-#549 send: use live clauses (already in base.tandc, but
        // guard against an unlikely empty-JSON edge case from the tender row).
        base.tandc = { clauses: liveClauses };
      }
    }

    const html = buildQuoteHtml(base, overlay);
    const ctx = await this.exportSvc.resolvePdfCompanyContext();
    const buffer = await this.pdfRenderer.renderHtmlToPdf(html, {
      displayHeaderFooter: true,
      headerHtml: headerTemplate(overlay.quoteRef, ctx, {
        ratesLockedAt: base.tender.rateSet?.lockedAt ?? null,
      }),
      footerHtml: footerTemplate(ctx),
      margin: { top: "35mm", bottom: "22mm" },
    });

    const filename = `IS_Quote_${quote.quoteRef.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
    await this.prisma.estimateExport.create({
      data: { tenderId, type: "pdf", generatedBy: userId }
    });
    return { buffer, filename };
  }
}
