import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import {
  DEFAULT_TENDERING_LABELS,
  isTenderingLabelKey,
  type TenderingLabelKey
} from "./tender-labels.defaults";

export type TenderingLabelMap = Record<TenderingLabelKey, string>;

/** One override entry from the settings page. `null` (or empty string) means
 *  "delete the override and fall back to the default". */
export type LabelOverrideInput = { key: string; label: string | null };

/**
 * Service for org-wide Tendering display-label overrides. Reads merge the
 * `tendering_labels` table on top of the in-code default map; writes upsert
 * one row per non-default label and delete rows whose label matches (or is
 * cleared to) the default so the table only ever holds true overrides.
 */
@Injectable()
export class TenderLabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  /**
   * Return the full label map (defaults merged with any stored overrides).
   * Unknown keys in the DB (e.g. from a rolled-back rename) are ignored.
   */
  async list(): Promise<TenderingLabelMap> {
    const rows = await this.prisma.tenderingLabel.findMany();
    const merged: TenderingLabelMap = { ...DEFAULT_TENDERING_LABELS };
    for (const row of rows) {
      if (isTenderingLabelKey(row.key)) {
        merged[row.key] = row.label;
      }
    }
    return merged;
  }

  /**
   * Upsert / delete overrides in one call. Only known keys are accepted;
   * an entry with a null / blank / default-matching label deletes the
   * override row. Writes one audit entry summarising the change.
   *
   * @returns the fully-merged label map after the change
   * @throws BadRequestException on unknown keys or non-string labels
   */
  async updateMany(inputs: LabelOverrideInput[], actorId?: string): Promise<TenderingLabelMap> {
    const upserts: Array<{ key: TenderingLabelKey; label: string }> = [];
    const deletes: TenderingLabelKey[] = [];

    for (const entry of inputs) {
      if (!isTenderingLabelKey(entry.key)) {
        throw new BadRequestException(`Unknown tendering label key "${entry.key}".`);
      }
      const trimmed = typeof entry.label === "string" ? entry.label.trim() : "";
      if (!trimmed || trimmed === DEFAULT_TENDERING_LABELS[entry.key]) {
        deletes.push(entry.key);
      } else {
        upserts.push({ key: entry.key, label: trimmed });
      }
    }

    await this.prisma.$transaction([
      ...(deletes.length
        ? [this.prisma.tenderingLabel.deleteMany({ where: { key: { in: deletes } } })]
        : []),
      ...upserts.map((u) =>
        this.prisma.tenderingLabel.upsert({
          where: { key: u.key },
          create: { key: u.key, label: u.label, updatedById: actorId ?? null },
          update: { label: u.label, updatedById: actorId ?? null }
        })
      )
    ]);

    await this.audit.write({
      actorId,
      action: "tenders.labels.update",
      entityType: "TenderingLabel",
      entityId: "*",
      metadata: {
        overriddenKeys: upserts.map((u) => u.key),
        resetKeys: deletes
      }
    });

    return this.list();
  }
}
