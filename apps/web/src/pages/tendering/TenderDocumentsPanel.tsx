import { useMemo, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const ACCEPTED = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".dwg", ".png", ".jpg", ".jpeg"];
const MAX_BYTES = 100 * 1024 * 1024;
const DWG_PATTERN = /\.dwg$/i;
const READABLE_PATTERN = /\.(pdf|docx?|xlsx?|png|jpe?g)$/i;

type DocumentRecord = {
  id: string;
  title: string;
  category: string;
  description?: string | null;
  createdAt?: string;
  fileLink?: {
    name: string;
    webUrl: string;
    sizeBytes?: number | null;
    mimeType?: string | null;
  } | null;
};

type ProposedScopeItem = {
  code: "SO" | "Str" | "Asb" | "Civ" | "Prv";
  title: string;
  description: string;
  estimatedLabourDays?: number;
  estimatedLabourRole?: string;
  estimatedPlantItems?: Array<{ item: string; days: number }>;
  estimatedWasteTonnes?: Array<{ type: string; tonnes: number }>;
  confidence: "high" | "medium" | "low";
  sourceReference?: string;
};

type DraftResult = {
  proposals: ProposedScopeItem[];
  documentsRead: number;
  documentsSkipped: string[];
  mode: "live" | "mock";
  revisionId?: string;
};

type LabourRate = { id: string; role: string; dayRate: string; nightRate: string; weekendRate: string; isActive: boolean };
type PlantRate = { id: string; item: string; rate: string; isActive: boolean };

