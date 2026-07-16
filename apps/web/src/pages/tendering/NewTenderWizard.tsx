/**
 * New Tender wizard — enlarged multi-step modal that replaces the single-step
 * NewTenderSlideOver. Wraps the existing DRAFT create flow (POST /tenders) and
 * pr-482 packages / matrix / document-bucket endpoints, and embeds the
 * existing TenderDocumentsPanel on the Documents step. State/transitions live
 * in newTenderWizard.helpers.ts so the flow can be tested without jsdom.
 */
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { AddressAutocomplete, type AddressSuggestion } from "../../components/AddressAutocomplete";
import "./newTenderWizard.css";
import { lockRateSet } from "./ratesTabApi";
import { QuickAddBuilderModal } from "./QuickAddBuilderModal";
import { QuickAddContactModal } from "./QuickAddContactModal";
import type { QuickAddClientResult, QuickAddContactResult } from "./tenderQuickAdd";
import { TenderDocumentsPanel, type DocumentRecord } from "./TenderDocumentsPanel";
import {
  advanceStep,
  buildAddBuilderRequest,
  buildDiscardDraftRequest,
  buildProjectStepFlushPayload,
  buildRemoveBuilderRequest,
  deriveDocumentBuckets,
  detectIncompleteBuilders,
  formatReminderBody,
  goBack,
  initialFlowState,
  jumpToStep,
  shouldConfirmClose,
  skipCurrentStep,
  WIZARD_STEP_KEYS,
  WIZARD_STEP_LABELS,
  type BuilderDraft,
  type MatrixCell,
  type PackageRef,
  type WizardFlowState,
  type WizardStepKey
} from "./newTenderWizard.helpers";

type PricingBasis = "DOCUMENTS" | "CLIENT_REQUEST" | "IDENTIFIED_RISK";

const PRICING_BASIS_LABEL: Record<PricingBasis, string> = {
  DOCUMENTS: "Documents",
  CLIENT_REQUEST: "From client request",
  IDENTIFIED_RISK: "On identified risk"
};

type ClientOption = { id: string; name: string };
type UserOption = { id: string; firstName: string; lastName: string };
type ContactOption = { id: string; fullName: string; email?: string | null; phone?: string | null };

type DisciplineItem = { id: string; value: string; label: string; sortOrder: number };

type ServerTenderClient = {
  id: string;
  clientId: string;
  relationshipType: string;
  submissionDate: string | null;
  client: { id: string; name: string };
  primaryContactId?: string | null;
};

type ServerTenderPackage = {
  id: string;
  disciplineItemId: string;
  disciplineItem: { id: string; value: string; label: string; sortOrder: number };
};

type ServerMatrixCell = {
  id: string;
  tenderClientId: string;
  tenderPackageId: string;
  pricingBasis: PricingBasis;
  basisNote: string | null;
};

type Action =
  | { type: "advance" }
  | { type: "skip" }
  | { type: "back" }
  | { type: "jump"; step: WizardStepKey }
  | { type: "setDraft"; draftId: string }
  | { type: "lockRates" }
  | { type: "reset" };

function flowReducer(state: WizardFlowState, action: Action): WizardFlowState {
  switch (action.type) {
    case "advance":
      return advanceStep(state);
    case "skip":
      return skipCurrentStep(state);
    case "back":
      return goBack(state);
    case "jump":
      return jumpToStep(state, action.step);
    case "setDraft":
      return { ...state, draftId: action.draftId };
    case "lockRates":
      return { ...state, ratesLocked: true };
    case "reset":
      return initialFlowState();
    default:
      return state;
  }
}

export type NewTenderWizardProps = {
  open: boolean;
  clients: ClientOption[];
  users: UserOption[];
  existingDraftId?: string | null;
  onClose: () => void;
  onCreated: (id: string) => void;
  /**
   * Fired when the wizard needs the parent to reload the master builder list
   * — currently used after quick-add so a builder given "full details" in the
   * other tab shows up when the user returns to the picker.
   */
  onNeedClientsRefetch?: () => void;
};

