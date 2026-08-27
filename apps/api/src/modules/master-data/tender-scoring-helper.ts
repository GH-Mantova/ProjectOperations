/**
 * Shared decision helper for tender client-stat scoring.
 *
 * Every path that writes a won tender status directly (outside
 * TenderingService.updateStatus) must call this helper so that
 * ClientStatsService.recordTenderOutcome fires on the first win and on the
 * win-flip (submitted/lost -> won) — exactly once each, regardless of which
 * status write triggered it.
 *
 * The RULE lives here. Import it from every status-write path so a future
 * eighth call-site cannot silently miss the increment.
 *
 * IMPORTANT: callers must own the actual ClientStatsService.recordTenderOutcome
 * call and the tenderScoreCounted / tenderWinCounted flag write. This helper
 * only encodes the decision; it does NOT perform I/O.
 *
 * @param tenderScoreCounted - current value of the tender's tenderScoreCounted flag
 * @param tenderWinCounted   - current value of the tender's tenderWinCounted flag
 * @param newStatus          - the status the tender was just moved to
 * @returns an action descriptor. If action === "none" the caller must not call
 *          recordTenderOutcome; otherwise it must call it with the given mode
 *          and isWin, then persist the flag update.
 */
export function decideTenderScoring(
  tenderScoreCounted: boolean,
  tenderWinCounted: boolean | null,
  newStatus: string
): { action: "first-count" | "win-flip" | "none"; isWin: boolean } {
  const isWon =
    newStatus === "AWARDED" || newStatus === "CONTRACT_ISSUED" || newStatus === "CONVERTED";
  const isScorable = isWon || newStatus === "SUBMITTED" || newStatus === "LOST";

  if (isScorable && !tenderScoreCounted) {
    // Tender has never been scored. Count it now (win or not).
    return { action: "first-count", isWin: isWon };
  }

  if (isWon && tenderScoreCounted && tenderWinCounted !== true) {
    // Tender was previously submitted/lost; now being won. Bump winCount
    // without double-counting tenderCount. tenderWinCounted guards against
    // re-firing when status advances AWARDED -> CONTRACT_ISSUED -> CONVERTED.
    return { action: "win-flip", isWin: true };
  }

  return { action: "none", isWin: false };
}
