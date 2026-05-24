// §5A.1 PR 10 — derive the contextKey for conversation persistence from
// the current URL + active sub-mode. Tender-scoped sub-modes pull the
// tender id out of the path; global sub-modes return null.
//
// The persona registry knows which sub-modes are tender-scoped, but the
// authoritative source for the id itself is the URL — sub-mode metadata
// doesn't carry route params. Keeping this client-side avoids an extra
// roundtrip on every navigation.

const TENDER_SCOPED_SUB_MODES = new Set([
  "tender-detail",
  "scope",
  "quote"
]);

const TENDER_PATH_PATTERN = /^\/tenders\/([^/?#]+)(?:\/|$|\?)/;

export function isTenderScopedSubMode(subMode: string | null | undefined): boolean {
  if (!subMode) return false;
  return TENDER_SCOPED_SUB_MODES.has(subMode);
}

export function deriveContextKey(
  pathname: string,
  subMode: string | null | undefined
): string | null {
  if (!isTenderScopedSubMode(subMode)) return null;
  const match = TENDER_PATH_PATTERN.exec(pathname);
  if (!match || !match[1]) return null;
  // Reject the obvious non-id path segments — keeps "/tenders/create" and
  // "/tenders/workspace" from being mistaken for tender ids.
  if (match[1] === "create" || match[1] === "workspace" || match[1] === "pipeline") {
    return null;
  }
  return match[1];
}
