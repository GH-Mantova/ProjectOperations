/**
 * Pure logic for the New Tender wizard. Keeps step navigation, document-bucket
 * derivation, and incomplete-builder detection out of the React component so
 * they can be exercised in isolation by vitest logic specs (no jsdom needed).
 */

export const WIZARD_STEP_KEYS = [
  "project",
  "builders",
  "packages",
  "documents",
  "rates",
  "ai",
  "review"
] as const;

export type WizardStepKey = (typeof WIZARD_STEP_KEYS)[number];

export const WIZARD_STEP_LABELS: Record<WizardStepKey, string> = {
  project: "Project",
  builders: "Builders",
  packages: "Packages",
  documents: "Documents",
  rates: "Rates",
  ai: "AI scope",
  review: "Review"
};

/**
 * Explicit wizard flow state — not derived from list positions or IDs. Prior
 * PRs have been burned by deriving edit/step state from `selectedId === latest.id`
 * or similar heuristics; the wizard names every boolean explicitly.
 */
export type WizardFlowState = {
  currentStep: WizardStepKey;
  skipped: Record<WizardStepKey, boolean>;
  visited: Record<WizardStepKey, boolean>;
  draftId: string | null;
  ratesLocked: boolean;
};

export function initialFlowState(): WizardFlowState {
  const emptyFlags = () =>
    WIZARD_STEP_KEYS.reduce(
      (acc, key) => {
        acc[key] = false;
        return acc;
      },
      {} as Record<WizardStepKey, boolean>
    );
  return {
    currentStep: "project",
    skipped: emptyFlags(),
    visited: { ...emptyFlags(), project: true },
    draftId: null,
    ratesLocked: false
  };
}

export function stepIndex(step: WizardStepKey): number {
  return WIZARD_STEP_KEYS.indexOf(step);
}

export function nextStep(step: WizardStepKey): WizardStepKey | null {
  const i = stepIndex(step);
  return i >= 0 && i < WIZARD_STEP_KEYS.length - 1 ? WIZARD_STEP_KEYS[i + 1] : null;
}

export function prevStep(step: WizardStepKey): WizardStepKey | null {
  const i = stepIndex(step);
  return i > 0 ? WIZARD_STEP_KEYS[i - 1] : null;
}

/**
 * Mark the current step as skipped and advance. Returns unchanged state at the
 * terminal step so the caller can decide what "skip" means on Review.
 */
export function skipCurrentStep(state: WizardFlowState): WizardFlowState {
  const next = nextStep(state.currentStep);
  if (!next) return state;
  return {
    ...state,
    skipped: { ...state.skipped, [state.currentStep]: true },
    visited: { ...state.visited, [next]: true },
    currentStep: next
  };
}

export function advanceStep(state: WizardFlowState): WizardFlowState {
  const next = nextStep(state.currentStep);
  if (!next) return state;
  return {
    ...state,
    skipped: { ...state.skipped, [state.currentStep]: false },
    visited: { ...state.visited, [next]: true },
    currentStep: next
  };
}

export function goBack(state: WizardFlowState): WizardFlowState {
  const prev = prevStep(state.currentStep);
  if (!prev) return state;
  return { ...state, currentStep: prev };
}

/**
 * Jump to any step from the rail. Allowed only for visited steps to prevent
 * skipping into a step whose data has not been fetched.
 */
export function jumpToStep(state: WizardFlowState, target: WizardStepKey): WizardFlowState {
  if (!state.visited[target]) return state;
  return { ...state, currentStep: target };
}

// ---------------------------------------------------------------------------
// Document buckets — derived from the pr-482 matrix. The API exposes
// GET /tenders/:id/document-buckets which returns the union already deduped;
// the helper below mirrors that shape so we can compose the panel client-side
// during the wizard (before the tender exists on the first step) and match
// server output during tests.
// ---------------------------------------------------------------------------

export type MatrixCell = {
  tenderClientId: string;
  tenderPackageId: string;
};

export type PackageRef = {
  id: string;
  disciplineItemId: string;
  value: string;
  label: string;
  sortOrder?: number;
};

export type DocumentBucket = {
  packageId: string;
  disciplineItemId: string;
  value: string;
  label: string;
  sortOrder: number;
};

/**
 * Given the selected matrix cells and the catalogue of packages, return the
 * deduplicated, sorted bucket list. Matches the server helper so tests can
 * pin the client-side selection UI against the same expected output.
 */
export function deriveDocumentBuckets(
  cells: ReadonlyArray<MatrixCell>,
  packages: ReadonlyArray<PackageRef>
): DocumentBucket[] {
  const selected = new Set(cells.map((c) => c.tenderPackageId));
  const seen = new Set<string>();
  const buckets: DocumentBucket[] = [];
  for (const pkg of packages) {
    if (!selected.has(pkg.id)) continue;
    if (seen.has(pkg.disciplineItemId)) continue;
    seen.add(pkg.disciplineItemId);
    buckets.push({
      packageId: pkg.id,
      disciplineItemId: pkg.disciplineItemId,
      value: pkg.value,
      label: pkg.label,
      sortOrder: pkg.sortOrder ?? 0
    });
  }
  buckets.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  return buckets;
}

