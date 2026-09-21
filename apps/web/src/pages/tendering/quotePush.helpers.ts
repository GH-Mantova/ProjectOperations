// quotePush.helpers.ts -- QUOTE_PUSH_PANEL_V1 (scopecards-s4b)
//
// Pure helpers for the push panel, diff modal, Cost Summary grouping,
// and source chips. No DOM, no fetch. All figures come from the server.

// ── Types mirrored from the server (web-side, no import of NestJS types) ──

export type CostLineWithGroup = {
  id: string;
  label: string;
  description: string;
  displayDescription: string | null;
  price: string;
  baseValue: string;
  overrideAmount: string | null;
  sortOrder: number;
  isVisible: boolean;
  groupId: string | null;
  sourceEstimateLineType: string | null;
  sourceEstimateLineId: string | null;
  // Optional fields added by S4b
  pushedAt?: string | null;
};

export type CostGroup = {
  id: string;
  code: string;
  label: string;
  name: string;
  printMode: string; // "ITEMISED" | "ONE_LINE"
  sortOrder: number;
};

export type LineAppropriation = {
  lineId: string;
  baseValue: number;
  overrideAmount: number | null;
  displayedAmount: number;
};

export type SummaryResult = {
  baseTotalCostLines: number;
  adjustmentAmount: number;
  adjustedTotal: number;
  provisionalTotal: number;
  costOptionsTotal: number;
  clientFacingTotal: number;
  lineAppropriations: LineAppropriation[];
  pricedOnEstimate?: number;
};

export type PushableLine = {
  type: string;
  id: string;
  code: string;
  description: string;
  cardId: string;
  cardCode: string;
  discipline: string;
  quoteDestination: "PRICE" | "PROVISIONAL" | "OPTION" | "INTERNAL";
  price: number;
  priceable: boolean;
  priceReason: string | null;
};

export type PushChange =
  | { action: "create"; type: string; id: string; description: string; destination: string; price: number }
  | { action: "update"; type: string; id: string; description: string; destination: string; price: number; prevPrice: number; keptDisplayDescription: boolean; keptOverrideAmount: boolean }
  | { action: "move"; type: string; id: string; description: string; fromDestination: string; destination: string; price: number }
  | { action: "withdraw"; type: string; id: string; description: string; prevDestination: string; prevPrice: number }
  | { action: "unchanged"; type: string; id: string; description: string; destination: string; price: number };

export type PushPlan = {
  counts: { create: number; update: number; move: number; withdraw: number; unchanged: number };
  groups: Array<{ code: string; label: string; name: string; prevTotal: number | null; nextTotal: number }>;
  changes: PushChange[];
  fingerprint: string;
  estimateChangedSincePush: boolean;
  quoteStatus: string;
};

// ── groupCostLines ─────────────────────────────────────────────────────────

export type GroupedSection = {
  group: CostGroup | null;
  lines: CostLineWithGroup[];
};

/**
 * groupCostLines(lines, groups) -- ordered [{ group | null, lines[] }]
 * Groups in sortOrder, each with its lines in sortOrder.
 * Ungrouped lines (no groupId, or groupId pointing to no known group)
 * appear last under group: null.
 */
