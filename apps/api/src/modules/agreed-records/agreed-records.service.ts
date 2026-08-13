import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AgreedRecordStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { JobSorSnapshotService } from "../schedule-of-rates/job-sor-snapshot.service";

// ── Sequence ID constant ───────────────────────────────────────────────────────

const SEQ_ID = 1;

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateAgreedRecordInput = {
  jobId: string;
  description: string;
  workDate: string; // ISO date string
};

export type UpdateAgreedRecordInput = {
  description?: string;
  workDate?: string; // ISO date string
};

export type CreateAgreedRecordLineInput = {
  category: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  resourceName: string;
  class?: string | null;
  unit?: string | null;
  quantity: number | string;
  tier?: string;
  notes?: string | null;
  sortOrder?: number;
};

export type UpdateAgreedRecordLineInput = {
  category?: "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
  resourceName?: string;
  class?: string | null;
  unit?: string | null;
  quantity?: number | string;
  tier?: string;
  notes?: string | null;
  sortOrder?: number;
};

export type CreateAgreedRecordAttachmentInput = {
  kind?: string;
  filePath: string;
  uploadedById?: string | null;
};

export type SubmitAgreedRecordInput = {
  // Caller provides these on submit (or they were already set via PATCH).
  workerSignaturePath: string;
  workerSignedById?: string | null;
  clientRepName: string;
  clientRepSignaturePath: string;
  // If the job has no SoR snapshot yet, caller must supply the period to lock.
  sorPeriodId?: string;
};

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * SoR S7 — Agreed Record (AR / dayworks) capture service.
 *
 * ARs represent dayworks captured by field crews against a job's locked SoR
 * snapshot. The field surface captures resources, hours/qty, photos, and BOTH
 * signatures. No rate or dollar value is returned by these endpoints — pricing
 * happens in S8 (office review). The first submit against a job triggers the
 * S4 snapshot attach ("first VC/AR locks it" rule from S4/S6).
 *
 * Permission reused: `field.view` (same guard as dockets, pre-starts,
 * timesheets). No new permission created.
 */
