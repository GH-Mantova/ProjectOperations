import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// Find-or-create a Site from a chosen address (typically the payload of a
// Geoapify autocomplete pick). We never mint a Site from a partial keystroke —
// the caller must have selected a suggestion — and we always match against
// existing Sites first so a busy suburb doesn't accumulate duplicate rows for
// the same street address.
export interface ResolveSiteInput {
  formatted?: string;
  name?: string;
  addressLine1?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  clientId?: string | null;
}

export interface ResolveSiteResult {
  site: {
    id: string;
    name: string;
    addressLine1: string | null;
    suburb: string | null;
    state: string | null;
    postcode: string | null;
    clientId: string | null;
  };
  created: boolean;
}

@Injectable()
export class SiteResolverService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(input: ResolveSiteInput): Promise<ResolveSiteResult> {
    const addressLine1 = normalisePart(input.addressLine1);
    const suburb = normalisePart(input.suburb);
    const state = normalisePart(input.state);
    const postcode = normalisePart(input.postcode);
    const formatted = normalisePart(input.formatted);
    const explicitName = normalisePart(input.name);

    if (!addressLine1 && !formatted) {
      throw new BadRequestException("At least one of `addressLine1` or `formatted` is required.");
    }

    // Match key: the normalised concatenation of the street address parts.
    // Sites without addressLine1 fall back to the formatted string so old
    // free-text-only rows can still be found before we create a duplicate.
    const matchKey = buildMatchKey({ addressLine1, suburb, state, postcode, formatted });

    const candidates = await this.prisma.site.findMany({
      where: {
        AND: [
          addressLine1
            ? { addressLine1: { equals: addressLine1, mode: "insensitive" as const } }
            : { addressLine1: null }
        ]
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        suburb: true,
        state: true,
        postcode: true,
        clientId: true
      }
    });

    const existing = candidates.find(
      (row) =>
        buildMatchKey({
          addressLine1: row.addressLine1,
          suburb: row.suburb,
          state: row.state,
          postcode: row.postcode,
          formatted: row.name
        }) === matchKey
    );

    if (existing) return { site: existing, created: false };

    const desiredName = explicitName || formatted || addressLine1 || "Untitled site";
    const uniqueName = await this.reserveUniqueName(desiredName);

    const created = await this.prisma.site.create({
      data: {
        name: uniqueName,
        addressLine1: addressLine1 ?? null,
        suburb: suburb ?? null,
        state: state ?? null,
        postcode: postcode ?? null,
        clientId: normalisePart(input.clientId) ?? null
      },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        suburb: true,
        state: true,
        postcode: true,
        clientId: true
      }
    });
    return { site: created, created: true };
  }

  // Site.name is a unique index — when two tenders in different suburbs happen
  // to share a Geoapify "formatted" string (typically the exact same address
  // was manually renamed earlier) we suffix " (n)" until we find a free slot
  // instead of crashing the wizard with a P2002.
  private async reserveUniqueName(desired: string): Promise<string> {
    const base = desired.slice(0, 180);
    let candidate = base;
    for (let attempt = 2; attempt <= 20; attempt += 1) {
      const clash = await this.prisma.site.findFirst({ where: { name: candidate }, select: { id: true } });
      if (!clash) return candidate;
      candidate = `${base} (${attempt})`;
    }
    return `${base} (${Date.now().toString(36)})`;
  }
}

function normalisePart(value: string | null | undefined): string | undefined {
  if (value == null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function buildMatchKey(parts: {
  addressLine1?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  formatted?: string | null;
}): string {
  const raw = [parts.addressLine1, parts.suburb, parts.state, parts.postcode]
    .map((p) => (p ?? "").toString().trim().toLowerCase())
    .filter(Boolean)
    .join("|");
  if (raw) return raw;
  return (parts.formatted ?? "").toString().trim().toLowerCase();
}
