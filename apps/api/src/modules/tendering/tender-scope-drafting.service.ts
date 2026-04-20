import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";

const MODEL_ID = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;

const READABLE_EXT = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;
const UNREADABLE_EXT = /\.(dwg)$/i;

export type ProposedScopeItem = {
  code: "SO" | "Str" | "Asb" | "Civ" | "Prv";
  title: string;
  description: string;
  estimatedLabourDays?: number;
  estimatedLabourRole?: string;
  estimatedPlantItems?: Array<{ item: string; days: number }>;
  estimatedWasteTonnes?: Array<{ type: string; tonnes: number }>;
  confidence: "high" | "medium" | "low";
  sourceReference?: string;
};

export type DraftScopeResult = {
  proposals: ProposedScopeItem[];
  documentsRead: number;
  documentsSkipped: string[];
  mode: "live" | "mock";
  revisionId?: string;
};

const SYSTEM_PROMPT = `You are an expert estimator for Initial Services Pty Ltd, a Brisbane-based contractor specialising in three core disciplines:

1. DEMOLITION — structural and non-structural demolition, internal strip-outs, fitout removal, concrete breaking, mechanical demolition, hand demolition
2. ASBESTOS REMOVAL — Class A (friable ACM, full enclosure, negative pressure) and Class B (non-friable ACM, bonded materials, super-6 sheeting, vinyl floor tiles, textured ceilings) removal, air monitoring, clearance certificates
3. CIVIL WORKS — excavation, earthworks, cut and fill, drainage, concrete removal, pavement works, site remediation

When reading documents, ONLY identify scope items that fall within these three disciplines. Do NOT propose scope for:
- New construction or installation work
- Mechanical/electrical/plumbing services (unless it's disconnection as part of demolition prep)
- Fit-out or joinery installation
- Painting or finishing works
- Any work outside demolition, asbestos, or civil scope

For asbestos items, always note:
- Whether friable (Class A) or non-friable (Class B) based on document context
- Estimated area in m² where mentioned
- Whether an asbestos register or report is referenced

For demolition items, always note:
- Structural vs non-structural
- Materials involved (concrete, masonry, timber, steel)
- Approximate quantities (m², m³, lineal metres) where mentioned

For civil items, always note:
- Volume (m³) or area (m²) of earthworks
- Disposal requirements
- Any environmental constraints mentioned

Your job is to read tender documents and propose a structured scope of works broken into typed items.

Item codes:
- SO: Strip-outs (internal strip-out, fitout removal, non-structural demolition)
- Str: Structural demolition (concrete, structural elements)
- Asb: Asbestos removal (ACM, friable/non-friable, enclosures, air monitoring, clearances)
- Civ: Civil works (excavation, earthworks, drainage, pavement, site remediation)
- Prv: Provisional sums (allowances for unknown/unforeseen work within these three disciplines)

For each scope item, provide:
- code: one of SO/Str/Asb/Civ/Prv
- title: concise item title (max 60 chars)
- description: detailed scope description including quantities, areas, levels, materials where mentioned in documents
- estimatedLabourDays: integer estimate of total labour days
- estimatedLabourRole: primary role (Demolition labourer / Asbestos labourer / Machine operator / Project manager)
- estimatedPlantItems: array of {item, days} for major plant
- estimatedWasteTonnes: array of {type, tonnes} estimated waste in tonnes by type
- confidence: "high" | "medium" | "low" — how confident you are based on document clarity
- sourceReference: which document/section this came from

Always include standard items when applicable:
- GPR scanning as a Prv item if underground services are possible
- Asbestos inspection/register review as Asb item if building pre-dates 1990
- Traffic management as SO item if road frontage work involved

Respond ONLY with a valid JSON array of scope items. No preamble, no explanation, no markdown fences.`;

@Injectable()
export class TenderScopeDraftingService {
  private readonly logger = new Logger(TenderScopeDraftingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService
  ) {}

