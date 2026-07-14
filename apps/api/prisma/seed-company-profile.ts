import { PrismaClient } from "@prisma/client";
import {
  TC_TEXT,
  COVER_LETTER_TEXT,
  PROJECT_ASSUMPTIONS_TEXT,
  PROJECT_ALLOWANCES_TEXT
} from "../src/modules/estimate-export/pdf/tc-text.const";

// CompanyProfile + CompanyLegalDocument seed.
//
// **Insert-if-absent, never overwrite.** Once seeded, a manual admin edit
// must survive `pnpm seed` re-runs (CP-08 discipline / S3-016 pattern) —
// the profile row is the single source of truth for the deployment. If the
// row already exists we skip entirely; if it doesn't we bootstrap from
// Initial Services' real values so behaviour on a fresh DB is
// byte-identical to the previous hardcoded surfaces.
//
// Legal documents (T&Cs, cover letter, assumptions, allowances) are
// seeded as **version 1**, verbatim, with an early effectiveFrom. The
// text is imported unchanged from tc-text.const.ts — legal wording is
// not paraphrased or reformatted. Later edits create a new version; the
// v1 row is never mutated.
export async function seedCompanyProfile(prisma: PrismaClient) {
  const existing = await prisma.companyProfile.findUnique({ where: { id: "singleton" } });
  if (existing) {
    // Profile already exists — a user may have edited it. Do NOT overwrite.
    // Still ensure the v1 legal documents exist (insert-if-absent) so a
    // partial-seed state can recover.
    await seedLegalDocumentsV1(prisma);
    return existing;
  }

  const profile = await prisma.companyProfile.create({
    data: {
      id: "singleton",
      // Identity — Initial Services' real values, migrated verbatim from
      // quote-html.builder.ts (PDF letterhead) and email defaults.
      legalName: "Initial Services Group Pty Ltd",
      tradingName: "Initial Services",
      abn: "75 631 222 556",
      entityType: "PTY_LTD",

      // Contact
      primaryEmail: "admin@initialservices.net",
      primaryPhone: "(07) 3888 0539",
      website: "https://initialservices.net",
      registeredAddressLine1: "10 Grice St",
      registeredSuburb: "Clontarf",
      registeredState: "QLD",
      registeredPostcode: "4019",
      registeredCountry: "Australia",
      postalAddressLine1: "10 Grice St",
      postalSuburb: "Clontarf",
      postalState: "QLD",
      postalPostcode: "4019",
      postalCountry: "Australia",

      // Commercial defaults — mirror the numbers currently baked into
      // forms (25 days per T&C §17 BIFA; GST 10% AU standard).
      gstRate: 10,
      currency: "AUD",
      financialYearStartMonth: 7,
      timezone: "Australia/Brisbane",
      defaultPaymentTermsDays: 25,
      defaultQuoteValidityDays: 30,
      defaultMarkupPercent: 15,

      // Document numbering — mirrors existing sequence prefixes.
      tenderNumberPrefix: "T",
      quoteNumberPrefix: "Q",
      jobNumberPrefix: "J",
      projectNumberPrefix: "IS-P",
      variationNumberPrefix: "V",
      claimNumberPrefix: "PC",
      incidentNumberPrefix: "INC",

      // Branding — from BRAND constant in tc-text.const.ts.
      primaryColorHex: "#005B61",
      secondaryColorHex: "#FEAA6D"
    }
  });

  await seedLegalDocumentsV1(prisma);
  return profile;
}

// Legal documents are seeded as version 1, effective from 2020-01-01
// (earliest known — Initial Services predates this system). Insert-if-absent
// keyed on the (type, version) unique index. NEVER updated by seed.
async function seedLegalDocumentsV1(prisma: PrismaClient) {
  const effectiveFrom = new Date("2020-01-01T00:00:00Z");

  const documents: Array<{
    id: string;
    type:
      | "TERMS_AND_CONDITIONS"
      | "COVER_LETTER"
      | "STANDARD_ASSUMPTIONS"
      | "PROJECT_ALLOWANCES";
    content: string;
  }> = [
    { id: "legal-tc-v1", type: "TERMS_AND_CONDITIONS", content: TC_TEXT },
    { id: "legal-coverletter-v1", type: "COVER_LETTER", content: COVER_LETTER_TEXT },
    { id: "legal-assumptions-v1", type: "STANDARD_ASSUMPTIONS", content: PROJECT_ASSUMPTIONS_TEXT },
    { id: "legal-allowances-v1", type: "PROJECT_ALLOWANCES", content: PROJECT_ALLOWANCES_TEXT }
  ];

  for (const doc of documents) {
    const already = await prisma.companyLegalDocument.findUnique({
      where: { type_version: { type: doc.type, version: 1 } }
    });
    if (already) continue;
    await prisma.companyLegalDocument.create({
      data: {
        id: doc.id,
        profileId: "singleton",
        type: doc.type,
        version: 1,
        content: doc.content,
        effectiveFrom,
        effectiveTo: null,
        isActive: true
      }
    });
  }
}
