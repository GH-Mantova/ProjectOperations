import { PrismaClient, SorCategory, SorPeriodHalf } from "@prisma/client";

/**
 * Idempotent seed for Schedule of Rates (SoR S1).
 *
 * Creates the H1 2026 period and a representative set of rates across all four
 * categories (LABOUR, PLANT, WASTE, SUBCONTRACTOR). Full rate population (all
 * ~60 rows from the rate schedule document) comes via the S2 admin UI.
 *
 * Safe to run multiple times — uses upsert-style logic (findFirst + skip, or
 * explicit upsert where Prisma supports it).
 */
export async function seedScheduleOfRates(prisma: PrismaClient): Promise<void> {
  // ── H1 2026 period ────────────────────────────────────────────────────────
  const existingPeriod = await prisma.sorPeriod.findFirst({
    where: { year: 2026, half: SorPeriodHalf.H1 }
  });

  const period = existingPeriod
    ? existingPeriod
    : await prisma.sorPeriod.create({
        data: {
          year: 2026,
          half: SorPeriodHalf.H1,
          startDate: new Date("2026-01-01T00:00:00.000Z"),
          expiryDate: new Date("2026-06-30T23:59:59.000Z"),
          label: "H1 2026 (1 Jan - 30 Jun)",
          status: "ACTIVE"
        }
      });

  const periodId = period.id;

  // ── Helper — idempotent rate upsert by (periodId, category, name) ─────────
  type RateSeed = {
    category: SorCategory;
    name: string;
    class?: string | null;
    unit?: string | null;
    ordinary?: number | null;
    oneAndHalf?: number | null;
    double?: number | null;
    isReference?: boolean;
    comments?: string | null;
    sortOrder?: number;
  };

  async function upsertRate(data: RateSeed): Promise<void> {
    const existing = await prisma.sorRate.findFirst({
      where: { periodId, category: data.category, name: data.name }
    });
    if (existing) return; // idempotent — already seeded

    await prisma.sorRate.create({
      data: {
        periodId,
        category: data.category,
        name: data.name,
        class: data.class ?? null,
        unit: data.unit ?? null,
        ordinary: data.ordinary != null ? data.ordinary : null,
        oneAndHalf: data.oneAndHalf != null ? data.oneAndHalf : null,
        double: data.double != null ? data.double : null,
        isReference: data.isReference ?? false,
        comments: data.comments ?? null,
        sortOrder: data.sortOrder ?? 0
      }
    });
  }

  // ── LABOUR rates ──────────────────────────────────────────────────────────
  const labourRates: RateSeed[] = [
    {
      category: SorCategory.LABOUR,
      name: "Project Manager",
      class: "Demolition",
      unit: "Per Hour",
      ordinary: 133.10,
      oneAndHalf: 160.00,
      double: 193.00,
      sortOrder: 10
    },
    {
      category: SorCategory.LABOUR,
      name: "Labourer",
      class: "Demolition",
      unit: "Per Hour",
      ordinary: 93.50,
      oneAndHalf: 113.00,
      double: 136.00,
      sortOrder: 20
    },
    {
      category: SorCategory.LABOUR,
      name: "Asbestos Removalist Friable",
      class: "A Class",
      unit: "Per Hour",
      ordinary: 114.95,
      oneAndHalf: 138.00,
      double: 167.00,
      sortOrder: 30
    }
  ];

  // ── PLANT rates ───────────────────────────────────────────────────────────
  const plantRates: RateSeed[] = [
    {
      category: SorCategory.PLANT,
      name: "01T-03T Excavator - Asbestos works (incl. Operator)",
      unit: "Per Hour",
      ordinary: 220.00,
      sortOrder: 10
    },
    {
      category: SorCategory.PLANT,
      name: "Bobcat",
      unit: "Per Hour",
      ordinary: 137.50,
      sortOrder: 20
    }
  ];

  // ── WASTE rates ───────────────────────────────────────────────────────────
  const wasteRates: RateSeed[] = [
    {
      category: SorCategory.WASTE,
      name: "C&D",
      unit: "Ton",
      ordinary: 302.90,
      sortOrder: 10
    },
    {
      category: SorCategory.WASTE,
      name: "Asbestos - Levy applicable",
      unit: "Ton",
      ordinary: 468.00,
      sortOrder: 20
    }
  ];

  // ── SUBCONTRACTOR rates ───────────────────────────────────────────────────
  const subbiRates: RateSeed[] = [
    {
      category: SorCategory.SUBCONTRACTOR,
      name: "Coring",
      isReference: true,
      comments: "Cost+ basis — no fixed rate. Reference only.",
      sortOrder: 10
    }
  ];

  const allRates = [...labourRates, ...plantRates, ...wasteRates, ...subbiRates];
  for (const rate of allRates) {
    await upsertRate(rate);
  }
}
