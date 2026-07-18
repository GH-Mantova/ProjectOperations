import type { PrismaService } from "../../prisma/prisma.service";

/**
 * Shared duplicate-detection helper for the directory / contacts modules.
 *
 * D365-style parity: return a scored list of candidate matches for a
 * proposed new Client / SubcontractorSupplier / Contact. The score is
 * advisory — callers surface it as a soft warning ("possible duplicates")
 * on create screens; the create endpoints themselves never block on it.
 *
 * Scoring is deterministic: field-level matches contribute additive
 * points, capped so the score comfortably fits a percentage-style badge
 * (0–100). A score at or above {@link DUPLICATE_THRESHOLD} is worth
 * showing; below that we drop the candidate.
 */

export const DUPLICATE_THRESHOLD = 50;

/**
 * Normalise an entity/person name for fuzzy comparison: lowercase, drop
 * punctuation, collapse whitespace. Kept intentionally cheap — no
 * Levenshtein or metaphone; the goal is "is this obviously the same
 * organisation typed slightly differently".
 */
export function normalizeName(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(pty|ltd|limited|inc|incorporated|co|the|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Digits-only normalisation for ABN, ACN, phone. ABNs and phones commonly
 * come in with spaces and country codes; comparing on the digit string
 * side-steps formatting mismatches.
 */
export function normalizeDigits(v: string | null | undefined): string {
  if (!v) return "";
  return v.replace(/\D+/g, "");
}

function normEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export type OrganisationScope = "client" | "subcontractor" | "supplier";

export type OrganisationCandidateInput = {
  scope: OrganisationScope;
  name?: string | null;
  tradingName?: string | null;
  legalName?: string | null;
  abn?: string | null;
  acn?: string | null;
  email?: string | null;
  phone?: string | null;
  excludeId?: string | null;
};

export type DuplicateCandidate = {
  id: string;
  kind: OrganisationScope;
  name: string;
  tradingName: string | null;
  abn: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  score: number;
  reasons: string[];
};

/**
 * Score a candidate row against the proposed input. Additive scoring so
 * multiple weak signals (name + email) can promote a candidate over a
 * single strong one. Returns null when nothing matched.
 */
function scoreOrganisation(
  input: OrganisationCandidateInput,
  row: {
    id: string;
    name: string;
    tradingName: string | null;
    legalName?: string | null;
    abn: string | null;
    acn?: string | null;
    email: string | null;
    phone: string | null;
    isActive: boolean;
  },
  kind: OrganisationScope
): DuplicateCandidate | null {
  const reasons: string[] = [];
  let score = 0;

  const inName = normalizeName(input.name);
  const rowNames = [row.name, row.tradingName, row.legalName]
    .map(normalizeName)
    .filter(Boolean);
  if (inName) {
    if (rowNames.includes(inName)) {
      score += 60;
      reasons.push("Name matches exactly");
    } else if (rowNames.some((n) => n.includes(inName) || inName.includes(n))) {
      score += 35;
      reasons.push("Name is similar");
    }
  }

  const inAbn = normalizeDigits(input.abn);
  const rowAbn = normalizeDigits(row.abn);
  if (inAbn && rowAbn && inAbn === rowAbn) {
    score += 60;
    reasons.push("ABN matches");
  }

  const inAcn = normalizeDigits(input.acn);
  const rowAcn = normalizeDigits(row.acn);
  if (inAcn && rowAcn && inAcn === rowAcn) {
    score += 50;
    reasons.push("ACN matches");
  }

  const inEmail = normEmail(input.email);
  const rowEmail = normEmail(row.email);
  if (inEmail && rowEmail && inEmail === rowEmail) {
    score += 45;
    reasons.push("Email matches");
  }

  const inPhone = normalizeDigits(input.phone);
  const rowPhone = normalizeDigits(row.phone);
  if (inPhone && rowPhone && inPhone.length >= 6 && inPhone === rowPhone) {
    score += 35;
    reasons.push("Phone matches");
  }

  if (score < DUPLICATE_THRESHOLD) return null;
  return {
    id: row.id,
    kind,
    name: row.name,
    tradingName: row.tradingName,
    abn: row.abn,
    email: row.email,
    phone: row.phone,
    isActive: row.isActive,
    score: Math.min(100, score),
    reasons
  };
}

/**
 * Find likely duplicates for a proposed Client / SubcontractorSupplier
 * record. Queries a modest candidate set (up to ~50 rows) via targeted
 * `where` filters — name prefix, ABN, ACN, email, phone — and re-scores
 * in memory. Small directories keep this well within budget.
 *
 * Returns candidates sorted by score descending, top 5.
 */
export async function findDuplicates(
  prisma: PrismaService,
  input: OrganisationCandidateInput
): Promise<DuplicateCandidate[]> {
  const inName = normalizeName(input.name);
  const inAbn = normalizeDigits(input.abn);
  const inAcn = normalizeDigits(input.acn);
  const inEmail = normEmail(input.email);
  const inPhone = normalizeDigits(input.phone);

  if (!inName && !inAbn && !inAcn && !inEmail && !inPhone) return [];

  const orFilters: Record<string, unknown>[] = [];
  // Case-insensitive name prefix / contains — cheap on small directories.
  if (inName) {
    const raw = input.name!.trim();
    orFilters.push({ name: { contains: raw, mode: "insensitive" } });
    orFilters.push({ tradingName: { contains: raw, mode: "insensitive" } });
  }
  if (input.abn) orFilters.push({ abn: input.abn });
  if (input.acn) orFilters.push({ acn: input.acn });
  if (inEmail) orFilters.push({ email: { equals: inEmail, mode: "insensitive" } });
  if (input.phone) orFilters.push({ phone: input.phone });

  if (orFilters.length === 0) return [];

  const where: Record<string, unknown> = { OR: orFilters };
  if (input.excludeId) where.NOT = { id: input.excludeId };

  const candidates: DuplicateCandidate[] = [];

  if (input.scope === "client") {
    const rows = await prisma.client.findMany({
      where,
      select: {
        id: true,
        name: true,
        tradingName: true,
        legalName: true,
        abn: true,
        acn: true,
        email: true,
        phone: true,
        isActive: true
      },
      take: 50
    });
    for (const row of rows) {
      const scored = scoreOrganisation(input, row, "client");
      if (scored) candidates.push(scored);
    }
  } else {
    const entityType = input.scope === "supplier" ? { in: ["supplier", "both"] } : { in: ["subcontractor", "both"] };
    const rows = await prisma.subcontractorSupplier.findMany({
      where: { ...where, entityType: entityType as never },
      select: {
        id: true,
        name: true,
        tradingName: true,
        legalName: true,
        abn: true,
        acn: true,
        email: true,
        phone: true,
        isActive: true
      },
      take: 50
    });
    for (const row of rows) {
      const scored = scoreOrganisation(input, row, input.scope);
      if (scored) candidates.push(scored);
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 5);
}

export type ContactCandidateInput = {
  organisationType: string;
  organisationId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  excludeId?: string | null;
};

export type DuplicateContactCandidate = {
  id: string;
  organisationType: string;
  organisationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  score: number;
  reasons: string[];
};

/**
 * Find likely duplicate Contacts, scoped either to a single organisation
 * (when `organisationId` is supplied — the common create-from-parent
 * flow) or across the whole organisation type. Matches on full-name
 * exact/near, email exact, and phone/mobile digit-normalised exact.
 */
export async function findDuplicateContacts(
  prisma: PrismaService,
  input: ContactCandidateInput
): Promise<DuplicateContactCandidate[]> {
  const first = (input.firstName ?? "").trim();
  const last = (input.lastName ?? "").trim();
  const inEmail = normEmail(input.email);
  const inPhone = normalizeDigits(input.phone);
  const inMobile = normalizeDigits(input.mobile);

  if (!first && !last && !inEmail && !inPhone && !inMobile) return [];

  const orFilters: Record<string, unknown>[] = [];
  if (first && last) {
    orFilters.push({
      AND: [
        { firstName: { equals: first, mode: "insensitive" } },
        { lastName: { equals: last, mode: "insensitive" } }
      ]
    });
  } else if (last) {
    orFilters.push({ lastName: { equals: last, mode: "insensitive" } });
  }
  if (inEmail) orFilters.push({ email: { equals: inEmail, mode: "insensitive" } });
  if (input.phone) orFilters.push({ phone: input.phone });
  if (input.mobile) orFilters.push({ mobile: input.mobile });

  if (orFilters.length === 0) return [];

  const where: Record<string, unknown> = {
    organisationType: input.organisationType,
    OR: orFilters
  };
  if (input.organisationId) where.organisationId = input.organisationId;
  if (input.excludeId) where.NOT = { id: input.excludeId };

  const rows = await prisma.contact.findMany({
    where,
    select: {
      id: true,
      organisationType: true,
      organisationId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      mobile: true
    },
    take: 50
  });

  const inFirst = first.toLowerCase();
  const inLast = last.toLowerCase();

  const scored: DuplicateContactCandidate[] = [];
  for (const row of rows) {
    const reasons: string[] = [];
    let score = 0;
    const rowFirst = row.firstName.toLowerCase();
    const rowLast = row.lastName.toLowerCase();
    if (inFirst && inLast && rowFirst === inFirst && rowLast === inLast) {
      score += 70;
      reasons.push("Name matches exactly");
    } else if (inLast && rowLast === inLast) {
      score += 25;
      reasons.push("Surname matches");
    }
    if (inEmail && row.email && normEmail(row.email) === inEmail) {
      score += 50;
      reasons.push("Email matches");
    }
    if (inPhone && row.phone && normalizeDigits(row.phone) === inPhone) {
      score += 30;
      reasons.push("Phone matches");
    }
    if (inMobile && row.mobile && normalizeDigits(row.mobile) === inMobile) {
      score += 30;
      reasons.push("Mobile matches");
    }
    if (score >= DUPLICATE_THRESHOLD) {
      scored.push({
        id: row.id,
        organisationType: row.organisationType,
        organisationId: row.organisationId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        mobile: row.mobile,
        score: Math.min(100, score),
        reasons
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5);
}