export function NewTenderWizard(props: NewTenderWizardProps) {
  const { open, clients, users, existingDraftId, onClose, onCreated, onNeedClientsRefetch } = props;
  const { authFetch, user } = useAuth();

  const [flow, dispatch] = useReducer(flowReducer, undefined, initialFlowState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When true, Escape / overlay / X / "Save & finish later" have asked to close
  // but there is a draft (or uploads) worth preserving. We surface a small
  // Keep / Discard / Cancel confirm before actually closing.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  // Quick-add builder / contact — mount the CenteredModal on demand. `quickAddContactFor`
  // pins which builder the contact belongs to so we can slot the created contact
  // straight into that builder's dropdown on success.
  const [quickAddBuilderOpen, setQuickAddBuilderOpen] = useState(false);
  const [quickAddContactFor, setQuickAddContactFor] = useState<
    { clientId: string; clientName: string } | null
  >(null);

  // Step 1 — Project
  const [title, setTitle] = useState("");
  // `siteAddress` is the text visible in the input; `resolvedSiteId` is the
  // linked Site.id set once the user picks a suggestion. The wizard cannot
  // advance past Project without a resolved site so every tender gets a real
  // Site link (siteId), not just a free-text description.
  const [siteAddress, setSiteAddress] = useState("");
  const [resolvedSiteId, setResolvedSiteId] = useState<string | null>(null);
  const [resolvingSite, setResolvingSite] = useState(false);
  const [estimatorUserId, setEstimatorUserId] = useState("");

  // Step 2 — Builders
  const [builders, setBuilders] = useState<BuilderDraft[]>([]);
  const [primaryClientId, setPrimaryClientId] = useState("");
  const [contactCache, setContactCache] = useState<Record<string, ContactOption[]>>({});

  // Step 3 — Packages catalogue + selected
  const [disciplines, setDisciplines] = useState<DisciplineItem[]>([]);
  const [packages, setPackages] = useState<ServerTenderPackage[]>([]);
  const [matrix, setMatrix] = useState<ServerMatrixCell[]>([]);

  // Step 4 — Documents
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  // Step 5 — Rates
  const [ratesVersionLabel, setRatesVersionLabel] = useState("");

  // Server tender-client index (needed to map builder → tenderClientId for pr-482 calls).
  const [serverTenderClients, setServerTenderClients] = useState<ServerTenderClient[]>([]);

  const panelRef = useRef<HTMLDivElement | null>(null);

  // Reset on open + preload draft-in-progress if the caller passed one.
  useEffect(() => {
    if (!open) return;
    dispatch({ type: "reset" });
    setBusy(false);
    setError(null);
    setTitle("");
    setSiteAddress("");
    setResolvedSiteId(null);
    setResolvingSite(false);
    setEstimatorUserId("");
    setBuilders([]);
    setPrimaryClientId("");
    setContactCache({});
    setPackages([]);
    setMatrix([]);
    setDocuments([]);
    setRatesVersionLabel("");
    setServerTenderClients([]);
    setConfirmingClose(false);
    setConfirmBusy(false);
    setConfirmError(null);
    setQuickAddBuilderOpen(false);
    setQuickAddContactFor(null);
    if (existingDraftId) {
      dispatch({ type: "setDraft", draftId: existingDraftId });
    }
  }, [open, existingDraftId]);

  // Load discipline catalogue on first open — powers the Packages step.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/lists/tender-package-disciplines/items?take=200");
        if (!res.ok) throw new Error("Could not load discipline catalogue.");
        const body = await res.json();
        const items: DisciplineItem[] = Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : [];
        if (!cancelled) setDisciplines(items.filter((d) => d.id));
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, authFetch]);

  // Whenever we have a draft id, hydrate tender-clients + packages + matrix + docs.
  useEffect(() => {
    if (!open || !flow.draftId) return;
    let cancelled = false;
    (async () => {
      try {
        const [tRes, pkgRes, mxRes, docRes] = await Promise.all([
          authFetch(`/tenders/${flow.draftId}`),
          authFetch(`/tenders/${flow.draftId}/packages`),
          authFetch(`/tenders/${flow.draftId}/matrix`),
          authFetch(`/tenders/${flow.draftId}/documents`)
        ]);
        if (!tRes.ok) throw new Error("Could not load draft tender.");
        const tender = await tRes.json();
        if (cancelled) return;
        setServerTenderClients(tender.tenderClients ?? []);
        setTitle((prev) => prev || tender.title || "");
        setEstimatorUserId((prev) => prev || tender.estimatorUserId || "");
        // Resume path: if the tender already has a site link, rehydrate the
        // visible address + the resolved id so the user can advance without
        // re-picking. Formatted-address display prefers the site name.
        if (tender.siteId) {
          setResolvedSiteId((prev) => prev ?? tender.siteId);
          if (tender.site) {
            const parts = [
              tender.site.addressLine1,
              tender.site.suburb,
              tender.site.state,
              tender.site.postcode
            ]
              .filter(Boolean)
              .join(", ");
            setSiteAddress((prev) => prev || parts || tender.site.name || "");
          }
        }
        // Rebuild builder drafts from server state so resume-flow shows saved builders.
        const rebuilt: BuilderDraft[] = (tender.tenderClients ?? []).map((tc: ServerTenderClient) => ({
          clientId: tc.clientId,
          clientName: tc.client?.name ?? "",
          contactId: tc.primaryContactId ?? null,
          submissionDate: tc.submissionDate ?? null
        }));
        if (rebuilt.length > 0) setBuilders(rebuilt);
        const primary = (tender.tenderClients ?? []).find((tc: ServerTenderClient) => tc.relationshipType === "PRIMARY");
        if (primary) setPrimaryClientId(primary.clientId);
        if (pkgRes.ok) setPackages(await pkgRes.json());
        if (mxRes.ok) setMatrix(await mxRes.json());
        if (docRes.ok) {
          const dbody = await docRes.json();
          setDocuments(Array.isArray(dbody?.data) ? dbody.data : Array.isArray(dbody) ? dbody : []);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, flow.draftId, authFetch]);

  // Esc-to-close (blocked when busy). If the confirm modal is open, defer to
  // its own Esc handler so pressing Escape closes the confirm rather than the
  // whole wizard.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (busy) return;
      if (confirmingClose) return;
      // Escape while a quick-add modal is open should close *that* modal only
      // — CenteredModal already handles it. Bail so the wizard doesn't also
      // close alongside the quick-add.
      if (quickAddBuilderOpen || quickAddContactFor) return;
      handleCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, confirmingClose, quickAddBuilderOpen, quickAddContactFor, flow.draftId, documents.length]);

  // Refetch the parent's builder list whenever the window regains focus —
  // covers the "opened /tenders/clients in another tab, filled full details,
  // came back" flow so the picker shows the updated record.
  useEffect(() => {
    if (!open || !onNeedClientsRefetch) return;
    const onFocus = () => onNeedClientsRefetch();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, onNeedClientsRefetch]);

  const packageRefs: PackageRef[] = useMemo(
    () =>
      packages.map((p) => ({
        id: p.id,
        disciplineItemId: p.disciplineItemId,
        value: p.disciplineItem.value,
        label: p.disciplineItem.label,
        sortOrder: p.disciplineItem.sortOrder
      })),
    [packages]
  );

  const matrixCells: MatrixCell[] = useMemo(
    () => matrix.map((m) => ({ tenderClientId: m.tenderClientId, tenderPackageId: m.tenderPackageId })),
    [matrix]
  );

  const documentBuckets = useMemo(
    () => deriveDocumentBuckets(matrixCells, packageRefs),
    [matrixCells, packageRefs]
  );

  const incompleteBuilders = useMemo(() => detectIncompleteBuilders(builders), [builders]);

  if (!open) return null;

  // -------------------------------------------------------------------------
  // API helpers — inline so the wizard is self-contained.
  // -------------------------------------------------------------------------

  async function ensureDraftId(): Promise<string> {
    if (flow.draftId) return flow.draftId;
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error("Project name is required before we can create the draft.");
    }
    const payload: Record<string, unknown> = {
      title: trimmed,
      status: "DRAFT"
    };
    const desc = [siteAddress.trim() ? `Site: ${siteAddress.trim()}` : ""]
      .filter(Boolean)
      .join("\n");
    if (desc) payload.description = desc;
    if (estimatorUserId) payload.estimatorUserId = estimatorUserId;
    // resolvedSiteId is set by the AddressAutocomplete onSelect handler once
    // the user picks a suggestion — attach it here so the draft is linked to
    // the real Site record (not just the free-text description) from the
    // first save.
    if (resolvedSiteId) payload.siteId = resolvedSiteId;
    const res = await authFetch("/tenders", { method: "POST", body: JSON.stringify(payload) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? "Could not create draft tender.");
    }
    const created = await res.json();
    dispatch({ type: "setDraft", draftId: created.id });
    setServerTenderClients(created.tenderClients ?? []);
    return created.id;
  }

  async function patchDraft(id: string, patch: Record<string, unknown>) {
    // API PATCH /tenders/:id uses UpsertTenderDto which requires `title`. Always
    // re-send the current title so partial patches (adding builders, packages,
    // etc.) don't get rejected with "title must be a string".
    const body = "title" in patch ? patch : { title: title.trim(), ...patch };
    const res = await authFetch(`/tenders/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? "Could not update draft tender.");
    }
    // 204/empty body → `res.json()` would throw "Unexpected end of JSON input".
    // Read text first and only parse when there's something to parse.
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  }

  async function refreshPackagesAndMatrix(id: string) {
    const [pkgRes, mxRes] = await Promise.all([
      authFetch(`/tenders/${id}/packages`),
      authFetch(`/tenders/${id}/matrix`)
    ]);
    if (pkgRes.ok) setPackages(await pkgRes.json());
    if (mxRes.ok) setMatrix(await mxRes.json());
  }

  async function refreshDocuments(id: string) {
    const res = await authFetch(`/tenders/${id}/documents`);
    if (res.ok) {
      const body = await res.json();
      setDocuments(Array.isArray(body?.data) ? body.data : Array.isArray(body) ? body : []);
    }
  }

  async function loadContacts(clientId: string, force = false) {
    if (!force && contactCache[clientId]) return contactCache[clientId];
    const res = await authFetch(`/master-data/contacts?clientId=${encodeURIComponent(clientId)}&pageSize=100`);
    if (!res.ok) return [];
    const body = await res.json();
    const raw = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : [];
    const list: ContactOption[] = raw.map((c: { id: string; fullName?: string; firstName?: string; lastName?: string; email?: string | null; phone?: string | null }) => ({
      id: c.id,
      fullName: c.fullName ?? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim(),
      email: c.email ?? null,
      phone: c.phone ?? null
    }));
    setContactCache((prev) => ({ ...prev, [clientId]: list }));
    return list;
  }

  // Flush the current step's field state to the draft so pressing Next / Skip
  // (or closing) never silently loses in-progress input. Server-writing steps
  // (packages / matrix / documents / submission-date) already persist on each
  // change; only the Project step accumulates local-only fields (estimator,
  // site/description) between mounts. Extend the switch when adding future
  // client-side-buffered steps.
  async function flushCurrentStep() {
    if (!flow.draftId) return;
    if (flow.currentStep === "project") {
      const patch = buildProjectStepFlushPayload({
        draftId: flow.draftId,
        title,
        estimatorUserId,
        siteAddress,
        siteId: resolvedSiteId
      });
      if (patch) await patchDraft(flow.draftId, patch);
    }
  }

  // Called by AddressAutocomplete once the user picks a suggestion. Sends the
  // structured address to /geo/sites/resolve which returns the matched-or-
  // created Site.id; that id is what actually links the tender to a Site.
  // Failures surface as an inline error so the user can retry — we never
  // silently drop the site link.
  async function handleAddressSelect(suggestion: AddressSuggestion) {
    setResolvingSite(true);
    setError(null);
    try {
      const res = await authFetch("/geo/sites/resolve", {
        method: "POST",
        body: JSON.stringify({
          formatted: suggestion.formatted,
          addressLine1: suggestion.addressLine1,
          suburb: suggestion.suburb,
          state: suggestion.state,
          postcode: suggestion.postcode
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not link this address to a site.");
      }
      const data = (await res.json()) as { site: { id: string }; created: boolean };
      setResolvedSiteId(data.site.id);
      // If the draft already exists, patch it immediately so a reload picks
      // up the site link even if the user closes without pressing Next.
      if (flow.draftId) {
        await patchDraft(flow.draftId, { title: title.trim(), siteId: data.site.id });
      }
    } catch (err) {
      setError((err as Error).message);
      setResolvedSiteId(null);
    } finally {
      setResolvingSite(false);
    }
  }

  async function fireIncompleteReminders() {
    if (!user) return;
    for (const reminder of incompleteBuilders) {
      const body = {
        userId: user.id,
        title: "Tender builder — details incomplete",
        body: formatReminderBody(reminder),
        severity: "info",
        linkUrl: flow.draftId ? `/tenders/${flow.draftId}` : undefined
      };
      try {
        await authFetch("/notifications", { method: "POST", body: JSON.stringify(body) });
      } catch {
        // Swallow — the notification is a nudge, not a blocker.
      }
    }
  }

  // -------------------------------------------------------------------------
  // Step-1 handlers
  // -------------------------------------------------------------------------

  const handleNextFromProject = async () => {
    if (!title.trim()) {
      setError("Project name is required.");
      return;
    }
    // Marco (2026-07-15): a tender's site address must be captured at tender
    // time. Block advance until the user has picked a suggestion (which sets
    // resolvedSiteId) — free-text was the exact reason every tender.siteId
    // was null before this PR.
    if (!resolvedSiteId) {
      setError("Select a site address from the suggestions before continuing.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureDraftId();
      // Flush estimator / site / description too — ensureDraftId only writes
      // them on the very first save (when it creates the draft), so second
      // and subsequent Nexts on this step would otherwise drop later edits.
      await flushCurrentStep();
      dispatch({ type: "advance" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Shared Skip handler — always flushes the current step's field state first
  // so users don't lose input by skipping a step they were partway through.
  const handleSkip = async () => {
    setBusy(true);
    setError(null);
    try {
      await flushCurrentStep();
      dispatch({ type: "skip" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Shared Next handler for steps whose fields already persist on change
  // (packages / matrix / documents / rates / ai / review). Still routes
  // through flushCurrentStep so future step additions get the same guarantee
  // by default.
  const handleGenericNext = async () => {
    setBusy(true);
    setError(null);
    try {
      await flushCurrentStep();
      dispatch({ type: "advance" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step-2 (Builders) handlers
  // -------------------------------------------------------------------------

  // `presetName` lets quick-add attach a builder that isn't (yet) in the parent's
  // `clients` prop — the create response gives us the name directly. Picker
  // callers pass no override and rely on the `clients` lookup.
  const addBuilder = async (clientId: string, presetName?: string) => {
    const client = clients.find((c) => c.id === clientId);
    const clientName = client?.name ?? presetName;
    if (!clientName) return;
    if (builders.some((b) => b.clientId === clientId)) return;
    setBusy(true);
    setError(null);
    try {
      const draftId = await ensureDraftId();
      const isFirst = builders.length === 0;
      // Append-only per-client endpoint — avoids the destructive PATCH /tenders/:id
      // {tenderClients} path in UpsertTenderDto, which whitelists a fixed field set
      // (no submissionDate) and deleteMany-then-recreates every child collection on
      // the tender (pricing snapshots, notes, clarifications, etc.).
      const req = buildAddBuilderRequest(clientId, isFirst);
      const res = await authFetch(`/tenders/${draftId}/${req.path}`, {
        method: req.method,
        body: JSON.stringify(req.body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Could not link builder to draft tender.");
      }
      const list = (await res.json()) as ServerTenderClient[];
      setServerTenderClients(list);
      setBuilders((prev) => [
        ...prev,
        { clientId, clientName, contactId: null, submissionDate: null }
      ]);
      if (isFirst) setPrimaryClientId(clientId);
      void loadContacts(clientId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Quick-add builder / contact — inline creation without leaving the wizard
  // -------------------------------------------------------------------------

  async function handleQuickBuilderCreated(created: QuickAddClientResult) {
    setQuickAddBuilderOpen(false);
    // Nudge the parent to refresh its master list so subsequent picker searches
    // find the new builder too (the immediate attach below uses the create
    // response directly, so it doesn't wait on the refetch).
    if (onNeedClientsRefetch) onNeedClientsRefetch();
    await addBuilder(created.id, created.name);
  }

  async function handleQuickContactCreated(created: QuickAddContactResult) {
    const target = quickAddContactFor;
    setQuickAddContactFor(null);
    if (!target) return;
    try {
      // Force-refetch this client's contacts so the dropdown reflects the
      // canonical server list (matches the spec: "refetch that client's
      // contacts and select the new one").
      await loadContacts(target.clientId, true);
    } catch {
      // Best-effort — even if the refetch fails we can still slot the newly
      // created contact into local state so the wizard can proceed.
      setContactCache((prev) => ({
        ...prev,
        [target.clientId]: [
          ...(prev[target.clientId] ?? []),
          { id: created.id, fullName: created.fullName, email: created.email, phone: created.phone }
        ]
      }));
    }
    updateBuilderContact(target.clientId, created.id);
  }

  const removeBuilder = async (clientId: string) => {
    setBusy(true);
    setError(null);
    try {
      const draftId = await ensureDraftId();
      const req = buildRemoveBuilderRequest(clientId);
      const res = await authFetch(`/tenders/${draftId}/${req.path}`, {
        method: req.method
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Could not unlink builder from draft tender.");
      }
      const list = (await res.json()) as ServerTenderClient[];
      setServerTenderClients(list);
      setBuilders((prev) => prev.filter((b) => b.clientId !== clientId));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateBuilderContact = (clientId: string, contactId: string) => {
    setBuilders((prev) =>
      prev.map((b) => (b.clientId === clientId ? { ...b, contactId: contactId || null } : b))
    );
  };

  const updateBuilderSubmissionDate = async (clientId: string, dateStr: string) => {
    const tc = serverTenderClients.find((t) => t.clientId === clientId);
    if (!tc || !flow.draftId) {
      setBuilders((prev) =>
        prev.map((b) => (b.clientId === clientId ? { ...b, submissionDate: dateStr || null } : b))
      );
      return;
    }
    setBusy(true);
    try {
      const body = { submissionDate: dateStr ? new Date(dateStr).toISOString() : null };
      const res = await authFetch(`/tenders/${flow.draftId}/clients/${tc.id}/submission-date`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Could not save submission date.");
      const updated = await res.json();
      setServerTenderClients((prev) => prev.map((t) => (t.id === tc.id ? { ...t, submissionDate: updated.submissionDate } : t)));
      setBuilders((prev) =>
        prev.map((b) => (b.clientId === clientId ? { ...b, submissionDate: dateStr || null } : b))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleNextFromBuilders = async () => {
    // Non-blocking: flush current step, fire notifications for any incomplete
    // builders, then advance.
    setBusy(true);
    setError(null);
    try {
      await flushCurrentStep();
      await fireIncompleteReminders();
      dispatch({ type: "advance" });
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step-3 (Packages) handlers
  // -------------------------------------------------------------------------

  const togglePackage = async (disciplineItemId: string) => {
    if (!flow.draftId) return;
    setBusy(true);
    setError(null);
    try {
      const existing = packages.find((p) => p.disciplineItemId === disciplineItemId);
      if (existing) {
        await authFetch(`/tenders/${flow.draftId}/packages/${existing.id}`, { method: "DELETE" });
      } else {
        await authFetch(`/tenders/${flow.draftId}/packages`, {
          method: "POST",
          body: JSON.stringify({ disciplineItemId })
        });
      }
      await refreshPackagesAndMatrix(flow.draftId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMatrixCell = async (tenderClientId: string, tenderPackageId: string) => {
    if (!flow.draftId) return;
    setBusy(true);
    setError(null);
    try {
      const existing = matrix.find(
        (m) => m.tenderClientId === tenderClientId && m.tenderPackageId === tenderPackageId
      );
      if (existing) {
        await authFetch(`/tenders/${flow.draftId}/matrix/${existing.id}`, { method: "DELETE" });
      } else {
        await authFetch(`/tenders/${flow.draftId}/matrix`, {
          method: "POST",
          body: JSON.stringify({ tenderClientId, tenderPackageId })
        });
      }
      await refreshPackagesAndMatrix(flow.draftId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const updateCellBasis = async (cellId: string, basis: PricingBasis, note: string) => {
    if (!flow.draftId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/tenders/${flow.draftId}/matrix/${cellId}`, {
        method: "PATCH",
        body: JSON.stringify({ pricingBasis: basis, basisNote: note || null })
      });
      if (!res.ok) throw new Error("Could not update pricing basis.");
      await refreshPackagesAndMatrix(flow.draftId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Step-5 (Rates) handler — lock the snapshot explicitly.
  // -------------------------------------------------------------------------

  const lockRates = async () => {
    if (!flow.draftId) return;
    // Use the dedicated rate-set lock endpoint so a TenderRateSet + entries
    // are actually snapshotted. The previous PATCH /tenders/:id
    // {pricingSnapshots} path did not create rate-set rows (which the Rates
    // tab reads) and returned an empty body that crashed res.json().
    const label = ratesVersionLabel.trim() || `Rates as of ${new Date().toLocaleDateString("en-AU")}`;
    setBusy(true);
    setError(null);
    try {
      await lockRateSet(authFetch, flow.draftId, label);
      dispatch({ type: "lockRates" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // -------------------------------------------------------------------------
  // Cancel / Save-and-finish-later / Discard draft
  // -------------------------------------------------------------------------

  // Blank wizard = no draft persisted server-side AND no uploads. In that
  // case Escape / overlay-click / X can close instantly with no prompt.
  const mustConfirmClose = shouldConfirmClose({
    draftId: flow.draftId,
    documentsCount: documents.length
  });

  function handleCancel() {
    if (!mustConfirmClose) {
      onClose();
      return;
    }
    // Draft exists (or uploads happened) — pop the confirm instead of
    // closing. Users previously reported "accidentally cancelling loses my
    // work"; even though the draft is server-side and resumable, closing
    // without confirmation is disorienting when they have a live draft.
    setConfirmError(null);
    setConfirmingClose(true);
  }

  async function handleKeepAndClose() {
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await flushCurrentStep();
      setConfirmingClose(false);
      onClose();
    } catch (err) {
      setConfirmError((err as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleDiscardDraft() {
    if (!flow.draftId) {
      // Uploads-without-draft is not currently reachable (uploads require a
      // draft id) but defend against it — just close.
      setConfirmingClose(false);
      onClose();
      return;
    }
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      const req = buildDiscardDraftRequest(flow.draftId);
      const res = await authFetch(`/${req.path}`, { method: req.method });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not discard the draft.");
      }
      setConfirmingClose(false);
      onClose();
    } catch (err) {
      setConfirmError((err as Error).message);
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handleFinish() {
    if (!flow.draftId) {
      setError("Draft has not been created yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Ensure any final field edits are flushed.
      const patch: Record<string, unknown> = { title: title.trim() };
      if (estimatorUserId) patch.estimatorUserId = estimatorUserId;
      if (resolvedSiteId) patch.siteId = resolvedSiteId;
      const desc = siteAddress.trim() ? `Site: ${siteAddress.trim()}` : "";
      if (desc) patch.description = desc;
      await patchDraft(flow.draftId, patch);
      await fireIncompleteReminders();
      onCreated(flow.draftId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  const stepIsLast = flow.currentStep === "review";

  return (
    <>
    <div
      className="new-tender-wizard__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Create tender"
      onClick={handleCancel}
    >
      <div
        ref={panelRef}
        className="new-tender-wizard"
        onClick={(event) => event.stopPropagation()}
        data-testid="new-tender-wizard"
      >
        <aside className="new-tender-wizard__rail" aria-label="Wizard steps">
          <div className="new-tender-wizard__rail-heading">
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>New tender</h2>
            <p className="new-tender-wizard__rail-subtitle">Every step is skippable and resumable.</p>
          </div>
          <ol className="new-tender-wizard__rail-steps">
            {WIZARD_STEP_KEYS.map((key, idx) => {
              const visited = flow.visited[key];
              const skipped = flow.skipped[key];
              const active = flow.currentStep === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={[
                      "new-tender-wizard__rail-step",
                      active ? "is-active" : "",
                      visited && !active ? "is-visited" : "",
                      skipped ? "is-skipped" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => dispatch({ type: "jump", step: key })}
                    disabled={!visited}
                    aria-current={active ? "step" : undefined}
                  >
                    <span className="new-tender-wizard__rail-index">{idx + 1}</span>
                    <span className="new-tender-wizard__rail-label">{WIZARD_STEP_LABELS[key]}</span>
                    {skipped ? <span className="new-tender-wizard__rail-badge">skipped</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <div className="new-tender-wizard__content">
          <header className="new-tender-wizard__header">
            <div>
              <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
                {WIZARD_STEP_LABELS[flow.currentStep]}
              </h3>
              <p className="new-tender-wizard__subtitle">
                {flow.draftId
                  ? "Draft saved — you can close and resume this tender from the drafts list at any time."
                  : "We will save a draft as soon as you enter a project name and continue."}
              </p>
            </div>
            <button
              type="button"
              className="slide-over__close"
              onClick={handleCancel}
              aria-label="Close"
              disabled={busy}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </header>

          <div className="new-tender-wizard__body">
            {error ? <div className="login-card__error" role="alert">{error}</div> : null}

            {flow.currentStep === "project" ? (
              <StepProject
                title={title}
                onTitleChange={setTitle}
                siteAddress={siteAddress}
                onSiteChange={(v) => {
                  setSiteAddress(v);
                  // Editing the address after a pick invalidates the resolved
                  // link — the user has to pick again from the suggestions.
                  if (resolvedSiteId) setResolvedSiteId(null);
                }}
                onAddressSelect={handleAddressSelect}
                resolvedSiteId={resolvedSiteId}
                resolvingSite={resolvingSite}
                users={users}
                estimatorUserId={estimatorUserId}
                onEstimatorChange={setEstimatorUserId}
                draftId={flow.draftId}
              />
            ) : null}

            {flow.currentStep === "builders" ? (
              <StepBuilders
                clients={clients}
                builders={builders}
                primaryClientId={primaryClientId}
                serverTenderClients={serverTenderClients}
                onAddBuilder={addBuilder}
                onRemoveBuilder={removeBuilder}
                onContactChange={updateBuilderContact}
                onSubmissionDateChange={updateBuilderSubmissionDate}
                contactCache={contactCache}
                onWantContacts={loadContacts}
                incompleteCount={incompleteBuilders.length}
                onQuickAddBuilder={() => setQuickAddBuilderOpen(true)}
                onQuickAddContact={(clientId, clientName) =>
                  setQuickAddContactFor({ clientId, clientName })
                }
              />
            ) : null}

            {flow.currentStep === "packages" ? (
              <StepPackages
                disciplines={disciplines}
                packages={packages}
                matrix={matrix}
                builders={serverTenderClients}
                onTogglePackage={togglePackage}
                onToggleCell={toggleMatrixCell}
                onUpdateCellBasis={updateCellBasis}
              />
            ) : null}

            {flow.currentStep === "documents" ? (
              <StepDocuments
                draftId={flow.draftId}
                buckets={documentBuckets}
                documents={documents}
                onDocumentsChanged={() => {
                  if (flow.draftId) void refreshDocuments(flow.draftId);
                }}
              />
            ) : null}

            {flow.currentStep === "rates" ? (
              <StepRates
                versionLabel={ratesVersionLabel}
                onVersionLabelChange={setRatesVersionLabel}
                onLock={lockRates}
                locked={flow.ratesLocked}
              />
            ) : null}

            {flow.currentStep === "ai" ? <StepAi /> : null}

            {flow.currentStep === "review" ? (
              <StepReview
                title={title}
                siteAddress={siteAddress}
                estimator={users.find((u) => u.id === estimatorUserId) ?? null}
                builders={builders}
                packages={packages}
                matrix={matrix}
                documents={documents}
                ratesLocked={flow.ratesLocked}
                buckets={documentBuckets}
              />
            ) : null}
          </div>

          <footer className="new-tender-wizard__footer">
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={handleCancel}
              disabled={busy}
            >
              {flow.draftId ? "Save & finish later" : "Cancel"}
            </button>
            <div className="new-tender-wizard__footer-actions">
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => dispatch({ type: "back" })}
                disabled={busy || flow.currentStep === "project"}
              >
                Back
              </button>
              {!stepIsLast ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost"
                  onClick={handleSkip}
                  disabled={busy}
                  data-testid="new-tender-wizard-skip"
                >
                  Skip
                </button>
              ) : null}
              {!stepIsLast ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={
                    flow.currentStep === "project"
                      ? handleNextFromProject
                      : flow.currentStep === "builders"
                        ? handleNextFromBuilders
                        : handleGenericNext
                  }
                  disabled={busy}
                  data-testid="new-tender-wizard-next"
                >
                  {busy ? "Working…" : "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={handleFinish}
                  disabled={busy}
                >
                  {busy ? "Creating…" : "Create tender"}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </div>
      {confirmingClose ? (
        <CenteredModal
          title="Close this tender?"
          subtitle={
            flow.draftId
              ? "Your draft is saved and can be resumed from the pipeline. You can also discard it if you no longer need it."
              : "You have uploads in progress. Close anyway?"
          }
          onClose={() => {
            if (confirmBusy) return;
            setConfirmingClose(false);
          }}
          busy={confirmBusy}
          maxWidth={480}
          dataTestId="new-tender-wizard-close-confirm"
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => setConfirmingClose(false)}
                disabled={confirmBusy}
                data-testid="new-tender-wizard-close-cancel"
              >
                Cancel
              </button>
              {flow.draftId ? (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost"
                  onClick={handleDiscardDraft}
                  disabled={confirmBusy}
                  data-testid="new-tender-wizard-close-discard"
                >
                  {confirmBusy ? "Working…" : "Discard draft"}
                </button>
              ) : null}
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={handleKeepAndClose}
                disabled={confirmBusy}
                data-testid="new-tender-wizard-close-keep"
              >
                {confirmBusy ? "Working…" : "Save & finish later"}
              </button>
            </>
          }
        >
          {confirmError ? (
            <div className="login-card__error" role="alert">
              {confirmError}
            </div>
          ) : null}
        </CenteredModal>
      ) : null}
      {quickAddBuilderOpen ? (
        <QuickAddBuilderModal
          onClose={() => setQuickAddBuilderOpen(false)}
          onCreated={(client) => void handleQuickBuilderCreated(client)}
        />
      ) : null}
      {quickAddContactFor ? (
        <QuickAddContactModal
          clientId={quickAddContactFor.clientId}
          clientName={quickAddContactFor.clientName}
          onClose={() => setQuickAddContactFor(null)}
          onCreated={(contact) => void handleQuickContactCreated(contact)}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Step subcomponents
// ---------------------------------------------------------------------------

function StepProject(props: {
  title: string;
  onTitleChange: (v: string) => void;
  siteAddress: string;
  onSiteChange: (v: string) => void;
  onAddressSelect: (suggestion: AddressSuggestion) => void;
  resolvedSiteId: string | null;
  resolvingSite: boolean;
  users: UserOption[];
  estimatorUserId: string;
  onEstimatorChange: (v: string) => void;
  draftId: string | null;
}) {
  return (
    <div className="new-tender-wizard__step">
      <label className="tender-form__field">
        <span className="s7-type-label">Project name</span>
        <input
          className="s7-input"
          value={props.title}
          onChange={(e) => props.onTitleChange(e.target.value)}
          placeholder="Site civil works package"
          autoFocus
          required
        />
        <span className="new-tender-wizard__hint">Use EstimateOne (E1) information preferably.</span>
      </label>
      <label className="tender-form__field" htmlFor="new-tender-site-address">
        <span className="s7-type-label">Site / address</span>
        <AddressAutocomplete
          inputId="new-tender-site-address"
          value={props.siteAddress}
          onValueChange={props.onSiteChange}
          onSelect={props.onAddressSelect}
          required
          placeholder="123 Example Rd, Brisbane QLD"
          dataTestId="new-tender-site-address"
        />
        <span className="new-tender-wizard__hint">
          {props.resolvingSite
            ? "Linking address to site…"
            : props.resolvedSiteId
              ? "Address linked to site record. Editing clears the link."
              : "Start typing, then pick a suggestion — required to continue."}
        </span>
      </label>
      <label className="tender-form__field">
        <span className="s7-type-label">Tender reference</span>
        <input
          className="s7-input"
          value={props.draftId ? "Assigned on save" : "Auto-generated on save (T{YYMMDD}-{CLIENT}-Rev1)"}
          disabled
          readOnly
        />
      </label>
      <label className="tender-form__field">
        <span className="s7-type-label">Estimator / owner</span>
        <select
          className="s7-select"
          value={props.estimatorUserId}
          onChange={(e) => props.onEstimatorChange(e.target.value)}
        >
          <option value="">Unassigned</option>
          {props.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.firstName} {u.lastName}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function StepBuilders(props: {
  clients: ClientOption[];
  builders: BuilderDraft[];
  primaryClientId: string;
  serverTenderClients: ServerTenderClient[];
  onAddBuilder: (clientId: string) => void;
  onRemoveBuilder: (clientId: string) => void;
  onContactChange: (clientId: string, contactId: string) => void;
  onSubmissionDateChange: (clientId: string, dateStr: string) => void;
  contactCache: Record<string, ContactOption[]>;
  onWantContacts: (clientId: string) => Promise<ContactOption[]>;
  incompleteCount: number;
  onQuickAddBuilder: () => void;
  onQuickAddContact: (clientId: string, clientName: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const takenIds = new Set(props.builders.map((b) => b.clientId));

  const filtered = props.clients.filter(
    (c) => !takenIds.has(c.id) && (search === "" || c.name.toLowerCase().includes(search.toLowerCase()))
  );

  useEffect(() => {
    for (const b of props.builders) {
      if (!props.contactCache[b.clientId]) void props.onWantContacts(b.clientId);
    }
  }, [props.builders, props.contactCache, props.onWantContacts]);

  return (
    <div className="new-tender-wizard__step">
      <div className="new-tender-wizard__builder-picker">
        <label className="tender-form__field">
          <span className="s7-type-label">Add a builder</span>
          <input
            className="s7-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPickerOpen(true);
            }}
            onFocus={() => setPickerOpen(true)}
            placeholder="Search builders…"
          />
        </label>
        {pickerOpen ? (
          <div className="new-tender-wizard__picker-results" role="listbox">
            {filtered.slice(0, 10).map((c) => (
              <button
                key={c.id}
                type="button"
                className="new-tender-wizard__picker-item"
                onClick={() => {
                  props.onAddBuilder(c.id);
                  setSearch("");
                  setPickerOpen(false);
                }}
              >
                {c.name}
              </button>
            ))}
            {filtered.length === 0 ? (
              <div className="new-tender-wizard__picker-empty">
                No matches — add a new builder without leaving the wizard.
              </div>
            ) : null}
            <button
              type="button"
              className="new-tender-wizard__picker-item"
              onClick={() => {
                props.onQuickAddBuilder();
                setPickerOpen(false);
              }}
              data-testid="new-tender-wizard-quick-add-builder"
              style={{ fontWeight: 500 }}
            >
              + Add new builder
            </button>
          </div>
        ) : null}
      </div>

      {props.incompleteCount > 0 ? (
        <div className="new-tender-wizard__notice" role="status">
          {props.incompleteCount} builder{props.incompleteCount === 1 ? "" : "s"} with incomplete details.
          A reminder notification will be created when you continue.
        </div>
      ) : null}

      {props.builders.length === 0 ? (
        <div className="new-tender-wizard__empty">
          <strong>No builders yet.</strong>
          <span>Add at least one so we can generate the tender reference on save.</span>
        </div>
      ) : (
        <ul className="new-tender-wizard__builders">
          {props.builders.map((b) => {
            const contacts = props.contactCache[b.clientId] ?? [];
            const isPrimary = b.clientId === props.primaryClientId;
            return (
              <li key={b.clientId} className="new-tender-wizard__builder">
                <div className="new-tender-wizard__builder-header">
                  <span className="s7-type-label">
                    {b.clientName}
                    {isPrimary ? <span className="new-tender-wizard__pill">Primary</span> : null}
                  </span>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    onClick={() => props.onRemoveBuilder(b.clientId)}
                  >
                    Remove
                  </button>
                </div>
                <div className="new-tender-wizard__builder-fields">
                  <label className="tender-form__field">
                    <span className="s7-type-label">Contact</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                      <select
                        className="s7-select"
                        value={b.contactId ?? ""}
                        onChange={(e) => props.onContactChange(b.clientId, e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select a contact…</option>
                        {contacts.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.fullName}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => props.onQuickAddContact(b.clientId, b.clientName)}
                        data-testid={`new-tender-wizard-quick-add-contact-${b.clientId}`}
                        style={{ minHeight: 44, whiteSpace: "nowrap" }}
                      >
                        + Add contact
                      </button>
                    </div>
                  </label>
                  <label className="tender-form__field">
                    <span className="s7-type-label">Submission date</span>
                    <input
                      className="s7-input"
                      type="date"
                      value={b.submissionDate ? b.submissionDate.slice(0, 10) : ""}
                      onChange={(e) => props.onSubmissionDateChange(b.clientId, e.target.value)}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StepPackages(props: {
  disciplines: DisciplineItem[];
  packages: ServerTenderPackage[];
  matrix: ServerMatrixCell[];
  builders: ServerTenderClient[];
  onTogglePackage: (disciplineItemId: string) => void;
  onToggleCell: (tenderClientId: string, tenderPackageId: string) => void;
  onUpdateCellBasis: (cellId: string, basis: PricingBasis, note: string) => void;
}) {
  const selectedIds = new Set(props.packages.map((p) => p.disciplineItemId));

  return (
    <div className="new-tender-wizard__step">
      <p className="new-tender-wizard__hint">
        Pick the packages you are pricing, then tick which builder is pricing which package.
      </p>
      <fieldset className="new-tender-wizard__discipline-grid">
        <legend className="s7-type-label">Packages in this tender</legend>
        {props.disciplines.map((d) => (
          <label key={d.id} className="new-tender-wizard__checkbox">
            <input
              type="checkbox"
              checked={selectedIds.has(d.id)}
              onChange={() => props.onTogglePackage(d.id)}
            />
            <span>{d.label}</span>
          </label>
        ))}
      </fieldset>

      {props.builders.length === 0 || props.packages.length === 0 ? (
        <div className="new-tender-wizard__empty">
          {props.builders.length === 0
            ? "Add at least one builder on the previous step to build the matrix."
            : "Pick at least one package to build the matrix."}
        </div>
      ) : (
        <div className="new-tender-wizard__matrix-scroll">
          <table className="new-tender-wizard__matrix">
            <thead>
              <tr>
                <th>Package</th>
                {props.builders.map((b) => (
                  <th key={b.id}>{b.client.name}</th>
                ))}
                <th>Pricing basis</th>
              </tr>
            </thead>
            <tbody>
              {props.packages.map((pkg) => {
                const rowCells = props.matrix.filter((m) => m.tenderPackageId === pkg.id);
                const anyCell = rowCells[0] ?? null;
                return (
                  <tr key={pkg.id}>
                    <th scope="row">{pkg.disciplineItem.label}</th>
                    {props.builders.map((b) => {
                      const cell = rowCells.find((m) => m.tenderClientId === b.id);
                      return (
                        <td key={b.id}>
                          <input
                            type="checkbox"
                            checked={!!cell}
                            onChange={() => props.onToggleCell(b.id, pkg.id)}
                            aria-label={`Assign ${pkg.disciplineItem.label} to ${b.client.name}`}
                          />
                        </td>
                      );
                    })}
                    <td>
                      {anyCell ? (
                        <BasisEditor
                          cell={anyCell}
                          onChange={(basis, note) => props.onUpdateCellBasis(anyCell.id, basis, note)}
                        />
                      ) : (
                        <span className="new-tender-wizard__muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BasisEditor(props: { cell: ServerMatrixCell; onChange: (b: PricingBasis, note: string) => void }) {
  const [basis, setBasis] = useState<PricingBasis>(props.cell.pricingBasis);
  const [note, setNote] = useState(props.cell.basisNote ?? "");
  const needsNote = basis === "CLIENT_REQUEST" || basis === "IDENTIFIED_RISK";

  return (
    <div className="new-tender-wizard__basis">
      <select
        className="s7-select"
        value={basis}
        onChange={(e) => {
          const next = e.target.value as PricingBasis;
          setBasis(next);
          if (!(next === "CLIENT_REQUEST" || next === "IDENTIFIED_RISK")) {
            props.onChange(next, "");
          }
        }}
      >
        {(Object.keys(PRICING_BASIS_LABEL) as PricingBasis[]).map((b) => (
          <option key={b} value={b}>
            {PRICING_BASIS_LABEL[b]}
          </option>
        ))}
      </select>
      {needsNote ? (
        <input
          className="s7-input"
          placeholder="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => props.onChange(basis, note)}
        />
      ) : null}
    </div>
  );
}

function StepDocuments(props: {
  draftId: string | null;
  buckets: ReturnType<typeof deriveDocumentBuckets>;
  documents: DocumentRecord[];
  onDocumentsChanged: () => void;
}) {
  if (!props.draftId) {
    return (
      <div className="new-tender-wizard__empty">
        Save the draft on the Project step to enable document uploads.
      </div>
    );
  }
  return (
    <div className="new-tender-wizard__step">
      <p className="new-tender-wizard__hint">
        A single deduplicated document set — the buckets below are the union of the packages you
        selected. Empty buckets never block completion.
      </p>
      {props.buckets.length === 0 ? (
        <div className="new-tender-wizard__empty">
          No packages selected yet. All uploads go to the default categories.
        </div>
      ) : (
        <ul className="new-tender-wizard__bucket-list">
          {props.buckets.map((b) => (
            <li key={b.packageId}>{b.label}</li>
          ))}
        </ul>
      )}
      <TenderDocumentsPanel
        tenderId={props.draftId}
        documents={props.documents}
        onDocumentsChanged={props.onDocumentsChanged}
        canManage={true}
      />
    </div>
  );
}

function StepRates(props: {
  versionLabel: string;
  onVersionLabelChange: (v: string) => void;
  onLock: () => void;
  locked: boolean;
}) {
  return (
    <div className="new-tender-wizard__step">
      <p className="new-tender-wizard__hint">
        Lock the rate snapshot so the tender remains priced against a stable version even if the
        master rate tables change later.
      </p>
      <label className="tender-form__field">
        <span className="s7-type-label">Snapshot label</span>
        <input
          className="s7-input"
          value={props.versionLabel}
          onChange={(e) => props.onVersionLabelChange(e.target.value)}
          placeholder="e.g. Rates as of Q3 2026"
          disabled={props.locked}
        />
      </label>
      <button
        type="button"
        className="s7-btn s7-btn--primary"
        onClick={props.onLock}
        disabled={props.locked}
      >
        {props.locked ? "Rates locked" : "Lock rates snapshot"}
      </button>
    </div>
  );
}

function StepAi() {
  return (
    <div className="new-tender-wizard__step">
      <div className="new-tender-wizard__empty">
        <strong>AI-drafted scope — coming soon.</strong>
        <span>
          The Draft scope with AI button will be enabled once the model integration is
          wired up. This step is skippable in the meantime.
        </span>
      </div>
      <button type="button" className="s7-btn s7-btn--primary" disabled>
        Draft scope with AI
      </button>
    </div>
  );
}

function StepReview(props: {
  title: string;
  siteAddress: string;
  estimator: UserOption | null;
  builders: BuilderDraft[];
  packages: ServerTenderPackage[];
  matrix: ServerMatrixCell[];
  documents: DocumentRecord[];
  ratesLocked: boolean;
  buckets: ReturnType<typeof deriveDocumentBuckets>;
}) {
  return (
    <div className="new-tender-wizard__step">
      <dl className="new-tender-wizard__review">
        <div>
          <dt>Project</dt>
          <dd>{props.title || <em>—</em>}</dd>
        </div>
        <div>
          <dt>Site</dt>
          <dd>{props.siteAddress || <em>—</em>}</dd>
        </div>
        <div>
          <dt>Estimator</dt>
          <dd>{props.estimator ? `${props.estimator.firstName} ${props.estimator.lastName}` : <em>Unassigned</em>}</dd>
        </div>
        <div>
          <dt>Builders</dt>
          <dd>{props.builders.length === 0 ? <em>None</em> : props.builders.map((b) => b.clientName).join(", ")}</dd>
        </div>
        <div>
          <dt>Packages</dt>
          <dd>{props.packages.length === 0 ? <em>None</em> : props.packages.map((p) => p.disciplineItem.label).join(", ")}</dd>
        </div>
        <div>
          <dt>Matrix cells</dt>
          <dd>{props.matrix.length}</dd>
        </div>
        <div>
          <dt>Document buckets</dt>
          <dd>{props.buckets.length === 0 ? <em>None (default categories)</em> : props.buckets.map((b) => b.label).join(", ")}</dd>
        </div>
        <div>
          <dt>Documents uploaded</dt>
          <dd>{props.documents.length}</dd>
        </div>
        <div>
          <dt>Rates snapshot</dt>
          <dd>{props.ratesLocked ? "Locked" : <em>Not locked (will lock automatically on first status change)</em>}</dd>
        </div>
      </dl>
      <p className="new-tender-wizard__hint">
        SharePoint folders will be created under 1. Operations / 1. Tenders / {"<tender>"} on save.
      </p>
    </div>
  );
}