@Injectable()
export class AgreedRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshots: JobSorSnapshotService,
  ) {}

  // ── Sequential AR number ──────────────────────────────────────────────────

  private async nextArNumber(): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.agreedRecordNumberSequence.upsert({
        where: { id: SEQ_ID },
        create: { id: SEQ_ID, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } },
      });
      return `AR-${String(row.lastNumber).padStart(6, "0")}`;
    });
  }

  // ── Create DRAFT ──────────────────────────────────────────────────────────

  async createDraft(input: CreateAgreedRecordInput, actorId: string) {
    // Verify job exists
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException("Job not found");

    const recordNumber = await this.nextArNumber();

    return this.prisma.agreedRecord.create({
      data: {
        jobId: input.jobId,
        recordNumber,
        description: input.description,
        workDate: new Date(input.workDate),
        status: AgreedRecordStatus.DRAFT,
        createdById: actorId,
      },
      include: this.includeShape(),
    });
  }

  // ── Update DRAFT ──────────────────────────────────────────────────────────

  async updateDraft(id: string, input: UpdateAgreedRecordInput) {
    const ar = await this.requireAgreedRecord(id);
    if (ar.status !== AgreedRecordStatus.DRAFT) {
      throw new BadRequestException(
        `Agreed Record ${id} is not in DRAFT status (status=${ar.status}); only DRAFT records may be edited.`,
      );
    }

    return this.prisma.agreedRecord.update({
      where: { id },
      data: {
        ...(input.description !== undefined && { description: input.description }),
        ...(input.workDate !== undefined && { workDate: new Date(input.workDate) }),
      },
      include: this.includeShape(),
    });
  }

  // ── Lines ─────────────────────────────────────────────────────────────────

  async addLine(agreedRecordId: string, input: CreateAgreedRecordLineInput) {
    const ar = await this.requireAgreedRecord(agreedRecordId);
    if (ar.status !== AgreedRecordStatus.DRAFT) {
      throw new BadRequestException("Lines can only be added to DRAFT records.");
    }

    const quantity = this.toDecimal(input.quantity, "quantity");

    return this.prisma.agreedRecordLine.create({
      data: {
        agreedRecordId,
        category: input.category,
        resourceName: input.resourceName,
        class: input.class ?? null,
        unit: input.unit ?? null,
        quantity,
        tier: input.tier ?? "ORDINARY",
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async updateLine(
    agreedRecordId: string,
    lineId: string,
    input: UpdateAgreedRecordLineInput,
  ) {
    const ar = await this.requireAgreedRecord(agreedRecordId);
    if (ar.status !== AgreedRecordStatus.DRAFT) {
      throw new BadRequestException("Lines can only be updated on DRAFT records.");
    }

    const existing = await this.prisma.agreedRecordLine.findUnique({
      where: { id: lineId },
    });
    if (!existing || existing.agreedRecordId !== agreedRecordId) {
      throw new NotFoundException("Agreed Record line not found.");
    }

    const quantity =
      input.quantity !== undefined
        ? this.toDecimal(input.quantity, "quantity")
        : existing.quantity;

    return this.prisma.agreedRecordLine.update({
      where: { id: lineId },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.resourceName !== undefined && { resourceName: input.resourceName }),
        ...(input.class !== undefined && { class: input.class }),
        ...(input.unit !== undefined && { unit: input.unit }),
        quantity,
        ...(input.tier !== undefined && { tier: input.tier }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
  }

  async deleteLine(agreedRecordId: string, lineId: string) {
    const ar = await this.requireAgreedRecord(agreedRecordId);
    if (ar.status !== AgreedRecordStatus.DRAFT) {
      throw new BadRequestException("Lines can only be deleted from DRAFT records.");
    }

    const existing = await this.prisma.agreedRecordLine.findUnique({
      where: { id: lineId },
    });
    if (!existing || existing.agreedRecordId !== agreedRecordId) {
      throw new NotFoundException("Agreed Record line not found.");
    }

    await this.prisma.agreedRecordLine.delete({ where: { id: lineId } });
    return { id: lineId, deleted: true };
  }

  // ── Attachments ───────────────────────────────────────────────────────────

  async addAttachment(
    agreedRecordId: string,
    input: CreateAgreedRecordAttachmentInput,
  ) {
    const ar = await this.requireAgreedRecord(agreedRecordId);
    if (!ar) throw new NotFoundException("Agreed Record not found.");

    return this.prisma.agreedRecordAttachment.create({
      data: {
        agreedRecordId,
        kind: input.kind ?? "PHOTO",
        filePath: input.filePath,
        uploadedById: input.uploadedById ?? null,
      },
    });
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  /**
   * Submit a DRAFT Agreed Record.
   *
   * Validates:
   *   1. Record is DRAFT.
   *   2. Both worker signature path and client-rep signature path are present
   *      (either passed here or already on the record from PATCH calls).
   *   3. At least one attachment of kind=PHOTO exists.
   *
   * Then:
   *   1. If the job has no active SoR snapshot, attaches one using the
   *      supplied `sorPeriodId` (the "first VC/AR locks it" rule from S4).
   *   2. Stamps jobSorSnapshotId + sorVersion on the record.
   *   3. Transitions status → SUBMITTED.
   */
  async submit(
    id: string,
    input: SubmitAgreedRecordInput,
    actorId: string,
  ) {
    const ar = await this.requireAgreedRecord(id);

    if (ar.status !== AgreedRecordStatus.DRAFT) {
      throw new BadRequestException(
        `Agreed Record ${id} is not in DRAFT status (status=${ar.status}).`,
      );
    }

    // Merge signature fields — they may have been set via a prior PATCH or
    // passed fresh on submit.
    const workerSignaturePath =
      input.workerSignaturePath ?? ar.workerSignaturePath;
    const clientRepSignaturePath =
      input.clientRepSignaturePath ?? ar.clientRepSignaturePath;
    const clientRepName = input.clientRepName ?? ar.clientRepName;

    if (!workerSignaturePath) {
      throw new BadRequestException(
        "Worker signature is required before submitting.",
      );
    }
    if (!clientRepSignaturePath) {
      throw new BadRequestException(
        "Client representative signature is required before submitting.",
      );
    }
    if (!clientRepName) {
      throw new BadRequestException(
        "Client representative name is required before submitting.",
      );
    }

    // Must have at least one PHOTO attachment.
    const photoCount = await this.prisma.agreedRecordAttachment.count({
      where: { agreedRecordId: id, kind: "PHOTO" },
    });
    if (photoCount === 0) {
      throw new BadRequestException(
        "At least one photo attachment is required before submitting.",
      );
    }

    // Ensure the job has a snapshot (first AR locks it).
    const snapshot = await this.ensureSnapshot(
      ar.jobId,
      input.sorPeriodId,
      actorId,
    );

    const now = new Date();
    return this.prisma.agreedRecord.update({
      where: { id },
      data: {
        status: AgreedRecordStatus.SUBMITTED,
        workerSignaturePath,
        workerSignedById: input.workerSignedById ?? ar.workerSignedById,
        workerSignedAt: ar.workerSignedAt ?? now,
        clientRepName,
        clientRepSignaturePath,
        clientRepSignedAt: ar.clientRepSignedAt ?? now,
        jobSorSnapshotId: snapshot.id,
        sorVersion: snapshot.sorVersion,
        submittedAt: now,
      },
      include: this.includeShape(),
    });
  }

  // ── List for job (field crew view — no $ values) ──────────────────────────

  async listForJob(jobId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException("Job not found");

    const records = await this.prisma.agreedRecord.findMany({
      where: { jobId },
      orderBy: { createdAt: "desc" },
      include: this.includeShape(),
    });

    return records;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async requireAgreedRecord(id: string) {
    const ar = await this.prisma.agreedRecord.findUnique({
      where: { id },
      include: this.includeShape(),
    });
    if (!ar) throw new NotFoundException(`Agreed Record ${id} not found`);
    return ar;
  }

  /**
   * Return the active snapshot for the job, attaching one on first use if the
   * caller supplied a period. Implements the "first VC/AR locks it" rule from S4.
   */
  private async ensureSnapshot(
    jobId: string,
    sorPeriodId: string | undefined,
    actorId: string,
  ) {
    const active = await this.snapshots.getForJob(jobId);
    if (active) return active;
    if (!sorPeriodId) {
      throw new BadRequestException(
        "Job has no active SoR snapshot. Provide sorPeriodId to lock one on this first submission.",
      );
    }
    return this.snapshots.attach({ jobId, sorPeriodId }, actorId);
  }

  /**
   * Prisma include shape for field-facing responses.
   * IMPORTANT: No rate / dollar values must be returned from this service.
   * AgreedRecordLine has no rate column — the include is safe by design.
   */
  private includeShape() {
    return {
      lines: {
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
      },
      attachments: {
        orderBy: [{ uploadedAt: "asc" as const }],
      },
    };
  }

  private toDecimal(value: number | string, field: string) {
    try {
      // Prisma accepts string for Decimal; validate it is numeric.
      const num = Number(value);
      if (isNaN(num)) throw new Error("not a number");
      return value;
    } catch {
      throw new BadRequestException(`Invalid ${field}: ${String(value)}`);
    }
  }
}
