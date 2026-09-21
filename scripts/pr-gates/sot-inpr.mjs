// sot-inpr freshness logic for CP-27. Pure module: no I/O, no imports beyond
// Node built-ins, ASCII-only strings.
//
// Context: sot/02-roadmap-and-status.md carries a hand-maintained "In-PR"
// section (## 2.) that lists every open PR at the time the doc was last
// refreshed. In practice this snapshot rots within days: PRs merge or close
// while the table rows stay. CP-27 blocks a merge whenever the table contains
// non-OPEN rows or the header count disagrees with the table.
//
// Two exported functions and nothing else:
//   parseInPrSection(markdown)           -> { declaredCount, prNumbers }
//   decideInPrFreshness({ declaredCount, prNumbers, states })
//                                        -> { verdict: "PASS"|"FAIL", detail }
//
// parseInPrSection:
//   - Finds the heading matching /^##\s+2\.\s.*In-PR/m.
//   - Reads until the next ^## heading or EOF.
//   - declaredCount: integer in trailing parentheses of that heading, or null.
//   - prNumbers: #<digits> extracted ONLY from the FIRST non-empty cell of
//     each table row (pipe-delimited). Deduped, insertion order preserved.
//     Prose footnotes below the table are NOT scanned.
//
// decideInPrFreshness:
//   - states is a Map<number, string> of PR -> "OPEN"|"MERGED"|"CLOSED".
//   - FAIL if any prNumber has state !== "OPEN".
//   - FAIL if declaredCount !== null && declaredCount !== prNumbers.length.
//   - Both may apply; both are reported.
//   - Otherwise PASS.

/**
 * @param {string} markdown
 * @returns {{ declaredCount: number|null, prNumbers: number[] }}
 */
export function parseInPrSection(markdown) {
  if (typeof markdown !== "string") {
    return { declaredCount: null, prNumbers: [] };
  }

  const lines = markdown.split(/\r?\n/);

  // Find the heading line matching ## 2. ... In-PR
  let headingIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+2\.\s.*In-PR/.test(lines[i])) {
      headingIdx = i;
      break;
    }
  }

  if (headingIdx === -1) {
    return { declaredCount: null, prNumbers: [] };
  }

  // Extract the declared count from trailing parentheses on the heading line.
  // e.g. "## 2. In-PR -- open right now (3)" -> 3
  const headingLine = lines[headingIdx];
  let declaredCount = null;
  const countMatch = headingLine.match(/\((\d+)\)\s*$/);
  if (countMatch) {
    declaredCount = parseInt(countMatch[1], 10);
  }

  // Find end of section: next ^## heading or EOF.
  let endIdx = lines.length;
  for (let i = headingIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  // Collect PR numbers from table rows ONLY (lines starting with |).
  // Extract from FIRST non-empty cell only (after splitting on |).
  const seen = new Set();
  const prNumbers = [];

  for (let i = headingIdx + 1; i < endIdx; i++) {
    const line = lines[i];
    if (!line.startsWith("|")) continue;

    // Split on | and get all cells
    const cells = line.split("|");
    // cells[0] is before the first |, cells[1] is the first cell, etc.
    // Find the first non-empty cell (trim whitespace).
    let firstCell = null;
    for (let j = 1; j < cells.length; j++) {
      const trimmed = cells[j].trim();
      if (trimmed.length > 0) {
        firstCell = trimmed;
        break;
      }
    }

    if (firstCell === null) continue;

    // Extract #<digits> from the first cell only.
    const prMatch = firstCell.match(/#(\d+)/);
    if (!prMatch) continue;

    const num = parseInt(prMatch[1], 10);
    if (!seen.has(num)) {
      seen.add(num);
      prNumbers.push(num);
    }
  }

  return { declaredCount, prNumbers };
}

/**
 * @param {{ declaredCount: number|null, prNumbers: number[], states: Map<number, string> }} input
 * @returns {{ verdict: "PASS"|"FAIL", detail: string }}
 */
export function decideInPrFreshness({ declaredCount, prNumbers, states }) {
  const failReasons = [];

  // Check for any non-OPEN rows.
  const stale = [];
  for (const n of prNumbers) {
    const state = states && states.get(n);
    if (state !== "OPEN") {
      stale.push(`#${n} (${state || "UNKNOWN"})`);
    }
  }
  if (stale.length > 0) {
    failReasons.push(`stale rows: ${stale.join(", ")}`);
  }

  // Check header count vs table row count.
  if (declaredCount !== null && declaredCount !== prNumbers.length) {
    failReasons.push(
      `header count ${declaredCount} disagrees with ${prNumbers.length} table rows`
    );
  }

  if (failReasons.length > 0) {
    return { verdict: "FAIL", detail: failReasons.join("; ") };
  }

  return {
    verdict: "PASS",
    detail: `${prNumbers.length} row(s) all OPEN`,
  };
}
