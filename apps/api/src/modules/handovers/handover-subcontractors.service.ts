// B-HW-10: Handover subcontractors & procurement capture.
//
// CRUD for HandoverSubcontractor rows attached to a handover. Each row records
// a required subbie/trade line, optionally linking an existing quote
// (`quoteRef`) and/or a purchase order (`poRef`), plus the `folderSlot` name
// used by B-HW-11 to scaffold one subfolder per engaged subbie under the job's
// `Subcontractor/` SharePoint folder at finalise.
//
// Design notes:
//  - Finalised handovers are read-only: create/update/delete throw
//    BadRequestException, matching HandoversService.patchValues (B-HW-6).
//  - `folderSlot` is the caller-supplied stable slug the folder scaffolder
//    will use at finalise. We do not normalise or scaffold folders here —
//    that is B-HW-11's job.
//  - `hasGap` (rows with neither quoteRef nor poRef) is computed on read so
//    the PM UI can surface unresolved procurement lines without a stored flag.

import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Input shapes ────────────────────────────────────────────────────────────

export interface CreateHandoverSubcontractorInput {
  name: string;
  folderSlot: string;
  quoteRef?: string | null;
  poRef?: string | null;
}

export interface UpdateHandoverSubcontractorInput {
  name?: string;
  folderSlot?: string;
  quoteRef?: string | null;
  poRef?: string | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class HandoverSubcontractorsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all subcontractor rows for a handover. Each row is decorated with
   * `hasGap = true` when it has neither a quoteRef nor a poRef.
   */
  async list(handoverId: string) {
    await this.assertHandoverExists(handoverId);
    const rows = await this.prisma.handoverSubcontractor.findMany({
      where: { handoverId },
      orderBy: { createdAt: "asc" }
    });
    return rows.map((row) => ({
      ...row,
      hasGap: !row.quoteRef && !row.poRef
    }));
  }

  /**
   * Create a subcontractor row on a handover.
   * Rejects the write when the handover is finalised.
   */
  async create(handoverId: string, input: CreateHandoverSubcontractorInput) {
    await this.assertHandoverEditable(handoverId);
    if (!input.name?.trim()) {
      throw new BadRequestException("name is required.");
    }
    if (!input.folderSlot?.trim()) {
      throw new BadRequestException("folderSlot is required.");
    }
    return this.prisma.handoverSubcontractor.create({
      data: {
        handoverId,
        name: input.name.trim(),
        folderSlot: input.folderSlot.trim(),
        quoteRef: input.quoteRef ?? null,
        poRef: input.poRef ?? null
      }
    });
  }

  /**
   * Patch a subcontractor row. Only supplied fields are changed; unset
   * fields are left as-is. `null` explicitly clears a reference.
   */
  async update(id: string, input: UpdateHandoverSubcontractorInput) {
    const row = await this.prisma.handoverSubcontractor.findUnique({
      where: { id }
    });
    if (!row) throw new NotFoundException(`Subcontractor ${id} not found.`);
    await this.assertHandoverEditable(row.handoverId);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) {
      if (!input.name.trim()) {
        throw new BadRequestException("name cannot be empty.");
      }
      data.name = input.name.trim();
    }
    if (input.folderSlot !== undefined) {
      if (!input.folderSlot.trim()) {
        throw new BadRequestException("folderSlot cannot be empty.");
      }
      data.folderSlot = input.folderSlot.trim();
    }
    if (input.quoteRef !== undefined) data.quoteRef = input.quoteRef;
    if (input.poRef !== undefined) data.poRef = input.poRef;

    return this.prisma.handoverSubcontractor.update({
      where: { id },
      data
    });
  }

  /**
   * Delete a subcontractor row. Rejects if the parent handover is finalised.
   */
  async remove(id: string) {
    const row = await this.prisma.handoverSubcontractor.findUnique({
      where: { id }
    });
    if (!row) throw new NotFoundException(`Subcontractor ${id} not found.`);
    await this.assertHandoverEditable(row.handoverId);
    await this.prisma.handoverSubcontractor.delete({ where: { id } });
  }

  /**
   * Return only the rows flagged as procurement gaps (no quote, no PO).
   * Used by the PM completeness view.
   */
  async listGaps(handoverId: string) {
    await this.assertHandoverExists(handoverId);
    return this.prisma.handoverSubcontractor.findMany({
      where: {
        handoverId,
        quoteRef: null,
        poRef: null
      },
      orderBy: { createdAt: "asc" }
    });
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async assertHandoverExists(handoverId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      select: { id: true }
    });
    if (!handover) {
      throw new NotFoundException(`Handover ${handoverId} not found.`);
    }
  }

  private async assertHandoverEditable(handoverId: string) {
    const handover = await this.prisma.handover.findUnique({
      where: { id: handoverId },
      select: { id: true, status: true }
    });
    if (!handover) {
      throw new NotFoundException(`Handover ${handoverId} not found.`);
    }
    if (handover.status === "finalised") {
      throw new BadRequestException(
        "Cannot modify subcontractors on a finalised handover."
      );
    }
  }
}
