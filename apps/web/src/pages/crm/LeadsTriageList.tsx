import type { Entry } from "./crm-api";

type Props = {
  entries: Entry[];
  onOpen: (id: string) => void;
  onPriceIt: (id: string) => void;
  onDontPursue: (id: string) => void;
};

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

export function LeadsTriageList({ entries, onOpen, onPriceIt, onDontPursue }: Props) {
  const open = entries.filter((e) => e.stage === "open");
  const notPursued = entries.filter((e) => e.stage === "not_pursued");

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
    </div>
  );
}

function TriageRow({
  entry,
  onOpen,
  onPriceIt,
  onDontPursue
}: {
  entry: Entry;
  onOpen: () => void;
  onPriceIt: () => void;
  onDontPursue: () => void;
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
