import { PrismaClient } from "@prisma/client";

// CRM S1: Seed default DropReason lookup records.
//
// Idempotent: upsert on label so re-running the seed is safe.
// sortOrder values use multiples of 10 to leave room for future insertions.

const DROP_REASON_DEFAULTS: Array<{ label: string; sortOrder: number }> = [
  { label: "Price / budget", sortOrder: 10 },
  { label: "Didn't know we offer it", sortOrder: 20 },
  { label: "Timing / capacity", sortOrder: 30 },
  { label: "Out of service area", sortOrder: 40 },
  { label: "Went cold", sortOrder: 50 },
  { label: "Other", sortOrder: 60 }
];

export async function seedCrmDropReasons(prisma: PrismaClient): Promise<void> {
  for (const reason of DROP_REASON_DEFAULTS) {
    await prisma.dropReason.upsert({
      where: { label: reason.label },
      update: { sortOrder: reason.sortOrder },
      create: {
        label: reason.label,
        sortOrder: reason.sortOrder,
        isActive: true
      }
    });
  }
}
