import { useEffect, useMemo, useRef, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { readTenderingLabels } from "../tendering-labels";
import {
  getTenderingAttentionSummary,
  getTenderingCreateReadiness,
  getTenderingLoadNotices,
  getTenderingStageReadiness,
  matchesTenderDueFilter,
  matchesTenderProbabilityBand,
  matchesTenderValueBand,
  type TenderingAttentionState,
  type TenderingDueFilter,
  type TenderingLoadNotice
} from "./tendering-page-helpers";

type ReferenceData = {
  clients: Array<{ id: string; name: string }>;
  contacts: Array<{ id: string; firstName: string; lastName: string; client?: { id: string; name: string } | null; email?: string | null; phone?: string | null }>;
  sites: Array<{ id: string; name: string }>;
  users: Array<{ id: string; firstName: string; lastName: string }>;
};

type TenderRecord = {
  id: string;
  tenderNumber: string;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  probability?: number | null;
  estimatedValue?: string | null;
  dueDate?: string | null;
  proposedStartDate?: string | null;
  leadTimeDays?: number | null;
  description?: string | null;
  notes?: string | null;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  sourceJob?: { id: string; jobNumber: string; name: string; status: string } | null;
  tenderClients: Array<{
    id: string;
    client: { id: string; name: string };
    contact?: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null } | null;
    isAwarded: boolean;
    contractIssued?: boolean;
    contractIssuedAt?: string | null;
    relationshipType?: string | null;
    notes?: string | null;
  }>;
  tenderNotes: Array<{ id: string; body: string; createdAt?: string; updatedAt?: string; author?: { id: string; firstName: string; lastName: string } | null }>;
  clarifications: Array<{ id: string; subject: string; status: string; dueDate?: string | null; response?: string | null; createdAt?: string; updatedAt?: string }>;
  followUps: Array<{ id: string; details: string; status: string; dueAt?: string | null; createdAt?: string; updatedAt?: string; assignedUser?: { id: string; firstName: string; lastName: string } | null }>;
  pricingSnapshots?: Array<{ id: string; versionLabel: string; estimatedValue?: string | null; marginPercent?: string | null; assumptions?: string | null }>;
  outcomes?: Array<{ id: string; outcomeType: string; notes?: string | null; createdAt?: string; updatedAt?: string }>;
  tenderDocuments?: Array<{
    id: string;
    category: string;
    title: string;
    createdAt?: string;
    updatedAt?: string;
    fileLink?: { webUrl: string; name: string } | null;
  }>;
};

type TenderActivityRecord = {
  id: string;
  sourceId: string;
  activityType: string;
  title: string;
  details?: string | null;
  status: string;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
  assignedUser?: { id: string; firstName: string; lastName: string } | null;
};

type TenderClientDraft = {
  relationshipType: string;
  notes: string;
};

const initialForm = {
  tenderNumber: "",
  title: "",
  status: "DRAFT",
  probability: "50",
  estimatedValue: "",
  dueDate: "",
  proposedStartDate: "",
  leadTimeDays: "",
  description: "",
  estimatorUserId: "",
  tenderClients: [
    { clientId: "", contactId: "", isAwarded: false }
  ] as Array<{ clientId: string; contactId: string; isAwarded: boolean }>,
  tenderNotes: [{ body: "" }],
  clarifications: [{ subject: "", status: "OPEN" }],
  followUps: [{ dueAt: "", details: "", status: "OPEN" }]
};

const initialConversionForm = {
  jobNumber: "",
  name: "",
  description: "",
  siteId: "",
  projectManagerId: "",
  supervisorId: "",
  carryTenderDocuments: true
};

const initialEditForm = {
  title: "",
  status: "DRAFT",
  probability: "0",
  estimatedValue: "",
  dueDate: "",
  proposedStartDate: "",
  leadTimeDays: "",
  description: "",
  estimatorUserId: ""
};

type TenderStatusFilter = "ALL" | "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED";
type TenderTab = "overview" | "activity" | "documents" | "conversion";
type TenderRegisterView = "board" | "list" | "forecast";
type TenderAttentionFilter = "ALL" | "NEEDS_ATTENTION" | "ROTTING" | "ON_TRACK";
type TenderClientFilter = "ALL" | string;
type TenderContactFilter = "ALL" | string;
type TenderValueBandFilter = "ALL" | "UNDER_100K" | "BETWEEN_100K_500K" | "OVER_500K";
type TenderProbabilityBandFilter = "ALL" | "UNDER_40" | "BETWEEN_40_70" | "OVER_70";
type TenderSortOption = "NEXT_ACTION" | "DUE_DATE" | "VALUE_DESC" | "PROBABILITY_DESC" | "STAGE_AGE_DESC";
type TenderActivityView = "ALL" | "OPEN" | "OVERDUE" | "COMPLETED" | "MY_OPEN";

const tenderFlow = [
  { key: "DRAFT", label: "Draft" },
  { key: "IN_PROGRESS", label: "Estimating" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "AWARDED", label: "Awarded" },
  { key: "CONTRACT_ISSUED", label: "Contract" },
  { key: "CONVERTED", label: "Converted" }
] as const;

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  return new Date(value).toLocaleDateString();
}

function formatCurrency(value?: string | null) {
  if (!value) return "$0";
  const amount = Number(value);
  if (Number.isNaN(amount)) return value;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(amount);
}

function getDueTone(value?: string | null) {
  if (!value) return "blue";
  const dueTime = new Date(value).getTime();
  if (Number.isNaN(dueTime)) return "blue";
  return dueTime < Date.now() ? "amber" : "blue";
}

function getTenderStage(tender: TenderRecord) {
  if (tender.sourceJob) return "CONVERTED";
  if (tender.tenderClients.some((item) => item.contractIssued)) return "CONTRACT_ISSUED";
  if (tender.tenderClients.some((item) => item.isAwarded)) return "AWARDED";
  if (tender.status === "SUBMITTED") return "SUBMITTED";
  if (tender.status === "IN_PROGRESS") return "IN_PROGRESS";
  return "DRAFT";
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatMonthYear(value?: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unscheduled";
  return date.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });
}

function getAttentionPillClass(state: TenderingAttentionState) {
  if (state === "rotting") return "pill--red";
  if (state === "watch") return "pill--amber";
  return "pill--green";
}

function getAttentionLabel(state: TenderingAttentionState) {
  if (state === "rotting") return "Rotting";
  if (state === "watch") return "Needs attention";
  return "On track";
}

function normalizeStakeholderRoleLabel(value?: string | null, fallback = "Stakeholder") {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "primary client") return "Primary client";
  if (normalized === "procurement contact") return "Procurement";
  if (normalized === "approver") return "Approver";
  if (normalized === "reviewer") return "Reviewer";
  if (normalized === "awarded party") return "Awarded party";
  if (normalized === "delivery stakeholder") return "Delivery";
  return value?.trim() || fallback;
}

function handleTenderInteractiveKeyDown(
  event: React.KeyboardEvent<HTMLElement>,
  actions: { onSelect: () => void; onOpen?: () => void }
) {
  if (event.key === "Enter") {
    event.preventDefault();
    void actions.onOpen?.();
    if (!actions.onOpen) {
      actions.onSelect();
    }
  }

  if (event.key === " ") {
    event.preventDefault();
    actions.onSelect();
  }
}

