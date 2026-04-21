import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { PlatformConfigService, type AiProviderName } from "../platform/platform-config.service";
import { ScopeOfWorksService } from "./scope-of-works.service";
import { ClaudeProvider } from "./ai-providers/claude.provider";
import { GeminiProvider } from "./ai-providers/gemini.provider";
import { GroqProvider } from "./ai-providers/groq.provider";
import type { AiProvider } from "./ai-providers/ai-provider.interface";

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
  mode: "live";
  provider: AiProviderName;
  providerLabel: string;
  revisionId?: string;
  itemsCreated: number;
  items: Array<{ id: string; wbsCode: string; discipline: string; description: string }>;
};

/**
 * Retained for backward-compatible controller behaviour — the HTTP layer maps
 * this to a 412 "api_key_required" response.
 */
export class AnthropicKeyMissingError extends Error {
  constructor(
    message = "No AI provider is configured. Go to Admin → Platform settings and add an Anthropic, Gemini, or Groq API key."
  ) {
    super(message);
    this.name = "AnthropicKeyMissingError";
  }
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly platformConfig: PlatformConfigService,
    private readonly scopeOfWorks: ScopeOfWorksService
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
    const provider = await this.pickProvider();
    if (!provider) {
      throw new AnthropicKeyMissingError();
    }
    const proposals = await provider.draftScope(SYSTEM_PROMPT, userMessage);

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

    // Create draft ScopeOfWorksItem rows so the estimator can review them in the
    // Scope of Works tab (the Drafted Scope tab is retired in PR #44).
    const createdItems = actorId
      ? await this.scopeOfWorks.createDraftItemsFromAi(
          tenderId,
          actorId,
          proposals.map((p) => ({
            code: p.code,
            title: p.title,
            description: p.description,
            confidence: p.confidence,
            sourceReference: p.sourceReference,
            estimatedLabourDays: p.estimatedLabourDays,
            estimatedLabourRole: p.estimatedLabourRole,
            estimatedPlantItems: p.estimatedPlantItems,
            estimatedWasteTonnes: p.estimatedWasteTonnes
          }))
        )
      : [];

    await this.audit.write({
      actorId,
      action: "tenders.scopeDraft",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        mode: "live",
        provider: provider.name,
        documentsRead: readable.length,
        skipped: skipped.length,
        correction: correction ?? null,
        itemsCreated: createdItems.length
      }
    });

    return {
      proposals,
      documentsRead: readable.length,
      documentsSkipped: skipped,
      mode: "live",
      provider: provider.name,
      providerLabel: provider.label,
      revisionId,
      itemsCreated: createdItems.length,
      items: createdItems.map((i) => ({
        id: i.id,
        wbsCode: i.wbsCode,
        discipline: i.discipline,
        description: i.description
      }))
    };
  }

  /**
   * Picks the first provider that has a configured API key, honouring the
   * admin's `preferredProvider` choice if set, else falling back to the
   * priority order Anthropic → Gemini → Groq.
   */
  private async pickProvider(): Promise<AiProvider | null> {
    const status = await this.platformConfig.status();
    const preferred: AiProviderName | null = (status.preferredProvider as AiProviderName | null) ?? null;
    const configuredOrder: AiProviderName[] = preferred
      ? [preferred, ...(["anthropic", "gemini", "groq"] as AiProviderName[]).filter((p) => p !== preferred)]
      : ["anthropic", "gemini", "groq"];
    for (const p of configuredOrder) {
      if (p === "anthropic" && status.anthropic.configured) {
        const key = await this.platformConfig.getAnthropicApiKey();
        if (key) return new ClaudeProvider(key);
      }
      if (p === "gemini" && status.gemini.configured) {
        const key = await this.platformConfig.getGeminiApiKey();
        if (key) return new GeminiProvider(key);
      }
      if (p === "groq" && status.groq.configured) {
        const key = await this.platformConfig.getGroqApiKey();
        if (key) return new GroqProvider(key);
      }
    }
    return null;
  }
}
