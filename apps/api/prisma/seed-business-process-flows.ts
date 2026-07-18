import { Prisma, PrismaClient } from "@prisma/client";

// Seed the Tender stage-bar flow. Insert-if-absent — an admin edit to the
// stages must survive `pnpm seed`. Stages live in the DB (not code) so
// reshaping the flow does not need a deploy.
//
// Required fields per stage encode the "you can't leave this stage
// without …" rule; the engine enforces them on advance().
const TENDER_STAGES: Array<{ name: string; requiredFields: string[] }> = [
  { name: "Lead", requiredFields: ["title"] },
  { name: "Qualify", requiredFields: ["dueDate"] },
  { name: "Estimate", requiredFields: ["estimatedValue"] },
  { name: "Submit", requiredFields: ["submittedAt"] },
  { name: "Won/Lost", requiredFields: [] }
];

export async function seedBusinessProcessFlows(prisma: PrismaClient) {
  const existing = await prisma.businessProcessFlow.findFirst({
    where: { entityType: "Tender", name: "Tender Pipeline" }
  });
  if (existing) return;

  await prisma.businessProcessFlow.create({
    data: {
      entityType: "Tender",
      name: "Tender Pipeline",
      active: true,
      stages: {
        create: TENDER_STAGES.map((stage, index) => ({
          name: stage.name,
          order: index,
          requiredFieldsJson: stage.requiredFields as unknown as Prisma.InputJsonValue
        }))
      }
    }
  });
}