function stopTenderCardActionEvent(event: React.MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function shouldSkipStakeholderBlurSave(
  event: React.FocusEvent<HTMLElement>,
  tenderClientId: string,
  pendingActionTenderClientId: string | null
) {
  if (pendingActionTenderClientId === tenderClientId) {
    return true;
  }

  const relatedTarget = event.relatedTarget;
  return relatedTarget instanceof HTMLElement
    ? relatedTarget.closest(`[data-stakeholder-actions="${tenderClientId}"]`) !== null
    : false;
}

function buildStageReadinessInput(tender: {
  dueDate?: string | null;
  estimatedValue?: string | null;
  estimator?: { id: string } | null;
  tenderClients: Array<{ isAwarded: boolean; contractIssued?: boolean }>;
  description?: string | null;
  notes?: string | null;
}) {
  return {
    dueDate: tender.dueDate,
    estimatedValue: tender.estimatedValue,
    estimatorUserId: tender.estimator?.id ?? null,
    linkedClientCount: tender.tenderClients.length,
    awardedClientCount: tender.tenderClients.filter((item) => item.isAwarded).length,
    contractIssuedCount: tender.tenderClients.filter((item) => item.contractIssued).length,
    commercialSummary: tender.notes || tender.description || null
  };
}

type TendersPageProps = {
  mode?: "full" | "workspace" | "create";
};

type BoardDropLifecycleStage = "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED";

type PendingBoardStageDrop = {
  tender: TenderRecord;
  nextStage: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED";
  selectedClientId: string;
  mode: "confirm-archive" | "confirm-convert" | "select-client" | "confirm-client";
  promptTargetStage: "AWARDED" | "CONTRACT_ISSUED";
  actionType: "forward-lifecycle" | "rollback-lifecycle";
};

type ArchivedConversionPrompt = {
  source: "board" | "workspace";
  tender: TenderRecord;
  payload: {
    jobNumber: string;
    name: string;
    description?: string;
    siteId?: string;
    projectManagerId?: string;
    supervisorId?: string;
    carryTenderDocuments?: boolean;
    tenderDocumentIds?: string[];
    archivedJobId?: string;
  };
  stageName: string;
  mode: "confirm-new-stage" | "name-stage" | "change-details";
};

export function TendersPage({ mode = "full" }: TendersPageProps) {
  const { authFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const labels = readTenderingLabels();
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [selectedTender, setSelectedTender] = useState<TenderRecord | null>(null);
  const [references, setReferences] = useState<ReferenceData>({ clients: [], contacts: [], sites: [], users: [] });
  const [form, setForm] = useState(initialForm);
  const [editForm, setEditForm] = useState(initialEditForm);
  const [conversionForm, setConversionForm] = useState(initialConversionForm);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [latestJob, setLatestJob] = useState<{ id: string; jobNumber: string; name: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadNotices, setLoadNotices] = useState<TenderingLoadNotice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TenderStatusFilter>("ALL");
  const [attentionFilter, setAttentionFilter] = useState<TenderAttentionFilter>("ALL");
  const [estimatorFilter, setEstimatorFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState<TenderingDueFilter>("ALL");
  const [valueBandFilter, setValueBandFilter] = useState<TenderValueBandFilter>("ALL");
  const [probabilityBandFilter, setProbabilityBandFilter] = useState<TenderProbabilityBandFilter>("ALL");
  const [clientFilter, setClientFilter] = useState<TenderClientFilter>("ALL");
  const [contactFilter, setContactFilter] = useState<TenderContactFilter>("ALL");
  const [sortOption, setSortOption] = useState<TenderSortOption>("NEXT_ACTION");
  const [forecastStartIndex, setForecastStartIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<TenderTab>("overview");
  const [registerView, setRegisterView] = useState<TenderRegisterView>("board");
  const [documentForm, setDocumentForm] = useState({
    category: "Submission",
    title: "",
    fileName: ""
  });
  const [activities, setActivities] = useState<TenderActivityRecord[]>([]);
  const [quickActivity, setQuickActivity] = useState({
    activityType: "FOLLOW_UP",
    title: "",
    details: "",
    dueAt: "",
    assignedUserId: ""
  });
  const [quickNote, setQuickNote] = useState("");
  const [quickClarification, setQuickClarification] = useState({ subject: "", dueDate: "" });
  const [quickFollowUp, setQuickFollowUp] = useState({ details: "", dueAt: "" });
  const [activityView, setActivityView] = useState<TenderActivityView>("ALL");
  const [activityOwnerFilter, setActivityOwnerFilter] = useState("ALL");
  const [importCsv, setImportCsv] = useState("");
  const [importPreview, setImportPreview] = useState<Array<{ rowNumber: number; tenderNumber: string; title: string; clientNames: string[]; valid: boolean; duplicate?: boolean }>>([]);
  const [importResult, setImportResult] = useState<{ createdCount: number; skipped: Array<{ tenderNumber: string; reason: string }> } | null>(null);
  const [draggedTenderId, setDraggedTenderId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<"DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED" | null>(null);
  const dragOverStageRef = useRef<"DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED" | null>(null);
  const [pendingBoardDrop, setPendingBoardDrop] = useState<PendingBoardStageDrop | null>(null);
  const [archivedConversionPrompt, setArchivedConversionPrompt] = useState<ArchivedConversionPrompt | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [stakeholderDrafts, setStakeholderDrafts] = useState<Record<string, TenderClientDraft>>({});
  const [savingStakeholderIds, setSavingStakeholderIds] = useState<string[]>([]);
  const stakeholderBlurActionRef = useRef<string | null>(null);

  const awardedCount = useMemo(
    () => form.tenderClients.filter((item) => item.isAwarded && item.clientId).length,
    [form.tenderClients]
  );

  const selectedCreateClients = useMemo(
    () =>
      form.tenderClients
        .map((item) => references.clients.find((client) => client.id === item.clientId)?.name)
        .filter((value): value is string => Boolean(value)),
    [form.tenderClients, references.clients]
  );

  const selectedCreateContacts = useMemo(
    () =>
      form.tenderClients
        .map((item) => {
          const contact = references.contacts.find((entry) => entry.id === item.contactId);
          return contact ? `${contact.firstName} ${contact.lastName}` : null;
        })
        .filter((value): value is string => Boolean(value)),
    [form.tenderClients, references.contacts]
  );

  const load = async () => {
    const [
      tendersResult,
      clientsResult,
      contactsResult,
      sitesResult,
      usersResult,
      jobsResult
    ] = await Promise.allSettled([
      authFetch("/tenders?page=1&pageSize=100"),
      authFetch("/master-data/clients?page=1&pageSize=100"),
      authFetch("/master-data/contacts?page=1&pageSize=100"),
      authFetch("/master-data/sites?page=1&pageSize=100"),
      authFetch("/users?page=1&pageSize=100"),
      authFetch("/jobs?page=1&pageSize=5")
    ]);

    const tendersResponse = tendersResult.status === "fulfilled" ? tendersResult.value : null;
    const clientsResponse = clientsResult.status === "fulfilled" ? clientsResult.value : null;
    const contactsResponse = contactsResult.status === "fulfilled" ? contactsResult.value : null;
    const sitesResponse = sitesResult.status === "fulfilled" ? sitesResult.value : null;
    const usersResponse = usersResult.status === "fulfilled" ? usersResult.value : null;
    const jobsResponse = jobsResult.status === "fulfilled" ? jobsResult.value : null;

    if (!tendersResponse?.ok || !clientsResponse?.ok || !contactsResponse?.ok) {
      throw new Error("Unable to load tendering data.");
    }

    const tendersData = await tendersResponse.json();
    const clientsData = await clientsResponse.json();
    const contactsData = await contactsResponse.json();
    const sitesData = sitesResponse?.ok ? await sitesResponse.json() : { items: [] };
    const usersData = usersResponse?.ok ? await usersResponse.json() : { items: [] };
    const jobsData = jobsResponse?.ok ? await jobsResponse.json() : { items: [] };
    const notices = getTenderingLoadNotices({
      jobsAvailable: Boolean(jobsResponse?.ok),
      sitesAvailable: Boolean(sitesResponse?.ok),
      usersAvailable: Boolean(usersResponse?.ok)
    });

    setTenders(tendersData.items);
    setReferences({
      clients: clientsData.items,
      contacts: contactsData.items,
      sites: sitesData.items ?? [],
      users: usersData.items ?? []
    });
    setLatestJob(jobsData.items?.[0] ?? null);
    setLoadNotices(notices);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  useEffect(() => {
    const requestedTenderId = searchParams.get("tenderId");
    if (!requestedTenderId || !tenders.length) return;
    if (selectedTender?.id === requestedTenderId) return;

    const requestedTender = tenders.find((item) => item.id === requestedTenderId);
    if (requestedTender) {
      void selectTender(requestedTenderId);
    }
  }, [searchParams, selectedTender?.id, tenders]);

  const selectTender = async (id: string, options?: { activeTab?: TenderTab }) => {
    const [response, activitiesResponse] = await Promise.all([
      authFetch(`/tenders/${id}`),
      authFetch(`/tenders/${id}/activities`)
    ]);
    if (!response.ok) {
      return;
    }
    const tender = (await response.json()) as TenderRecord;
    const unifiedActivities = activitiesResponse.ok ? ((await activitiesResponse.json()) as TenderActivityRecord[]) : [];
    setSelectedTender(tender);
    setActivities(unifiedActivities);
    setSelectedDocumentIds(tender.tenderDocuments?.map((item) => item.id) ?? []);
    setActiveTab(options?.activeTab ?? "overview");
    setQuickActivity({
      activityType: "FOLLOW_UP",
      title: "",
      details: "",
      dueAt: "",
      assignedUserId: ""
    });
    setEditForm({
      title: tender.title,
      status: tender.status,
      probability: String(tender.probability ?? 0),
      estimatedValue: tender.estimatedValue ?? "",
      dueDate: tender.dueDate ? tender.dueDate.slice(0, 10) : "",
      proposedStartDate: tender.proposedStartDate ? tender.proposedStartDate.slice(0, 10) : "",
      leadTimeDays: tender.leadTimeDays ? String(tender.leadTimeDays) : "",
      description: tender.description ?? "",
      estimatorUserId: tender.estimator?.id ?? ""
    });
    setConversionForm({
      jobNumber: tender.sourceJob?.jobNumber ?? tender.tenderNumber.replace("TEN", "JOB"),
      name: tender.sourceJob?.name ?? tender.title,
      description: tender.description ?? "",
      siteId: "",
      projectManagerId: "",
      supervisorId: "",
      carryTenderDocuments: true
    });
  };

  const openTenderWorkspace = async (id: string, targetTab?: TenderTab) => {
    if (mode === "full") {
      setIsWorkspaceModalOpen(true);
    }
    await selectTender(id, { activeTab: targetTab });
  };

  const closeTenderWorkspace = () => {
    if (mode === "full") {
      setIsWorkspaceModalOpen(false);
    }
  };

  useEffect(() => {
    if (!selectedTender) {
      setStakeholderDrafts({});
      return;
    }

    setStakeholderDrafts(
      Object.fromEntries(
        selectedTender.tenderClients.map((item) => [
          item.id,
          {
            relationshipType: item.relationshipType ?? "",
            notes: item.notes ?? ""
          }
        ])
      )
    );
  }, [selectedTender]);

  const updateClient = (index: number, patch: Partial<{ clientId: string; contactId: string; isAwarded: boolean }>) => {
    const next = [...form.tenderClients];
    next[index] = { ...next[index], ...patch };

    if (patch.isAwarded) {
      next.forEach((item, itemIndex) => {
        if (itemIndex !== index) item.isAwarded = false;
      });
    }

    setForm({ ...form, tenderClients: next });
  };

  const updateSelectedTenderClient = async (
    tenderClientId: string,
    patch: Partial<{ contactId: string; isAwarded: boolean; relationshipType: string; notes: string }>
  ) => {
    if (!selectedTender) return;

    const nextTenderClients = selectedTender.tenderClients.map((item) => {
      const nextItem = item.id === tenderClientId
        ? {
            ...item,
            isAwarded: patch.isAwarded ?? item.isAwarded,
            contact: patch.contactId
              ? references.contacts.find((contact) => contact.id === patch.contactId) ?? null
              : patch.contactId === ""
                ? null
                : item.contact,
            relationshipType: patch.relationshipType ?? item.relationshipType,
            notes: patch.notes ?? item.notes
          }
        : {
            ...item,
            isAwarded: patch.isAwarded ? false : item.isAwarded
          };

      return nextItem;
    });

    const response = await authFetch(`/tenders/${selectedTender.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        tenderNumber: selectedTender.tenderNumber,
        title: editForm.title,
        description: editForm.description || undefined,
        estimatorUserId: editForm.estimatorUserId || undefined,
        status: editForm.status,
        probability: Number(editForm.probability),
        estimatedValue: editForm.estimatedValue || undefined,
        dueDate: editForm.dueDate || undefined,
        proposedStartDate: editForm.proposedStartDate || undefined,
        leadTimeDays: editForm.leadTimeDays ? Number(editForm.leadTimeDays) : undefined,
        tenderClients: nextTenderClients.map((item) => ({
          clientId: item.client.id,
          contactId: item.contact?.id,
          isAwarded: item.isAwarded,
          relationshipType: item.relationshipType || undefined,
          notes: item.notes || undefined
        })),
        tenderNotes: selectedTender.tenderNotes.map((item) => ({ body: item.body })),
        clarifications: selectedTender.clarifications.map((item) => ({
          subject: item.subject,
          response: item.response || undefined,
          status: item.status,
          dueDate: item.dueDate || undefined
        })),
        followUps: selectedTender.followUps
          .filter((item) => item.dueAt)
          .map((item) => ({
            details: item.details,
            dueAt: item.dueAt!,
            status: item.status
          })),
        outcomes: selectedTender.outcomes?.map((item) => ({
          outcomeType: item.outcomeType,
          notes: item.notes || undefined
        }))
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update tender client.");
      return;
    }

    await load();
    await selectTender(selectedTender.id);
  };

  const updateStakeholderDraft = (tenderClientId: string, patch: Partial<TenderClientDraft>) => {
    setStakeholderDrafts((current) => ({
      ...current,
      [tenderClientId]: {
        relationshipType: current[tenderClientId]?.relationshipType ?? "",
        notes: current[tenderClientId]?.notes ?? "",
        ...patch
      }
    }));
  };

  const saveStakeholderDraft = async (tenderClientId: string) => {
    if (!selectedTender) return;

    const stakeholder = selectedTender.tenderClients.find((item) => item.id === tenderClientId);
    const draft = stakeholderDrafts[tenderClientId];
    if (!stakeholder || !draft) return;

    const normalizedRelationshipType = draft.relationshipType.trim();
    const normalizedNotes = draft.notes.trim();
    const currentRelationshipType = stakeholder.relationshipType?.trim() ?? "";
    const currentNotes = stakeholder.notes?.trim() ?? "";
    const hasChanges =
      normalizedRelationshipType !== currentRelationshipType ||
      normalizedNotes !== currentNotes;

    if (!hasChanges) return;

    setSavingStakeholderIds((current) => [...current, tenderClientId]);
    try {
      await updateSelectedTenderClient(tenderClientId, {
        relationshipType: normalizedRelationshipType,
        notes: normalizedNotes
      });
    } finally {
      setSavingStakeholderIds((current) => current.filter((id) => id !== tenderClientId));
    }
  };

  const resetStakeholderDraft = (tenderClientId: string) => {
    if (!selectedTender) return;

    const stakeholder = selectedTender.tenderClients.find((item) => item.id === tenderClientId);
    if (!stakeholder) return;

    setStakeholderDrafts((current) => ({
      ...current,
      [tenderClientId]: {
        relationshipType: stakeholder.relationshipType ?? "",
        notes: stakeholder.notes ?? ""
      }
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (awardedCount > 1) {
      setError("Only one client can be marked awarded.");
      return;
    }

    const payload = {
      tenderNumber: form.tenderNumber,
      title: form.title,
      description: form.description || undefined,
      estimatorUserId: form.estimatorUserId || undefined,
      status: form.status,
      probability: Number(form.probability),
      estimatedValue: form.estimatedValue || undefined,
      dueDate: form.dueDate || undefined,
      proposedStartDate: form.proposedStartDate || undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      tenderClients: form.tenderClients
        .filter((item) => item.clientId)
        .map((item) => ({
          clientId: item.clientId,
          contactId: item.contactId || undefined,
          isAwarded: item.isAwarded
        })),
      tenderNotes: form.tenderNotes.filter((item) => item.body),
      clarifications: form.clarifications.filter((item) => item.subject),
      followUps: form.followUps.filter((item) => item.dueAt && item.details)
    };

    const response = await authFetch("/tenders", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      setError("Unable to save tender.");
      return;
    }

    setForm(initialForm);
    await load();
  };

  const submitDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTender) return;

    const response = await authFetch(`/tenders/${selectedTender.id}/documents`, {
      method: "POST",
      body: JSON.stringify(documentForm)
    });

    if (!response.ok) {
      setError("Unable to save tender document.");
      return;
    }

    setDocumentForm({ category: "Submission", title: "", fileName: "" });
    await selectTender(selectedTender.id);
  };

  const runLifecycleAction = async (
    path: string,
    payload: Record<string, unknown>,
    failureMessage: string
  ) => {
    if (!selectedTender) return;

    const response = await authFetch(path, {
      method: path.includes("convert") ? "POST" : "PATCH",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      if (
        path.includes("convert-to-job") &&
        body?.message === "A job with this number and source tender already exists."
      ) {
        setArchivedConversionPrompt({
          source: "workspace",
          tender: selectedTender,
          payload: {
            ...(payload as ArchivedConversionPrompt["payload"]),
            archivedJobId:
              typeof body?.archivedJobId === "string" ? body.archivedJobId : undefined
          },
          stageName: "",
          mode: "confirm-new-stage"
        });
        return;
      }
      setError(body?.message ?? failureMessage);
      return;
    }

    const result = await response.json();
    if (path.includes("convert")) {
      setLatestJob(result);
    }

    await load();
    await selectTender(selectedTender.id);
  };

  const submitQuickActivity = async (path: string, payload: Record<string, unknown>, reset: () => void) => {
    if (!selectedTender) return;

    const response = await authFetch(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save tender activity.");
      return;
    }

    reset();
    await selectTender(selectedTender.id);
    await load();
  };

  const submitUnifiedActivity = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTender) return;

    const response = await authFetch(`/tenders/${selectedTender.id}/activities`, {
      method: "POST",
      body: JSON.stringify({
        activityType: quickActivity.activityType,
        title: quickActivity.title,
        details: quickActivity.details || undefined,
        dueAt: quickActivity.dueAt || undefined,
        assignedUserId: quickActivity.assignedUserId || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to save tender activity.");
      return;
    }

    setQuickActivity({
      activityType: "FOLLOW_UP",
      title: "",
      details: "",
      dueAt: "",
      assignedUserId: ""
    });
    await selectTender(selectedTender.id);
    await load();
  };

  const updateUnifiedActivity = async (
    activityId: string,
    payload: Partial<Pick<TenderActivityRecord, "status" | "dueAt" | "details">>
  ) => {
    if (!selectedTender) return;

    const response = await authFetch(`/tenders/${selectedTender.id}/activities/${encodeURIComponent(activityId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update tender activity.");
      return;
    }

    await selectTender(selectedTender.id);
    await load();
  };

  const previewImport = async () => {
    const response = await authFetch("/tenders/import/preview", {
      method: "POST",
      body: JSON.stringify({ csvText: importCsv })
    });

    if (!response.ok) {
      setError("Unable to preview tender import.");
      return;
    }

    const body = await response.json();
    setImportPreview(body.rows ?? []);
    setImportResult(null);
  };

  const commitImport = async () => {
    const response = await authFetch("/tenders/import/commit", {
      method: "POST",
      body: JSON.stringify({ csvText: importCsv })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to import tenders.");
      return;
    }

    const body = await response.json();
    setImportResult({ createdCount: body.createdCount ?? 0, skipped: body.skipped ?? [] });
    setImportCsv("");
    setImportPreview([]);
    await load();
  };

  const saveSelectedTender = async () => {
    if (!selectedTender) return;

    if (["AWARDED", "CONTRACT_ISSUED", "CONVERTED"].includes(editForm.status)) {
      setError("Use the award, contract, and conversion actions to move into those lifecycle stages.");
      return;
    }

    const readiness = getTenderingStageReadiness({
      nextStage: editForm.status as "DRAFT" | "IN_PROGRESS" | "SUBMITTED",
      dueDate: editForm.dueDate || null,
      estimatedValue: editForm.estimatedValue || null,
      estimatorUserId: editForm.estimatorUserId || null,
      linkedClientCount: selectedTender.tenderClients.length,
      awardedClientCount: selectedTender.tenderClients.filter((item) => item.isAwarded).length,
      contractIssuedCount: selectedTender.tenderClients.filter((item) => item.contractIssued).length,
      commercialSummary: editForm.description || selectedTender.notes || null
    });
    if (!readiness.canProceed) {
      setError(readiness.blockers[0] ?? "This tender is not ready for that stage.");
      return;
    }

    const response = await authFetch(`/tenders/${selectedTender.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        tenderNumber: selectedTender.tenderNumber,
        title: editForm.title,
        description: editForm.description || undefined,
        estimatorUserId: editForm.estimatorUserId || undefined,
        status: editForm.status,
        probability: Number(editForm.probability),
        estimatedValue: editForm.estimatedValue || undefined,
        dueDate: editForm.dueDate || undefined,
        proposedStartDate: editForm.proposedStartDate || undefined,
        leadTimeDays: editForm.leadTimeDays ? Number(editForm.leadTimeDays) : undefined,
        tenderClients: selectedTender.tenderClients.map((item) => ({
          clientId: item.client.id,
          contactId: item.contact?.id,
          isAwarded: item.isAwarded,
          relationshipType: item.relationshipType || undefined,
          notes: item.notes || undefined
        })),
        tenderNotes: selectedTender.tenderNotes.map((item) => ({ body: item.body })),
        clarifications: selectedTender.clarifications.map((item) => ({
          subject: item.subject,
          response: item.response || undefined,
          status: item.status,
          dueDate: item.dueDate || undefined
        })),
        followUps: selectedTender.followUps
          .filter((item) => item.dueAt)
          .map((item) => ({
            details: item.details,
            dueAt: item.dueAt!,
            status: item.status
          })),
        outcomes: selectedTender.outcomes?.map((item) => ({
          outcomeType: item.outcomeType,
          notes: item.notes || undefined
        }))
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to update tender.");
      return;
    }

    await load();
    await selectTender(selectedTender.id);
  };

  const filteredTenders = useMemo(() => {
    return tenders.filter((tender) => {
      const stage = getTenderStage(tender);
      const attention = getTenderingAttentionSummary({
        stage,
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
        dueDate: tender.dueDate,
        contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
        tenderNotes: tender.tenderNotes,
        clarifications: tender.clarifications,
        followUps: tender.followUps,
        tenderDocuments: tender.tenderDocuments,
        outcomes: tender.outcomes
      });
      const matchesStatus = statusFilter === "ALL" || stage === statusFilter;
      const matchesEstimator =
        estimatorFilter === "ALL"
          ? true
          : estimatorFilter === "UNASSIGNED"
            ? !tender.estimator?.id
            : tender.estimator?.id === estimatorFilter;
      const matchesDue = matchesTenderDueFilter(tender.dueDate, dueFilter);
      const matchesValueBand = matchesTenderValueBand(tender.estimatedValue, valueBandFilter);
      const matchesProbabilityBand = matchesTenderProbabilityBand(tender.probability, probabilityBandFilter);
      const matchesClient = clientFilter === "ALL" ? true : tender.tenderClients.some((item) => item.client.id === clientFilter);
      const matchesContact =
        contactFilter === "ALL"
          ? true
          : tender.tenderClients.some((item) => item.contact?.id === contactFilter);
      const haystack = [
        tender.tenderNumber,
        tender.title,
        tender.tenderClients.map((item) => item.client.name).join(" "),
        tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : ""
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = search.trim() ? haystack.includes(search.trim().toLowerCase()) : true;
      const matchesAttention =
        attentionFilter === "ALL"
          ? true
          : attentionFilter === "NEEDS_ATTENTION"
            ? attention.needsAttention
            : attentionFilter === "ROTTING"
              ? attention.attentionState === "rotting"
              : attention.attentionState === "healthy";

      return matchesStatus && matchesEstimator && matchesDue && matchesValueBand && matchesProbabilityBand && matchesClient && matchesContact && matchesSearch && matchesAttention;
    }).sort((left, right) => {
      const leftAttention = getTenderingAttentionSummary({
        stage: getTenderStage(left),
        createdAt: left.createdAt,
        updatedAt: left.updatedAt,
        dueDate: left.dueDate,
        contractIssuedAt: left.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
        tenderNotes: left.tenderNotes,
        clarifications: left.clarifications,
        followUps: left.followUps,
        tenderDocuments: left.tenderDocuments,
        outcomes: left.outcomes
      });
      const rightAttention = getTenderingAttentionSummary({
        stage: getTenderStage(right),
        createdAt: right.createdAt,
        updatedAt: right.updatedAt,
        dueDate: right.dueDate,
        contractIssuedAt: right.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
        tenderNotes: right.tenderNotes,
        clarifications: right.clarifications,
        followUps: right.followUps,
        tenderDocuments: right.tenderDocuments,
        outcomes: right.outcomes
      });

      if (sortOption === "VALUE_DESC") return Number(right.estimatedValue ?? 0) - Number(left.estimatedValue ?? 0);
      if (sortOption === "PROBABILITY_DESC") return Number(right.probability ?? 0) - Number(left.probability ?? 0);
      if (sortOption === "STAGE_AGE_DESC") return rightAttention.stageAgeDays - leftAttention.stageAgeDays;

      const leftDate = new Date(
        (sortOption === "NEXT_ACTION" ? leftAttention.nextActionAt : left.dueDate) ?? "9999-12-31"
      ).getTime();
      const rightDate = new Date(
        (sortOption === "NEXT_ACTION" ? rightAttention.nextActionAt : right.dueDate) ?? "9999-12-31"
      ).getTime();

      return leftDate - rightDate;
    });
  }, [attentionFilter, clientFilter, contactFilter, dueFilter, estimatorFilter, probabilityBandFilter, search, sortOption, statusFilter, tenders, valueBandFilter]);

  const selectedTenderStage = selectedTender ? getTenderStage(selectedTender) : "DRAFT";
  const selectedTenderFlowIndex = tenderFlow.findIndex((item) => item.key === selectedTenderStage);
  const activityTimeline = useMemo(() => {
    if (!selectedTender) return [];

    return [
      ...selectedTender.tenderNotes.map((item) => ({
        id: `note-${item.id}`,
        type: "Note",
        title: item.body,
        date: undefined,
        tone: "blue"
      })),
      ...selectedTender.clarifications.map((item) => ({
        id: `clarification-${item.id}`,
        type: "Clarification",
        title: item.subject,
        date: item.dueDate,
        tone: item.status === "CLOSED" ? "green" : "amber"
      })),
      ...selectedTender.followUps.map((item) => ({
        id: `followup-${item.id}`,
        type: "Follow-up",
        title: item.details,
        date: item.dueAt,
        tone: item.status === "DONE" ? "green" : "amber"
      })),
      ...(selectedTender.outcomes ?? []).map((item) => ({
        id: `outcome-${item.id}`,
        type: "Outcome",
        title: item.outcomeType,
        date: undefined,
        tone: "green"
      })),
      ...(selectedTender.tenderDocuments ?? []).map((item) => ({
        id: `document-${item.id}`,
        type: "Document",
        title: item.title,
        date: undefined,
        tone: "blue"
      }))
    ].sort((left, right) => {
      const leftTime = left.date ? new Date(left.date).getTime() : 0;
      const rightTime = right.date ? new Date(right.date).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [selectedTender]);

  const boardColumns = useMemo(() => {
    return tenderFlow.map((column) => ({
      ...column,
      items: tenders.filter((tender) => {
        const stage = getTenderStage(tender);
        const attention = getTenderingAttentionSummary({
          stage,
          createdAt: tender.createdAt,
          updatedAt: tender.updatedAt,
          dueDate: tender.dueDate,
          contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
          tenderNotes: tender.tenderNotes,
          clarifications: tender.clarifications,
          followUps: tender.followUps,
          tenderDocuments: tender.tenderDocuments,
          outcomes: tender.outcomes
        });
        const matchesSearch = search.trim()
          ? [
              tender.tenderNumber,
              tender.title,
              tender.tenderClients.map((item) => item.client.name).join(" "),
              tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : ""
            ]
              .join(" ")
              .toLowerCase()
              .includes(search.trim().toLowerCase())
          : true;
        const matchesEstimator =
          estimatorFilter === "ALL"
            ? true
            : estimatorFilter === "UNASSIGNED"
              ? !tender.estimator?.id
              : tender.estimator?.id === estimatorFilter;
        const matchesDue = matchesTenderDueFilter(tender.dueDate, dueFilter);
        const matchesValueBand = matchesTenderValueBand(tender.estimatedValue, valueBandFilter);
        const matchesProbabilityBand = matchesTenderProbabilityBand(tender.probability, probabilityBandFilter);
        const matchesClient = clientFilter === "ALL" ? true : tender.tenderClients.some((item) => item.client.id === clientFilter);
        const matchesContact =
          contactFilter === "ALL"
            ? true
            : tender.tenderClients.some((item) => item.contact?.id === contactFilter);
        const matchesAttention =
          attentionFilter === "ALL"
            ? true
            : attentionFilter === "NEEDS_ATTENTION"
              ? attention.needsAttention
              : attentionFilter === "ROTTING"
                ? attention.attentionState === "rotting"
                : attention.attentionState === "healthy";

        if (statusFilter !== "ALL" && statusFilter !== column.key) {
          return false;
        }

        return stage === column.key && matchesSearch && matchesEstimator && matchesDue && matchesValueBand && matchesProbabilityBand && matchesClient && matchesContact && matchesAttention;
      })
    }));
  }, [attentionFilter, clientFilter, contactFilter, dueFilter, estimatorFilter, probabilityBandFilter, search, statusFilter, tenders, valueBandFilter]);

  const registerKpis = useMemo(() => {
    const openFollowUps = tenders.reduce((total, tender) => total + tender.followUps.filter((item) => item.status !== "DONE").length, 0);
    const attentionSummaries = tenders.map((tender) =>
      getTenderingAttentionSummary({
        stage: getTenderStage(tender),
        createdAt: tender.createdAt,
        updatedAt: tender.updatedAt,
        dueDate: tender.dueDate,
        contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
        tenderNotes: tender.tenderNotes,
        clarifications: tender.clarifications,
        followUps: tender.followUps,
        tenderDocuments: tender.tenderDocuments,
        outcomes: tender.outcomes
      })
    );

    return {
      total: tenders.length,
      submitted: tenders.filter((tender) => getTenderStage(tender) === "SUBMITTED").length,
      awarded: tenders.filter((tender) => getTenderStage(tender) === "AWARDED" || getTenderStage(tender) === "CONTRACT_ISSUED").length,
      openFollowUps,
      needsAttention: attentionSummaries.filter((item) => item.needsAttention).length,
      rotting: attentionSummaries.filter((item) => item.attentionState === "rotting").length
    };
  }, [tenders]);

  const forecastColumns = useMemo(() => {
    const monthMap = new Map<string, TenderRecord[]>();

    filteredTenders.forEach((tender) => {
      const bucketDate = tender.dueDate ?? tender.proposedStartDate ?? null;
      const date = bucketDate ? new Date(bucketDate) : null;
      const key = date && !Number.isNaN(date.getTime())
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : "unscheduled";
      const current = monthMap.get(key) ?? [];
      current.push(tender);
      monthMap.set(key, current);
    });

    return [...monthMap.entries()]
      .sort(([left], [right]) => {
        if (left === "unscheduled") return 1;
        if (right === "unscheduled") return -1;
        return left.localeCompare(right);
      })
      .map(([key, items]) => ({
        key,
        label: key === "unscheduled" ? "Unscheduled" : formatMonthYear(`${key}-01`),
        items,
        totalValue: items.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0),
        weightedValue: items.reduce(
          (sum, tender) => sum + Number(tender.estimatedValue ?? 0) * ((tender.probability ?? 0) / 100),
          0
        )
      }));
  }, [filteredTenders]);

  const visibleForecastColumns = useMemo(() => forecastColumns.slice(forecastStartIndex, forecastStartIndex + 4), [forecastColumns, forecastStartIndex]);
  const activeFilterCount = [
    statusFilter !== "ALL",
    attentionFilter !== "ALL",
    estimatorFilter !== "ALL",
    dueFilter !== "ALL",
    valueBandFilter !== "ALL",
    probabilityBandFilter !== "ALL",
    clientFilter !== "ALL",
    contactFilter !== "ALL",
    Boolean(search.trim())
  ].filter(Boolean).length;
  const filteredPipelineValue = useMemo(
    () => filteredTenders.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0),
    [filteredTenders]
  );
  const filteredWeightedValue = useMemo(
    () => filteredTenders.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0) * ((tender.probability ?? 0) / 100), 0),
    [filteredTenders]
  );

  useEffect(() => {
    if (!forecastColumns.length) {
      if (forecastStartIndex !== 0) setForecastStartIndex(0);
      return;
    }

    const maxStart = Math.max(0, forecastColumns.length - 4);
    if (forecastStartIndex > maxStart) {
      setForecastStartIndex(maxStart);
    }
  }, [forecastColumns, forecastStartIndex]);

  const estimatorOptions = useMemo(() => {
    const unique = new Map<string, string>();

    tenders.forEach((tender) => {
      if (tender.estimator?.id) {
        unique.set(tender.estimator.id, `${tender.estimator.firstName} ${tender.estimator.lastName}`);
      }
    });

    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [tenders]);

  const contactOptions = useMemo(() => {
    return references.contacts
      .map((contact) => ({
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        clientName: contact.client?.name ?? ""
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [references.contacts]);

  const showRegister = mode === "full";
  const showWorkspace = mode === "workspace" || (mode === "full" && isWorkspaceModalOpen);
  const showCreate = mode === "create";
  const showWorkspaceShell = mode !== "create";
  const createFollowUpReady = Boolean(form.followUps[0]?.details?.trim() && form.followUps[0]?.dueAt);
  const createClarificationReady = Boolean(form.clarifications[0]?.subject?.trim());
  const createNoteReady = Boolean(form.tenderNotes[0]?.body?.trim());
  const createReadiness = getTenderingCreateReadiness({
    tenderNumber: form.tenderNumber,
    title: form.title,
    hasClarification: createClarificationReady,
    hasFollowUp: createFollowUpReady,
    hasNote: createNoteReady
  });

  const selectedTenderAttention = useMemo(() => {
    if (!selectedTender) return null;

    return getTenderingAttentionSummary({
      stage: getTenderStage(selectedTender),
      createdAt: selectedTender.createdAt,
      updatedAt: selectedTender.updatedAt,
      dueDate: selectedTender.dueDate,
      contractIssuedAt: selectedTender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
      tenderNotes: selectedTender.tenderNotes,
      clarifications: selectedTender.clarifications,
      followUps: selectedTender.followUps,
      tenderDocuments: selectedTender.tenderDocuments,
      outcomes: selectedTender.outcomes
    });
  }, [selectedTender]);
  const selectedRegisterSummary = useMemo(() => {
    if (!selectedTender || !selectedTenderAttention) return null;

    return {
      stageLabel: tenderFlow.find((item) => item.key === getTenderStage(selectedTender))?.label ?? "Draft",
      clientNames: selectedTender.tenderClients.map((item) => item.client.name).join(", ") || "No linked clients",
      nextActionLabel: selectedTenderAttention.nextActionAt ? formatDateTime(selectedTenderAttention.nextActionAt) : "No next action set",
      lastTouchLabel: selectedTenderAttention.lastActivityAt ? formatDateTime(selectedTenderAttention.lastActivityAt) : "No recent touch",
      attentionLabel: getAttentionLabel(selectedTenderAttention.attentionState),
      openItemCount: selectedTenderAttention.openFollowUpCount + selectedTenderAttention.openClarificationCount,
      overdueCount: selectedTenderAttention.overdueFollowUpCount + selectedTenderAttention.overdueClarificationCount
    };
  }, [selectedTender, selectedTenderAttention]);

  const selectedTenderStageReadiness = useMemo(() => {
    if (!selectedTender) return null;

    return getTenderingStageReadiness({
      nextStage: selectedTenderStage,
      ...buildStageReadinessInput(selectedTender)
    });
  }, [selectedTender, selectedTenderStage]);

  const selectedTenderSubmittedReadiness = useMemo(() => {
    if (!selectedTender) return null;

    return getTenderingStageReadiness({
      nextStage: "SUBMITTED",
      ...buildStageReadinessInput(selectedTender)
    });
  }, [selectedTender]);

  const selectedTenderFocusItems = useMemo(() => {
    if (!selectedTender) return { overdue: [], upcoming: [], recent: [] as TenderActivityRecord[] };

    const dueItems = [
      ...selectedTender.followUps
        .filter((item) => item.status !== "DONE")
        .map((item) => ({
          id: `follow-up-${item.id}`,
          kind: "Follow-up",
          title: item.details,
          dueAt: item.dueAt ?? null
        })),
      ...selectedTender.clarifications
        .filter((item) => item.status !== "CLOSED")
        .map((item) => ({
          id: `clarification-${item.id}`,
          kind: "Clarification",
          title: item.subject,
          dueAt: item.dueDate ?? null
        }))
    ].sort((left, right) => {
      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });

    return {
      overdue: dueItems.filter((item) => item.dueAt && new Date(item.dueAt).getTime() < Date.now()),
      upcoming: dueItems.filter((item) => !item.dueAt || new Date(item.dueAt).getTime() >= Date.now()).slice(0, 3),
      recent: activities.slice(0, 3)
    };
  }, [activities, selectedTender]);

  const selectedTenderAwardedClient = selectedTender?.tenderClients.find((item) => item.isAwarded) ?? null;
  const selectedTenderContacts = selectedTender?.tenderClients.filter((item) => item.contact) ?? [];
  const selectedTenderOpenClarifications = selectedTender?.clarifications.filter((item) => item.status !== "CLOSED") ?? [];
  const selectedTenderOpenFollowUps = selectedTender?.followUps.filter((item) => item.status !== "DONE") ?? [];
  const selectedTenderOpenItemCount = selectedTenderOpenClarifications.length + selectedTenderOpenFollowUps.length;
  const selectedTenderPrimaryContact = selectedTenderContacts[0]?.contact ?? null;
  const selectedTenderNextCommitment = selectedTenderFocusItems.upcoming[0] ?? null;
  const selectedTenderLatestSignal = selectedTenderFocusItems.recent[0] ?? null;
  const selectedTenderReadinessHighlights = selectedTenderStageReadiness?.importantChecks.slice(0, 3) ?? [];
  const selectedTenderStakeholders = useMemo(() => {
    if (!selectedTender) return [];

    return selectedTender.tenderClients.map((item, index) => {
      const relationshipLabel =
        item.relationshipType?.trim() ||
        (item.isAwarded
          ? "Awarded party"
          : index === 0
            ? "Primary client"
            : item.contact
              ? "Stakeholder"
              : "Linked organization");

      return {
        id: item.id,
        clientName: item.client.name,
        contactName: item.contact ? `${item.contact.firstName} ${item.contact.lastName}` : "No contact linked",
        contactEmail: item.contact?.email ?? null,
        contactPhone: item.contact?.phone ?? null,
        relationshipLabel: normalizeStakeholderRoleLabel(relationshipLabel),
        notes: item.notes?.trim() || null,
        isAwarded: item.isAwarded,
        contractIssued: Boolean(item.contractIssued)
      };
    });
  }, [selectedTender]);
  const selectedTenderStakeholderSnapshots = useMemo(() => {
    if (!selectedTender) return [];

    return selectedTender.tenderClients.map((item, index) => {
      const fallbackRole = item.isAwarded ? "Awarded party" : index === 0 ? "Primary client" : "Stakeholder";
      const contactChannel = [item.contact?.email, item.contact?.phone].filter(Boolean).join(" | ");
      return {
        id: item.id,
        roleLabel: normalizeStakeholderRoleLabel(item.relationshipType, fallbackRole),
        relationshipSummary: item.contact
          ? `${item.contact.firstName} ${item.contact.lastName} at ${item.client.name}`
          : `${item.client.name} organization link`,
        communicationSummary: contactChannel || "No direct contact details",
        roleGuidance:
          item.isAwarded
            ? "Commercial path is tied to this awarded party."
            : item.contractIssued
              ? "Contract path has already touched this stakeholder."
              : fallbackRole === "Primary client"
                ? "Keep this contact warm as the main buyer-side relationship."
                : "Track this contact as part of the approval and review path."
      };
    });
  }, [selectedTender]);
  const selectedTenderCommunicationSignals = useMemo(() => {
    if (!selectedTender) return [];

    const noteAuthors = selectedTender.tenderNotes
      .filter((item) => item.author)
      .slice(0, 2)
      .map((item) => `${item.author?.firstName} ${item.author?.lastName}`);
    const followUpOwners = selectedTender.followUps
      .filter((item) => item.assignedUser)
      .slice(0, 3)
      .map((item) => `${item.assignedUser?.firstName} ${item.assignedUser?.lastName}`);
    const latestSignalDetail = selectedTenderLatestSignal
      ? `${selectedTenderLatestSignal.activityType.replaceAll("_", " ")} updated ${formatDateTime(selectedTenderLatestSignal.updatedAt ?? selectedTenderLatestSignal.createdAt)}`
      : "No recent activity captured yet.";
    const cadenceValue = selectedTenderAttention?.lastActivityAt
      ? formatDateTime(selectedTenderAttention.lastActivityAt)
      : "No touch yet";
    const cadenceDetail = selectedTenderAttention?.needsAttention
      ? `Attention state: ${getAttentionLabel(selectedTenderAttention.attentionState)}`
      : "Conversation is currently on track.";

    return [
      {
        label: "Coverage",
        value: `${selectedTenderStakeholders.length}`,
        detail: selectedTenderStakeholders.length ? "Stakeholders mapped into the current deal conversation." : "No stakeholders mapped yet."
      },
      {
        label: "Owners",
        value: `${new Set(followUpOwners).size}`,
        detail: followUpOwners.length ? followUpOwners.join(", ") : "No owned follow-ups yet."
      },
      {
        label: "Cadence",
        value: cadenceValue,
        detail: cadenceDetail
      },
      {
        label: "Recent voices",
        value: `${new Set(noteAuthors).size}`,
        detail: noteAuthors.length ? noteAuthors.join(", ") : latestSignalDetail
      }
    ];
  }, [selectedTender, selectedTenderAttention, selectedTenderLatestSignal, selectedTenderStakeholders]);
  const selectedTenderCommunicationQueue = useMemo(() => {
    return activities
      .filter((item) => item.status !== "DONE" && item.status !== "CLOSED" && item.status !== "RECORDED")
      .map((item) => {
        const dueTime = item.dueAt ? new Date(item.dueAt).getTime() : null;
        return {
          id: item.id,
          title: item.title,
          activityType: item.activityType.replaceAll("_", " "),
          owner: item.assignedUser ? `${item.assignedUser.firstName} ${item.assignedUser.lastName}` : "Unassigned",
          dueTime,
          dueLabel: item.dueAt ? formatDate(item.dueAt) : "No due date",
          isOverdue: dueTime !== null && dueTime < Date.now()
        };
      })
      .sort((left, right) => {
        if (left.isOverdue !== right.isOverdue) return left.isOverdue ? -1 : 1;
        if (left.dueTime === null && right.dueTime !== null) return 1;
        if (right.dueTime === null && left.dueTime !== null) return -1;
        if (left.dueTime !== null && right.dueTime !== null && left.dueTime !== right.dueTime) {
          return left.dueTime - right.dueTime;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 4);
  }, [activities]);
  const visibleActivities = useMemo(() => {
    return activities.filter((item) => {
      const isCompleted = item.status === "DONE" || item.status === "CLOSED" || item.status === "RECORDED";
      const isOverdue = !isCompleted && Boolean(item.dueAt) && new Date(item.dueAt as string).getTime() < Date.now();
      const matchesOwner =
        activityOwnerFilter === "ALL"
          ? true
          : activityOwnerFilter === "UNASSIGNED"
            ? !item.assignedUser?.id
            : item.assignedUser?.id === activityOwnerFilter;
      const matchesView =
        activityView === "ALL"
          ? true
          : activityView === "OPEN"
            ? !isCompleted
            : activityView === "OVERDUE"
              ? isOverdue
              : activityView === "COMPLETED"
                ? isCompleted
                : activityOwnerFilter === "ALL"
                  ? !isCompleted
                  : item.assignedUser?.id === activityOwnerFilter && !isCompleted;

      return matchesOwner && matchesView;
    });
  }, [activities, activityOwnerFilter, activityView]);
  const activityOwnerOptions = useMemo(() => {
    const unique = new Map<string, string>();

    activities.forEach((item) => {
      if (item.assignedUser?.id) {
        unique.set(item.assignedUser.id, `${item.assignedUser.firstName} ${item.assignedUser.lastName}`);
      }
    });

    return [...unique.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [activities]);
  const draggableBoardStages = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"] as const;
  const droppableBoardStages = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED", "CONVERTED"] as const;

  const buildTenderClientsForStageMove = (
    tenderClients: TenderRecord["tenderClients"],
    nextStatus: "DRAFT" | "IN_PROGRESS" | "SUBMITTED"
  ) => {
    const shouldClearAwardPath = ["DRAFT", "IN_PROGRESS", "SUBMITTED"].includes(nextStatus);

    return tenderClients.map((item) => ({
      clientId: item.client.id,
      contactId: item.contact?.id,
      isAwarded: shouldClearAwardPath ? false : item.isAwarded
    }));
  };

  const isDraggableBoardStage = (stage: (typeof tenderFlow)[number]["key"]) =>
    draggableBoardStages.includes(stage as (typeof draggableBoardStages)[number]);

  const isDroppableBoardStage = (stage: (typeof tenderFlow)[number]["key"]) =>
    droppableBoardStages.includes(stage as (typeof droppableBoardStages)[number]);

  const getBoardStageTargetClient = (tender: TenderRecord) => {
    const awardedClient = tender.tenderClients.find((item) => item.isAwarded);
    if (awardedClient) return awardedClient;
    if (tender.tenderClients.length === 1) return tender.tenderClients[0];
    return null;
  };

  const getBoardConversionPayload = (tender: TenderRecord) => ({
    jobNumber: tender.sourceJob?.jobNumber ?? tender.tenderNumber.replace("TEN", "JOB"),
    name: tender.sourceJob?.name ?? tender.title,
    description: tender.description || undefined,
    siteId: undefined,
    projectManagerId: undefined,
    supervisorId: undefined,
    carryTenderDocuments: true,
    tenderDocumentIds: tender.tenderDocuments?.map((item) => item.id) ?? []
  });

  const buildWorkspaceConversionPayload = () => ({
    jobNumber: conversionForm.jobNumber,
    name: conversionForm.name,
    description: conversionForm.description || undefined,
    siteId: conversionForm.siteId || undefined,
    projectManagerId: conversionForm.projectManagerId || undefined,
    supervisorId: conversionForm.supervisorId || undefined,
    carryTenderDocuments: conversionForm.carryTenderDocuments,
    tenderDocumentIds: selectedDocumentIds
  });

  const openPendingBoardDropSelector = (
    tender: TenderRecord,
    nextStage: BoardDropLifecycleStage | "AWARDED",
    promptTargetStage: "AWARDED" | "CONTRACT_ISSUED",
    actionType: "forward-lifecycle" | "rollback-lifecycle" = "forward-lifecycle"
  ) => {
    setPendingBoardDrop({
      tender,
      nextStage,
      selectedClientId: tender.tenderClients[0]?.id ?? "",
      mode: "select-client",
      promptTargetStage,
      actionType
    });
  };

  const openConvertedRollbackWarning = (
    tender: TenderRecord,
    nextStage: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED"
  ) => {
    setPendingBoardDrop({
      tender,
      nextStage,
      selectedClientId: tender.tenderClients.find((item) => item.isAwarded)?.id ?? tender.tenderClients[0]?.id ?? "",
      mode: "confirm-archive",
      promptTargetStage: nextStage === "AWARDED" ? "AWARDED" : "CONTRACT_ISSUED",
      actionType: "rollback-lifecycle"
    });
  };

  const openConvertedCreateJobPrompt = (tender: TenderRecord) => {
    setPendingBoardDrop({
      tender,
      nextStage: "CONVERTED",
      selectedClientId: tender.tenderClients.find((item) => item.isAwarded)?.id ?? tender.tenderClients[0]?.id ?? "",
      mode: "confirm-convert",
      promptTargetStage: "CONTRACT_ISSUED",
      actionType: "forward-lifecycle"
    });
  };

  const moveSelectedTenderStage = async (nextStatus: "DRAFT" | "IN_PROGRESS" | "SUBMITTED") => {
    if (!selectedTender) return;

    const readiness = getTenderingStageReadiness({
      nextStage: nextStatus,
      ...buildStageReadinessInput(selectedTender)
    });
    if (!readiness.canProceed) {
      setError(readiness.blockers[0] ?? "This tender is not ready for that stage.");
      return;
    }

    setEditForm((current) => ({ ...current, status: nextStatus }));

    const response = await authFetch(`/tenders/${selectedTender.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        tenderNumber: selectedTender.tenderNumber,
        title: editForm.title,
        description: editForm.description || undefined,
        estimatorUserId: editForm.estimatorUserId || undefined,
        status: nextStatus,
        probability: Number(editForm.probability),
        estimatedValue: editForm.estimatedValue || undefined,
        dueDate: editForm.dueDate || undefined,
        proposedStartDate: editForm.proposedStartDate || undefined,
        leadTimeDays: editForm.leadTimeDays ? Number(editForm.leadTimeDays) : undefined,
        tenderClients: buildTenderClientsForStageMove(selectedTender.tenderClients, nextStatus),
        tenderNotes: selectedTender.tenderNotes.map((item) => ({ body: item.body })),
        clarifications: selectedTender.clarifications.map((item) => ({
          subject: item.subject,
          response: item.response || undefined,
          status: item.status,
          dueDate: item.dueDate || undefined
        })),
        followUps: selectedTender.followUps
          .filter((item) => item.dueAt)
          .map((item) => ({
            details: item.details,
            dueAt: item.dueAt!,
            status: item.status
          })),
        outcomes: selectedTender.outcomes?.map((item) => ({
          outcomeType: item.outcomeType,
          notes: item.notes || undefined
        }))
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to move tender stage.");
      return;
    }

    await load();
    await selectTender(selectedTender.id);
  };

  const refreshAfterTenderMove = async (tenderId: string) => {
    await load();
    if (selectedTender?.id === tenderId) {
      await selectTender(tenderId);
    }
  };

  const runTenderBoardLifecycleMove = async (
    tender: TenderRecord,
    nextStatus: BoardDropLifecycleStage,
    chosenClientId?: string
  ) => {
    const targetClient = chosenClientId
      ? tender.tenderClients.find((item) => item.id === chosenClientId) ?? null
      : getBoardStageTargetClient(tender);

    if (!targetClient) {
      openPendingBoardDropSelector(
        tender,
        nextStatus,
        nextStatus === "AWARDED" ? "AWARDED" : "CONTRACT_ISSUED"
      );
      return;
    }

    if (!targetClient.isAwarded) {
      const awardResponse = await authFetch(`/tenders/${tender.id}/award`, {
        method: "PATCH",
        body: JSON.stringify({ tenderClientId: targetClient.id })
      });

      if (!awardResponse.ok) {
        const body = await awardResponse.json().catch(() => null);
        setError(body?.message ?? "Unable to move tender card.");
        return;
      }
    }

    if (nextStatus === "AWARDED") {
      await refreshAfterTenderMove(tender.id);
      return;
    }

    if (!targetClient.contractIssued) {
      const contractResponse = await authFetch(`/tenders/${tender.id}/contract`, {
        method: "PATCH",
        body: JSON.stringify({ tenderClientId: targetClient.id })
      });

      if (!contractResponse.ok) {
        const body = await contractResponse.json().catch(() => null);
        setError(body?.message ?? "Unable to move tender card.");
        return;
      }
    }

    if (nextStatus === "CONTRACT_ISSUED") {
      await refreshAfterTenderMove(tender.id);
      return;
    }

    const convertResponse = await authFetch(`/tenders/${tender.id}/convert-to-job`, {
      method: "POST",
      body: JSON.stringify(getBoardConversionPayload(tender))
    });

    if (!convertResponse.ok) {
      const body = await convertResponse.json().catch(() => null);
      if (body?.message === "A job with this number and source tender already exists.") {
        setArchivedConversionPrompt({
          source: "board",
          tender,
          payload: {
            ...getBoardConversionPayload(tender),
            archivedJobId:
              typeof body?.archivedJobId === "string" ? body.archivedJobId : undefined
          },
          stageName: "",
          mode: "confirm-new-stage"
        });
        return;
      }
      setError(body?.message ?? "Unable to move tender card.");
      return;
    }

    const result = await convertResponse.json().catch(() => null);
    if (result) {
      setLatestJob(result);
    }

    await refreshAfterTenderMove(tender.id);
  };

  const rollbackTenderBoardLifecycleMove = async (
    tender: TenderRecord,
    nextStatus: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED",
    chosenClientId?: string
  ) => {
    const response = await authFetch(`/tenders/${tender.id}/rollback-lifecycle`, {
      method: "PATCH",
      body: JSON.stringify({
        targetStage: nextStatus,
        tenderClientId: chosenClientId || undefined
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to move tender card.");
      return;
    }

    await refreshAfterTenderMove(tender.id);
  };

  const moveTenderCardStage = async (
    tender: TenderRecord,
    nextStatus: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
  ) => {
    const currentStage = getTenderStage(tender);

    if (currentStage === "CONTRACT_ISSUED" && nextStatus === "AWARDED") {
      setPendingBoardDrop({
        tender,
        nextStage: nextStatus,
        selectedClientId: tender.tenderClients.find((item) => item.isAwarded)?.id ?? tender.tenderClients[0]?.id ?? "",
        mode: "confirm-client",
        promptTargetStage: "AWARDED",
        actionType: "rollback-lifecycle"
      });
      return;
    }

    if (currentStage === "CONVERTED" && (nextStatus === "AWARDED" || nextStatus === "CONTRACT_ISSUED")) {
      openConvertedRollbackWarning(tender, nextStatus);
      return;
    }

    if (currentStage === "CONVERTED" && ["DRAFT", "IN_PROGRESS", "SUBMITTED"].includes(nextStatus)) {
      openConvertedRollbackWarning(tender, nextStatus as "DRAFT" | "IN_PROGRESS" | "SUBMITTED");
      return;
    }

    if (nextStatus === "CONVERTED") {
      openConvertedCreateJobPrompt(tender);
      return;
    }

    if (nextStatus === "AWARDED" || nextStatus === "CONTRACT_ISSUED") {
      await runTenderBoardLifecycleMove(tender, nextStatus);
      return;
    }

    const readiness = getTenderingStageReadiness({
      nextStage: nextStatus,
      ...buildStageReadinessInput(tender)
    });
    if (!readiness.canProceed) {
      setError(readiness.blockers[0] ?? "This tender is not ready for that stage.");
      return;
    }

    const response = await authFetch(`/tenders/${tender.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        tenderNumber: tender.tenderNumber,
        title: tender.title,
        description: tender.description || undefined,
        estimatorUserId: tender.estimator?.id || undefined,
        status: nextStatus,
        probability: tender.probability ?? undefined,
        estimatedValue: tender.estimatedValue || undefined,
        dueDate: tender.dueDate || undefined,
        proposedStartDate: tender.proposedStartDate || undefined,
        leadTimeDays: tender.leadTimeDays ?? undefined,
        tenderClients: buildTenderClientsForStageMove(tender.tenderClients, nextStatus),
        tenderNotes: tender.tenderNotes.map((item) => ({ body: item.body })),
        clarifications: tender.clarifications.map((item) => ({
          subject: item.subject,
          response: item.response || undefined,
          status: item.status,
          dueDate: item.dueDate || undefined
        })),
        followUps: tender.followUps
          .filter((item) => item.dueAt)
          .map((item) => ({
            details: item.details,
            dueAt: item.dueAt!,
            status: item.status
          })),
        outcomes: tender.outcomes?.map((item) => ({
          outcomeType: item.outcomeType,
          notes: item.notes || undefined
        }))
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to move tender card.");
      return;
    }

    await refreshAfterTenderMove(tender.id);
  };

  const handleBoardCardDragStart = (event: React.DragEvent<HTMLElement>, tenderId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", tenderId);
    setDraggedTenderId(tenderId);
    dragOverStageRef.current = null;
  };

  const handleBoardCardDragEnd = async (tender: TenderRecord) => {
    const nextStage = dragOverStageRef.current;
    setDraggedTenderId(null);
    setDragOverStage(null);
    dragOverStageRef.current = null;
    if (!nextStage || getTenderStage(tender) === nextStage) return;
    await moveTenderCardStage(tender, nextStage);
  };

  const handleBoardColumnDragOver = (
    event: React.DragEvent<HTMLElement>,
    nextStage: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    dragOverStageRef.current = nextStage;
    setDragOverStage(nextStage);
  };

  const handleBoardColumnDragLeave = (
    event: React.DragEvent<HTMLElement>,
    nextStage: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
  ) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    if (dragOverStage === nextStage) {
      setDragOverStage(null);
    }
    if (dragOverStageRef.current === nextStage) {
      dragOverStageRef.current = null;
    }
  };

  const handleBoardColumnDrop = async (
    event: React.DragEvent<HTMLElement>,
    nextStage: "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
  ) => {
    event.preventDefault();
    const tenderId = event.dataTransfer.getData("text/plain") || draggedTenderId;
    const tender = tenders.find((item) => item.id === tenderId);
    setDragOverStage(null);
    setDraggedTenderId(null);
    dragOverStageRef.current = null;
    if (!tender || getTenderStage(tender) === nextStage) return;
    await moveTenderCardStage(tender, nextStage);
  };

  const cancelPendingBoardDrop = () => {
    setPendingBoardDrop(null);
  };

  const confirmPendingBoardDrop = async () => {
    if (!pendingBoardDrop) return;
    const { tender, nextStage, selectedClientId, actionType, mode } = pendingBoardDrop;
    setPendingBoardDrop(null);
    if (mode === "confirm-archive") {
      if (nextStage === "AWARDED" || nextStage === "CONTRACT_ISSUED") {
        setPendingBoardDrop({
          tender,
          nextStage,
          selectedClientId,
          mode: "confirm-client",
          promptTargetStage: nextStage,
          actionType
        });
        return;
      }

      if (actionType === "rollback-lifecycle" && ["DRAFT", "IN_PROGRESS", "SUBMITTED"].includes(nextStage)) {
        await rollbackTenderBoardLifecycleMove(
          tender,
          nextStage as "DRAFT" | "IN_PROGRESS" | "SUBMITTED",
          selectedClientId
        );
      }
      return;
    }
    if (mode === "confirm-convert") {
      await runTenderBoardLifecycleMove(tender, "CONVERTED", selectedClientId);
      return;
    }
    if (
      actionType === "rollback-lifecycle" &&
      ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "CONTRACT_ISSUED"].includes(nextStage)
    ) {
      await rollbackTenderBoardLifecycleMove(
        tender,
        nextStage as "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED",
        selectedClientId
      );
      return;
    }
    if (nextStage === "AWARDED" || nextStage === "CONTRACT_ISSUED" || nextStage === "CONVERTED") {
      await runTenderBoardLifecycleMove(tender, nextStage, selectedClientId);
    }
  };

  const chooseDifferentPendingBoardClient = () => {
    setPendingBoardDrop((current) => (current ? { ...current, mode: "select-client" } : current));
  };

  const cancelArchivedConversionPrompt = () => {
    setArchivedConversionPrompt(null);
  };

  const confirmArchivedConversionAsNewStage = () => {
    setArchivedConversionPrompt((current) => (current ? { ...current, mode: "name-stage" } : current));
  };

  const declineArchivedConversionAsNewStage = () => {
    setArchivedConversionPrompt((current) => (current ? { ...current, mode: "change-details" } : current));
  };

  const submitArchivedConversionAsNewStage = async () => {
    if (!archivedConversionPrompt || !archivedConversionPrompt.stageName.trim()) return;
    const { tender, payload, stageName } = archivedConversionPrompt;
    setArchivedConversionPrompt(null);

    const response = await authFetch(`/tenders/${tender.id}/convert-to-job/reuse-archived`, {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        stageName: stageName.trim()
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to reuse archived job conversion.");
      return;
    }

    const result = await response.json().catch(() => null);
    if (result) {
      setLatestJob(result);
    }

    await load();
    setTenders((current) =>
      current.map((item) =>
        item.id === tender.id
          ? {
              ...item,
              status: "CONVERTED",
              sourceJob: result
                ? {
                    id: result.id,
                    jobNumber: result.jobNumber,
                    name: result.name,
                    status: result.status
                  }
                : item.sourceJob
            }
          : item
      )
    );
    await selectTender(tender.id);
  };

  const exportFilteredTenders = () => {
    const rows = [
      [
        "tenderNumber",
        "title",
        "stage",
        "estimator",
        "clients",
        "dueDate",
        "nextAction",
        "stageAgeDays",
        "probability",
        "estimatedValue"
      ],
      ...filteredTenders.map((tender) => {
        const attention = getTenderingAttentionSummary({
          stage: getTenderStage(tender),
          createdAt: tender.createdAt,
          updatedAt: tender.updatedAt,
          dueDate: tender.dueDate,
          contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
          tenderNotes: tender.tenderNotes,
          clarifications: tender.clarifications,
          followUps: tender.followUps,
          tenderDocuments: tender.tenderDocuments,
          outcomes: tender.outcomes
        });

        return [
          tender.tenderNumber,
          tender.title,
          getTenderStage(tender),
          tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : "",
          tender.tenderClients.map((item) => item.client.name).join(" | "),
          tender.dueDate ?? "",
          attention.nextActionAt ?? "",
          String(attention.stageAgeDays),
          String(tender.probability ?? 0),
          String(tender.estimatedValue ?? "")
        ];
      })
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tender-register-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tendering-page">
      {error ? <p className="error-text">{error}</p> : null}
      {loadNotices.length ? (
        <div className="stack-grid">
          {loadNotices.map((notice, index) => (
            <div key={`${notice.kind}-${index}`} className="notice-banner notice-banner--warning">
              {notice.message}
            </div>
          ))}
        </div>
      ) : null}

      {showWorkspaceShell ? (
      <div className={`tendering-layout${showRegister ? "" : " tendering-layout--single"}`}>
        {showRegister ? (
        <AppCard
          title="Tender Pipeline"
          subtitle="CRM-style register and workspace flow for live tenders."
          actions={
            <div className="tendering-register-header-metrics">
              <div className="tendering-register-summary__metric">
                <span>Live</span>
                <strong>{registerKpis.total}</strong>
              </div>
              <div className="tendering-register-summary__metric">
                <span>Submitted</span>
                <strong>{registerKpis.submitted}</strong>
              </div>
              <div className="tendering-register-summary__metric">
                <span>Award path</span>
                <strong>{registerKpis.awarded}</strong>
              </div>
              <div className="tendering-register-summary__metric">
                <span>Needs attention</span>
                <strong>{registerKpis.needsAttention}</strong>
              </div>
              <div className="tendering-register-summary__metric">
                <span>Rotting</span>
                <strong>{registerKpis.rotting}</strong>
              </div>
            </div>
          }
        >
          <div className="tendering-register-shell">
          <div className="tendering-register-scroll">
            <div className="tendering-register-briefing">
              <div className="tendering-register-briefing__primary">
                <div>
                  <span className="tendering-section-label tendering-section-label--muted">Deal desk</span>
                  <h3>Keep the pipeline moving without losing the next commercial move.</h3>
                </div>
                <p className="muted-text">
                  Single click keeps a tender in focus. Double click opens the workspace overlay for deeper activity, document, and conversion work.
                </p>
              </div>
              <div className="tendering-register-briefing__stats">
                <div className="tendering-register-briefing__stat">
                  <span className="muted-text">Visible pipeline</span>
                  <strong>{formatCurrency(String(filteredPipelineValue))}</strong>
                  <small>{filteredTenders.length} deals in view</small>
                </div>
                <div className="tendering-register-briefing__stat">
                  <span className="muted-text">Weighted forecast</span>
                  <strong>{formatCurrency(String(filteredWeightedValue))}</strong>
                  <small>{activeFilterCount ? `${activeFilterCount} active filters` : "All deals visible"}</small>
                </div>
                <div className="tendering-register-briefing__stat">
                  <span className="muted-text">Current focus</span>
                  <strong>{selectedTender ? selectedTender.tenderNumber : "No tender selected"}</strong>
                  <small>{selectedRegisterSummary ? `${selectedRegisterSummary.stageLabel} | ${selectedRegisterSummary.attentionLabel}` : "Pick a deal to hold context while you scan the pipeline."}</small>
                </div>
              </div>
              <div className="tendering-register-briefing__focus">
                {selectedTender && selectedRegisterSummary ? (
                  <>
                    <div>
                      <span className="muted-text">Selected opportunity</span>
                      <strong>{selectedTender.title}</strong>
                      <p className="muted-text">{selectedRegisterSummary.clientNames}</p>
                    </div>
                    <div className="tendering-register-briefing__focus-meta">
                      <span>{selectedRegisterSummary.nextActionLabel}</span>
                      <span>{selectedRegisterSummary.lastTouchLabel}</span>
                      <span>{selectedRegisterSummary.overdueCount ? `${selectedRegisterSummary.overdueCount} overdue` : `${selectedRegisterSummary.openItemCount} open items`}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <span className="muted-text">Selected opportunity</span>
                      <strong>Nothing pinned yet</strong>
                      <p className="muted-text">Choose a tender from the board, list, or forecast to keep one deal in focus while the rest of the register stays visible.</p>
                    </div>
                    <div className="tendering-register-briefing__focus-meta">
                      <span>Pipeline scan mode</span>
                      <span>Workspace opens on double click</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="tendering-toolbar tendering-toolbar--pipeline">
              <div className="tendering-toolbar__row">
                <div className="tendering-toolbar-panel tendering-toolbar-panel--search">
                  <span className="tendering-toolbar-panel__label">Search</span>
                  <input
                    className="tendering-search"
                    placeholder="Search tender, client, or estimator"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <div className="tendering-toolbar-panel">
                  <span className="tendering-toolbar-panel__label">View</span>
                  <div className="tendering-view-toggle tendering-view-switcher">
                    <button
                      type="button"
                      className={`tendering-filter-chip${registerView === "board" ? " tendering-filter-chip--active" : ""}`}
                      onClick={() => setRegisterView("board")}
                    >
                      Pipeline
                    </button>
                    <button
                      type="button"
                      className={`tendering-filter-chip${registerView === "list" ? " tendering-filter-chip--active" : ""}`}
                      onClick={() => setRegisterView("list")}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      className={`tendering-filter-chip${registerView === "forecast" ? " tendering-filter-chip--active" : ""}`}
                      onClick={() => setRegisterView("forecast")}
                    >
                      Forecast
                    </button>
                  </div>
                </div>
                <div className="tendering-toolbar-panel">
                  <span className="tendering-toolbar-panel__label">Sort</span>
                  <select
                    className="tendering-filter-select"
                    value={sortOption}
                    onChange={(event) => setSortOption(event.target.value as TenderSortOption)}
                  >
                    <option value="NEXT_ACTION">Next activity</option>
                    <option value="DUE_DATE">Due date</option>
                    <option value="VALUE_DESC">Value</option>
                    <option value="PROBABILITY_DESC">Probability</option>
                    <option value="STAGE_AGE_DESC">Stage age</option>
                  </select>
                </div>
                <div className="tendering-toolbar-panel">
                  <span className="tendering-toolbar-panel__label">Actions</span>
                  <div className="tendering-toolbar-actions">
                    <button
                      type="button"
                      className="tendering-topbar-button"
                      onClick={() => setSearch("")}
                      disabled={!search}
                    >
                      Clear search
                    </button>
                    <button
                      type="button"
                      className="tendering-topbar-button"
                      onClick={() => {
                        setStatusFilter("ALL");
                        setAttentionFilter("ALL");
                        setEstimatorFilter("ALL");
                        setDueFilter("ALL");
                        setValueBandFilter("ALL");
                        setProbabilityBandFilter("ALL");
                        setClientFilter("ALL");
                        setContactFilter("ALL");
                      }}
                    >
                      Reset filters
                    </button>
                    <button type="button" className="tendering-filter-chip tendering-filter-chip--ghost" onClick={exportFilteredTenders}>
                      Export CSV
                    </button>
                  </div>
                </div>
                <div className="tendering-toolbar-panel tendering-toolbar-panel--inline-filters">
                  <span className="tendering-toolbar-panel__label">Due, value, and relationships</span>
                  <div className="tendering-toolbar-actions tendering-toolbar-actions--filters">
                    <select
                      className="tendering-filter-select"
                      value={dueFilter}
                      onChange={(event) => setDueFilter(event.target.value as TenderingDueFilter)}
                    >
                      <option value="ALL">All due dates</option>
                      <option value="OVERDUE">Overdue</option>
                      <option value="THIS_WEEK">Due this week</option>
                      <option value="NEXT_30_DAYS">Next 30 days</option>
                      <option value="NO_DUE_DATE">No due date</option>
                    </select>
                    <select
                      className="tendering-filter-select"
                      value={valueBandFilter}
                      onChange={(event) => setValueBandFilter(event.target.value as TenderValueBandFilter)}
                    >
                      <option value="ALL">All values</option>
                      <option value="UNDER_100K">Under $100k</option>
                      <option value="BETWEEN_100K_500K">$100k to $500k</option>
                      <option value="OVER_500K">Over $500k</option>
                    </select>
                    <select
                      className="tendering-filter-select"
                      value={probabilityBandFilter}
                      onChange={(event) => setProbabilityBandFilter(event.target.value as TenderProbabilityBandFilter)}
                    >
                      <option value="ALL">All probabilities</option>
                      <option value="UNDER_40">Under 40%</option>
                      <option value="BETWEEN_40_70">40% to 70%</option>
                      <option value="OVER_70">Over 70%</option>
                    </select>
                    <select
                      className="tendering-filter-select"
                      value={clientFilter}
                      onChange={(event) => setClientFilter(event.target.value)}
                    >
                      <option value="ALL">All clients</option>
                      {references.clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="tendering-filter-select"
                      value={contactFilter}
                      onChange={(event) => setContactFilter(event.target.value)}
                    >
                      <option value="ALL">All contacts</option>
                      {contactOptions.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}{contact.clientName ? ` - ${contact.clientName}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="tendering-toolbar-panel tendering-toolbar-panel--value">
                  <span className="tendering-toolbar-panel__label">Visible value</span>
                  <div className="tendering-toolbar-value">
                    <strong>{formatCurrency(String(filteredPipelineValue))}</strong>
                    <span className="muted-text">pipeline total</span>
                  </div>
                </div>
              </div>
              <div className="tendering-filter-cluster">
                <span className="tendering-toolbar-panel__label">Stage / Momentum and owner</span>
                <div className="tendering-filter-row tendering-filter-row--dense">
                  {[
                    ["ALL", "All"],
                    ["DRAFT", "Draft"],
                    ["IN_PROGRESS", "Estimating"],
                    ["SUBMITTED", "Submitted"],
                    ["AWARDED", "Awarded"],
                    ["CONTRACT_ISSUED", "Contracted"],
                    ["CONVERTED", "Converted"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`tendering-filter-chip${statusFilter === value ? " tendering-filter-chip--active" : ""}`}
                      onClick={() => setStatusFilter(value as TenderStatusFilter)}
                    >
                      {label}
                    </button>
                  ))}
                  {[
                    ["ALL", "All momentum"],
                    ["NEEDS_ATTENTION", "Needs attention"],
                    ["ROTTING", "Rotting"],
                    ["ON_TRACK", "On track"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={`tendering-filter-chip${attentionFilter === value ? " tendering-filter-chip--active" : ""}`}
                      onClick={() => setAttentionFilter(value as TenderAttentionFilter)}
                    >
                      {label}
                    </button>
                  ))}
                  <select
                    className="tendering-filter-select"
                    value={estimatorFilter}
                    onChange={(event) => setEstimatorFilter(event.target.value)}
                  >
                    <option value="ALL">All estimators</option>
                    <option value="UNASSIGNED">Unassigned</option>
                    {estimatorOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {registerView === "list" ? (
            <div className="tendering-table-shell">
              <div className="tendering-table">
                <div className="tendering-table__header">
                  <span>Title</span>
                  <span>Value</span>
                  <span>Organization</span>
                  <span>Contact person</span>
                  <span>Expected close</span>
                  <span>Next activity</span>
                  <span>Owner</span>
                  <span>Stage</span>
                  <span>Action</span>
                </div>
                {filteredTenders.map((tender) => {
                  const stage = getTenderStage(tender);
                  const awardedClient = tender.tenderClients.find((item) => item.isAwarded);
                  const attention = getTenderingAttentionSummary({
                    stage,
                    createdAt: tender.createdAt,
                    updatedAt: tender.updatedAt,
                    dueDate: tender.dueDate,
                    contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
                    tenderNotes: tender.tenderNotes,
                    clarifications: tender.clarifications,
                    followUps: tender.followUps,
                    tenderDocuments: tender.tenderDocuments,
                    outcomes: tender.outcomes
                  });

                  return (
                    <div
                      key={tender.id}
                      className={`tendering-table__row${selectedTender?.id === tender.id ? " tendering-table__row--selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => void selectTender(tender.id)}
                      onDoubleClick={() => void openTenderWorkspace(tender.id)}
                      onKeyDown={(event) =>
                        handleTenderInteractiveKeyDown(event, {
                          onSelect: () => void selectTender(tender.id),
                          onOpen: () => void openTenderWorkspace(tender.id)
                        })
                      }
                    >
                      <span className="tendering-table__title">
                        <strong>{tender.title}</strong>
                        <small>{tender.tenderNumber}</small>
                      </span>
                      <span>{formatCurrency(tender.estimatedValue)}</span>
                      <span>{tender.tenderClients.map((item) => item.client.name).join(", ") || "No client linked"}</span>
                      <span>
                        {tender.tenderClients.find((item) => item.contact)?.contact
                          ? `${tender.tenderClients.find((item) => item.contact)?.contact?.firstName} ${tender.tenderClients.find((item) => item.contact)?.contact?.lastName}`
                          : "No contact"}
                      </span>
                      <span>{formatDate(tender.dueDate)}</span>
                      <span className="tendering-table__activity">
                        <strong>{attention.nextActionAt ? formatDate(attention.nextActionAt) : "Not set"}</strong>
                        <small>
                          {attention.overdueFollowUpCount + attention.overdueClarificationCount
                            ? `${attention.overdueFollowUpCount + attention.overdueClarificationCount} overdue`
                            : `${attention.openFollowUpCount + attention.openClarificationCount} open items`}
                        </small>
                      </span>
                      <span>{tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : "Unassigned"}</span>
                      <span className="tendering-table__stage">
                        <span className={`pill ${getAttentionPillClass(attention.attentionState)}`}>
                          {getAttentionLabel(attention.attentionState)}
                        </span>
                        <small>{tenderFlow.find((item) => item.key === stage)?.label ?? stage}</small>
                        {awardedClient ? <small>{awardedClient.client.name}</small> : null}
                      </span>
                      <span className="tendering-table__quick-action">
                        <button
                          type="button"
                          className="tendering-topbar-button tendering-topbar-button--compact"
                          onMouseDown={stopTenderCardActionEvent}
                          onClick={(event) => {
                            stopTenderCardActionEvent(event);
                            void openTenderWorkspace(tender.id, "activity");
                          }}
                        >
                          Add activity
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>

              {!filteredTenders.length ? (
                <div className="tendering-empty-state">
                  <strong>No tenders in this view.</strong>
                  <p>Adjust the stage filter or search term to broaden the register.</p>
                </div>
              ) : null}
            </div>
            ) : registerView === "forecast" ? (
            <>
              <div className="tendering-forecast-toolbar">
                <div className="tendering-forecast-toolbar__window">
                  <span className="tendering-toolbar-panel__label">Forecast window</span>
                  <strong>
                    {visibleForecastColumns.length
                      ? `${visibleForecastColumns[0]?.label} to ${visibleForecastColumns[visibleForecastColumns.length - 1]?.label}`
                      : "No forecast months"}
                  </strong>
                </div>
                <div className="tendering-forecast-toolbar__actions">
                  <button
                    type="button"
                    className="tendering-topbar-button tendering-topbar-button--compact"
                    onClick={() => setForecastStartIndex((current) => Math.max(0, current - 1))}
                    disabled={forecastStartIndex === 0}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="tendering-topbar-button tendering-topbar-button--compact"
                    onClick={() => setForecastStartIndex(0)}
                    disabled={forecastStartIndex === 0}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className="tendering-topbar-button tendering-topbar-button--compact"
                    onClick={() =>
                      setForecastStartIndex((current) => Math.min(Math.max(0, forecastColumns.length - 4), current + 1))
                    }
                    disabled={forecastStartIndex >= Math.max(0, forecastColumns.length - 4)}
                  >
                    Next
                  </button>
                </div>
              </div>

              <div className="tendering-forecast-strip">
                {forecastColumns.map((column, index) => (
                  <button
                    key={column.key}
                    type="button"
                    className={`tendering-forecast-strip__chip${index >= forecastStartIndex && index < forecastStartIndex + 4 ? " tendering-forecast-strip__chip--active" : ""}`}
                    onClick={() => setForecastStartIndex(Math.min(index, Math.max(0, forecastColumns.length - 4)))}
                  >
                    <strong>{column.label}</strong>
                    <span>{column.items.length} tenders</span>
                  </button>
                ))}
              </div>

              <div className="tendering-forecast-board">
              {visibleForecastColumns.map((column) => (
                <section key={column.key} className="tendering-forecast-board__column">
                  <div className="tendering-forecast-board__header">
                    <div>
                      <strong>{column.label}</strong>
                      <span>{column.items.length} tenders</span>
                    </div>
                    <div className="tendering-forecast-board__totals">
                      <small>Weighted forecast</small>
                      <strong>{formatCurrency(String(column.weightedValue))}</strong>
                      <span>{formatCurrency(String(column.totalValue))} gross</span>
                    </div>
                  </div>
                  <div className="tendering-forecast-board__cards">
                    {column.items.map((tender) => {
                      const stage = getTenderStage(tender);
                      const attention = getTenderingAttentionSummary({
                        stage,
                        createdAt: tender.createdAt,
                        updatedAt: tender.updatedAt,
                        dueDate: tender.dueDate,
                        contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
                        tenderNotes: tender.tenderNotes,
                        clarifications: tender.clarifications,
                        followUps: tender.followUps,
                        tenderDocuments: tender.tenderDocuments,
                        outcomes: tender.outcomes
                      });
                      const weightedValue = Number(tender.estimatedValue ?? 0) * ((tender.probability ?? 0) / 100);

                      return (
                        <div
                          key={tender.id}
                          className={`tendering-forecast-card__deal${selectedTender?.id === tender.id ? " tendering-forecast-card__deal--selected" : ""}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => void selectTender(tender.id)}
                          onDoubleClick={() => void openTenderWorkspace(tender.id)}
                          onKeyDown={(event) =>
                            handleTenderInteractiveKeyDown(event, {
                              onSelect: () => void selectTender(tender.id),
                              onOpen: () => void openTenderWorkspace(tender.id)
                            })
                          }
                        >
                          <div className="tendering-register-card__eyebrow">
                            <strong>{tender.title}</strong>
                            <span className={`pill ${getAttentionPillClass(attention.attentionState)}`}>
                              {getAttentionLabel(attention.attentionState)}
                            </span>
                          </div>
                          <span className="muted-text">
                            {tender.tenderClients.map((item) => item.client.name).join(", ") || "No client linked"}
                          </span>
                          <div className="tendering-forecast-card__meta">
                            <span>{formatCurrency(tender.estimatedValue)}</span>
                            <span>{tender.probability ?? 0}% probability</span>
                          </div>
                          <div className="tendering-forecast-card__meta">
                            <span>Weighted {formatCurrency(String(weightedValue))}</span>
                            <span>{tender.dueDate ? `Due ${formatDate(tender.dueDate)}` : "No due date"}</span>
                          </div>
                          <div className="tendering-forecast-card__meta">
                            <span>{tenderFlow.find((item) => item.key === stage)?.label ?? stage}</span>
                            <span>{attention.nextActionAt ? `Next ${formatDate(attention.nextActionAt)}` : "No next action"}</span>
                          </div>
                          <div className="tendering-forecast-card__actions">
                            <span>{attention.lastActivityAt ? `Last touch ${formatDate(attention.lastActivityAt)}` : "No last touch yet"}</span>
                            <button
                              type="button"
                              className="tendering-topbar-button tendering-topbar-button--compact"
                              onMouseDown={stopTenderCardActionEvent}
                              onClick={(event) => {
                                stopTenderCardActionEvent(event);
                                void openTenderWorkspace(tender.id, "activity");
                              }}
                            >
                              Add activity
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}

              {!forecastColumns.length ? (
                <div className="tendering-empty-state">
                  <strong>No tenders in this forecast.</strong>
                  <p>Adjust the filters or add due dates to build out the forecast view.</p>
                </div>
              ) : null}
              </div>
            </>
            ) : (
            <div className="tendering-board tendering-board--crm">
              {boardColumns.map((column) => (
                <section
                  key={column.key}
                  className={`tendering-board__column${dragOverStage === column.key ? " tendering-board__column--dragover" : ""}`}
                  onDragEnter={(event) => {
                    if (!isDroppableBoardStage(column.key)) return;
                    handleBoardColumnDragOver(
                      event,
                      column.key as "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
                    );
                  }}
                  onDragOver={(event) => {
                    if (!isDroppableBoardStage(column.key)) return;
                    handleBoardColumnDragOver(
                      event,
                      column.key as "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
                    );
                  }}
                  onDragLeave={(event) => {
                    if (!isDroppableBoardStage(column.key)) return;
                    handleBoardColumnDragLeave(
                      event,
                      column.key as "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
                    );
                  }}
                  onDrop={(event) => {
                    if (!isDroppableBoardStage(column.key)) return;
                    void handleBoardColumnDrop(
                      event,
                      column.key as "DRAFT" | "IN_PROGRESS" | "SUBMITTED" | "AWARDED" | "CONTRACT_ISSUED" | "CONVERTED"
                    );
                  }}
                >
                  <div className="tendering-board__header tendering-board__header--crm">
                    <div className="tendering-board__header-copy">
                      <strong>{column.label}</strong>
                      <span>{column.items.length} tenders</span>
                    </div>
                    <div className="tendering-board__header-stats">
                      <span>{formatCurrency(String(column.items.reduce((sum, item) => sum + Number(item.estimatedValue ?? 0), 0)))}</span>
                      <span>
                        {column.items.filter((item) => {
                          const columnAttention = getTenderingAttentionSummary({
                            stage: column.key,
                            createdAt: item.createdAt,
                            updatedAt: item.updatedAt,
                            dueDate: item.dueDate,
                            contractIssuedAt: item.tenderClients.find((entry) => entry.contractIssued)?.contractIssuedAt ?? null,
                            tenderNotes: item.tenderNotes,
                            clarifications: item.clarifications,
                            followUps: item.followUps,
                            tenderDocuments: item.tenderDocuments,
                            outcomes: item.outcomes
                          });
                          return columnAttention.attentionState !== "healthy";
                        }).length} flagged
                      </span>
                    </div>
                  </div>
                  <div className="tendering-board__cards">
                    {column.items.length ? (
                      column.items.map((tender) => {
                        const awardedClient = tender.tenderClients.find((item) => item.isAwarded);
                        const attention = getTenderingAttentionSummary({
                          stage: column.key,
                          createdAt: tender.createdAt,
                          updatedAt: tender.updatedAt,
                          dueDate: tender.dueDate,
                          contractIssuedAt: tender.tenderClients.find((item) => item.contractIssued)?.contractIssuedAt ?? null,
                          tenderNotes: tender.tenderNotes,
                          clarifications: tender.clarifications,
                          followUps: tender.followUps,
                          tenderDocuments: tender.tenderDocuments,
                          outcomes: tender.outcomes
                        });

                        return (
                            <div
                              key={tender.id}
                              className={`tendering-board-card${selectedTender?.id === tender.id ? " tendering-board-card--selected" : ""}${draggedTenderId === tender.id ? " tendering-board-card--dragging" : ""}`}
                              draggable={isDraggableBoardStage(column.key)}
                              onDragStart={(event) => handleBoardCardDragStart(event, tender.id)}
                              onDragEnd={() => void handleBoardCardDragEnd(tender)}
                            >
                              <div
                                className="tendering-board-card__open"
                                role="button"
                                tabIndex={0}
                                draggable={isDraggableBoardStage(column.key)}
                                onDragStart={(event) => handleBoardCardDragStart(event, tender.id)}
                                onDragEnd={() => void handleBoardCardDragEnd(tender)}
                              onClick={() => void selectTender(tender.id)}
                              onDoubleClick={() => void openTenderWorkspace(tender.id)}
                              onKeyDown={(event) =>
                                handleTenderInteractiveKeyDown(event, {
                                  onSelect: () => void selectTender(tender.id),
                                  onOpen: () => void openTenderWorkspace(tender.id)
                                })
                              }
                            >
                              <div className="tendering-register-card__eyebrow">
                                <strong>{tender.tenderNumber}</strong>
                                <span className={`pill ${getAttentionPillClass(attention.attentionState)}`}>
                                  {getAttentionLabel(attention.attentionState)}
                                </span>
                              </div>
                              <h3>{tender.title}</h3>
                              <p className="muted-text">{tender.tenderClients.map((item) => item.client.name).join(", ") || "No clients linked"}</p>
                              <div className="tendering-board-card__value-row">
                                <strong>{formatCurrency(tender.estimatedValue)}</strong>
                                <span>{tender.probability ?? 0}% probability</span>
                              </div>
                              <div className="tendering-register-card__headline">
                                <span>{tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : "Unassigned"}</span>
                                <span>{attention.nextActionAt ? `Next ${formatDate(attention.nextActionAt)}` : "No next action"}</span>
                              </div>
                              <div className="tendering-register-card__meta">
                                <span>Due {formatDate(tender.dueDate)}</span>
                                <span>{awardedClient ? awardedClient.client.name : "No award yet"}</span>
                              </div>
                              <div className="tendering-board-card__footer">
                                <span>Stage age {attention.stageAgeDays}d</span>
                                <span>{attention.openFollowUpCount + attention.openClarificationCount} open items</span>
                              </div>
                              <div className="tendering-board-card__actions">
                                <button
                                  type="button"
                                  onMouseDown={stopTenderCardActionEvent}
                                  onClick={(event) => {
                                    stopTenderCardActionEvent(event);
                                    void openTenderWorkspace(tender.id, "activity");
                                  }}
                                >
                                  Add activity
                                </button>
                                <button
                                  type="button"
                                  onMouseDown={stopTenderCardActionEvent}
                                  onClick={(event) => {
                                    stopTenderCardActionEvent(event);
                                    void openTenderWorkspace(tender.id);
                                  }}
                                >
                                  Open deal
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="tendering-board__empty">No tenders in this stage.</div>
                    )}
                  </div>
                </section>
              ))}
            </div>
            )}
          </div>
          </div>
        </AppCard>
        ) : null}

        <div className={`tendering-detail-column${mode === "full" ? " tendering-detail-column--modal" : ""}${mode === "workspace" ? " tendering-detail-column--standalone" : ""}${showWorkspace ? " tendering-detail-column--modal-open" : ""}`}>
          {mode === "full" && showWorkspace ? (
            <button
              type="button"
              aria-label="Close tender workspace"
              className="tendering-detail-column__backdrop"
              onClick={closeTenderWorkspace}
            />
          ) : null}
          <div className={mode === "full" ? "tendering-detail-column__panel" : undefined}>
          {showWorkspace ? (selectedTender ? (
            <AppCard
              title={`${selectedTender.tenderNumber} - ${selectedTender.title}`}
              subtitle={`${selectedTender.tenderClients.map((item) => item.client.name).join(", ")} | ${formatCurrency(selectedTender.estimatedValue)}`}
              actions={
                <>
                  {selectedTender.sourceJob ? (
                    <span className="pill pill--green">Converted to {selectedTender.sourceJob.jobNumber}</span>
                  ) : null}
                  {mode === "full" ? (
                    <button type="button" className="tendering-topbar-button" onClick={closeTenderWorkspace}>
                      Close
                    </button>
                  ) : null}
                </>
              }
            >
              <div className={`tendering-workspace-scroll${mode === "workspace" ? " tendering-workspace-scroll--standalone" : ""}`}>
                <div className="tendering-workspace-hero">
                  <div className="tendering-workspace-hero__primary">
                    <span className="tendering-section-label tendering-section-label--muted">Workspace</span>
                    <div className="tendering-workspace-hero__headline">
                      <div>
                        <h3>{selectedTender.title}</h3>
                        <p className="muted-text">
                          {tenderFlow.find((item) => item.key === selectedTenderStage)?.label ?? selectedTenderStage} pipeline stage
                          {" | "}
                          {selectedTender.estimator ? `${selectedTender.estimator.firstName} ${selectedTender.estimator.lastName}` : "Unassigned estimator"}
                        </p>
                      </div>
                      <div className="tendering-register-card__pills">
                        <span className={`pill ${selectedTenderAttention ? getAttentionPillClass(selectedTenderAttention.attentionState) : "pill--green"}`}>
                          {selectedTenderAttention ? getAttentionLabel(selectedTenderAttention.attentionState) : "On track"}
                        </span>
                        <span className={`pill ${selectedTenderStage === "CONVERTED" ? "pill--green" : selectedTenderStage === "AWARDED" || selectedTenderStage === "CONTRACT_ISSUED" ? "pill--amber" : "pill--blue"}`}>
                          {formatCurrency(selectedTender.estimatedValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="tendering-workspace-hero__metrics">
                    <div className="tendering-workspace-hero__metric">
                      <span className="muted-text">Next action</span>
                      <strong>{formatDateTime(selectedTenderAttention?.nextActionAt)}</strong>
                    </div>
                    <div className="tendering-workspace-hero__metric">
                      <span className="muted-text">Last activity</span>
                      <strong>{formatDateTime(selectedTenderAttention?.lastActivityAt)}</strong>
                    </div>
                    <div className="tendering-workspace-hero__metric">
                      <span className="muted-text">Stage age</span>
                      <strong>{selectedTenderAttention?.stageAgeDays ?? 0}d</strong>
                    </div>
                    <div className="tendering-workspace-hero__metric">
                      <span className="muted-text">Open workload</span>
                      <strong>{selectedTenderAttention ? selectedTenderAttention.openFollowUpCount + selectedTenderAttention.openClarificationCount : 0}</strong>
                    </div>
                  </div>
                </div>

                <div className="tendering-stagebar">
                  {tenderFlow.map((item, index) => (
                    <div
                      key={item.key}
                      className={`tendering-stagebar__step${index <= selectedTenderFlowIndex ? " tendering-stagebar__step--active" : ""}`}
                    >
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>

                <div className="tendering-detail-grid tendering-workspace-shell">
                  <div className="stack-grid tendering-detail-main tendering-workspace-shell__canvas">
                  <div className="tendering-canvas-header">
                    <div>
                      <span className="tendering-section-label tendering-section-label--muted">Workspace canvas</span>
                      <h3>Activities, documents, and conversion</h3>
                    </div>
                    <div className="tendering-register-card__pills">
                      <span className="pill pill--blue">{activities.length} activities</span>
                      <span className="pill pill--amber">{selectedTender.tenderDocuments?.length ?? 0} docs</span>
                    </div>
                  </div>
                  <div className="tab-row tendering-canvas-tabs">
                    {[
                      ["overview", "Overview"],
                      ["activity", "Activity"],
                      ["documents", "Documents"],
                      ["conversion", "Conversion"]
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`tab-button${activeTab === value ? " tab-button--active" : ""}`}
                        onClick={() => setActiveTab(value as TenderTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {activeTab === "overview" ? (
                    <>
                      <div className="tendering-overview-summary">
                        <div className="tendering-overview-summary__hero">
                          <span className="tendering-section-label tendering-section-label--muted">Deal summary</span>
                          <h4>{editForm.title || selectedTender.title}</h4>
                          <p className="muted-text">
                            {selectedTender.tenderClients.map((item) => item.client.name).join(", ") || "No linked clients yet"}
                          </p>
                        </div>
                        <div className="tendering-overview-summary__metrics">
                          <div className="tendering-overview-summary__metric">
                            <span>Stage</span>
                            <strong>{tenderFlow.find((item) => item.key === getTenderStage(selectedTender))?.label ?? "Draft"}</strong>
                          </div>
                          <div className="tendering-overview-summary__metric">
                            <span>Attention</span>
                            <strong>{selectedTenderAttention ? getAttentionLabel(selectedTenderAttention.attentionState) : "On track"}</strong>
                          </div>
                          <div className="tendering-overview-summary__metric">
                            <span>Due</span>
                            <strong>{formatDate(selectedTender.dueDate)}</strong>
                          </div>
                          <div className="tendering-overview-summary__metric">
                            <span>Value</span>
                            <strong>{formatCurrency(selectedTender.estimatedValue)}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="tendering-overview-grid">
                        <div className="subsection tendering-overview-panel tendering-overview-panel--primary">
                          <div className="tendering-overview-panel__header">
                            <div>
                              <span className="tendering-section-label tendering-section-label--muted">Opportunity brief</span>
                              <strong>Commercial Snapshot</strong>
                            </div>
                            <span className={`pill ${getDueTone(selectedTender.dueDate) === "amber" ? "pill--amber" : "pill--blue"}`}>
                              Due {formatDate(selectedTender.dueDate)}
                            </span>
                          </div>
                          <div className="tendering-overview-brief">
                            <p>{selectedTender.description || "No tender description captured yet."}</p>
                            <p className="muted-text">{selectedTender.notes || "No internal summary notes captured yet."}</p>
                          </div>
                          <div className="tendering-overview-grid tendering-overview-grid--nested">
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Award path</span>
                              <strong>{selectedTenderAwardedClient ? selectedTenderAwardedClient.client.name : "No awarded client yet"}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Upcoming commitment</span>
                              <strong>{selectedTenderNextCommitment?.title ?? "No next action set"}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Primary contact</span>
                              <strong>{selectedTenderPrimaryContact ? `${selectedTenderPrimaryContact.firstName} ${selectedTenderPrimaryContact.lastName}` : "No primary contact yet"}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Delivery start</span>
                              <strong>{formatDate(selectedTender.proposedStartDate)}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="subsection tendering-overview-panel">
                          <div className="tendering-overview-panel__header">
                            <div>
                              <span className="tendering-section-label tendering-section-label--muted">People and context</span>
                              <strong>Relationship Snapshot</strong>
                            </div>
                            <span className="pill pill--blue">{selectedTenderContacts.length} contacts</span>
                          </div>
                          <div className="tendering-overview-relationship-grid">
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Clients</span>
                              <strong>{selectedTender.tenderClients.map((item) => item.client.name).join(", ") || "Not linked"}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Primary estimator</span>
                              <strong>{selectedTender.estimator ? `${selectedTender.estimator.firstName} ${selectedTender.estimator.lastName}` : "Unassigned"}</strong>
                            </div>
                          </div>
                          <div className="tendering-overview-contact-list">
                            {selectedTenderStakeholders.length ? (
                              selectedTenderStakeholders.slice(0, 4).map((item) => (
                                <div key={`${item.id}-overview-contact`} className="tendering-overview-contact-card">
                                  <div className="split-header">
                                    <div>
                                      <strong>{item.contactName}</strong>
                                      <p>{item.clientName}</p>
                                    </div>
                                    <span className={`pill ${item.isAwarded ? "pill--green" : item.contractIssued ? "pill--amber" : "pill--blue"}`}>
                                      {item.relationshipLabel}
                                    </span>
                                  </div>
                                  <span className="muted-text">
                                    {[item.contactEmail, item.contactPhone].filter(Boolean).join(" | ") || "No direct contact details"}
                                  </span>
                                  <p className="muted-text">{item.notes ?? "No stakeholder notes captured yet."}</p>
                                </div>
                              ))
                            ) : (
                              <p className="muted-text">No contacts linked yet. Add one from the rail to anchor the deal around a real person.</p>
                            )}
                          </div>
                        </div>

                        <div className="subsection tendering-overview-panel">
                          <div className="tendering-overview-panel__header">
                            <div>
                              <span className="tendering-section-label tendering-section-label--muted">Timing and health</span>
                              <strong>Momentum Snapshot</strong>
                            </div>
                            <span className={`pill ${selectedTenderAttention ? getAttentionPillClass(selectedTenderAttention.attentionState) : "pill--green"}`}>
                              {selectedTenderAttention ? getAttentionLabel(selectedTenderAttention.attentionState) : "On track"}
                            </span>
                          </div>
                          <div className="tendering-overview-grid tendering-overview-grid--nested">
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Last activity</span>
                              <strong>{formatDateTime(selectedTenderAttention?.lastActivityAt)}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Next action</span>
                              <strong>{formatDateTime(selectedTenderAttention?.nextActionAt)}</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Stage age</span>
                              <strong>{selectedTenderAttention?.stageAgeDays ?? 0} days</strong>
                            </div>
                            <div className="tendering-overview-panel__stat">
                              <span className="muted-text">Open items</span>
                              <strong>{selectedTenderOpenItemCount}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="subsection tendering-overview-panel">
                          <div className="tendering-overview-panel__header">
                            <div>
                              <span className="tendering-section-label tendering-section-label--muted">Workspace briefing</span>
                              <strong>Immediate Deal View</strong>
                            </div>
                            <span className="pill pill--blue">{selectedTender.tenderDocuments?.length ?? 0} docs</span>
                          </div>
                          <div className="tendering-overview-list">
                            <div className="tendering-overview-list__item">
                              <span className="muted-text">Pinned next step</span>
                              <strong>{selectedTenderNextCommitment?.title ?? "No next action set"}</strong>
                            </div>
                            <div className="tendering-overview-list__item">
                              <span className="muted-text">Open pressure</span>
                              <strong>{selectedTenderFocusItems.overdue.length ? `${selectedTenderFocusItems.overdue.length} overdue items` : "No overdue items"}</strong>
                            </div>
                            <div className="tendering-overview-list__item">
                              <span className="muted-text">Latest signal</span>
                              <strong>{selectedTenderLatestSignal?.title ?? "No recent activity yet"}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="subsection tendering-overview-panel tendering-overview-panel--full">
                          <div className="tendering-overview-panel__header">
                            <div>
                              <span className="tendering-section-label tendering-section-label--muted">Deal pulse</span>
                              <strong>What needs attention next</strong>
                            </div>
                            <span className={`pill ${selectedTenderFocusItems.overdue.length ? "pill--amber" : "pill--green"}`}>
                              {selectedTenderFocusItems.overdue.length ? `${selectedTenderFocusItems.overdue.length} overdue` : "Under control"}
                            </span>
                          </div>
                          <div className="tendering-overview-pulse-grid">
                            <div className="tendering-overview-pulse-card">
                              <span className="muted-text">Next commitment</span>
                              <strong>{selectedTenderNextCommitment?.title ?? "No next action set"}</strong>
                              <p className="muted-text">
                                {selectedTenderNextCommitment
                                  ? `${selectedTenderNextCommitment.kind} due ${formatDate(selectedTenderNextCommitment.dueAt)}`
                                  : "Capture a follow-up or clarification to anchor the next move."}
                              </p>
                            </div>
                            <div className="tendering-overview-pulse-card">
                              <span className="muted-text">Latest signal</span>
                              <strong>{selectedTenderLatestSignal?.title ?? "No recent activity yet"}</strong>
                              <p className="muted-text">
                                {selectedTenderLatestSignal
                                  ? `${selectedTenderLatestSignal.activityType.replaceAll("_", " ")} updated ${formatDateTime(selectedTenderLatestSignal.updatedAt ?? selectedTenderLatestSignal.createdAt)}`
                                  : "The activity stream has not picked up a recent signal yet."}
                              </p>
                            </div>
                            <div className="tendering-overview-pulse-card">
                              <span className="muted-text">Submission readiness</span>
                              <strong>{selectedTenderSubmittedReadiness?.importantChecks.length ? "Needs cleanup" : "Ready to submit"}</strong>
                              <p className="muted-text">
                                {selectedTenderSubmittedReadiness?.importantChecks.length
                                  ? selectedTenderSubmittedReadiness.importantChecks[0]
                                  : "Core due date, value, client, estimator, and commercial summary checks are in place."}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <form
                        className="admin-form tendering-overview-form"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void saveSelectedTender();
                        }}
                      >
                        <div className="tendering-overview-form__header">
                          <div>
                            <span className="tendering-section-label tendering-section-label--muted">Quick edit</span>
                            <strong>Adjust the core deal fields without leaving the workspace.</strong>
                          </div>
                          <button type="submit">Save workspace changes</button>
                        </div>
                        <div className="tendering-overview-form__grid">
                          <label className="tendering-overview-form__grid-wide">
                            {labels["field.title"]}
                            <input value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
                          </label>
                          <label>
                            {labels["field.status"]}
                            <select value={editForm.status} onChange={(event) => setEditForm({ ...editForm, status: event.target.value })}>
                              <option value="DRAFT">Draft</option>
                              <option value="IN_PROGRESS">Estimating</option>
                              <option value="SUBMITTED">Submitted</option>
                              <option value="AWARDED">Awarded</option>
                              <option value="CONVERTED">Converted</option>
                            </select>
                          </label>
                          <label>
                            {labels["field.estimator"]}
                            <select
                              value={editForm.estimatorUserId}
                              onChange={(event) => setEditForm({ ...editForm, estimatorUserId: event.target.value })}
                            >
                              <option value="">Select estimator</option>
                              {references.users.map((user) => (
                                <option key={user.id} value={user.id}>
                                  {user.firstName} {user.lastName}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            {labels["field.probability"]}
                            <input value={editForm.probability} onChange={(event) => setEditForm({ ...editForm, probability: event.target.value })} />
                          </label>
                          <label>
                            {labels["field.estimatedValue"]}
                            <input
                              value={editForm.estimatedValue}
                              onChange={(event) => setEditForm({ ...editForm, estimatedValue: event.target.value })}
                            />
                          </label>
                          <label>
                            {labels["field.dueDate"]}
                            <input type="date" value={editForm.dueDate} onChange={(event) => setEditForm({ ...editForm, dueDate: event.target.value })} />
                          </label>
                          <label>
                            {labels["field.proposedStart"]}
                            <input
                              type="date"
                              value={editForm.proposedStartDate}
                              onChange={(event) => setEditForm({ ...editForm, proposedStartDate: event.target.value })}
                            />
                          </label>
                          <label>
                            {labels["field.leadTimeDays"]}
                            <input
                              value={editForm.leadTimeDays}
                              onChange={(event) => setEditForm({ ...editForm, leadTimeDays: event.target.value })}
                            />
                          </label>
                          <label className="tendering-overview-form__grid-wide">
                            {labels["field.description"]}
                            <textarea
                              rows={3}
                              value={editForm.description}
                              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                            />
                          </label>
                        </div>
                      </form>

                      <div className="subsection">
                        <strong>Award and Contract Path</strong>
                        {selectedTender.tenderClients.map((item) => (
                          <div key={item.id} className="record-row">
                            <div>
                              <strong>{item.client.name}</strong>
                              <p className="muted-text">
                                {item.isAwarded ? "Awarded client" : "Bid-stage client"}
                                {item.contractIssued ? ` | Contract issued ${formatDate(item.contractIssuedAt)}` : ""}
                              </p>
                              {item.contact ? (
                                <p className="muted-text">
                              {labels["field.contact"]}: {item.contact.firstName} {item.contact.lastName}
                                </p>
                              ) : null}
                            </div>
                            <div className="inline-fields">
                              <select
                                value={item.contact?.id ?? ""}
                                onChange={(event) =>
                                  void updateSelectedTenderClient(item.id, { contactId: event.target.value })
                                }
                              >
                      <option value="">{labels["field.contact"]}</option>
                                {references.contacts
                                  .filter((contact) => contact.client?.id === item.client.id)
                                  .map((contact) => (
                                    <option key={contact.id} value={contact.id}>
                                      {contact.firstName} {contact.lastName}
                                    </option>
                                  ))}
                              </select>
                              <button
                                type="button"
                                onClick={() =>
                                  runLifecycleAction(
                                    `/tenders/${selectedTender.id}/award`,
                                    { tenderClientId: item.id },
                                    "Unable to award tender client."
                                  )
                                }
                              >
                                Set Awarded
                              </button>
                              <button
                                type="button"
                                disabled={!item.isAwarded || item.contractIssued}
                                onClick={() =>
                                  runLifecycleAction(
                                    `/tenders/${selectedTender.id}/contract`,
                                    { tenderClientId: item.id },
                                    "Unable to issue contract."
                                  )
                                }
                              >
                                Issue Contract
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {selectedTenderAttention ? (
                        <div className="subsection">
                          <strong>Attention Summary</strong>
                          <div className="detail-list detail-list--single">
                            <div>
                              <dt>Momentum</dt>
                              <dd>{getAttentionLabel(selectedTenderAttention.attentionState)}</dd>
                            </div>
                            <div>
                              <dt>Last activity</dt>
                              <dd>{formatDateTime(selectedTenderAttention.lastActivityAt)}</dd>
                            </div>
                            <div>
                              <dt>Next action</dt>
                              <dd>{formatDateTime(selectedTenderAttention.nextActionAt)}</dd>
                            </div>
                            <div>
                              <dt>Stage age</dt>
                              <dd>{selectedTenderAttention.stageAgeDays} days</dd>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {selectedTenderSubmittedReadiness ? (
                        <div className="subsection">
                          <strong>Stage Readiness</strong>
                          <div className="tendering-readiness-panel">
                            <div className="tendering-readiness-panel__header">
                              <span className={`pill ${selectedTenderSubmittedReadiness.canProceed ? "pill--green" : "pill--amber"}`}>
                                {selectedTenderSubmittedReadiness.canProceed ? "Ready for Submitted" : "Submission blocked"}
                              </span>
                              <span className="muted-text">Validation checks for the next formal stage move.</span>
                            </div>
                            {selectedTenderSubmittedReadiness.blockers.length ? (
                              <div className="stack-grid">
                                {selectedTenderSubmittedReadiness.blockers.map((item) => (
                                  <div key={item} className="notice-banner notice-banner--warning">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="muted-text">Due date, value, estimator, and linked client are all in place for submission.</p>
                            )}
                            {selectedTenderSubmittedReadiness.importantChecks.length ? (
                              <div className="tendering-readiness-list">
                                {selectedTenderSubmittedReadiness.importantChecks.map((item) => (
                                  <div key={item} className="tendering-readiness-list__item">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      <div className="subsection">
                        <strong>Focus / Next Actions</strong>
                        <div className="tendering-focus-grid">
                          <div className="tendering-focus-card">
                            <span className="muted-text">Pinned next action</span>
                            {selectedTenderFocusItems.upcoming[0] ? (
                              <>
                                <strong>{selectedTenderFocusItems.upcoming[0].title}</strong>
                                <p className="muted-text">
                                  {selectedTenderFocusItems.upcoming[0].kind} due {formatDate(selectedTenderFocusItems.upcoming[0].dueAt)}
                                </p>
                              </>
                            ) : (
                              <p className="muted-text">No open upcoming commitments yet.</p>
                            )}
                          </div>
                          <div className="tendering-focus-card">
                            <span className="muted-text">Overdue items</span>
                            <strong>{selectedTenderFocusItems.overdue.length}</strong>
                            <p className="muted-text">
                              {selectedTenderAttention
                                ? `${selectedTenderAttention.overdueFollowUpCount} follow-ups and ${selectedTenderAttention.overdueClarificationCount} clarifications are overdue.`
                                : "No overdue breakdown available."}
                            </p>
                          </div>
                          <div className="tendering-focus-card">
                            <span className="muted-text">Tender age</span>
                            <strong>{selectedTenderAttention?.tenderAgeDays ?? 0} days</strong>
                            <p className="muted-text">Use this with stage age to spot slow-moving opportunities.</p>
                          </div>
                        </div>
                        <div className="tendering-focus-list">
                          {selectedTenderFocusItems.upcoming.slice(0, 3).map((item) => (
                            <div key={item.id} className="tendering-focus-list__item">
                              <strong>{item.title}</strong>
                              <span className="muted-text">{item.kind} due {formatDate(item.dueAt)}</span>
                            </div>
                          ))}
                          {!selectedTenderFocusItems.upcoming.length ? (
                            <p className="muted-text">No upcoming commitments to surface right now.</p>
                          ) : null}
                        </div>
                        <div className="tendering-focus-list">
                          {selectedTenderFocusItems.recent.map((item) => (
                            <div key={item.id} className="tendering-focus-list__item">
                              <strong>{item.title}</strong>
                              <span className="muted-text">
                                {item.activityType.replaceAll("_", " ")} {item.dueAt ? `due ${formatDate(item.dueAt)}` : `updated ${formatDateTime(item.updatedAt ?? item.createdAt)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                    </>
                  ) : null}

                  {activeTab === "activity" ? (
                    <>
                      <div className="tendering-activity-band">
                        <div className="tendering-activity-band__intro">
                          <span className="tendering-section-label tendering-section-label--muted">Activity workspace</span>
                          <h4>Keep the deal moving with one shared timeline.</h4>
                          <p className="muted-text">Capture the next step, clear overdue pressure, and review the running commercial conversation without leaving the tender.</p>
                        </div>
                        <div className="tendering-activity-band__stats">
                          <div className="tendering-activity-band__stat">
                            <span>Open items</span>
                            <strong>{selectedTenderAttention ? selectedTenderAttention.openFollowUpCount + selectedTenderAttention.openClarificationCount : 0}</strong>
                          </div>
                          <div className="tendering-activity-band__stat">
                            <span>Overdue</span>
                            <strong>{selectedTenderFocusItems.overdue.length}</strong>
                          </div>
                          <div className="tendering-activity-band__stat">
                            <span>Timeline events</span>
                            <strong>{activityTimeline.length}</strong>
                          </div>
                          <div className="tendering-activity-band__stat">
                            <span>Last touch</span>
                            <strong>{selectedTenderAttention?.lastActivityAt ? formatDate(selectedTenderAttention.lastActivityAt) : "Not set"}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="subsection">
                        <strong>Activity Focus</strong>
                        <div className="tendering-focus-grid">
                          <div className="tendering-focus-card">
                            <span className="muted-text">Next required action</span>
                            <strong>{selectedTenderFocusItems.upcoming[0]?.title ?? "No next action set"}</strong>
                            <p className="muted-text">
                              {selectedTenderFocusItems.upcoming[0]
                                ? `${selectedTenderFocusItems.upcoming[0].kind} due ${formatDate(selectedTenderFocusItems.upcoming[0].dueAt)}`
                                : "Add a follow-up or clarification to anchor the next step."}
                            </p>
                          </div>
                          <div className="tendering-focus-card">
                            <span className="muted-text">Open workload</span>
                            <strong>{selectedTenderAttention ? selectedTenderAttention.openFollowUpCount + selectedTenderAttention.openClarificationCount : 0}</strong>
                            <p className="muted-text">
                              {selectedTenderAttention
                                ? `${selectedTenderAttention.openFollowUpCount} open follow-ups and ${selectedTenderAttention.openClarificationCount} open clarifications`
                                : "No open workload metrics available."}
                            </p>
                          </div>
                          <div className="tendering-focus-card">
                            <span className="muted-text">Overdue pressure</span>
                            <strong>{selectedTenderFocusItems.overdue.length}</strong>
                            <p className="muted-text">Overdue items are highlighted below in the timeline and activity lists.</p>
                          </div>
                          <div className="tendering-focus-card">
                            <span className="muted-text">Last touch</span>
                            <strong>{selectedTenderAttention?.lastActivityAt ? formatDateTime(selectedTenderAttention.lastActivityAt) : "No recent touch"}</strong>
                            <p className="muted-text">Use this to spot idle deals before they start rotting in stage.</p>
                          </div>
                        </div>
                        <div className="tendering-focus-list tendering-focus-list--activity">
                          <div className="tendering-focus-list__item">
                            <strong>Latest signal</strong>
                            <span className="muted-text">
                              {selectedTenderLatestSignal
                                ? `${selectedTenderLatestSignal.title} | ${selectedTenderLatestSignal.activityType.replaceAll("_", " ")}`
                                : "No recent activity signal yet"}
                            </span>
                          </div>
                          <div className="tendering-focus-list__item">
                            <strong>Next scheduled move</strong>
                            <span className="muted-text">
                              {selectedTenderNextCommitment
                                ? `${selectedTenderNextCommitment.kind} due ${formatDate(selectedTenderNextCommitment.dueAt)}`
                                : "Create a follow-up or clarification to anchor the next commercial step"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="tendering-activity-layout">
                        <div className="tendering-activity-layout__main">
                      <div className="subsection tendering-activity-section">
                        <strong>Unified Activity Capture</strong>
                        <form className="admin-form" onSubmit={submitUnifiedActivity}>
                          <div className="tendering-create-grid">
                            <label>
                              Activity type
                              <select
                                value={quickActivity.activityType}
                                onChange={(event) => setQuickActivity({ ...quickActivity, activityType: event.target.value })}
                              >
                                <option value="FOLLOW_UP">Follow-up</option>
                                <option value="CALL">Call</option>
                                <option value="MEETING">Meeting</option>
                                <option value="CLARIFICATION">Clarification</option>
                                <option value="NOTE">Internal note</option>
                                <option value="SUBMISSION_TASK">Submission task</option>
                              </select>
                            </label>
                            <label className="tendering-create-grid__wide">
                              Title
                              <input
                                value={quickActivity.title}
                                onChange={(event) => setQuickActivity({ ...quickActivity, title: event.target.value })}
                              />
                            </label>
                            <label className="tendering-create-grid__wide">
                              Details
                              <input
                                value={quickActivity.details}
                                onChange={(event) => setQuickActivity({ ...quickActivity, details: event.target.value })}
                              />
                            </label>
                            <label>
                              Due date
                              <input
                                type="date"
                                value={quickActivity.dueAt}
                                onChange={(event) => setQuickActivity({ ...quickActivity, dueAt: event.target.value })}
                              />
                            </label>
                            <label>
                              Assignee
                              <select
                                value={quickActivity.assignedUserId}
                                onChange={(event) => setQuickActivity({ ...quickActivity, assignedUserId: event.target.value })}
                              >
                                <option value="">Unassigned</option>
                                {references.users.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.firstName} {user.lastName}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            type="submit"
                            disabled={
                              !quickActivity.title.trim() ||
                              ((quickActivity.activityType === "FOLLOW_UP" ||
                                quickActivity.activityType === "CALL" ||
                                quickActivity.activityType === "MEETING" ||
                                quickActivity.activityType === "SUBMISSION_TASK") &&
                                !quickActivity.dueAt)
                            }
                          >
                            Add activity
                          </button>
                        </form>
                      </div>

                      <div className="subsection tendering-activity-section">
                        <strong>Quick Add Activity</strong>
                        <div className="tendering-quick-actions tendering-quick-actions--activity">
                          <form
                            className="admin-form tendering-activity-quick-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void submitQuickActivity(
                                `/tenders/${selectedTender.id}/notes`,
                                { body: quickNote },
                                () => setQuickNote("")
                              );
                            }}
                          >
                            <span className="tendering-section-label tendering-section-label--muted">Internal note</span>
                            <label>
                              Add note
                              <input value={quickNote} onChange={(event) => setQuickNote(event.target.value)} />
                            </label>
                            <button type="submit" disabled={!quickNote.trim()}>
                              Save note
                            </button>
                          </form>

                          <form
                            className="admin-form tendering-activity-quick-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void submitQuickActivity(
                                `/tenders/${selectedTender.id}/clarifications`,
                                quickClarification,
                                () => setQuickClarification({ subject: "", dueDate: "" })
                              );
                            }}
                          >
                            <span className="tendering-section-label tendering-section-label--muted">Clarification</span>
                            <label>
                              Add clarification
                              <input
                                value={quickClarification.subject}
                                onChange={(event) => setQuickClarification({ ...quickClarification, subject: event.target.value })}
                              />
                            </label>
                            <label>
                              Due date
                              <input
                                type="date"
                                value={quickClarification.dueDate}
                                onChange={(event) => setQuickClarification({ ...quickClarification, dueDate: event.target.value })}
                              />
                            </label>
                            <button type="submit" disabled={!quickClarification.subject.trim()}>
                              Save clarification
                            </button>
                          </form>

                          <form
                            className="admin-form tendering-activity-quick-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              void submitQuickActivity(
                                `/tenders/${selectedTender.id}/follow-ups`,
                                quickFollowUp,
                                () => setQuickFollowUp({ details: "", dueAt: "" })
                              );
                            }}
                          >
                            <span className="tendering-section-label tendering-section-label--muted">Follow-up</span>
                            <label>
                              Add follow-up
                              <input
                                value={quickFollowUp.details}
                                onChange={(event) => setQuickFollowUp({ ...quickFollowUp, details: event.target.value })}
                              />
                            </label>
                            <label>
                              Due at
                              <input
                                type="date"
                                value={quickFollowUp.dueAt}
                                onChange={(event) => setQuickFollowUp({ ...quickFollowUp, dueAt: event.target.value })}
                              />
                            </label>
                            <button type="submit" disabled={!quickFollowUp.details.trim() || !quickFollowUp.dueAt}>
                              Save follow-up
                            </button>
                          </form>
                        </div>
                      </div>

                      </div>

                      <div className="tendering-activity-layout__rail">
                      <div className="subsection tendering-activity-section">
                        <div className="tendering-rail-card__header">
                          <strong>Activity Feed</strong>
                          <span className="pill pill--blue">{visibleActivities.length}</span>
                        </div>
                        <div className="tendering-activity-filterbar">
                          <div className="tendering-view-toggle">
                            {[
                              ["ALL", "All"],
                              ["OPEN", "Open"],
                              ["OVERDUE", "Overdue"],
                              ["COMPLETED", "Completed"]
                            ].map(([value, label]) => (
                              <button
                                key={value}
                                type="button"
                                className={`tendering-filter-chip${activityView === value ? " tendering-filter-chip--active" : ""}`}
                                onClick={() => setActivityView(value as TenderActivityView)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                          <select
                            className="tendering-filter-select"
                            value={activityOwnerFilter}
                            onChange={(event) => {
                              const nextValue = event.target.value;
                              setActivityOwnerFilter(nextValue);
                              if (activityView === "MY_OPEN" && nextValue === "ALL") {
                                setActivityView("OPEN");
                              }
                            }}
                          >
                            <option value="ALL">All owners</option>
                            <option value="UNASSIGNED">Unassigned</option>
                            {activityOwnerOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`tendering-filter-chip${activityView === "MY_OPEN" ? " tendering-filter-chip--active" : ""}`}
                            onClick={() => {
                              if (activityOwnerFilter === "ALL") {
                                const preferredOwner = selectedTender.estimator?.id ?? activityOwnerOptions[0]?.id ?? "UNASSIGNED";
                                setActivityOwnerFilter(preferredOwner);
                              }
                              setActivityView("MY_OPEN");
                            }}
                          >
                            By owner
                          </button>
                        </div>
                        <div className="tendering-activity-feed-list">
                        {visibleActivities.length ? (
                          visibleActivities.map((item) => (
                            <div key={item.id} className={`tendering-feed-item tendering-feed-item--${
                              item.status === "DONE" || item.status === "CLOSED" || item.status === "RECORDED"
                                ? "green"
                                : item.dueAt && new Date(item.dueAt).getTime() < Date.now()
                                  ? "amber"
                                  : "blue"
                            }`}>
                              <div className="split-header">
                                <div>
                                  <strong>{item.title}</strong>
                                  <p className="muted-text">{item.activityType.replaceAll("_", " ")}</p>
                                </div>
                                <span className={`pill ${
                                  item.status === "DONE" || item.status === "CLOSED" || item.status === "RECORDED"
                                    ? "pill--green"
                                    : item.dueAt && new Date(item.dueAt).getTime() < Date.now()
                                      ? "pill--amber"
                                      : "pill--blue"
                                }`}>
                                  {item.status}
                                </span>
                              </div>
                              <p>{item.details || item.title}</p>
                              <span className="muted-text">
                                {item.dueAt ? `Due ${formatDate(item.dueAt)}` : `Updated ${formatDateTime(item.updatedAt ?? item.createdAt)}`}
                                {item.assignedUser ? ` | ${item.assignedUser.firstName} ${item.assignedUser.lastName}` : ""}
                              </span>
                              {item.activityType !== "NOTE" ? (
                                <div className="tendering-board-card__actions">
                                  {item.activityType === "CLARIFICATION" ? (
                                    item.status === "CLOSED" ? (
                                      <button type="button" onClick={() => void updateUnifiedActivity(item.id, { status: "OPEN" })}>
                                        Reopen
                                      </button>
                                    ) : (
                                      <button type="button" onClick={() => void updateUnifiedActivity(item.id, { status: "CLOSED" })}>
                                        Close
                                      </button>
                                    )
                                  ) : item.status === "DONE" ? (
                                    <button type="button" onClick={() => void updateUnifiedActivity(item.id, { status: "OPEN" })}>
                                      Reopen
                                    </button>
                                  ) : (
                                    <button type="button" onClick={() => void updateUnifiedActivity(item.id, { status: "DONE" })}>
                                      Mark done
                                    </button>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No activities match this activity view yet.</p>
                        )}
                        </div>
                      </div>

                      <div className="subsection tendering-activity-section">
                        <div className="tendering-rail-card__header">
                          <strong>Timeline</strong>
                          <span className="pill pill--amber">{activityTimeline.length}</span>
                        </div>
                        <div className="tendering-activity-feed-list tendering-activity-feed-list--timeline">
                        {activityTimeline.length ? (
                          activityTimeline.map((item) => (
                            <div key={item.id} className={`tendering-feed-item tendering-feed-item--${item.tone}`}>
                              <div className="split-header">
                                <div>
                                  <strong>{item.title}</strong>
                                  <p className="muted-text">{item.type}</p>
                                </div>
                                <span className={`pill pill--${item.tone}`}>{item.type}</span>
                              </div>
                              <span className="muted-text">{item.date ? formatDate(item.date) : "Recorded on tender"}</span>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No activity recorded yet.</p>
                        )}
                        </div>
                      </div>

                      <div className="subsection tendering-activity-section">
                        <strong>Notes</strong>
                        {selectedTender.tenderNotes.length ? (
                          selectedTender.tenderNotes.map((note) => (
                            <div key={note.id} className="tendering-feed-item tendering-feed-item--blue">
                              <div className="split-header">
                                <strong>Internal note</strong>
                                <span className="pill pill--blue">Note</span>
                              </div>
                              <p>{note.body}</p>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No notes recorded yet.</p>
                        )}
                      </div>

                      <div className="subsection tendering-activity-section">
                        <strong>Clarifications</strong>
                        {selectedTender.clarifications.length ? (
                          selectedTender.clarifications.map((item) => (
                            <div key={item.id} className={`tendering-feed-item tendering-feed-item--${item.status === "CLOSED" ? "green" : getDueTone(item.dueDate)}`}>
                              <div className="split-header">
                                <strong>{item.subject}</strong>
                                <span className={`pill ${item.status === "CLOSED" ? "pill--green" : getDueTone(item.dueDate) === "amber" ? "pill--amber" : "pill--blue"}`}>{item.status}</span>
                              </div>
                              <p>{item.response || "No response recorded yet."}</p>
                              <span className="muted-text">Due {formatDate(item.dueDate)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No clarifications recorded yet.</p>
                        )}
                      </div>

                      <div className="subsection tendering-activity-section">
                        <strong>Follow-ups</strong>
                        {selectedTender.followUps.length ? (
                          selectedTender.followUps.map((item) => (
                            <div key={item.id} className={`tendering-feed-item tendering-feed-item--${item.status === "DONE" ? "green" : getDueTone(item.dueAt)}`}>
                              <div className="split-header">
                                <strong>{item.details}</strong>
                                <span className={`pill ${item.status === "DONE" ? "pill--green" : getDueTone(item.dueAt) === "amber" ? "pill--amber" : "pill--blue"}`}>{item.status}</span>
                              </div>
                              <span className="muted-text">Due {formatDate(item.dueAt)}</span>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No follow-ups recorded yet.</p>
                        )}
                      </div>
                      </div>
                      </div>
                    </>
                  ) : null}

                  {activeTab === "documents" ? (
                    <>
                      <div className="subsection">
                        <strong>Tender Documents</strong>
                        {selectedTender.tenderDocuments?.length ? (
                          <div className="check-list">
                            {selectedTender.tenderDocuments.map((item) => (
                              <label key={item.id} className="tendering-document-row">
                                <div>
                                  <strong>{item.title}</strong>
                                  <p className="muted-text">{item.category}</p>
                                  {item.fileLink?.webUrl ? (
                                    <a href={item.fileLink.webUrl} target="_blank" rel="noreferrer">
                                      Open SharePoint link
                                    </a>
                                  ) : null}
                                </div>
                                <input
                                  type="checkbox"
                                  checked={selectedDocumentIds.includes(item.id)}
                                  onChange={() =>
                                    setSelectedDocumentIds((current) =>
                                      current.includes(item.id)
                                        ? current.filter((id) => id !== item.id)
                                        : [...current, item.id]
                                    )
                                  }
                                />
                              </label>
                            ))}
                          </div>
                        ) : (
                          <p className="muted-text">No tender documents linked yet.</p>
                        )}
                      </div>

                      <form className="admin-form" onSubmit={submitDocument}>
                        <label>
                          Document category
                          <input
                            value={documentForm.category}
                            onChange={(event) => setDocumentForm({ ...documentForm, category: event.target.value })}
                          />
                        </label>
                        <label>
                          Document title
                          <input
                            value={documentForm.title}
                            onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })}
                          />
                        </label>
                        <label>
                          File name
                          <input
                            value={documentForm.fileName}
                            onChange={(event) => setDocumentForm({ ...documentForm, fileName: event.target.value })}
                          />
                        </label>
                        <button type="submit">Add document</button>
                      </form>
                    </>
                  ) : null}

                  {activeTab === "conversion" ? (
                    <form
                      className="admin-form"
                      onSubmit={(event) => {
                          event.preventDefault();
                          void runLifecycleAction(
                            `/tenders/${selectedTender.id}/convert-to-job`,
                            {
                              ...buildWorkspaceConversionPayload()
                            },
                            "Unable to convert tender to job."
                          );
                        }}
                    >
                      <div className="subsection">
                        <strong>Convert to job</strong>
                        <p className="muted-text">
                          {selectedTenderStage === "CONTRACT_ISSUED" || selectedTenderStage === "CONVERTED"
                            ? "This tender is ready for operational conversion."
                            : "Award a client and issue contract before converting."}
                        </p>
                        <label>
                          Job number
                          <input
                            value={conversionForm.jobNumber}
                            onChange={(event) => setConversionForm({ ...conversionForm, jobNumber: event.target.value })}
                          />
                        </label>
                        <label>
                          Job name
                          <input
                            value={conversionForm.name}
                            onChange={(event) => setConversionForm({ ...conversionForm, name: event.target.value })}
                          />
                        </label>
                        <label>
                          Description
                          <input
                            value={conversionForm.description}
                            onChange={(event) => setConversionForm({ ...conversionForm, description: event.target.value })}
                          />
                        </label>
                        <label>
                          Site
                          <select
                            value={conversionForm.siteId}
                            onChange={(event) => setConversionForm({ ...conversionForm, siteId: event.target.value })}
                          >
                            <option value="">Select site</option>
                            {references.sites.map((site) => (
                              <option key={site.id} value={site.id}>
                                {site.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Project manager
                          <select
                            value={conversionForm.projectManagerId}
                            onChange={(event) => setConversionForm({ ...conversionForm, projectManagerId: event.target.value })}
                          >
                            <option value="">Select project manager</option>
                            {references.users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Supervisor
                          <select
                            value={conversionForm.supervisorId}
                            onChange={(event) => setConversionForm({ ...conversionForm, supervisorId: event.target.value })}
                          >
                            <option value="">Select supervisor</option>
                            {references.users.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.firstName} {user.lastName}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="checkbox-inline">
                          <input
                            type="checkbox"
                            checked={conversionForm.carryTenderDocuments}
                            onChange={(event) =>
                              setConversionForm({ ...conversionForm, carryTenderDocuments: event.target.checked })
                            }
                          />
                          Carry selected tender documents
                        </label>
                        <button
                          type="submit"
                          disabled={
                            Boolean(selectedTender.sourceJob) ||
                            !selectedTender.tenderClients.some((item) => item.contractIssued)
                          }
                        >
                          {selectedTender.sourceJob ? "Already converted" : "Convert to job"}
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>

                  <div className="stack-grid tendering-detail-rail tendering-workspace-shell__rail">
                  <div className="subsection tendering-rail-card tendering-rail-card--summary tendering-rail-card--workspace">
                    <div className="tendering-rail-card__header">
                      <div>
                        <span className="tendering-section-label tendering-section-label--muted">Workspace rail</span>
                        <strong>Deal sidebar</strong>
                      </div>
                      <span className="pill pill--blue">{selectedTenderStage.replaceAll("_", " ")}</span>
                    </div>
                    <div className="tendering-side-metrics tendering-side-metrics--compact">
                      <div className="tendering-side-metric">
                        <span className="muted-text">Tender</span>
                        <strong>{selectedTender.tenderNumber}</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Probability</span>
                        <strong>{selectedTender.probability ?? 0}%</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Value</span>
                        <strong>{formatCurrency(selectedTender.estimatedValue)}</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Due</span>
                        <strong>{formatDate(selectedTender.dueDate)}</strong>
                      </div>
                    </div>
                    <div className="tendering-summary-stack">
                      <div className="tendering-summary-line">
                        <span className="muted-text">Primary client</span>
                        <strong>{selectedTender.tenderClients[0]?.client.name ?? "Not linked"}</strong>
                      </div>
                      <div className="tendering-summary-line">
                        <span className="muted-text">Primary contact</span>
                        <strong>{selectedTenderPrimaryContact ? `${selectedTenderPrimaryContact.firstName} ${selectedTenderPrimaryContact.lastName}` : "Not linked"}</strong>
                      </div>
                      <div className="tendering-summary-line">
                        <span className="muted-text">Estimator</span>
                        <strong>{selectedTender.estimator ? `${selectedTender.estimator.firstName} ${selectedTender.estimator.lastName}` : "Unassigned"}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="subsection tendering-rail-card tendering-rail-card--workspace">
                    <div className="tendering-rail-card__header">
                      <strong>Stage Actions</strong>
                      <span className="pill pill--amber">{selectedTenderAttention?.stageAgeDays ?? 0}d</span>
                    </div>
                    {selectedTenderReadinessHighlights.length ? (
                      <div className="tendering-rail-checklist">
                        {selectedTenderReadinessHighlights.map((item) => (
                          <div key={item} className="tendering-rail-checklist__item">
                            {item}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted-text">This stage already has the key commercial checks covered.</p>
                    )}
                    <div className="tendering-stage-actions">
                      <button type="button" onClick={() => void moveSelectedTenderStage("DRAFT")}>
                        Move to Draft
                      </button>
                      <button type="button" onClick={() => void moveSelectedTenderStage("IN_PROGRESS")}>
                        Move to Estimating
                      </button>
                      <button type="button" onClick={() => void moveSelectedTenderStage("SUBMITTED")}>
                        Move to Submitted
                      </button>
                    </div>
                  </div>

                  <div className="subsection tendering-rail-card tendering-rail-card--workspace">
                    <div className="tendering-rail-card__header">
                      <strong>Deal Pulse</strong>
                      <span className="pill pill--blue">{selectedTenderOpenItemCount} open</span>
                    </div>
                    <div className="tendering-side-metrics">
                      <div className="tendering-side-metric">
                        <span className="muted-text">Documents</span>
                        <strong>{selectedTender.tenderDocuments?.length ?? 0}</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Open follow-ups</span>
                        <strong>{selectedTenderOpenFollowUps.length}</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Attention state</span>
                        <strong>{selectedTenderAttention ? getAttentionLabel(selectedTenderAttention.attentionState) : "On track"}</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Stage age</span>
                        <strong>{selectedTenderAttention?.stageAgeDays ?? 0}d</strong>
                      </div>
                      <div className="tendering-side-metric">
                        <span className="muted-text">Tender age</span>
                        <strong>{selectedTenderAttention?.tenderAgeDays ?? 0}d</strong>
                      </div>
                    </div>
                    <div className="tendering-rail-pulse-list">
                      <div className="tendering-rail-pulse-item">
                        <span className="muted-text">Next action</span>
                        <strong>{selectedTenderNextCommitment?.title ?? "No next action set"}</strong>
                        <p className="muted-text">
                          {selectedTenderNextCommitment
                            ? `${selectedTenderNextCommitment.kind} due ${formatDate(selectedTenderNextCommitment.dueAt)}`
                            : "Seed a follow-up or clarification to anchor the next move."}
                        </p>
                      </div>
                      <div className="tendering-rail-pulse-item">
                        <span className="muted-text">Latest signal</span>
                        <strong>{selectedTenderLatestSignal?.title ?? "No recent activity yet"}</strong>
                        <p className="muted-text">
                          {selectedTenderLatestSignal
                            ? `${selectedTenderLatestSignal.activityType.replaceAll("_", " ")} updated ${formatDateTime(selectedTenderLatestSignal.updatedAt ?? selectedTenderLatestSignal.createdAt)}`
                            : "The activity stream has not registered any recent movement."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="subsection tendering-rail-card tendering-rail-card--workspace">
                      <div className="tendering-rail-card__header">
                        <strong>Relationship Map</strong>
                        <span className="pill pill--blue">{selectedTenderStakeholders.length} stakeholders</span>
                      </div>
                    {selectedTenderStakeholders.length ? (
                      selectedTender.tenderClients.map((item, index) => {
                        const stakeholderSnapshot = selectedTenderStakeholderSnapshots.find((entry) => entry.id === item.id);
                        const stakeholderDraft = stakeholderDrafts[item.id] ?? {
                          relationshipType: item.relationshipType ?? "",
                          notes: item.notes ?? ""
                        };
                        const isSavingStakeholder = savingStakeholderIds.includes(item.id);
                        const stakeholderHasPendingChanges =
                          stakeholderDraft.relationshipType.trim() !== (item.relationshipType?.trim() ?? "") ||
                          stakeholderDraft.notes.trim() !== (item.notes?.trim() ?? "");

                        return (
                        <div key={`${item.id}-contact`} className={`tendering-feed-item ${item.isAwarded ? "tendering-feed-item--green" : "tendering-feed-item--blue"}`}>
                          <div className="split-header">
                            <div>
                              <strong>{item.contact ? `${item.contact.firstName} ${item.contact.lastName}` : item.client.name}</strong>
                              <p>{item.client.name}</p>
                            </div>
                            <div className="tendering-relationship-map__badges">
                              <span className={`pill ${item.isAwarded ? "pill--green" : item.contractIssued ? "pill--amber" : "pill--blue"}`}>
                                {stakeholderSnapshot?.roleLabel ?? normalizeStakeholderRoleLabel(item.relationshipType, item.isAwarded ? "Awarded party" : index === 0 ? "Primary client" : "Stakeholder")}
                              </span>
                              <span className={`pill ${isSavingStakeholder ? "pill--amber" : stakeholderHasPendingChanges ? "pill--blue" : "pill--green"}`}>
                                {isSavingStakeholder ? "Saving" : stakeholderHasPendingChanges ? "Unsaved" : "Saved"}
                              </span>
                            </div>
                          </div>
                          <div className="tendering-stakeholder-snapshot">
                            <div className="tendering-stakeholder-snapshot__item">
                              <span className="muted-text">Relationship</span>
                              <strong>{stakeholderSnapshot?.relationshipSummary ?? item.client.name}</strong>
                              <p className="muted-text">{stakeholderSnapshot?.communicationSummary ?? "No direct contact details"}</p>
                            </div>
                            <div className="tendering-stakeholder-snapshot__item">
                              <span className="muted-text">Deal path</span>
                              <strong>{stakeholderSnapshot?.roleLabel ?? "Stakeholder"}</strong>
                              <p className="muted-text">
                                {stakeholderDraft.notes.trim()
                                  ? stakeholderDraft.notes.trim()
                                  : stakeholderSnapshot?.roleGuidance ?? "Keep this stakeholder aligned to the deal path."}
                              </p>
                            </div>
                          </div>
                          <p className="muted-text">Role and notes save when you leave the field. You can also save or revert this stakeholder card explicitly.</p>
                          <label className="admin-form">
                            <span>Stakeholder role</span>
                            <select
                              value={stakeholderDraft.relationshipType}
                              onChange={(event) =>
                                updateStakeholderDraft(item.id, { relationshipType: event.target.value })
                              }
                              onBlur={(event) => {
                                if (shouldSkipStakeholderBlurSave(event, item.id, stakeholderBlurActionRef.current)) {
                                  stakeholderBlurActionRef.current = null;
                                  return;
                                }
                                void saveStakeholderDraft(item.id);
                              }}
                            >
                              <option value="">Select role</option>
                              <option value="Primary client">Primary client</option>
                              <option value="Procurement contact">Procurement contact</option>
                              <option value="Approver">Approver</option>
                              <option value="Reviewer">Reviewer</option>
                              <option value="Awarded party">Awarded party</option>
                              <option value="Delivery stakeholder">Delivery stakeholder</option>
                            </select>
                          </label>
                          <label className="admin-form">
                            <span>Relationship notes</span>
                            <textarea
                              rows={2}
                              value={stakeholderDraft.notes}
                              onChange={(event) =>
                                updateStakeholderDraft(item.id, { notes: event.target.value })
                              }
                              onBlur={(event) => {
                                if (shouldSkipStakeholderBlurSave(event, item.id, stakeholderBlurActionRef.current)) {
                                  stakeholderBlurActionRef.current = null;
                                  return;
                                }
                                void saveStakeholderDraft(item.id);
                              }}
                            />
                          </label>
                          <div className="inline-fields" data-stakeholder-actions={item.id}>
                            <button
                              type="button"
                              className="tendering-topbar-button"
                              onMouseDown={() => {
                                stakeholderBlurActionRef.current = item.id;
                              }}
                              onClick={() => {
                                stakeholderBlurActionRef.current = null;
                                void saveStakeholderDraft(item.id);
                              }}
                              disabled={!stakeholderHasPendingChanges || isSavingStakeholder}
                            >
                              Save stakeholder
                            </button>
                            <button
                              type="button"
                              className="tendering-topbar-button"
                              onMouseDown={() => {
                                stakeholderBlurActionRef.current = item.id;
                              }}
                              onClick={() => {
                                stakeholderBlurActionRef.current = null;
                                resetStakeholderDraft(item.id);
                              }}
                              disabled={!stakeholderHasPendingChanges || isSavingStakeholder}
                            >
                              Revert
                            </button>
                          </div>
                        </div>
                      )})
                    ) : (
                      <p className="muted-text">No linked stakeholders on this tender yet.</p>
                    )}
                  </div>

                  <div className="subsection tendering-rail-card tendering-rail-card--workspace">
                    <div className="tendering-rail-card__header">
                      <strong>Communication View</strong>
                      <span className="pill pill--amber">{selectedTenderOpenItemCount} active</span>
                    </div>
                    <p className="muted-text">Track who is in the conversation, who owns the next step, and whether the commercial thread is staying warm.</p>
                    <div className="tendering-overview-pulse-grid tendering-overview-pulse-grid--communication">
                      {selectedTenderCommunicationSignals.map((item) => (
                        <div key={item.label} className="tendering-overview-pulse-card tendering-overview-pulse-card--communication">
                          <span className="muted-text">{item.label}</span>
                          <strong>{item.value}</strong>
                          <p className="muted-text">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="tendering-communication-queue">
                      <div className="tendering-rail-card__header">
                        <strong>Communication queue</strong>
                        <span className={`pill ${selectedTenderCommunicationQueue.some((item) => item.isOverdue) ? "pill--amber" : "pill--blue"}`}>
                          {selectedTenderCommunicationQueue.some((item) => item.isOverdue) ? "Overdue inside queue" : "Next 4 open items"}
                        </span>
                      </div>
                      {selectedTenderCommunicationQueue.length ? (
                        <div className="tendering-focus-list">
                          {selectedTenderCommunicationQueue.map((item) => (
                            <div key={item.id} className="tendering-focus-list__item">
                              <div className="split-header">
                                <strong>{item.title}</strong>
                                <span className={`pill ${item.isOverdue ? "pill--amber" : item.owner === "Unassigned" ? "pill--blue" : "pill--green"}`}>
                                  {item.owner}
                                </span>
                              </div>
                              <span className="muted-text">
                                {item.activityType} | {item.isOverdue ? `Overdue ${item.dueLabel}` : `Due ${item.dueLabel}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted-text">No open communication items are queued right now.</p>
                      )}
                    </div>
                  </div>

                  {selectedTender.pricingSnapshots?.length ? (
                    <div className="subsection tendering-rail-card">
                      <strong>Pricing Snapshots</strong>
                      {selectedTender.pricingSnapshots.map((item) => (
                        <div key={item.id} className="tendering-feed-item">
                          <strong>{item.versionLabel}</strong>
                          <p>{formatCurrency(item.estimatedValue)} | Margin {item.marginPercent ?? "n/a"}%</p>
                          <span className="muted-text">{item.assumptions || "No assumptions captured."}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="subsection tendering-rail-card tendering-rail-card--workspace">
                    <div className="tendering-rail-card__header">
                      <strong>Latest Converted Job</strong>
                      {latestJob ? <span className="pill pill--green">{latestJob.status}</span> : null}
                    </div>
                    {latestJob ? (
                      <>
                        <p>{latestJob.jobNumber} - {latestJob.name}</p>
                        <span className="muted-text">Most recent operational conversion linked to the tender stream.</span>
                      </>
                    ) : (
                      <p className="muted-text">No converted jobs yet.</p>
                    )}
                  </div>
                  </div>
                </div>
              </div>
            </AppCard>
          ) : (
            <AppCard title="Tender Workspace" subtitle="Select a tender from the register to open its CRM-style detail view.">
              <div className={`tendering-workspace-scroll${mode === "workspace" ? " tendering-workspace-scroll--standalone" : ""}`}>
                <div className="tendering-empty-state tendering-empty-state--workspace">
                  <div>
                    <span className="tendering-section-label tendering-section-label--muted">Tender workplace</span>
                    <strong>No tender selected.</strong>
                    <p>
                      {mode === "workspace"
                        ? "Open this route with a tender selection from the register, or use a tender-specific link with a tender id to load the dedicated workspace."
                        : "Choose a tender from the pipeline to open the left-rail summary, right-canvas activity stream, and conversion workspace."}
                    </p>
                  </div>
                  <div className="tendering-empty-state__grid">
                    <div>
                      <span>Left rail</span>
                      <strong>Summary, linked contacts, stage actions</strong>
                    </div>
                    <div>
                      <span>Canvas</span>
                      <strong>Activity, documents, conversion</strong>
                    </div>
                  </div>
                </div>
              </div>
            </AppCard>
          )) : null}
          </div>
        </div>
      </div>
      ) : null}

        <div className="tendering-detail-column">
          {showCreate ? (
          <AppCard title="Create Tender" subtitle="Open a new tender like a guided CRM deal create flow.">
            <form className="admin-form tendering-create-form" onSubmit={submit}>
              <div className="tendering-create-shell">
                <div className="tendering-create-shell__main">
                  <div className="tendering-create-hero">
                    <div>
                      <span className="tendering-section-label tendering-section-label--muted">Deal create</span>
                      <h3>Capture the tender before work starts scattering.</h3>
                      <p className="muted-text">Start with the commercial basics, link the right client and contact, then seed the first activity into the workspace.</p>
                    </div>
                    <div className="tendering-register-card__pills">
                      <span className="pill pill--blue">{selectedCreateClients.length} linked clients</span>
                      <span className="pill pill--amber">{selectedCreateContacts.length} linked contacts</span>
                    </div>
                  </div>

                  <div className="tendering-create-grid">
                    <label>
                      {labels["field.tenderNumber"]}
                      <input value={form.tenderNumber} onChange={(event) => setForm({ ...form, tenderNumber: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.status"]}
                      <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                        <option value="DRAFT">Draft</option>
                        <option value="IN_PROGRESS">Estimating</option>
                        <option value="SUBMITTED">Submitted</option>
                      </select>
                    </label>
                    <label className="tendering-create-grid__wide">
                      {labels["field.title"]}
                      <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                    </label>
                    <label className="tendering-create-grid__wide">
                      {labels["field.description"]}
                      <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.probability"]}
                      <input value={form.probability} onChange={(event) => setForm({ ...form, probability: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.estimatedValue"]}
                      <input value={form.estimatedValue} onChange={(event) => setForm({ ...form, estimatedValue: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.dueDate"]}
                      <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.proposedStart"]}
                      <input
                        type="date"
                        value={form.proposedStartDate}
                        onChange={(event) => setForm({ ...form, proposedStartDate: event.target.value })}
                      />
                    </label>
                    <label>
                      {labels["field.leadTimeDays"]}
                      <input value={form.leadTimeDays} onChange={(event) => setForm({ ...form, leadTimeDays: event.target.value })} />
                    </label>
                    <label>
                      {labels["field.estimator"]}
                      <select
                        value={form.estimatorUserId}
                        onChange={(event) => setForm({ ...form, estimatorUserId: event.target.value })}
                      >
                        <option value="">Select estimator</option>
                        {references.users.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.firstName} {user.lastName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="subsection tendering-create-linker">
                    <strong>{labels["field.linkedClients"]}</strong>
                    {form.tenderClients.map((item, index) => (
                      <div key={index} className="inline-fields tendering-create-linker__row">
                        <select value={item.clientId} onChange={(event) => updateClient(index, { clientId: event.target.value })}>
                          <option value="">Select client</option>
                          {references.clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.contactId}
                          onChange={(event) => updateClient(index, { contactId: event.target.value })}
                        >
                          <option value="">{labels["field.contact"]}</option>
                          {references.contacts
                            .filter((contact) => !item.clientId || contact.client?.id === item.clientId)
                            .map((contact) => (
                              <option key={contact.id} value={contact.id}>
                                {contact.firstName} {contact.lastName}
                              </option>
                            ))}
                        </select>
                        <label className="checkbox-inline">
                          <input
                            type="checkbox"
                            checked={item.isAwarded}
                            onChange={(event) => updateClient(index, { isAwarded: event.target.checked })}
                          />
                          Awarded
                        </label>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          tenderClients: [...form.tenderClients, { clientId: "", contactId: "", isAwarded: false }]
                        })
                      }
                    >
                      Add client
                    </button>
                  </div>

                  <div className="tendering-create-activity-grid">
                    <label>
                      Internal note
                      <input
                        value={form.tenderNotes[0]?.body ?? ""}
                        onChange={(event) => setForm({ ...form, tenderNotes: [{ body: event.target.value }] })}
                      />
                    </label>
                    <label>
                      Clarification
                      <input
                        placeholder="Subject"
                        value={form.clarifications[0]?.subject ?? ""}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            clarifications: [{ ...form.clarifications[0], subject: event.target.value, status: "OPEN" }]
                          })
                        }
                      />
                    </label>
                    <label>
                      Follow-up details
                      <input
                        value={form.followUps[0]?.details ?? ""}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            followUps: [{ ...form.followUps[0], details: event.target.value, dueAt: form.followUps[0]?.dueAt ?? "", status: "OPEN" }]
                          })
                        }
                      />
                    </label>
                    <label>
                      Follow-up date
                      <input
                        type="date"
                        value={form.followUps[0]?.dueAt ?? ""}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            followUps: [{ ...form.followUps[0], dueAt: event.target.value, details: form.followUps[0]?.details ?? "", status: "OPEN" }]
                          })
                        }
                      />
                    </label>
                  </div>
                </div>

                <div className="tendering-create-shell__rail">
                  <div className="subsection tendering-rail-card tendering-rail-card--summary">
                    <strong>Create Summary</strong>
                    <div className="tendering-summary-stack">
                      <div className="tendering-summary-line">
                        <span className="muted-text">Linked clients</span>
                        <strong>{selectedCreateClients.length}</strong>
                      </div>
                      <p className="muted-text">
                        {selectedCreateClients.length ? selectedCreateClients.join(", ") : "No clients linked yet."}
                      </p>
                      <div className="tendering-summary-line">
                        <span className="muted-text">Linked contacts</span>
                        <strong>{selectedCreateContacts.length}</strong>
                      </div>
                      <p className="muted-text">
                        {selectedCreateContacts.length ? selectedCreateContacts.join(", ") : "No contacts linked yet."}
                      </p>
                    </div>
                  </div>
                  <div className="subsection tendering-rail-card">
                    <strong>Readiness Check</strong>
                    <div className="tendering-summary-stack">
                      <div className="tendering-summary-line">
                        <span className="muted-text">Core details</span>
                        <span className={`pill ${createReadiness.missingCoreFields.length ? "pill--amber" : "pill--green"}`}>
                          {createReadiness.missingCoreFields.length ? `Missing ${createReadiness.missingCoreFields.length}` : "Ready"}
                        </span>
                      </div>
                      <p className="muted-text">
                        {createReadiness.missingCoreFields.length
                          ? `Still needed: ${createReadiness.missingCoreFields.join(", ")}.`
                          : "Tender number and title are both captured."}
                      </p>
                      <div className="tendering-summary-line">
                        <span className="muted-text">Opening activity</span>
                        <span className={`pill ${createReadiness.hasOpeningActivity ? "pill--blue" : "pill--amber"}`}>
                          {createReadiness.hasOpeningActivity ? "Included" : "Optional"}
                        </span>
                      </div>
                      <p className="muted-text">
                        {createReadiness.hasOpeningActivity
                          ? "This tender will start with opening activity in the workspace timeline."
                          : "Add a note, clarification, or follow-up now if you want the timeline to start populated."}
                      </p>
                    </div>
                  </div>
                  <div className="subsection tendering-rail-card">
                    <strong>What opens next</strong>
                    <p className="muted-text">After save, this tender is ready to open in the workspace with the linked client context, first activities, and conversion readiness already visible.</p>
                  </div>
                  <div className="subsection tendering-rail-card">
                    <strong>Relationship data</strong>
                    <p className="muted-text">Clients and contacts are maintained as reusable records. Stay in Tendering for deal prep, or jump to the shared reference hub when the record itself needs broader ERP cleanup.</p>
                    <div className="inline-fields">
                      <a className="tendering-inline-link" href="/tenders/clients">Tendering clients</a>
                      <a className="tendering-inline-link" href="/tenders/contacts">Tendering contacts</a>
                      <a className="tendering-inline-link" href="/master-data">Master Data hub</a>
                    </div>
                  </div>
                  <div className="subsection tendering-rail-card">
                    <strong>Import Tenders</strong>
                    <p className="muted-text">Paste CSV rows to preview and create multiple tenders quickly.</p>
                    <label className="admin-form">
                      <span>CSV text</span>
                      <textarea
                        className="tendering-import-textarea tendering-import-textarea--rail"
                        value={importCsv}
                        onChange={(event) => setImportCsv(event.target.value)}
                        placeholder={"tenderNumber,title,status,probability,estimatedValue,dueDate,clientNames,description,initialNote,followUpDetails,followUpDueAt\nTEN-2026-010,Example package,IN_PROGRESS,60,250000,2026-05-15,Acme Civil|Harbour Utilities,Scope summary,Initial call complete,Confirm addendum receipt,2026-04-15"}
                      />
                    </label>
                    <div className="inline-fields">
                      <button type="button" onClick={() => void previewImport()} disabled={!importCsv.trim()}>
                        Preview import
                      </button>
                      <button type="button" onClick={() => void commitImport()} disabled={!importPreview.length}>
                        Commit import
                      </button>
                    </div>

                    {importPreview.length ? (
                      <div className="subsection">
                        <strong>Import Preview</strong>
                        <div className="tendering-import-summary">
                          <div className="tendering-side-metric">
                            <span className="muted-text">Ready rows</span>
                            <strong>{importPreview.filter((row) => row.valid && !row.duplicate).length}</strong>
                          </div>
                          <div className="tendering-side-metric">
                            <span className="muted-text">Duplicates</span>
                            <strong>{importPreview.filter((row) => row.duplicate).length}</strong>
                          </div>
                          <div className="tendering-side-metric">
                            <span className="muted-text">Needs review</span>
                            <strong>{importPreview.filter((row) => !row.valid).length}</strong>
                          </div>
                        </div>
                        {importPreview.map((row) => (
                          <div key={`${row.rowNumber}-${row.tenderNumber}`} className="record-row">
                            <div>
                              <strong>Row {row.rowNumber}: {row.tenderNumber || "Missing tender number"}</strong>
                              <p className="muted-text">{row.title} | {row.clientNames.join(", ")}</p>
                            </div>
                            <span className={`pill ${row.valid ? "pill--green" : "pill--amber"}`}>
                              {row.duplicate ? "Duplicate" : row.valid ? "Ready" : "Needs review"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {importResult ? (
                      <div className="subsection">
                        <strong>Import Result</strong>
                        <p className="muted-text">Created {importResult.createdCount} tenders.</p>
                        {importResult.skipped.length ? (
                          importResult.skipped.map((item, index) => (
                            <div key={`${item.tenderNumber}-${index}`} className="record-row">
                              <strong>{item.tenderNumber}</strong>
                              <span className="muted-text">{item.reason}</span>
                            </div>
                          ))
                        ) : (
                          <p className="muted-text">No rows were skipped.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              <button type="submit">Create Tender</button>
            </form>
          </AppCard>
          ) : null}
        </div>
      {pendingBoardDrop ? (
        <div className="tendering-stage-modal" role="dialog" aria-modal="true" aria-labelledby="tendering-stage-modal-title">
          <div className="tendering-stage-modal__backdrop" onClick={cancelPendingBoardDrop} />
          <div className="tendering-stage-modal__panel">
            <span className="tendering-section-label tendering-section-label--muted">Board stage move</span>
            <h3 id="tendering-stage-modal-title">
              {pendingBoardDrop.mode === "confirm-archive"
                ? "Are you sure you want to continue?"
                : pendingBoardDrop.mode === "confirm-convert"
                ? "Create a live job from this tender?"
                : pendingBoardDrop.mode === "confirm-client"
                ? "Is the awarded client still the same?"
                : "Choose the awarded client before moving this tender"}
            </h3>
            <p className="muted-text">
              {pendingBoardDrop.mode === "confirm-archive"
                ? "This will archive any active jobs and resource allocations made for this project. If you continue, the tender will move back out of Converted."
                : pendingBoardDrop.mode === "confirm-convert"
                ? "If you continue, the system will create a live job in the Jobs module using the tender and CRM information already captured for this deal."
                : pendingBoardDrop.mode === "confirm-client"
                  ? pendingBoardDrop.promptTargetStage === "AWARDED"
                    ? "This move will bring the tender back to Awarded. If the awarded client is still correct, continue. Otherwise choose a different client."
                  : "This move will keep the tender on the contract path. If the awarded client is still correct, continue. Otherwise choose a different client for this tender."
                : pendingBoardDrop.nextStage === "AWARDED"
                  ? "Pick the client that won this tender. The card will then move into Awarded."
                  : pendingBoardDrop.nextStage === "CONTRACT_ISSUED"
                    ? "Pick the awarded client. The board will award that client first, then move the card into Contract."
                    : "Pick the awarded client. The board will award the client, issue the contract, and then convert the tender using the default job details."}
            </p>
            <div className="notice-banner notice-banner--warning">
              {pendingBoardDrop.mode === "confirm-archive"
                ? "Choosing No keeps the tender in Converted and leaves the live job and scheduler allocations untouched."
                : pendingBoardDrop.mode === "confirm-convert"
                ? "Choosing No or Cancel leaves the tender in its current stage and does not create a job."
                : "Client links stay on the tender. If you later drag this tender back to a pre-award stage, the awarded state is cleared but the client details remain attached."}
            </div>
            {pendingBoardDrop.mode === "select-client" ? (
              <label className="admin-form">
                <span>Awarded client</span>
                <select
                  value={pendingBoardDrop.selectedClientId}
                  onChange={(event) =>
                    setPendingBoardDrop((current) =>
                      current ? { ...current, selectedClientId: event.target.value } : current
                    )
                  }
                >
                  {pendingBoardDrop.tender.tenderClients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.client.name}
                      {item.contact ? ` - ${item.contact.firstName} ${item.contact.lastName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : pendingBoardDrop.mode === "confirm-client" ? (
              <div className="tendering-stage-modal__summary">
                <span className="muted-text">Current awarded client</span>
                <strong>
                  {pendingBoardDrop.tender.tenderClients.find((item) => item.id === pendingBoardDrop.selectedClientId)?.client.name ?? "Unknown client"}
                </strong>
              </div>
            ) : null}
            <div className="tendering-stage-modal__actions">
              <button type="button" className="tendering-topbar-button" onClick={cancelPendingBoardDrop}>
                {pendingBoardDrop.mode === "confirm-archive" || pendingBoardDrop.mode === "confirm-convert" ? "No" : "Cancel"}
              </button>
              {pendingBoardDrop.mode === "confirm-archive" ? (
                <button type="button" onClick={() => void confirmPendingBoardDrop()}>
                  Yes
                </button>
              ) : pendingBoardDrop.mode === "confirm-convert" ? (
                <button type="button" onClick={() => void confirmPendingBoardDrop()}>
                  Yes
                </button>
              ) : pendingBoardDrop.mode === "confirm-client" ? (
                <>
                  <button type="button" className="tendering-topbar-button" onClick={chooseDifferentPendingBoardClient}>
                    No
                  </button>
                  <button type="button" onClick={() => void confirmPendingBoardDrop()} disabled={!pendingBoardDrop.selectedClientId}>
                    Yes
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => void confirmPendingBoardDrop()} disabled={!pendingBoardDrop.selectedClientId}>
                  Continue move
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {archivedConversionPrompt ? (
        <div className="tendering-stage-modal" role="dialog" aria-modal="true" aria-labelledby="tendering-archived-conversion-title">
          <div className="tendering-stage-modal__backdrop" onClick={cancelArchivedConversionPrompt} />
          <div className="tendering-stage-modal__panel">
            <span className="tendering-section-label tendering-section-label--muted">Conversion conflict</span>
            <h3 id="tendering-archived-conversion-title">
              {archivedConversionPrompt.mode === "confirm-new-stage"
                ? "A job with this number and source tender already exists. Is this a new stage?"
                : archivedConversionPrompt.mode === "name-stage"
                  ? "Name the new stage"
                  : "Please change tender details before proceeding."}
            </h3>
            <p className="muted-text">
              {archivedConversionPrompt.mode === "confirm-new-stage"
                ? "If this tender is reopening as another project stage, we can reuse the archived job and add a new stage under it."
                : archivedConversionPrompt.mode === "name-stage"
                  ? "Enter the stage name to reopen the archived job and continue the conversion."
                  : "Update the tender conversion details before trying again."}
            </p>
            {archivedConversionPrompt.mode === "name-stage" ? (
              <label className="admin-form">
                <span>Stage name</span>
                <input
                  value={archivedConversionPrompt.stageName}
                  onChange={(event) =>
                    setArchivedConversionPrompt((current) =>
                      current ? { ...current, stageName: event.target.value } : current
                    )
                  }
                  placeholder="Enter stage name"
                />
              </label>
            ) : null}
            <div className="tendering-stage-modal__actions">
              {archivedConversionPrompt.mode === "confirm-new-stage" ? (
                <>
                  <button type="button" className="tendering-topbar-button" onClick={declineArchivedConversionAsNewStage}>
                    No
                  </button>
                  <button type="button" onClick={confirmArchivedConversionAsNewStage}>
                    Yes
                  </button>
                </>
              ) : archivedConversionPrompt.mode === "name-stage" ? (
                <>
                  <button type="button" className="tendering-topbar-button" onClick={cancelArchivedConversionPrompt}>
                    Cancel
                  </button>
                  <button type="button" onClick={() => void submitArchivedConversionAsNewStage()} disabled={!archivedConversionPrompt.stageName.trim()}>
                    Continue
                  </button>
                </>
              ) : (
                <button type="button" onClick={cancelArchivedConversionPrompt}>
                  Ok
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
