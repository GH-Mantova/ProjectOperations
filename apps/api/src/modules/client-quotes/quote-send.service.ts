import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { ClientQuotesService } from "./client-quotes.service";
import { QuotePdfService } from "./quote-pdf.service";

export type SendQuoteInput = {
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  attachPdf: boolean;
};

export type SendQuoteResult =
  | { success: true; sentAt: Date; sentTo: string[] }
  | { success: false; error: string };

@Injectable()
export class QuoteSendService {
  private readonly logger = new Logger(QuoteSendService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly pdf: QuotePdfService,
    private readonly quotes: ClientQuotesService
  ) {}

  async send(
    tenderId: string,
    quoteId: string,
    actorId: string,
    input: SendQuoteInput
  ): Promise<SendQuoteResult> {
    try {
      const quote = await this.quotes.getOne(tenderId, quoteId);

      const provider = await this.email.resolveProvider();
      // Build the attachment if requested. The PDF is generated with the
      // same QuotePdfService the /pdf endpoint uses so what the client
      // receives matches what the estimator sees in Preview.
      const attachments: Array<{ filename: string; content: string; contentType: string }> = [];
      if (input.attachPdf) {
        const { buffer, filename } = await this.pdf.generate(tenderId, quoteId, actorId);
        attachments.push({
          filename,
          content: buffer.toString("base64"),
          contentType: "application/pdf"
        });
      }

      const htmlBody = input.body
        .split(/\r?\n/)
        .map((line) => (line.trim() === "" ? "<br/>" : `<div>${escapeHtml(line)}</div>`))
        .join("\n");

      await provider.sendMail({
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        html: htmlBody,
        text: input.body,
        attachments
      });

      const sentAt = new Date();
      await this.prisma.$transaction([
        this.prisma.clientQuote.update({
          where: { id: quoteId },
          data: { status: "SENT", sentAt, sentById: actorId }
        }),
        this.prisma.quoteEmail.create({
          data: {
            quoteId,
            sentTo: input.to,
            subject: input.subject,
            bodyPreview: input.body.slice(0, 500),
            sentById: actorId,
            sentAt
          }
        })
      ]);

      this.logger.log(`quote ${quote.quoteRef} sent to ${input.to.length} recipients`);
      return { success: true, sentAt, sentTo: input.to };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`quote send failed: ${msg}`);
      return { success: false, error: msg };
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
