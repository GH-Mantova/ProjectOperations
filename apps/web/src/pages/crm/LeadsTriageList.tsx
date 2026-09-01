import { useState } from "react";
import type { Entry } from "./crm-api";
import { filterByStage } from "./LeadsTriageList.helpers";

// Re-export pure helpers so consumers can import them from either path.
export { filterByStage, makeArchiveHandler } from "./LeadsTriageList.helpers";

type Props = {
  entries: Entry[];
  onOpen: (id: string) => void;
  onPriceIt: (id: string) => void;
  onDontPursue: (id: string) => void;
  onArchive: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
};

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtMoney(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

function parseValue(v: string | null): number {
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ownerLabel(owner: Entry["owner"]): string {
  if (!owner) return "Unassigned";
  return `${owner.firstName} ${owner.lastName}`.trim() || "Unassigned";
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Returns true when the entry has no content that would block deletion. */
function isEntryEmpty(entry: Entry): boolean {
  return (
    !entry.description &&
    !entry.contact &&
    !entry.estimatedValue &&
    !entry.dropReason &&
    !entry.convertedTender
  );
}

export function LeadsTriageList({ entries, onOpen, onPriceIt, onDontPursue, onArchive, onRestore, onDelete }: Props) {
  const open = filterByStage(entries, "open");
  const notPursued = filterByStage(entries, "not_pursued");
  const archived = filterByStage(entries, "archived");

  const [archivedExpanded, setArchivedExpanded] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section>
        <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: "0 0 8px" }}>
          Triage ({open.length})
        </h2>
        {open.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted, #888)", background: "#fff", border: "1px dashed #e5e7eb", borderRadius: 8 }}>
            Nothing to triage. Click <strong>+ Add new</strong> to capture a lead or opportunity.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {open.map((e) => (
              <TriageRow
                key={e.id}
                entry={e}
                onOpen={() => onOpen(e.id)}
                onPriceIt={() => onPriceIt(e.id)}
                onDontPursue={() => onDontPursue(e.id)}
                onArchive={() => onArchive(e.id)}
              />
            ))}
          </div>
        )}
      </section>

      {notPursued.length > 0 && (
        <section>
          <h2 style={{ fontFamily: "var(--font-heading, Syne)", fontSize: 16, margin: "0 0 8px", color: "var(--text-muted, #666)" }}>
            Not pursued ({notPursued.length})
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {notPursued.map((e) => (
              <NotPursuedRow key={e.id} entry={e} onOpen={() => onOpen(e.id)} />
            ))}
          </div>
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <button
            onClick={() => setArchivedExpanded((prev) => !prev)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontFamily: "var(--font-heading, Syne)",
              fontSize: 16,
              color: "var(--text-muted, #999)",
              marginBottom: archivedExpanded ? 8 : 0
            }}
            aria-expanded={archivedExpanded}
          >
            <span style={{ fontSize: 11, userSelect: "none" }}>{archivedExpanded ? "▾" : "▸"}</span>
            Archived ({archived.length})
          </button>
          {archivedExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {archived.map((e) => (
                <ArchivedRow
                  key={e.id}
                  entry={e}
                  onOpen={() => onOpen(e.id)}
                  onRestore={() => onRestore(e.id)}
                  onDelete={isEntryEmpty(e) ? () => onDelete(e.id) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TriageRow({
  entry,
  onOpen,
  onPriceIt,
  onDontPursue,
  onArchive
}: {
  entry: Entry;
  onOpen: () => void;
  onPriceIt: () => void;
  onDontPursue: () => void;
  onArchive: () => void;
}) {
  const value = parseValue(entry.estimatedValue);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 14,
        display: "flex",
        gap: 12,
        alignItems: "flex-start"
      }}
    >
      <div style={{ flex: 1, cursor: "pointer" }} onClick={onOpen}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
          <strong>{entry.title}</strong>
          <span style={{ background: entry.isLead ? "#e0f2fe" : "#f0fdf4", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>
            {entry.isLead ? "lead" : "opportunity"}
          </span>
          <span style={{ background: "#f3f4f6", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>{entry.source}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted, #666)", display: "flex", gap: 12, flexWrap: "wrap" }}>
          {entry.client && <span>Client: {entry.client.name}</span>}
          {value > 0 && <span>Value: {fmtMoney(value)}</span>}
          <span>Owner: {ownerLabel(entry.owner)}</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <button
          onClick={onPriceIt}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: "var(--color-orange, #FEAA6D)",
            cursor: "pointer",
            fontWeight: 600,
            minHeight: 40
          }}
        >
          Price it
        </button>
        <button
          onClick={onDontPursue}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            minHeight: 40
          }}
        >
          Don't pursue
        </button>
        <button
          onClick={onArchive}
          aria-label="Archive"
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "transparent",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-muted, #888)"
          }}
        >
          Archive
        </button>
      </div>
    </div>
  );
}

function NotPursuedRow({ entry, onOpen }: { entry: Entry; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
        display: "flex",
        gap: 12,
        alignItems: "center",
        cursor: "pointer"
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--text-muted, #444)" }}>{entry.title}</span>
          {entry.dropReason && (
            <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>
              {entry.dropReason.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted, #666)" }}>
          {entry.client?.name ?? "-"} · Owner: {ownerLabel(entry.owner)}
        </div>
      </div>
    </div>
  );
}

function ArchivedRow({
  entry,
  onOpen,
  onRestore,
  onDelete
}: {
  entry: Entry;
  onOpen: () => void;
  onRestore: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      style={{
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        padding: 12,
        display: "flex",
        gap: 12,
        alignItems: "center"
      }}
    >
      <div style={{ flex: 1, cursor: "pointer" }} onClick={onOpen}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
          <span style={{ fontWeight: 600, color: "var(--text-muted, #666)" }}>{entry.title}</span>
          {entry.archiveReason && (
            <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 4, padding: "2px 7px", fontSize: 12 }}>
              {entry.archiveReason.label}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted, #999)" }}>
          {entry.client?.name ?? "-"} · Owner: {ownerLabel(entry.owner)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={onRestore}
          style={{
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid #e5e7eb",
            background: "transparent",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--text-muted, #555)"
          }}
        >
          Restore
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="Delete empty entry"
            title="Delete — only available for empty entries"
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid #fca5a5",
              background: "transparent",
              cursor: "pointer",
              fontSize: 12,
              color: "#dc2626"
            }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
