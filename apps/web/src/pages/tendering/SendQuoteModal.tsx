import { useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type TenderClientLite = {
  id: string;
  client: { id: string; name: string };
  contact?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
};

type FullQuote = {
  id: string;
  quoteRef: string;
  client: { id: string; name: string; email: string | null; phone: string | null };
};

type SummaryResult = { clientFacingTotal: number } | null;

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

export function SendQuoteModal({
  tenderId,
  quote,
  tenderClients,
  summary,
  onClose,
  onSent
}: {
  tenderId: string;
  quote: FullQuote;
  tenderClients: TenderClientLite[];
  summary: SummaryResult;
  onClose: () => void;
  onSent: () => Promise<void>;
}) {
  const { authFetch, user } = useAuth();
  // Pre-populate To: with every contact email linked to this client.
  const contactsForClient = useMemo(
    () =>
      tenderClients
        .filter((tc) => tc.client.id === quote.client.id)
        .map((tc) => tc.contact)
        .filter((c): c is NonNullable<TenderClientLite["contact"]> => !!c && !!c.email),
    [tenderClients, quote.client.id]
  );
  const defaultRecipients = contactsForClient.map((c) => c.email!).filter(Boolean);
  const defaultContactName = contactsForClient[0]
    ? `${contactsForClient[0].firstName} ${contactsForClient[0].lastName}`.trim()
    : "team";

  const [to, setTo] = useState<string[]>(defaultRecipients.length > 0 ? defaultRecipients : []);
  const [toInput, setToInput] = useState("");
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState("");
  const [subject, setSubject] = useState(`Quote ${quote.quoteRef} — Initial Services`);
  const total = summary ? fmtCurrency(summary.clientFacingTotal) : "";
  const estimatorName = user ? `${user.firstName} ${user.lastName}`.trim() : "Initial Services";
  const estimatorEmail = user?.email ?? "";
  const [body, setBody] = useState(
    `Dear ${defaultContactName},\n\nPlease find attached our quote ${quote.quoteRef}.\n\nThe quoted price is ${total} (ex GST).\n\nPlease do not hesitate to contact us if you have any questions.\n\nKind regards,\n${estimatorName}\n${estimatorEmail}\nInitial Services`
  );
  const [attachPdf, setAttachPdf] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTo = () => {
    if (toInput.trim()) {
      setTo((prev) => [...prev, toInput.trim()]);
      setToInput("");
    }
  };
  const addCc = () => {
    if (ccInput.trim()) {
      setCc((prev) => [...prev, ccInput.trim()]);
      setCcInput("");
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      if (to.length === 0) throw new Error("At least one recipient is required.");
      const res = await authFetch(`/tenders/${tenderId}/quotes/${quote.id}/send`, {
        method: "POST",
        body: JSON.stringify({
          to,
          cc: cc.length > 0 ? cc : undefined,
          subject,
          body,
          attachPdf
        })
      });
      if (!res.ok) throw new Error(await res.text());
      const result = (await res.json()) as { success: boolean; error?: string };
      if (!result.success) throw new Error(result.error || "Send failed");
      await onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="slide-over-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200
      }}
    >
      <div
        className="s7-card"
        style={{ width: 640, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>
          Send quote {quote.quoteRef} to {quote.client.name}
        </h3>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 8 }}>To:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          {to.map((addr) => (
            <span
              key={addr}
              style={{
                padding: "2px 8px",
                background: "#E8F4F5",
                borderRadius: 999,
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              {addr}
              <button
                type="button"
                onClick={() => setTo((prev) => prev.filter((a) => a !== addr))}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            className="s7-input"
            value={toInput}
            placeholder="Add email…"
            onChange={(e) => setToInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTo())}
            style={{ flex: 1 }}
          />
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={addTo}>
            Add
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 12 }}>CC:</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
          {cc.map((addr) => (
            <span
              key={addr}
              style={{
                padding: "2px 8px",
                background: "#F6F6F6",
                borderRadius: 999,
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              {addr}
              <button
                type="button"
                onClick={() => setCc((prev) => prev.filter((a) => a !== addr))}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            className="s7-input"
            value={ccInput}
            placeholder="Add cc email…"
            onChange={(e) => setCcInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCc())}
            style={{ flex: 1 }}
          />
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={addCc}>
            Add
          </button>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 12 }}>
          Subject:
        </label>
        <input
          className="s7-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          style={{ width: "100%" }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginTop: 12 }}>Body:</label>
        <textarea
          className="s7-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={12}
          style={{ width: "100%" }}
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginTop: 12,
            fontSize: 13
          }}
        >
          <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} />
          Attach PDF quote — <code>IS_Quote_{quote.quoteRef}.pdf</code>
        </label>

        {error ? (
          <div
            role="alert"
            style={{ background: "#FEE2E2", color: "#7F1D1D", padding: 8, borderRadius: 4, marginTop: 10 }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void send()}
            disabled={busy}
            style={{ background: "#FEAA6D", borderColor: "#FEAA6D", color: "#000" }}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
