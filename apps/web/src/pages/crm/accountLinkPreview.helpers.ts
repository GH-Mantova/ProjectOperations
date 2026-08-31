// CRM-S4: Pure helpers for the AccountLinkPreview screen.
// Extracted here so the test suite can exercise boundary cases without jsdom.

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProposalLifecycle = "ACTIVE" | "PROSPECT" | "PAST";

export type ClientLinkPreviewRow = {
  clientId: string;
  name: string;
  tenderCount: number;
  wonCount: number;
  lastTenderAt: string | null; // ISO string from JSON
  existingAccountId: string | null;
};

/** A row as it appears in the UI — adds proposed and overridden lifecycle. */
export type PreviewRow = ClientLinkPreviewRow & {
  proposed: ProposalLifecycle;
  /** When non-null the user has overridden the auto-proposal for this row. */
  override: ProposalLifecycle | null;
};

// ── proposeLifecycle ──────────────────────────────────────────────────────────

/**
 * Derives the proposed Account lifecycle for a client row.
 *
 * Rules (stated on the screen):
 *   - won a tender (wonCount > 0)                          → Active
 *   - tendered but never won, OR never tendered            → Prospect
 *   - last tender was more than 24 months ago              → Past
 *
 * The 24-month check takes precedence over the won/never-won rule: a client
 * who won in the past but has not tendered in 24 months is Past, not Active.
 *
 * @param row  - The raw row from the API.
 * @param now  - Injectable clock (ms since epoch). Defaults to Date.now().
 */
export function proposeLifecycle(
  row: Pick<ClientLinkPreviewRow, "tenderCount" | "wonCount" | "lastTenderAt">,
  now: number = Date.now()
): ProposalLifecycle {
  if (row.lastTenderAt !== null) {
    const lastMs = new Date(row.lastTenderAt).getTime();
    const diffMs = now - lastMs;
    const months = diffMs / (1000 * 60 * 60 * 24 * 30.44); // mean month
    if (months > 24) return "PAST";
  }
  if (row.wonCount > 0) return "ACTIVE";
  return "PROSPECT";
}

// ── buildPreviewRows ──────────────────────────────────────────────────────────

/**
 * Converts the raw API rows into UI rows by attaching the proposed lifecycle.
 * All overrides start as null (no user change yet).
 */
export function buildPreviewRows(
  apiRows: ClientLinkPreviewRow[],
  now: number = Date.now()
): PreviewRow[] {
  return apiRows.map((row) => ({
    ...row,
    proposed: proposeLifecycle(row, now),
    override: null
  }));
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
 *  - "skip"   → already linked and lifecycle matches; nothing to do.
 *  - "patch"  → already linked but lifecycle needs updating.
 *  - "create" → no account yet; create one.
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
