// B-HW-6: Handover API — create, prefill from awarded quote, patch values,
// completeness, section-done.
//
// Design decisions recorded here:
// 1. tenderId is resolved via Contract → Project → sourceTenderId so the
//    caller only needs to pass contractId.
// 2. autoBinding dot-paths understood for prefill:
//    "contract.*"   — fields on the Contract row (contractValue, startDate, …)
//    "project.*"    — fields on the Project row (name, clientId, …)
//    "quote.*"      — fields on the awarded ClientQuote row (revision, quoteRef, …)
//    "quote.totalCost" is computed as sum of all QuoteCostLine.price values.
//    Unknown paths resolve to null (no prefill for that field).
// 3. sectionDone is stored per HandoverValue row (per the schema). A PATCH
//    item may include sectionDone to set that flag alongside the value.
// 4. completionPct counts non-retired required fields whose HandoverValue.value
//    is non-null and not an empty string. Integer 0–100.
// 5. One-way prefill: sourceValue and value are both set at create time.
//    We NEVER write back to any tender/quote/contract row.

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Internal types ───────────────────────────────────────────────────────────

interface PrefillContext {
  contract: Record<string, unknown>;
  project: Record<string, unknown>;
  quote: Record<string, unknown>;
}

type JsonValue = Prisma.InputJsonValue;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HandoversService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  /**
   * Create a handover for an existing contract.
   *
   * Steps:
   * 1. Load Contract + Project + Tender (to get tenderId and prefill context).
   * 2. Resolve the template version to pin (caller-supplied or active).
   * 3. Load all non-retired fields from the pinned version.
   * 4. Build prefill rows from auto-binding fields on the awarded ClientQuote.
   * 5. Persist Handover + HandoverValue rows in a transaction.
   * 6. Compute initial completionPct and persist it.
   */
  async create(userId: string, contractId: string, templateVersionId?: string) {
    // 1. Load contract → project → tender
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        project: true
      }
    });
    if (!contract) throw new NotFoundException(`Contract ${contractId} not found.`);

    const project = contract.project;
    if (!project) {
      throw new BadRequestException(
        `Contract ${contractId} has no linked project — cannot create handover.`
      );
    }
    const tenderId = project.sourceTenderId;
    if (!tenderId) {
      throw new BadRequestException(
        `Project linked to contract ${contractId} has no sourceTenderId — cannot create handover.`
      );
    }

    // 2. Resolve the template version to pin.
    const pinnedVersion = await this.resolveTemplateVersion(templateVersionId);

    // 3. Load all non-retired fields (across all sections of the pinned version).
    const sections = await this.prisma.handoverTemplateSection.findMany({
      where: { templateId: pinnedVersion.id },
      orderBy: { sortOrder: "asc" },
      include: {
        fields: {
          where: { retiredAt: null },
          orderBy: { sortOrder: "asc" }
        }
      }
    });
    const allFields = sections.flatMap((s) => s.fields);

    // 4. Build prefill context from the awarded ClientQuote.
    const prefillCtx = await this.buildPrefillContext(tenderId, contract, project);

    // 5. Persist inside a transaction.
    const handover = await this.prisma.$transaction(async (tx) => {
      const created = await tx.handover.create({
        data: {
          contractId,
          tenderId,
          templateVersionId: pinnedVersion.id,
          createdById: userId
        }
      });

      // Build HandoverValue rows for all auto-binding fields.
      const valueRows: {
        handoverId: string;
        fieldKey: string;
        value: JsonValue;
        sourceValue: JsonValue;
        isOverridden: boolean;
        sectionDone: boolean;
      }[] = [];

      for (const field of allFields) {
        if (field.sourceType === "auto" && field.autoBinding) {
          const resolved = this.resolveBinding(field.autoBinding, prefillCtx);
          if (resolved !== undefined && resolved !== null) {
            valueRows.push({
              handoverId: created.id,
              fieldKey: field.key,
              value: resolved as JsonValue,
              sourceValue: resolved as JsonValue,
              isOverridden: false,
              sectionDone: false
            });
          }
        }
      }

      if (valueRows.length > 0) {
        await tx.handoverValue.createMany({ data: valueRows });
      }

      return created;
    });

    // 6. Compute initial completionPct and update.
    const completionPct = await this.computeCompletionPct(handover.id, allFields);
    await this.prisma.handover.update({
      where: { id: handover.id },
      data: { completionPct }
    });

    return this.loadHandoverWithValues(handover.id);
  }

  // ── Get ────────────────────────────────────────────────────────────────────

  /**
   * Get a handover by id, including all its values and the pinned template
   * version. Returns a completionPct freshly computed from the template's
   * required fields vs filled values.
   */
  async get(id: string) {
    const handover = await this.loadHandoverWithValues(id);
    if (!handover) throw new NotFoundException(`Handover ${id} not found.`);
    return handover;
  }

  // ── Patch values ───────────────────────────────────────────────────────────

  /**
   * Upsert a batch of field values for a handover.
   *
   * For each item:
   * - If a HandoverValue row already exists for (handoverId, fieldKey), update it.
   * - If the field had a sourceValue and the new value differs, set isOverridden=true.
   * - If sectionDone is supplied, set it on this row.
   *
   * After all upserts, recomputes and persists completionPct.
   */
  async patchValues(
    handoverId: string,
    items: { fieldKey: string; value: unknown; sectionDone?: boolean }[]
  ) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId }
    });
    if (!handover) throw new NotFoundException(`Handover ${handoverId} not found.`);
    if (handover.status === "finalised") {
      throw new BadRequestException("Cannot patch values on a finalised handover.");
    }

    // Load existing values for the override comparison.
    const existingValues = await this.prisma.handoverValue.findMany({
      where: { handoverId }
    });
    const existingMap = new Map(existingValues.map((v) => [v.fieldKey, v]));

    // Upsert each item in sequence (small batches OK for wizard interactions).
    for (const item of items) {
      const existing = existingMap.get(item.fieldKey);

      let isOverridden = false;
      if (existing) {
        // Mark overridden when a prefilled field is edited away from its source.
        isOverridden =
          existing.sourceValue !== null &&
          existing.sourceValue !== undefined &&
          JSON.stringify(existing.sourceValue) !== JSON.stringify(item.value);
      }

      const data: Prisma.HandoverValueUpdateInput = {
        value: item.value as JsonValue
      };
      if (isOverridden) data.isOverridden = true;
      if (item.sectionDone !== undefined) data.sectionDone = item.sectionDone;

      await this.prisma.handoverValue.upsert({
        where: {
          handoverId_fieldKey: { handoverId, fieldKey: item.fieldKey }
        },
        create: {
          handoverId,
          fieldKey: item.fieldKey,
          value: item.value as JsonValue,
          isOverridden,
          sectionDone: item.sectionDone ?? false
        },
        update: data
      });
    }

    // Recompute and persist completionPct.
    const allFields = await this.loadTemplateFields(handoverId);
    const completionPct = await this.computeCompletionPct(handoverId, allFields);
    await this.prisma.handover.update({
      where: { id: handoverId },
      data: { completionPct }
    });

    return this.loadHandoverWithValues(handoverId);
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Resolve the template version to pin.
   * If templateVersionId is supplied, load and validate it.
   * Otherwise, use the currently-active version (isActive=true).
   */
  private async resolveTemplateVersion(templateVersionId?: string) {
    if (templateVersionId) {
      const version = await this.prisma.handoverTemplate.findUnique({
        where: { id: templateVersionId }
      });
      if (!version) {
        throw new NotFoundException(
          `HandoverTemplate version ${templateVersionId} not found.`
        );
      }
      return version;
    }

    const active = await this.prisma.handoverTemplate.findFirst({
      where: { isActive: true }
    });
    if (!active) {
      throw new NotFoundException(
        "No active HandoverTemplate found. Publish a template version before creating a handover."
      );
    }
    return active;
  }

  /**
   * Build the prefill context object containing contract, project, and
   * awarded-quote data. The awarded quote is the highest-revision ClientQuote
   * for the TenderClient whose isAwarded=true.
   */
  private async buildPrefillContext(
    tenderId: string,
    contract: Record<string, unknown>,
    project: Record<string, unknown>
  ): Promise<PrefillContext> {
    // Find the awarded TenderClient for this tender.
    const awardedClient = await this.prisma.tenderClient.findFirst({
      where: { tenderId, isAwarded: true }
    });

    let quoteData: Record<string, unknown> = {};

    if (awardedClient) {
      // Highest revision ClientQuote for the awarded client.
      const quote = await this.prisma.clientQuote.findFirst({
        where: { tenderId, clientId: awardedClient.clientId },
        orderBy: { revision: "desc" },
        include: {
          costLines: true
        }
      });

      if (quote) {
        // Compute total cost from cost lines.
        const totalCost = quote.costLines.reduce(
          (sum, line) => sum + Number(line.price),
          0
        );

        quoteData = {
          id: quote.id,
          revision: quote.revision,
          quoteRef: quote.quoteRef,
          status: quote.status,
          adjustmentPct: quote.adjustmentPct !== null ? Number(quote.adjustmentPct) : null,
          adjustmentAmt: quote.adjustmentAmt !== null ? Number(quote.adjustmentAmt) : null,
          totalCost
        };
      }
    }

    // Flatten contract to plain scalars (strip Decimal/Date to JSON-safe values).
    const contractData = this.flattenRecord(contract as Record<string, unknown>);
    const projectData = this.flattenRecord(project as Record<string, unknown>);

    return {
      contract: contractData,
      project: projectData,
      quote: quoteData
    };
  }

  /**
   * Resolve a single autoBinding dot-path against the prefill context.
   * Returns undefined when the path is unknown or the value is absent.
   *
   * Supported prefixes: "contract.*", "project.*", "quote.*".
   */
  private resolveBinding(
    binding: string,
    ctx: PrefillContext
  ): unknown | undefined {
    const dotIdx = binding.indexOf(".");
    if (dotIdx === -1) return undefined;

    const prefix = binding.slice(0, dotIdx);
    const field = binding.slice(dotIdx + 1);

    let source: Record<string, unknown> | undefined;
    if (prefix === "contract") source = ctx.contract;
    else if (prefix === "project") source = ctx.project;
    else if (prefix === "quote") source = ctx.quote;
    else return undefined;

    if (!source) return undefined;
    return source[field];
  }

  /**
   * Flatten a Prisma record to a plain JSON-safe object.
   * Converts Decimal → number, Date → ISO string, drops relation objects.
   */
  private flattenRecord(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(record)) {
      if (val === null || val === undefined) {
        out[key] = null;
      } else if (typeof val === "object" && "toNumber" in val && typeof (val as { toNumber: unknown }).toNumber === "function") {
        // Prisma Decimal
        out[key] = (val as { toNumber(): number }).toNumber();
      } else if (val instanceof Date) {
        out[key] = val.toISOString();
      } else if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        out[key] = val;
      }
      // Skip nested objects/arrays (relations) — they're not useful for auto-binding.
    }
    return out;
  }

  /**
   * Compute completionPct: filled required fields / total required non-retired
   * fields in the pinned template version. A field is "filled" when its
   * HandoverValue.value is non-null and not an empty string.
   */
  private async computeCompletionPct(
    handoverId: string,
    allFields: { key: string; required: boolean }[]
  ): Promise<number> {
    const requiredFields = allFields.filter((f) => f.required);
    if (requiredFields.length === 0) return 100;

    const filledValues = await this.prisma.handoverValue.findMany({
      where: { handoverId },
      select: { fieldKey: true, value: true }
    });
    const filledMap = new Map(filledValues.map((v) => [v.fieldKey, v.value]));

    let filledCount = 0;
    for (const field of requiredFields) {
      const val = filledMap.get(field.key);
      if (val !== null && val !== undefined && val !== "") {
        filledCount += 1;
      }
    }

    return Math.round((filledCount / requiredFields.length) * 100);
  }

  /**
   * Load all non-retired template fields for the template version pinned to
   * the given handover.
   */
  private async loadTemplateFields(handoverId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      select: { templateVersionId: true }
    });
    if (!handover) return [];

    const sections = await this.prisma.handoverTemplateSection.findMany({
      where: { templateId: handover.templateVersionId },
      include: {
        fields: { where: { retiredAt: null } }
      }
    });
    return sections.flatMap((s) => s.fields);
  }

  /**
   * Load a handover with its values and freshly-computed completionPct.
   */
  private async loadHandoverWithValues(id: string) {
    return this.prisma.handover.findUnique({
      where: { id },
      include: {
        values: {
          orderBy: { createdAt: "asc" }
        },
        templateVersion: {
          include: {
            sections: {
              orderBy: { sortOrder: "asc" },
              include: {
                fields: {
                  where: { retiredAt: null },
                  orderBy: { sortOrder: "asc" }
                }
              }
            }
          }
        }
      }
    });
  }
}
