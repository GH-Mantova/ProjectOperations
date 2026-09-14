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
  const defaultScheme = await seedDefaultBrandColorScheme(prisma);

  const existing = await prisma.companyProfile.findUnique({ where: { id: "singleton" } });
  if (existing) {
    // Profile already exists — a user may have edited it. Do NOT overwrite.
    // Still ensure the v1 legal documents exist (insert-if-absent) so a
    // partial-seed state can recover. Also wire activeColorSchemeId to the
    // default palette if it hasn't been set — a NULL FK on an existing
    // profile means the branding-manager migration hit before this seed.
    if (existing.activeColorSchemeId === null) {
      await prisma.companyProfile.update({
        where: { id: "singleton" },
        data: { activeColorSchemeId: defaultScheme.id }
      });
    }
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

      // Branding — from BRAND constant in tc-text.const.ts. Legacy string
      // fallbacks are kept in lock-step with the default BrandColorScheme
      // seeded above so both readers see the same palette.
      primaryColorHex: "#005B61",
      secondaryColorHex: "#FEAA6D",
      activeColorSchemeId: defaultScheme.id
    }
  });

  await seedLegalDocumentsV1(prisma);
  return profile;
}

// The "Default" brand palette. Idempotent upsert (never deleteMany-then-create)
// so a manual admin edit of the palette survives a `pnpm seed` re-run — same
// CP-08 discipline the profile row itself uses.
async function seedDefaultBrandColorScheme(prisma: PrismaClient) {
  const scheme = await prisma.brandColorScheme.upsert({
    where: { name: "Default" },
    update: {},
    create: {
      id: "brand-scheme-default",
      name: "Default",
      primaryColorHex: "#005B61",
      secondaryColorHex: "#FEAA6D"
    }
  });
  // S4: seed the two named candidate presets (Harbour, Graphite) alongside
  // Default. Same upsert-by-name shape → idempotent. `update: {}` means a
  // company that edits Harbour keeps their edits across re-seeds; the seed
  // is the source of truth for the first write only.
  for (const preset of [HARBOUR_PRESET, GRAPHITE_PRESET]) {
    await prisma.brandColorScheme.upsert({
      where: { name: preset.name },
      update: {},
      create: preset
    });
  }
  return scheme;
}

// S4 named presets — every field is populated so a preset is a preset, not a
// half-preset that inherits from tokens.css for whatever it omits. Values are
// lifted from Marco's approved `theme-system-mockup.html`; the muted sidebar
// colour and neutral status colours are flattened from rgba() to solid hex
// because the schema stores hex only. Never used as the active scheme by seed
// — the null-check at seedCompanyProfile:33 protects live activeColorSchemeId.
export const HARBOUR_PRESET = {
  id: "brand-scheme-harbour",
  name: "Harbour",
  primaryColorHex: "#2F5FD0",
  secondaryColorHex: "#16B1C9",
  sidebarBgHex: "#1E2A4A",
  sidebarTextHex: "#8B96AC",
  sidebarTextActiveHex: "#FFFFFF",
  surfacePageHex: "#F5F7FB",
  surfaceCardHex: "#FFFFFF",
  textPrimaryHex: "#131A2B",
  textSecondaryHex: "#6B7793",
  textMutedHex: "#9BA3BA",
  statusActiveHex: "#12876F",
  statusWarningHex: "#9A5A13",
  statusDangerHex: "#C33B34",
  statusInfoHex: "#2F5FD0",
  statusNeutralHex: "#5F6B85"
} as const;

export const GRAPHITE_PRESET = {
  id: "brand-scheme-graphite",
  name: "Graphite",
  primaryColorHex: "#2F3237",
  secondaryColorHex: "#E8A33D",
  sidebarBgHex: "#17191C",
  sidebarTextHex: "#848487",
  sidebarTextActiveHex: "#F2F2EF",
  surfacePageHex: "#EEEEEA",
  surfaceCardHex: "#FFFFFF",
  textPrimaryHex: "#101114",
  textSecondaryHex: "#6B6F76",
  textMutedHex: "#9C9FA5",
  statusActiveHex: "#2F6B33",
  statusWarningHex: "#7A5310",
  statusDangerHex: "#9C2B20",
  statusInfoHex: "#2C5AA0",
  statusNeutralHex: "#5B5F63"
} as const;

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