  async draft(tenderId: string, correction: string | null, actorId?: string): Promise<DraftScopeResult> {
    const tender = await this.prisma.tender.findUnique({
      where: { id: tenderId },
      select: {
        id: true,
        tenderNumber: true,
        title: true,
        description: true,
        tenderDocuments: {
          include: { fileLink: { select: { name: true, mimeType: true, webUrl: true } } }
        }
      }
    });
    if (!tender) throw new NotFoundException("Tender not found.");

    const docs = tender.tenderDocuments;
    if (docs.length === 0) {
      throw new BadRequestException("Upload at least one document before drafting scope.");
    }

    const readable = docs.filter((d) => {
      const name = d.fileLink?.name ?? "";
      return READABLE_EXT.test(name) && !UNREADABLE_EXT.test(name);
    });
    const skipped = docs
      .filter((d) => {
        const name = d.fileLink?.name ?? "";
        return UNREADABLE_EXT.test(name) || !READABLE_EXT.test(name);
      })
      .map((d) => d.fileLink?.name ?? d.title);

    if (readable.length === 0) {
      throw new BadRequestException(
        "All uploaded documents are DWG or unsupported types. Upload a PDF or image of the drawings so Claude can read them."
      );
    }

    const previousRevisions = await this.prisma.tenderScopeRevision.findMany({
      where: { tenderId },
      orderBy: { createdAt: "asc" },
      select: { correction: true }
    });

    const userMessageParts: string[] = [];
    userMessageParts.push(`Tender: ${tender.tenderNumber} — ${tender.title}`);
    if (tender.description) userMessageParts.push(`Description: ${tender.description}`);
    userMessageParts.push("");
    userMessageParts.push(`Readable documents (${readable.length}):`);
    for (const d of readable) {
      userMessageParts.push(
        `- ${d.title} (${d.fileLink?.name ?? "unknown"}) — category: ${d.category}${d.description ? ` — ${d.description}` : ""}`
      );
    }
    if (skipped.length > 0) {
      userMessageParts.push("");
      userMessageParts.push(`Documents skipped (DWG / unsupported): ${skipped.join(", ")}`);
    }

    const corrections = [...previousRevisions.map((r) => r.correction), ...(correction ? [correction] : [])];
    if (corrections.length > 0) {
      userMessageParts.push("");
      userMessageParts.push("Previous feedback from the estimator — please revise your scope proposal accordingly:");
      for (const c of corrections) userMessageParts.push(`- ${c}`);
    }

    userMessageParts.push("");
    userMessageParts.push(
      "Propose a structured scope of works for this tender as a JSON array of scope items. JSON only, no other text."
    );

    const userMessage = userMessageParts.join("\n");
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    let proposals: ProposedScopeItem[];
    let mode: "live" | "mock" = "mock";

    if (apiKey) {
      try {
        proposals = await this.callAnthropic(apiKey, userMessage);
        mode = "live";
      } catch (err) {
        this.logger.warn(`Anthropic call failed; falling back to mock proposals: ${(err as Error).message}`);
        proposals = this.mockProposals(tender.title);
      }
    } else {
      this.logger.log("ANTHROPIC_API_KEY not set; returning mock proposals");
      proposals = this.mockProposals(tender.title);
    }

    let revisionId: string | undefined;
    if (correction) {
      const revision = await this.prisma.tenderScopeRevision.create({
        data: {
          tenderId,
          correction,
          originalProposal: { proposals: previousRevisions.map((r) => r.correction) },
          revisedProposal: proposals as never,
          createdById: actorId ?? null
        }
      });
      revisionId = revision.id;
    }

    await this.audit.write({
      actorId,
      action: "tenders.scopeDraft",
      entityType: "Tender",
      entityId: tenderId,
      metadata: { mode, documentsRead: readable.length, skipped: skipped.length, correction: correction ?? null }
    });

    return {
      proposals,
      documentsRead: readable.length,
      documentsSkipped: skipped,
      mode,
      revisionId
    };
  }

  private async callAnthropic(apiKey: string, userMessage: string): Promise<ProposedScopeItem[]> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API ${response.status}: ${errorText.slice(0, 400)}`);
    }
    const body = (await response.json()) as {
      content: Array<{ type: string; text?: string }>;
    };
    const text = body.content.map((block) => block.text ?? "").join("").trim();
    return parseJsonArray(text);
  }

  private mockProposals(tenderTitle: string): ProposedScopeItem[] {
    const prefix = tenderTitle.slice(0, 40);
    return [
      {
        code: "SO",
        title: `Strip-out — ${prefix}`,
        description:
          "Full internal strip-out of non-structural fitout, ceilings, partitions, joinery, floor coverings and services to slab.",
        estimatedLabourDays: 12,
        estimatedLabourRole: "Demolition labourer",
        estimatedPlantItems: [{ item: "Bobcat", days: 4 }],
        estimatedWasteTonnes: [{ type: "C&D — general", tonnes: 30 }],
        confidence: "medium",
        sourceReference: "Mock proposal — example"
      },
      {
        code: "Asb",
        title: "Asbestos register review + removal allowance",
        description:
          "Review pre-1990 asbestos register, confirm ACM extent, remove non-friable ACM linings and flooring in controlled work zones.",
        estimatedLabourDays: 6,
        estimatedLabourRole: "Asbestos labourer",
        estimatedPlantItems: [],
        estimatedWasteTonnes: [{ type: "Asbestos NF", tonnes: 4 }],
        confidence: "low",
        sourceReference: "Mock proposal — example"
      },
      {
        code: "Str",
        title: "Structural demolition — concrete elements",
        description:
          "Saw-cut and break out identified concrete walls, slab openings and stair shaft where shown on drawings.",
        estimatedLabourDays: 8,
        estimatedLabourRole: "Machine operator",
        estimatedPlantItems: [{ item: "Excavator 16T-25T (wet hire)", days: 5 }],
        estimatedWasteTonnes: [{ type: "Concrete — clean", tonnes: 60 }],
        confidence: "medium",
        sourceReference: "Mock proposal — example"
      },
      {
        code: "Prv",
        title: "Provisional sum — GPR scanning & unknowns",
        description:
          "Allowance for GPR scanning of slabs prior to penetrations and for unforeseen services encountered during demolition.",
        estimatedLabourDays: 2,
        estimatedLabourRole: "Project manager",
        estimatedPlantItems: [],
        estimatedWasteTonnes: [],
        confidence: "low",
        sourceReference: "Mock proposal — example"
      }
    ];
  }
}

function parseJsonArray(raw: string): ProposedScopeItem[] {
  const trimmed = raw.trim();
  const unfenced = trimmed.startsWith("```")
    ? trimmed.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim()
    : trimmed;
  const start = unfenced.indexOf("[");
  const end = unfenced.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Claude response did not contain a JSON array.");
  }
  const slice = unfenced.slice(start, end + 1);
  const parsed = JSON.parse(slice);
  if (!Array.isArray(parsed)) throw new Error("Claude response was not an array.");
  return parsed as ProposedScopeItem[];
}