// ---------------------------------------------------------------------------
// Incomplete-builder detection — the wizard fires an in-app notification to
// the creator when a builder is saved without a nominated contact or without
// a submission date, so they can chase it up later.
// ---------------------------------------------------------------------------

export type BuilderDraft = {
  clientId: string;
  clientName: string;
  contactId: string | null;
  submissionDate: string | null;
};

export type IncompleteBuilderReminder = {
  clientId: string;
  clientName: string;
  reasons: Array<"missing_contact" | "missing_submission_date">;
};

export function detectIncompleteBuilders(
  builders: ReadonlyArray<BuilderDraft>
): IncompleteBuilderReminder[] {
  const reminders: IncompleteBuilderReminder[] = [];
  for (const b of builders) {
    const reasons: IncompleteBuilderReminder["reasons"] = [];
    if (!b.contactId) reasons.push("missing_contact");
    if (!b.submissionDate) reasons.push("missing_submission_date");
    if (reasons.length > 0) {
      reminders.push({ clientId: b.clientId, clientName: b.clientName, reasons });
    }
  }
  return reminders;
}

export function formatReminderBody(reminder: IncompleteBuilderReminder): string {
  const parts: string[] = [];
  if (reminder.reasons.includes("missing_contact")) parts.push("no contact selected");
  if (reminder.reasons.includes("missing_submission_date")) parts.push("no submission date set");
  return `${reminder.clientName}: ${parts.join(", ")}. Follow up before submission.`;
}

// ---------------------------------------------------------------------------
// Builder link/unlink request shapes. Kept as pure helpers so the wizard can
// be tested without jsdom AND so the request payload is provably free of the
// `submissionDate` field that the destructive PATCH /tenders/:id path rejects
// under `forbidNonWhitelisted: true` (see TenderClientInputDto).
// ---------------------------------------------------------------------------

export type BuilderRequest = {
  path: string;
  method: "POST" | "DELETE";
  body?: { clientId: string; relationshipType: "PRIMARY" | "COMPETITOR" };
};

export function buildAddBuilderRequest(clientId: string, isFirst: boolean): BuilderRequest {
  return {
    path: "clients",
    method: "POST",
    body: {
      clientId,
      relationshipType: isFirst ? "PRIMARY" : "COMPETITOR"
    }
  };
}

export function buildRemoveBuilderRequest(clientId: string): BuilderRequest {
  return {
    path: `clients/${encodeURIComponent(clientId)}`,
    method: "DELETE"
  };
}

// ---------------------------------------------------------------------------
// Close-guard helpers. Users report "accidentally cancelling (Escape) loses my
// work" — the draft is actually server-side once created, but closing without
// warning is disorienting. These pure helpers back the confirm/discard/flush
// wiring in NewTenderWizard so the component can be tested via the existing
// helper-only pattern (no jsdom).
// ---------------------------------------------------------------------------

/**
 * True when Escape / overlay-click / X must NOT close instantly — i.e., the
 * wizard has state worth preserving (a persisted draft or at least one
 * upload). Blank wizards close immediately.
 */
export function shouldConfirmClose(input: {
  draftId: string | null;
  documentsCount: number;
}): boolean {
  return !!input.draftId || input.documentsCount > 0;
}

/**
 * Build the PATCH body for flushing the Project step's local field state to
 * the draft. Returns `null` when there's nothing to flush — either no draft
 * exists yet (nothing to patch) or the title is empty (would fail the API's
 * UpsertTenderDto `title` guard, which the component avoids by refusing to
 * advance past the Project step until a title is entered).
 */
export function buildProjectStepFlushPayload(input: {
  draftId: string | null;
  title: string;
  estimatorUserId: string;
  siteAddress: string;
  siteId?: string | null;
}): Record<string, unknown> | null {
  if (!input.draftId) return null;
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) return null;
  const patch: Record<string, unknown> = { title: trimmedTitle };
  if (input.estimatorUserId) patch.estimatorUserId = input.estimatorUserId;
  const site = input.siteAddress.trim();
  if (site) patch.description = `Site: ${site}`;
  if (input.siteId) patch.siteId = input.siteId;
  return patch;
}

export type DiscardDraftRequest = { path: string; method: "DELETE" };

/**
 * The Discard-draft action targets the tenders module's existing hard-delete
 * endpoint (DELETE /tenders/:id — writes audit BEFORE the cascade). Encoded
 * as a pure helper so the request shape is pinned by test rather than
 * scattered through the component.
 */
export function buildDiscardDraftRequest(draftId: string): DiscardDraftRequest {
  return {
    path: `tenders/${encodeURIComponent(draftId)}`,
    method: "DELETE"
  };
}