function formatSize(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceColour(c: ProposedScopeItem["confidence"]): { bg: string; fg: string } {
  switch (c) {
    case "high": return { bg: "#D1FAE5", fg: "#065F46" };
    case "medium": return { bg: "#FEF3C7", fg: "#92400E" };
    case "low": return { bg: "#FEE2E2", fg: "#991B1B" };
  }
}

export function TenderDocumentsPanel({
  tenderId,
  documents,
  onDocumentsChanged,
  canManage
}: {
  tenderId: string;
  documents: DocumentRecord[];
  onDocumentsChanged: () => void;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set());
  const [revisionInstruction, setRevisionInstruction] = useState("");
  const [revising, setRevising] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const hasReadableDoc = useMemo(
    () => documents.some((d) => {
      const name = d.fileLink?.name ?? d.title;
      return READABLE_PATTERN.test(name);
    }),
    [documents]
  );

  const draftButtonTooltip = documents.length === 0
    ? "Upload at least one document first"
    : !hasReadableDoc
      ? "DWG files cannot be read by Claude — upload a PDF or image of the drawings"
      : null;

  const uploadFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      setUploadError(`${file.name} exceeds the 100 MB limit.`);
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("category", "tender");
    form.append("title", file.name);
    form.append("fileName", file.name);
    form.append("mimeType", file.type || "application/octet-stream");

    const response = await authFetch(`/tenders/${tenderId}/documents`, {
      method: "POST",
      body: form
    });
    if (!response.ok) {
      throw new Error(`${file.name}: ${await response.text()}`);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!canManage) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of list) {
        await uploadFile(file);
      }
      onDocumentsChanged();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
      void handleFiles(event.dataTransfer.files);
    }
  };

  const requestDraft = async (correction?: string) => {
    const isRevise = correction != null;
    if (isRevise) setRevising(true);
    else setDrafting(true);
    setDraftError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/draft-scope`, {
        method: "POST",
        body: JSON.stringify(correction ? { correction } : {})
      });
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as DraftResult;
      setDraft(body);
      // Default: check everything except Prv items
      const initial = new Set<number>();
      body.proposals.forEach((p, idx) => {
        if (p.code !== "Prv") initial.add(idx);
      });
      setSelectedTypes(initial);
      setRevisionInstruction("");
    } catch (err) {
      setDraftError((err as Error).message);
    } finally {
      setDrafting(false);
      setRevising(false);
    }
  };

  const toggleSelected = (idx: number) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const createSelected = async () => {
    if (!draft) return;
    setCreating(true);
    setCreateError(null);
    try {
      // Ensure the estimate exists
      const estimateResponse = await authFetch(`/tenders/${tenderId}/estimate`);
      if (estimateResponse.status === 404 || (estimateResponse.ok && (await estimateResponse.clone().text()) === "null")) {
        await authFetch(`/tenders/${tenderId}/estimate`, { method: "POST" });
      } else if (!estimateResponse.ok) {
        await authFetch(`/tenders/${tenderId}/estimate`, { method: "POST" });
      }

      const [labourRatesRes, plantRatesRes] = await Promise.all([
        authFetch(`/estimate-rates/labour`),
        authFetch(`/estimate-rates/plant`)
      ]);
      const labourRates: LabourRate[] = labourRatesRes.ok ? await labourRatesRes.json() : [];
      const plantRates: PlantRate[] = plantRatesRes.ok ? await plantRatesRes.json() : [];

      let created = 0;
      for (const idx of Array.from(selectedTypes).sort((a, b) => a - b)) {
        const proposal = draft.proposals[idx];
        if (!proposal) continue;
        const itemResponse = await authFetch(`/tenders/${tenderId}/estimate/items`, {
          method: "POST",
          body: JSON.stringify({
            code: proposal.code,
            title: proposal.title.slice(0, 120),
            description: proposal.description,
            isProvisional: proposal.code === "Prv",
            provisionalAmount: proposal.code === "Prv" ? "0" : undefined
          })
        });
        if (!itemResponse.ok) continue;
        const updated = (await itemResponse.json()) as { items: Array<{ id: string; code: string; title: string }> };
        const fresh = updated.items.find((i) => i.title === proposal.title.slice(0, 120));
        const itemId = fresh?.id;
        if (!itemId) {
          created += 1;
          continue;
        }

        // Labour line
        if (proposal.estimatedLabourDays && proposal.estimatedLabourDays > 0) {
          const role = proposal.estimatedLabourRole ?? labourRates[0]?.role;
          const rate = labourRates.find((r) => r.role === role) ?? labourRates[0];
          if (role && rate) {
            await authFetch(`/tenders/${tenderId}/estimate/items/${itemId}/labour`, {
              method: "POST",
              body: JSON.stringify({
                role,
                qty: "1",
                days: String(proposal.estimatedLabourDays),
                shift: "Day",
                rate: rate.dayRate
              })
            });
          }
        }

        // Plant lines
        for (const p of proposal.estimatedPlantItems ?? []) {
          const rate = plantRates.find((r) => r.item === p.item);
          if (!rate) continue;
          await authFetch(`/tenders/${tenderId}/estimate/items/${itemId}/plant`, {
            method: "POST",
            body: JSON.stringify({
              plantItem: p.item,
              qty: "1",
              days: String(p.days),
              rate: rate.rate
            })
          });
        }

        created += 1;
      }
      // Signal the parent page that documents (and indirectly the estimate) changed
      onDocumentsChanged();
      setDraft(null);
      setSelectedTypes(new Set());
      // Navigate to Estimate tab — TenderDetailPage handles tab state via URL? No — switch via pushState event.
      const detailUrl = new URL(window.location.href);
      detailUrl.hash = "#estimate";
      window.history.replaceState(null, "", detailUrl.toString());
      window.dispatchEvent(new CustomEvent("tender-detail:switch-tab", { detail: "estimate" }));
      void navigate(window.location.pathname + window.location.hash, { replace: true });

      window.alert(`${created} scope items imported — review and adjust costs.`);
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const removeDocument = async (_docId: string) => {
    // The API currently has no DELETE endpoint for tender documents; keep UI-level removal disabled.
    window.alert("Deleting documents is not yet supported. Remove from the source SharePoint folder.");
  };

  return (
    <section className="s7-card" aria-label="Tender documents">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Documents</h3>
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {documents.length} uploaded
        </span>
      </div>

      {canManage ? (
        <div
          className={`doc-upload-zone${dragOver ? " doc-upload-zone--drag" : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FEAA6D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
          <p style={{ margin: 0, fontSize: 14 }}>
            <span style={{ color: "#FEAA6D", fontWeight: 500 }}>Drag & drop files here, or browse</span>
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
            PDF, Word, Excel, DWG, PNG, JPG · up to 100 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept={ACCEPTED.join(",")}
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {uploading ? <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Uploading…</p> : null}
        </div>
      ) : null}

      {uploadError ? (
        <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{uploadError}</p>
      ) : null}

      {documents.length > 0 ? (
        <ul className="doc-upload-list">
          {documents.map((doc) => {
            const name = doc.fileLink?.name ?? doc.title;
            const isDwg = DWG_PATTERN.test(name);
            return (
              <li key={doc.id}>
                <div className="doc-upload-list__main">
                  <strong>{name}</strong>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {formatSize(doc.fileLink?.sizeBytes ?? null)}
                    {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ""}
                    {isDwg ? " · Preview not available" : ""}
                  </span>
                </div>
                {doc.fileLink?.webUrl ? (
                  <a href={doc.fileLink.webUrl} target="_blank" rel="noreferrer" className="s7-btn s7-btn--secondary s7-btn--sm">
                    Open
                  </a>
                ) : null}
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--danger s7-btn--sm"
                    onClick={() => void removeDocument(doc.id)}
                    aria-label={`Remove ${name}`}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="draft-scope-panel">
        <div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>✨ Draft scope with Claude</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            Claude reads the uploaded docs and proposes SO/Str/Asb/Civ/Prv items with descriptions &amp; quantities.
          </p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => void requestDraft()}
          disabled={!!draftButtonTooltip || drafting || !canManage}
          title={draftButtonTooltip ?? undefined}
          style={{ background: "#0F172A", whiteSpace: "nowrap" }}
        >
          {drafting ? "Claude is reading…" : "Draft scope →"}
        </button>
      </div>

      {draftError ? (
        <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{draftError}</p>
      ) : null}

      {draft ? (
        <div className="draft-scope-review">
          <div className="draft-scope-review__head">
            <h4 style={{ margin: 0 }}>
              Claude proposed {draft.proposals.length} scope item{draft.proposals.length === 1 ? "" : "s"}
            </h4>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="s7-badge s7-badge--neutral">Read {draft.documentsRead} document{draft.documentsRead === 1 ? "" : "s"}</span>
              {draft.mode === "mock" ? (
                <span className="s7-badge" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  Mock mode — no API key
                </span>
              ) : null}
            </div>
          </div>

          <ul className="draft-scope-review__list">
            {draft.proposals.map((p, idx) => {
              const c = confidenceColour(p.confidence);
              const qtySummary: string[] = [];
              if (p.estimatedLabourDays) qtySummary.push(`~${p.estimatedLabourDays} labour days`);
              const totalWaste = (p.estimatedWasteTonnes ?? []).reduce((s, w) => s + w.tonnes, 0);
              if (totalWaste > 0) qtySummary.push(`~${totalWaste.toFixed(1)} tonnes waste`);
              return (
                <li key={idx} className="draft-scope-card">
                  <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={selectedTypes.has(idx)}
                      onChange={() => toggleSelected(idx)}
                      style={{ marginTop: 2 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="draft-scope-card__code">{p.code}</span>
                        <strong>{p.title}</strong>
                        <span className="s7-badge" style={{ background: c.bg, color: c.fg, marginLeft: "auto" }}>
                          {p.confidence[0].toUpperCase() + p.confidence.slice(1)}
                        </span>
                      </div>
                      <p className="draft-scope-card__description">{p.description}</p>
                      {p.sourceReference ? (
                        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 0" }}>
                          Source: {p.sourceReference}
                        </p>
                      ) : null}
                      {qtySummary.length > 0 ? (
                        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
                          {qtySummary.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="draft-scope-review__actions">
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void createSelected()}
              disabled={selectedTypes.size === 0 || creating}
            >
              {creating ? "Importing…" : `Create ${selectedTypes.size} selected item${selectedTypes.size === 1 ? "" : "s"} →`}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              onClick={() => setDraft(null)}
            >
              Dismiss
            </button>
          </div>

          <div className="draft-scope-review__revise">
            <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Ask Claude to revise
            </label>
            <textarea
              className="s7-input"
              rows={2}
              value={revisionInstruction}
              onChange={(e) => setRevisionInstruction(e.target.value)}
              placeholder="e.g. Add scaffolding for levels 2-3; remove the structural demo item — that's a separate package."
            />
            <button
              type="button"
              className="s7-btn s7-btn--secondary s7-btn--sm"
              onClick={() => void requestDraft(revisionInstruction.trim())}
              disabled={!revisionInstruction.trim() || revising}
            >
              {revising ? "Revising…" : "Revise with this feedback"}
            </button>
          </div>

          {createError ? (
            <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{createError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
