import { TC_TEXT } from "../estimate-export/pdf/tc-text.const";

export type TcClause = { number: string; heading: string; body: string };

/**
 * Parse an arbitrary T&C text string into an ordered array of
 * { number, heading, body }. Clause 17A is a real clause so numbers are
 * strings, not integers. Blank lines inside a clause are preserved in the
 * body as "\n\n" so the textarea round-trips cleanly.
 *
 * Returns an empty array when no `N. HEADING` lines are found — callers must
 * treat an empty result as "fall back to live terms".
 */
export function parseClauses(text: string): TcClause[] {
  const lines = text.split(/\r?\n/);
  const headingRe = /^(\d+A?)\.\s+(.+)$/;
  const clauses: TcClause[] = [];
  let current: TcClause | null = null;
  const flushBody = (bodyLines: string[]): string => bodyLines.join("\n").trim();
  let body: string[] = [];
  for (const line of lines) {
    const match = headingRe.exec(line);
    if (match) {
      if (current) {
        current.body = flushBody(body);
        clauses.push(current);
      }
      current = { number: match[1], heading: match[2].trim(), body: "" };
      body = [];
    } else if (current) {
      body.push(line);
    }
  }
  if (current) {
    current.body = flushBody(body);
    clauses.push(current);
  }
  return clauses;
}

/**
 * Parse the monolithic TC_TEXT string (defined for the quote-PDF renderer)
 * into an ordered array of { number, heading, body }. This is a one-line
 * wrapper over parseClauses(TC_TEXT) — kept so callers are unaffected.
 */
export function parseDefaultClauses(): TcClause[] {
  return parseClauses(TC_TEXT);
}

export function clauseByNumber(clauses: TcClause[], number: string): TcClause | undefined {
  return clauses.find((c) => c.number === number);
}
