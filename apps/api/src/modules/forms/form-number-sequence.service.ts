import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Atomic row-locked counter for "Unique ID" form fields (F-4 wave 1).
 *
 * Mirrors the SafetyIncidentNumberSequence / HazardNumberSequence pattern used
 * in SafetyService and FormsEngineService.nextSeq() — a single row (id = 1) is
 * upserted on first use; subsequent increments run inside a Prisma transaction
 * so the counter is serialised under SQLite's table-level write lock and under
 * Postgres's row-level lock.
 *
 * Formatting is entirely config-driven:
 *   prefix     — string prepended to the number (e.g. "FORM-")
 *   padLength  — zero-pads the counter to this width (default 4, e.g. 0001)
 *
 * The service does NOT persist the generated string; callers write it into the
 * FormSubmissionValue via the standard shapeValue / upsert path so it lands in
 * the `value_text` column, exactly like any other text field.
 *
 * Mirrored from: apps/api/src/modules/safety/safety.service.ts (nextIncidentNumber).
 */
@Injectable()
export class FormNumberSequenceService {
  private static readonly SEQ_ID = 1;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Claim the next number in the shared form sequence and return a formatted
   * unique-ID string according to the field's config.
   *
   * @param prefix    - string prepended before the zero-padded counter
   *                    (from `FormField.config.prefix`, default "")
   * @param padLength - total digit width of the counter (default 4)
   * @returns formatted ID string, e.g. "FORM-0001" or "INS-00042"
   */
  async next(prefix = "", padLength = 4): Promise<string> {
    const id = FormNumberSequenceService.SEQ_ID;
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.formNumberSequence.upsert({
        where: { id },
        create: { id, lastNumber: 1 },
        update: { lastNumber: { increment: 1 } }
      });
      const pad = Math.max(1, Math.min(10, padLength));
      return `${prefix}${String(row.lastNumber).padStart(pad, "0")}`;
    });
  }
}
