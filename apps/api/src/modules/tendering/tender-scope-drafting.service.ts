import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AiProvidersService } from "../ai-providers/ai-providers.service";
import { sanitiseProviderError } from "../ai-providers/error-sanitiser";
import { AuditService } from "../audit/audit.service";
import { type AiProviderName } from "../platform/platform-config.service";
import { ScopeOfWorksService } from "./scope-of-works.service";
import { ClaudeProvider } from "./ai-providers/claude.provider";
import { MockAiProvider, OpenAiProvider } from "./ai-providers/openai.provider";
import type { AiProvider } from "./ai-providers/ai-provider.interface";

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  anthropic: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  groq: "Llama 3 on Groq",
  openai: "ChatGPT (OpenAI)"
};

// Post-§5A.1-PR-8 (this PR): provider source is always "company" or "mock".
// The legacy "personal" source was tied to UserAiProvidersService — which is
// deleted in this PR. Provider selection is now centralised in persona
// settings (see AI Settings page). The userId is still recorded in audit
// metadata so we keep "company" vs "mock" distinguishable per request.
export type ProviderMeta = {
  id: string;
  type: AiProviderName | "mock";
  source: "company" | "mock";
  label: string;
};

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
  provider: string;
  providerLabel: string;
  model: string;
  providerMeta: ProviderMeta;
  revisionId?: string;
  itemsCreated: number;
  items: Array<{ id: string; wbsCode: string; discipline: string; description: string }>;
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
    private readonly aiProviders: AiProvidersService,
    private readonly scopeOfWorks: ScopeOfWorksService
  ) {}

  async draft(
    tenderId: string,
    correction: string | null,
    actorId?: string
  ): Promise<DraftScopeResult> {
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
    const { provider, providerMeta } = await this.resolveProviderForUser(actorId);

    // §5A.1 PR 8: error sanitisation on the scope-drafting boundary mirrors
    // the chat endpoint pattern from PR #131. Raw provider errors are logged
    // server-side; the user gets a categorised user-facing string via the
    // re-thrown exception (or the route handler's error filter).
    let proposals: ProposedScopeItem[];
    try {
      proposals = await provider.draftScope(SYSTEM_PROMPT, userMessage);
    } catch (err) {
      const sanitised = sanitiseProviderError(err);
      this.logger.error(
        `Scope draft error [tenderId=${tenderId}, user=${actorId ?? "anonymous"}, category=${sanitised.category}]: ${sanitised.logMessage}`
      );
      throw new ServiceUnavailableException(sanitised.userMessage);
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

    const mode: "live" | "mock" = provider.name === "mock" ? "mock" : "live";
    await this.audit.write({
      actorId,
      action: "tenders.scopeDraft",
      entityType: "Tender",
      entityId: tenderId,
      metadata: {
        mode,
        provider: provider.name,
        providerSource: providerMeta.source,
        providerId: providerMeta.id,
        model: provider.model,
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
      mode,
      provider: provider.name,
      providerLabel: provider.label,
      model: provider.model,
      providerMeta,
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
   * Resolve the AI provider to use for scope drafting. Delegates provider
   * selection to AiProvidersService — same resolver the §5A.1 chat endpoint
   * uses, so admin-configured persona settings (provider, model, key) apply
   * uniformly to chat AND scope drafting.
   *
   * Falls back to MockAiProvider when no key is configured (preserves the
   * legacy "no key → mock" UX so devs can still trigger scope drafting on
   * a fresh DB without billing).
   */
  async resolveProviderForUser(
    userId: string | undefined
  ): Promise<{ provider: AiProvider; providerMeta: ProviderMeta }> {
    if (!userId) {
      // Anonymous callers (e.g. seed scripts) can't have persona settings —
      // fall through to the mock.
      return this.mockFallback();
    }
    try {
      const config = await this.aiProviders.resolveProviderConfig(userId, "tendering");
      const provider = this.instantiate(config.providerId, config.apiKey, config.model);
      return {
        provider,
        providerMeta: {
          id: `company-${config.providerId}`,
          type: config.providerId,
          source: "company",
          label: `${PROVIDER_LABELS[config.providerId]} (company)`
        }
      };
    } catch (err) {
      // resolveProviderConfig throws ServiceUnavailableException when no key
      // is configured — preserve the legacy "fall back to mock" UX rather
      // than failing the whole draft request. Other error categories are
      // genuinely fatal and propagate.
      const sanitised = sanitiseProviderError(err);
      if (sanitised.category === "config") {
        return this.mockFallback();
      }
      throw err;
    }
  }

  private instantiate(name: AiProviderName, key: string, model: string | null): AiProvider {
    // The new ai-providers module supports anthropic + openai (PR #124).
    // Gemini and Groq legacy classes are kept for now in case a future
    // PR re-enables them — but the resolver won't currently return those
    // providerIds (SUPPORTED_PROVIDERS in ai-providers.service.ts).
    if (name === "anthropic") return new ClaudeProvider(key, model);
    return new OpenAiProvider(key, model);
  }

  private mockFallback(): { provider: AiProvider; providerMeta: ProviderMeta } {
    return {
      provider: new MockAiProvider(),
      providerMeta: {
        id: "mock",
        type: "mock",
        source: "mock",
        label: "Mock (no provider configured)"
      }
    };
  }
}
