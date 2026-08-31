// CRM-S4: Pure helpers for the AccountLinkPreview screen.
// Extracted here so the test suite can exercise boundary cases without jsdom.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposalLifecycle = "ACTIVE" | "PROSPECT" | "PAST";

/**
 * Describes why the proposal was made — tells the UI whether the system has
 * earned the right to recommend a lifecycle with confidence.
 *
 * - "won"              - client won at least one tender recently (< 24 months)
 * - "stale"            - last tender was more than 24 months ago
 * - "tendered-no-win"  - tendered at least once, never won
 * - "no-history"       - no tender activity at all; the proposal is a fallback,
 *                        not a derivation from real signals
 */
export type ProposalBasis = "won" | "stale" | "tendered-no-win" | "no-history";

export type ClientLinkPreviewRow = {
  clientId: string;
  name: string;
  tenderCount: number;
  wonCount: number;
  lastTenderAt: string | null; // ISO string from JSON
  existingAccountId: string | null;
};

/** A row as it appears in the UI — adds proposed lifecycle, basis, and override. */
export type PreviewRow = ClientLinkPreviewRow & {
  proposed: ProposalLifecycle;
  /**
   * The basis explains WHY the lifecycle was proposed. Used by the UI to decide
   * how to present the proposal — a "no-history" row must not show a confident
   * PROSPECT pill; it shows a neutral "No history" indicator instead.
   */
  basis: ProposalBasis;
  /** When non-null the user has overridden the auto-proposal for this row. */
  override: ProposalLifecycle | null;
};

// ── proposeLifecycleWithBasis ─────────────────────────────────────────────────

/**
 * Derives the proposed Account lifecycle AND the basis (the reason for the
 * proposal) for a client row.
 *
 * Rules (in precedence order):
 *   1. lastTenderAt !== null && > 24 months ago  → { lifecycle: PAST,     basis: stale }
 *   2. wonCount > 0                              → { lifecycle: ACTIVE,   basis: won }
 *   3. tenderCount > 0 && wonCount === 0         → { lifecycle: PROSPECT, basis: tendered-no-win }
 *   4. tenderCount === 0 && lastTenderAt === null → { lifecycle: PROSPECT, basis: no-history }
 *
 * The 24-month stale check takes precedence over everything — a client who won
 * in the past but has not tendered in 24 months is Past (stale), not Active.
 *
 * @param row  - The raw row from the API.
 * @param now  - Injectable clock (ms since epoch). Defaults to Date.now().
 */
export function proposeLifecycleWithBasis(
  row: Pick<ClientLinkPreviewRow, "tenderCount" | "wonCount" | "lastTenderAt">,
  now: number = Date.now()
): { lifecycle: ProposalLifecycle; basis: ProposalBasis } {
  if (row.lastTenderAt !== null) {
    const lastMs = new Date(row.lastTenderAt).getTime();
    const diffMs = now - lastMs;
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.44); // mean month
    if (months > 24) return { lifecycle: "PAST", basis: "stale" };
  }
  if (row.wonCount > 0) return { lifecycle: "ACTIVE", basis: "won" };
  if (row.tenderCount > 0 && row.wonCount === 0) {
    return { lifecycle: "PROSPECT", basis: "tendered-no-win" };
  }
  // tenderCount === 0 && wonCount === 0 && lastTenderAt === null
  return { lifecycle: "PROSPECT", basis: "no-history" };
}

// ── proposeLifecycle ──────────────────────────────────────────────────────────

/**
 * Derives the proposed Account lifecycle for a client row.
 *
 * Back-compat wrapper around proposeLifecycleWithBasis. Existing callers that
 * only need the lifecycle continue to work without change.
 *
 * @param row  - The raw row from the API.
 * @param now  - Injectable clock (ms since epoch). Defaults to Date.now().
 */
export function proposeLifecycle(
  row: Pick<ClientLinkPreviewRow, "tenderCount" | "wonCount" | "lastTenderAt">,
  now: number = Date.now()
): ProposalLifecycle {
  return proposeLifecycleWithBasis(row, now).lifecycle;
}

// ── buildPreviewRows ──────────────────────────────────────────────────────────

/**
 * Converts the raw API rows into UI rows by attaching the proposed lifecycle
 * and its basis. All overrides start as null (no user change yet).
 */
export function buildPreviewRows(
  apiRows: ClientLinkPreviewRow[],
  now: number = Date.now()
): PreviewRow[] {
  return apiRows.map((row) => {
    const { lifecycle, basis } = proposeLifecycleWithBasis(row, now);
    return {
      ...row,
      proposed: lifecycle,
      basis,
      override: null
    };
  });
}

// ── resolveLifecycle ──────────────────────────────────────────────────────────

/**
 * Returns the effective lifecycle for a row: override if set, otherwise proposal.
 */
export function resolveLifecycle(row: PreviewRow): ProposalLifecycle {
  return row.override ?? row.proposed;
}

// ── buildCommitPayload ────────────────────────────────────────────────────────

/**
 * Builds the commit payload for a single unlinked row.
 * ONLY creates/updates Account rows — never touches Client, Tender, or Job.
 *
 * For a row with no existing account → POST /crm/accounts body.
 * For a row with an existing account → PATCH /crm/accounts/:id body.
 *
 * Neither payload includes any Client, Tender, or Job field.
 */
export type AccountCreatePayload = {
  clientId: string;
  lifecycleStatus: ProposalLifecycle;
};

export type AccountPatchPayload = {
  accountId: string;
  lifecycleStatus: ProposalLifecycle;
};

export type CommitAction =
  | { kind: "create"; payload: AccountCreatePayload }
  | { kind: "patch"; payload: AccountPatchPayload }
  | { kind: "skip" };

/**
 * Returns the commit action for a row:
 *  - "skip"   → already linked and reviewer did not override; nothing to do.
 *  - "patch"  → already linked and reviewer explicitly moved the lifecycle select.
 *  - "create" → no account yet; create one with the resolved lifecycle.
 *
 * For "no-history" rows specifically:
 *  - Unlinked  → create with PROSPECT (resolveLifecycle falls back to proposed
 *                which is PROSPECT; the create payload is unchanged).
 *  - Linked, override === null → skip (same guard as every other untouched linked
 *                row — the reviewer must take a deliberate action).
 *  - Linked, override set → patch with the chosen lifecycle.
 */
export function buildCommitAction(row: PreviewRow): CommitAction {
  const lifecycle = resolveLifecycle(row);
  if (row.existingAccountId !== null) {
    // Account already exists. Patch it ONLY when the reviewer actually moved
    // the lifecycle select for this row (row.override !== null).
    //
    // An untouched row must skip. resolveLifecycle() falls back to the COMPUTED
    // proposal and PreviewRow does not carry the account's stored lifecycle, so
    // patching an untouched row would overwrite a value a human set by hand
    // with the rule's guess — a bulk write behind a screen that reports these
    // rows as "Already linked (skipped)". Decision 7 requires preview-then-
    // confirm per row, never a one-click bulk write.
    //
    // This applies equally to "no-history" rows: if the reviewer has not set
    // an override, we skip — they must take a deliberate action.
    if (row.override === null) {
      return { kind: "skip" };
    }
    return {
      kind: "patch",
      payload: { accountId: row.existingAccountId, lifecycleStatus: lifecycle }
    };
  }
  return {
    kind: "create",
    payload: { clientId: row.clientId, lifecycleStatus: lifecycle }
  };
}
