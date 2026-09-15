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
  projectName?: string | null;
}): Record<string, unknown> | null {
  if (!input.draftId) return null;
  const trimmedTitle = input.title.trim();
  if (!trimmedTitle) return null;
  const patch: Record<string, unknown> = { title: trimmedTitle };
  if (input.estimatorUserId) patch.estimatorUserId = input.estimatorUserId;
  const site = input.siteAddress.trim();
  if (site) patch.description = `Site: ${site}`;
  if (input.siteId) patch.siteId = input.siteId;
  if (input.projectName != null) patch.projectName = input.projectName.trim() || null;
  return patch;
}

// ---------------------------------------------------------------------------
// TFM-S2: SharePoint folder name sanitiser + preview helper
// Mirrors the backend sanitiseSharePointName / deriveTenderFolderName so the
// wizard can show exactly the folder name the API will create.
// ---------------------------------------------------------------------------

/** Characters Graph API rejects in SharePoint folder/file names. */
const GRAPH_REJECTED_CHARS = /[~"#%&*:<>?/\\{|}]/g;

/**
 * Sanitise a string for use as a SharePoint folder name:
 *   1. Strip Graph-rejected characters.
 *   2. Collapse whitespace runs to a single space.
 *   3. Trim.
 *   4. Cap at 90 characters.
 */
export function sanitiseSharePointName(raw: string): string {
  return raw
    .replace(GRAPH_REJECTED_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

/**
 * Build the folder name preview shown in the wizard.
 * Format: `T{YYMMDD} - {projectName}` (fallback to T-prefix when name is empty).
 *
 * `tNumber` is the tender number in canonical format "T260817-..." — we read
 * the first 7 characters.  `projectName` and `siteName` may be null/undefined.
 */
export function deriveFolderPreview(
  tNumber: string | null | undefined,
  projectName: string | null | undefined,
  siteName: string | null | undefined
): string {
  const tPrefix = tNumber ? tNumber.slice(0, 7) : "T??????";
  const rawProject = (projectName ?? siteName ?? "").trim();
  const sanitised = sanitiseSharePointName(rawProject);
  return sanitised ? `${tPrefix} - ${sanitised}` : tPrefix;
}

// ---------------------------------------------------------------------------
// Draft completeness derivation (DraftPanel S2).
// Pure helper — no DOM, no fetch — so it can be exercised without jsdom.
// ---------------------------------------------------------------------------

/**
 * One entry per WIZARD_STEP_KEYS describing how complete that step is.
 * Steps with state "not-checkable" do not contribute to the ready count.
 */
export type StepCompletionState = "ready" | "partial" | "outstanding" | "not-checkable";

export type StepCompletion = {
  step: WizardStepKey;
  state: StepCompletionState;
  why: string;
  counts?: { done: number; total: number };
};

export type DraftCompleteness = {
  steps: StepCompletion[];
  /** How many of the 5 checkable steps are "ready". */
  readyCount: number;
  /** Always 5 — the two not-checkable steps (ai, review) are excluded. */
  checkableCount: number;
};

/** Minimal tender shape the derivation needs from the server. */
export type TenderForCompleteness = {
  title?: string | null;
  siteId?: string | null;
  estimatorUserId?: string | null;
};

/** Minimal rate-set shape — we only care whether one exists. */
export type RateSetForCompleteness = { id: string } | null;

export function deriveDraftCompleteness(
  tender: TenderForCompleteness,
  builders: ReadonlyArray<BuilderDraft>,
  packages: ReadonlyArray<PackageRef>,
  cells: ReadonlyArray<MatrixCell>,
  documents: ReadonlyArray<{ id: string }>,
  rateSet: RateSetForCompleteness
): DraftCompleteness {
  const steps: StepCompletion[] = [];

  // --- project ---
  const hasTitle = !!(tender.title?.trim());
  const hasSite = !!tender.siteId;
  const hasEstimator = !!tender.estimatorUserId;
  const projectDone = hasTitle && hasSite && hasEstimator;
  const projectMissing: string[] = [];
  if (!hasTitle) projectMissing.push("title");
  if (!hasSite) projectMissing.push("linked site");
  if (!hasEstimator) projectMissing.push("estimator");
  steps.push({
    step: "project",
    state: projectDone ? "ready" : "outstanding",
    why: projectDone
      ? "Title, site and estimator all set."
      : `Missing: ${projectMissing.join(", ")}.`
  });

  // --- builders ---
  const incomplete = detectIncompleteBuilders(builders);
  const buildersState: StepCompletionState =
    builders.length === 0
      ? "outstanding"
      : incomplete.length > 0
        ? "partial"
        : "ready";
  steps.push({
    step: "builders",
    state: buildersState,
    why:
      builders.length === 0
        ? "No builders added yet."
        : incomplete.length > 0
          ? `${incomplete.length} builder${incomplete.length === 1 ? "" : "s"} missing contact or submission date.`
          : `${builders.length} builder${builders.length === 1 ? "" : "s"} complete.`,
    counts: { done: builders.length - incomplete.length, total: builders.length }
  });

  // --- packages ---
  // "at least one package and at least one matrix cell per builder"
  const builderIds = new Set(builders.map((b) => b.clientId));
  // We only have clientId in BuilderDraft; cells carry tenderClientId (the
  // junction row id, not the raw clientId). We cannot cross-check per-builder
  // cell coverage without the serverTenderClients map here, so we use a
  // simpler heuristic: at least one package and at least one cell.
  const packagesDone = packages.length > 0 && cells.length > 0;
  const packagesState: StepCompletionState =
    packages.length === 0 ? "outstanding" : cells.length === 0 ? "partial" : "ready";
  void packagesDone; // quiets unused-var; state is what matters
  void builderIds;
  steps.push({
    step: "packages",
    state: packagesState,
    why:
      packages.length === 0
        ? "No packages selected."
        : cells.length === 0
          ? `${packages.length} package${packages.length === 1 ? "" : "s"} added but no matrix cells ticked.`
          : `${packages.length} package${packages.length === 1 ? "" : "s"}, ${cells.length} matrix cell${cells.length === 1 ? "" : "s"}.`,
    counts: { done: packages.length, total: packages.length }
  });

  // --- documents ---
  // The disciplineItem<->UploadCategoryPicker mapping was NOT found
  // (UploadCategoryPicker uses a static folder structure, not disciplineItemId;
  // documents carry a `category` string path, not a disciplineItemId). The row
  // degrades honestly to a file count as the spec allows.
  const docCount = documents.length;
  const docsState: StepCompletionState =
    docCount === 0 ? "outstanding" : "partial";
  // "partial" even with files present because we cannot verify bucket coverage
  // without the disciplineItem mapping. The prompt spec says "partial when > 0".
  steps.push({
    step: "documents",
    state: docsState,
    why:
      docCount === 0
        ? "No files uploaded yet."
        : `${docCount} file${docCount === 1 ? "" : "s"} uploaded (bucket coverage unverifiable).`,
    counts: { done: docCount, total: docCount }
  });

  // --- rates ---
  const ratesState: StepCompletionState = rateSet ? "ready" : "outstanding";
  steps.push({
    step: "rates",
    state: ratesState,
    why: rateSet ? "Rate snapshot locked." : "No rate snapshot locked yet."
  });

  // --- ai (not checkable) ---
  steps.push({
    step: "ai",
    state: "not-checkable",
    why: "AI scope is a stub -- not yet available."
  });

  // --- review (not checkable) ---
  steps.push({
    step: "review",
    state: "not-checkable",
    why: "Review persists no server state."
  });

  const checkableCount = 5;
  const readyCount = steps.filter(
    (s) => s.state === "ready" && s.step !== "ai" && s.step !== "review"
  ).length;

  return { steps, readyCount, checkableCount };
}

export type DiscardDraftRequest = { path: string; method: "DELETE" };

/**
 * The Discard-draft action targets the tenders module's existing hard-delete
 * endpoint (DELETE /tenders/:id -- writes audit BEFORE the cascade). Encoded
 * as a pure helper so the request shape is pinned by test rather than
 * scattered through the component.
 */
export function buildDiscardDraftRequest(draftId: string): DiscardDraftRequest {
  return {
    path: `tenders/${encodeURIComponent(draftId)}`,
    method: "DELETE"
  };
}

// ---------------------------------------------------------------------------
// DraftPanel S3: carry-over row selection (DRAFTPANEL_S3_V1).
// Pure helper -- no DOM, no fetch -- exercises the same completeness object
// the strip reads, so tests can run without jsdom.
// ---------------------------------------------------------------------------

export type BuilderReminder = IncompleteBuilderReminder;

/** One row that will appear in the DraftCarryOverStrip. */
export type CarryOverRow = { step: WizardStepKey; text: string };

/** Steps that are never carry-over candidates (not checkable in the wizard). */
const NOT_CARRY_OVER_STEPS = new Set<WizardStepKey>(["rates", "ai", "review"]);

/**
 * Derive which carry-over rows to display.
 *
 * "full" mode: every partial/outstanding step except rates/ai/review.
 *   Used when snapshotting on status change and when building the strip
 *   if no snapshot exists.
 *
 * "light" mode: only builders (partial/outstanding) and documents (outstanding
 *   with zero files). Used by the strip when no snapshot is available.
 *
 * text = step.why for most steps. For builders, if reminders are supplied,
 * the per-builder wording from formatReminderBody() is preferred.
 */
export function selectCarryOverRows(
  completeness: DraftCompleteness,
  mode: "full" | "light",
  reminders?: ReadonlyArray<BuilderReminder>
): CarryOverRow[] {
  const rows: CarryOverRow[] = [];

  for (const step of completeness.steps) {
    if (step.state === "ready" || step.state === "not-checkable") continue;
    if (NOT_CARRY_OVER_STEPS.has(step.step)) continue;

    if (mode === "light") {
      // light: only builders (any incomplete) and documents (outstanding, zero files)
      if (step.step === "builders") {
        const text =
          reminders && reminders.length > 0
            ? reminders.map(formatReminderBody).join(" ")
            : step.why;
        rows.push({ step: step.step, text });
        continue;
      }
      if (step.step === "documents" && step.state === "outstanding") {
        rows.push({ step: step.step, text: step.why });
        continue;
      }
      // all other steps excluded from light mode
      continue;
    }

    // full mode
    if (step.step === "builders") {
      const text =
        reminders && reminders.length > 0
          ? reminders.map(formatReminderBody).join(" ")
          : step.why;
      rows.push({ step: step.step, text });
    } else {
      rows.push({ step: step.step, text: step.why });
    }
  }

  return rows;
}