export function groupCostLines(
  lines: CostLineWithGroup[],
  groups: CostGroup[]
): GroupedSection[] {
  const sorted = [...groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const knownGroupIds = new Set(groups.map((g) => g.id));

  const result: GroupedSection[] = sorted.map((g) => ({
    group: g,
    lines: lines
      .filter((l) => l.groupId === g.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }));

  // Ungrouped = no groupId (typed on this quote) OR groupId points to no known group
  const ungrouped = lines
    .filter((l) => !l.groupId || !knownGroupIds.has(l.groupId))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  result.push({ group: null, lines: ungrouped });

  return result;
}

// ── groupFigures ───────────────────────────────────────────────────────────

export type GroupFigures = {
  subtotal: number;
  tickedCount: number;
  lineCount: number;
};

/**
 * groupFigures(group, lines, appropriations)
 * Sums displayedAmount of visible lines only. Never recomputes price.
 */
export function groupFigures(
  _group: CostGroup | null,
  lines: CostLineWithGroup[],
  appropriations: LineAppropriation[]
): GroupFigures {
  const visibleLines = lines.filter((l) => l.isVisible);
  let subtotal = 0;
  for (const l of visibleLines) {
    const approp = appropriations.find((a) => a.lineId === l.id);
    subtotal += approp ? approp.displayedAmount : Number(l.price);
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tickedCount: visibleLines.length,
    lineCount: lines.length
  };
}

// ── pushCounts ─────────────────────────────────────────────────────────────

export type PushCounts = {
  price: { lines: number; amount: number; ticked: number };
  provisional: { lines: number; amount: number };
  option: { lines: number; amount: number };
  internal: { lines: number; amount: number };
};

/**
 * pushCounts(pushableLines, costLines)
 * Four-count strip from the server's pushable lines.
 * ticked = pushed PRICE rows whose quote row is isVisible.
 */
export function pushCounts(
  pushableLines: PushableLine[],
  costLines: CostLineWithGroup[]
): PushCounts {
  // Index pushed cost lines by their source pointer.
  const pushedCostLineMap = new Map(
    costLines
      .filter((l) => l.sourceEstimateLineType && l.sourceEstimateLineId)
      .map((l) => [`${l.sourceEstimateLineType}:${l.sourceEstimateLineId}`, l])
  );

  const price = pushableLines.filter((l) => l.quoteDestination === "PRICE");
  const provisional = pushableLines.filter((l) => l.quoteDestination === "PROVISIONAL");
  const option = pushableLines.filter((l) => l.quoteDestination === "OPTION");
  const internal = pushableLines.filter((l) => l.quoteDestination === "INTERNAL");

  const priceTicked = price.filter((l) => {
    const cl = pushedCostLineMap.get(`${l.type}:${l.id}`);
    return cl ? cl.isVisible : false;
  });

  return {
    price: {
      lines: price.length,
      amount: Math.round(price.reduce((s, l) => s + l.price, 0) * 100) / 100,
      ticked: priceTicked.length
    },
    provisional: {
      lines: provisional.length,
      amount: Math.round(provisional.reduce((s, l) => s + l.price, 0) * 100) / 100
    },
    option: {
      lines: option.length,
      amount: Math.round(option.reduce((s, l) => s + l.price, 0) * 100) / 100
    },
    internal: {
      lines: internal.length,
      amount: Math.round(internal.reduce((s, l) => s + l.price, 0) * 100) / 100
    }
  };
}

// ── quoteLineFigures ───────────────────────────────────────────────────────

export type QuoteLineFigures = {
  inThisQuote: number;
  pricedOnEstimate: number;
  unticked: number;
};

/**
 * quoteLineFigures(summary)
 * { inThisQuote: clientFacingTotal, pricedOnEstimate, unticked: pricedOnEstimate - baseTotalCostLines }
 */
export function quoteLineFigures(summary: SummaryResult): QuoteLineFigures {
  const inThisQuote = summary.clientFacingTotal;
  const pricedOnEstimate = summary.pricedOnEstimate ?? 0;
  const unticked = Math.round((pricedOnEstimate - summary.baseTotalCostLines) * 100) / 100;
  return { inThisQuote, pricedOnEstimate, unticked: Math.max(0, unticked) };
}

// ── pushPanelState ─────────────────────────────────────────────────────────

export type PushPanelState =
  | { state: "never-pushed"; sentence: string }
  | { state: "up-to-date"; sentence: string }
  | { state: "changed"; sentence: string }
  | { state: "frozen"; sentence: string };

type QuoteForPanelState = {
  status: string;
  pushedAt: string | null | undefined;
  pushedBy?: { firstName?: string; lastName?: string; name?: string } | null;
  sentAt: string | null | undefined;
  ratesLockedAt?: string | null;
};

function fmtDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function fmtPushDateTime(iso: string): string {
  // "11 Sep 2026, 09:12"
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const timePart = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${datePart}, ${timePart}`;
  } catch {
    return iso;
  }
}

function actorInitials(pushedBy: QuoteForPanelState["pushedBy"]): string {
  if (!pushedBy) return "";
  if (pushedBy.name) return pushedBy.name;
  const first = pushedBy.firstName ?? "";
  const last = pushedBy.lastName ?? "";
  if (first && last) return `${first[0]}. ${last}`;
  return last || first || "";
}

/**
 * pushPanelState(quote, plan)
 * Returns one of four states plus the panel's status sentence.
 */
export function pushPanelState(
  quote: QuoteForPanelState,
  plan: PushPlan | null
): PushPanelState {
  // frozen when quote.status !== "DRAFT"
  if (quote.status !== "DRAFT") {
    const sentDate = quote.sentAt ? fmtDateShort(quote.sentAt) : "unknown date";
    return {
      state: "frozen",
      sentence: `This quote was sent on ${sentDate} and cannot be changed by a push. Create a new revision and push into that.`
    };
  }

  // Never pushed
  if (!quote.pushedAt) {
    return {
      state: "never-pushed",
      sentence: "This quote has never been pushed from the estimate."
    };
  }

  // Build the sentence for pushed states
  const pushDateTime = fmtPushDateTime(quote.pushedAt);
  const actor = actorInitials(quote.pushedBy);
  const actorPart = actor ? ` by ${actor}` : "";

  const ratesLocked = quote.ratesLockedAt ? fmtDateShort(quote.ratesLockedAt) : null;
  const ratesPart = ratesLocked ? ` · rates locked ${ratesLocked}` : "";

  const changed = plan?.estimateChangedSincePush;

  if (!changed) {
    // up-to-date
    const sentence = `Pushed ${pushDateTime}${actorPart} · the estimate has not changed since${ratesPart}`;
    return { state: "up-to-date", sentence };
  } else {
    // changed -- no time per S4a's call 3 (no time in the "changed" case)
    const sentence = `Pushed ${pushDateTime}${actorPart} · the estimate has changed since${ratesPart}`;
    return { state: "changed", sentence };
  }
}

// ── sourceChip ─────────────────────────────────────────────────────────────

export type SourceChipResult =
  | { kind: "pushed"; text: string }
  | { kind: "typed"; text: string }
  | { kind: "kept"; text: string };

type LineForSourceChip = {
  sourceEstimateLineId: string | null | undefined;
  overrideAmount: string | null | undefined;
  pushedAt?: string | null;
};

/**
 * sourceChip(row) -- returns { kind, text }
 * - pushed: has a pointer and no override
 * - kept: has a pointer AND an override
 * - typed: no pointer (added on this quote)
 */
export function sourceChip(row: LineForSourceChip): SourceChipResult {
  const hasPointer = !!(row.sourceEstimateLineId);
  const hasOverride = row.overrideAmount != null && row.overrideAmount !== "";

  if (!hasPointer) {
    return { kind: "typed", text: "added on this quote · no estimate line" };
  }

  if (hasOverride) {
    // kept at override
    const overrideAmt = fmtCurrencyHelper(Number(row.overrideAmount));
    return { kind: "kept", text: `quote ${overrideAmt} ≠ estimate (override)` };
  }

  // pushed
  const pushTime = row.pushedAt ? fmtPushTimeShort(row.pushedAt) : null;
  const text = pushTime ? `pushed ${pushTime}` : "pushed from estimate";
  return { kind: "pushed", text };
}

function fmtPushTimeShort(iso: string): string {
  // "11 Sep 09:12"
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleDateString("en-AU", { month: "short" });
    const time = d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} ${month} ${time}`;
  } catch {
    return iso;
  }
}

function fmtCurrencyHelper(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

// ── nextOptionLabel ─────────────────────────────────────────────────────────

const OPTION_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/**
 * nextOptionLabel(options) -- first unused letter A... among existing labels.
 * Replaces the numeric nextLabel at :1273 in ClientQuotesPanel.
 */
export function nextOptionLabel(existingLabels: string[]): string {
  const used = new Set(existingLabels);
  return OPTION_LETTERS.find((l) => !used.has(l)) ?? "?";
}
