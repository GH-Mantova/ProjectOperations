// B-HW-9: Handover compliance-obligation service.
//
// Persistence side of the compliance-derivation feature.  Uses the pure
// `deriveComplianceSuggestions` function to compute suggestions from the
// handover's scope-of-works items, then upserts them into the DB without
// clobbering rows that already carry user edits (status / docRef).
//
// Design notes:
//  - Mirrors the helper/guard pattern from HandoverSubcontractorsService.
//  - No Prisma model changes here — HandoverComplianceItem landed in B-HW-5.
//  - Zero I/O in the derivation layer; all DB work lives in this class.

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  deriveComplianceSuggestions,
  SUGGESTION_ORIGIN,
  MANUAL_ORIGIN
} from "./compliance-derivation";

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface AddManualComplianceInput {
  type: string;
  responsibleParty: "us" | "client";
  status?: string;
  docRef?: string;
}

export interface UpdateComplianceInput {
  type?: string;
  responsibleParty?: "us" | "client";
  status?: string;
  docRef?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class HandoverComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all compliance-item rows for a handover, ordered by createdAt asc.
   * Throws NotFoundException if the handover does not exist.
   */
  async list(handoverId: string) {
    await this.assertHandoverExists(handoverId);
    return this.prisma.handoverComplianceItem.findMany({
      where: { handoverId },
      orderBy: { createdAt: "asc" }
    });
  }

  /**
   * Derive suggestions from the handover's tender scope-of-works items and
   * persist them.  Rows that already exist as `suggested` origin with the
   * same type are skipped so that any user edits (status, docRef) are not
   * overwritten.  Returns the full fresh list after upsert.
   *
   * Throws BadRequestException if the handover is finalised.
   */
  async deriveSuggestions(handoverId: string) {
    const handover = await this.assertHandoverEditable(handoverId);

    // Load scope items via the handover's tender.
    const scopeItems = await this.prisma.scopeOfWorksItem.findMany({
      where: { tenderId: handover.tenderId },
      include: { card: { select: { discipline: true } } }
    });

    const inputs = scopeItems.map((item) => ({
      rowType: item.rowType,
      discipline: (item.card?.discipline as string | undefined) ?? "Other",
      description: (item.description as string | undefined) ?? undefined
    }));

    const suggestions = deriveComplianceSuggestions(inputs);

    if (suggestions.length > 0) {
      // Load existing suggested rows so we can skip-create without overwriting.
      const existing = await this.prisma.handoverComplianceItem.findMany({
        where: { handoverId, origin: "suggested" },
        select: { type: true }
      });
      const existingTypes = new Set(existing.map((row) => row.type.toLowerCase()));

      const toCreate = suggestions.filter(
        (sug) => !existingTypes.has(sug.type.toLowerCase())
      );

      if (toCreate.length > 0) {
        await this.prisma.handoverComplianceItem.createMany({
          data: toCreate.map((sug) => ({
            handoverId,
            type: sug.type,
            origin: SUGGESTION_ORIGIN,
            responsibleParty: sug.responsibleParty,
            status: "pending"
          }))
        });
      }
    }

    return this.list(handoverId);
  }

  /**
   * Create a manual compliance-item row.
   * Throws BadRequestException if the handover is finalised or `type` is empty.
   */
  async addManual(handoverId: string, input: AddManualComplianceInput) {
    await this.assertHandoverEditable(handoverId);

    if (!input.type?.trim()) {
      throw new BadRequestException("type is required.");
    }
    if (input.responsibleParty !== "us" && input.responsibleParty !== "client") {
      throw new BadRequestException("responsibleParty must be 'us' or 'client'.");
    }

    return this.prisma.handoverComplianceItem.create({
      data: {
        handoverId,
        type: input.type.trim(),
        origin: MANUAL_ORIGIN,
        responsibleParty: input.responsibleParty,
        status: input.status?.trim() ?? "pending",
        docRef: input.docRef ?? null
      }
    });
  }

  /**
   * Patch a compliance-item row.  Only supplied fields are changed.
   * Throws NotFoundException if the item does not exist.
   * Throws BadRequestException if the parent handover is finalised,
   * or if `type` is supplied as an empty string.
   */
  async update(itemId: string, input: UpdateComplianceInput) {
    const row = await this.prisma.handoverComplianceItem.findUnique({
      where: { id: itemId }
    });
    if (!row) throw new NotFoundException(`Compliance item ${itemId} not found.`);
    await this.assertHandoverEditable(row.handoverId);

    const data: Record<string, unknown> = {};

    if (input.type !== undefined) {
      if (!input.type.trim()) {
        throw new BadRequestException("type cannot be empty.");
      }
      data.type = input.type.trim();
    }
    if (input.responsibleParty !== undefined) {
      data.responsibleParty = input.responsibleParty;
    }
    if (input.status !== undefined) {
      data.status = input.status.trim();
    }
    if (input.docRef !== undefined) {
      data.docRef = input.docRef;
    }

    return this.prisma.handoverComplianceItem.update({
      where: { id: itemId },
      data
    });
  }

  /**
   * Delete a compliance-item row.
   * Throws NotFoundException if the item does not exist.
   * Throws BadRequestException if the parent handover is finalised.
   */
  async remove(itemId: string) {
    const row = await this.prisma.handoverComplianceItem.findUnique({
      where: { id: itemId }
    });
    if (!row) throw new NotFoundException(`Compliance item ${itemId} not found.`);
    await this.assertHandoverEditable(row.handoverId);
    await this.prisma.handoverComplianceItem.delete({ where: { id: itemId } });
  }

  // ── Internal helpers ────────────────────────────────────────────────────────

  private async assertHandoverExists(handoverId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      select: { id: true }
    });
    if (!handover) {
      throw new NotFoundException(`Handover ${handoverId} not found.`);
    }
  }

  /**
   * Returns the handover (with tenderId and status) if it exists and is
   * editable (not finalised).  Throws otherwise.
   */
  private async assertHandoverEditable(handoverId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      select: { id: true, tenderId: true, status: true }
    });
    if (!handover) {
      throw new NotFoundException(`Handover ${handoverId} not found.`);
    }
    if (handover.status === "finalised") {
      throw new BadRequestException(
        "Cannot modify compliance items on a finalised handover."
      );
    }
    return handover;
  }
}
