import { useEffect, useState } from "react";

export function FieldSafetyPage() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div>
      <h2 style={{ margin: "0 0 12px", fontSize: 18, fontFamily: "Syne, Outfit, sans-serif" }}>Safety &amp; incidents</h2>

      <section className="field-card">
        <h3 style={{ margin: 0, fontSize: 16 }}>Incident report</h3>
        <p style={{ margin: "4px 0 12px", color: "#374151", fontSize: 14 }}>
          Tap to report a safety incident or near-miss.
        </p>
        <button
          type="button"
          className="field-btn"
          onClick={() => setToast("Incident reporting form coming soon")}
        >
          Report incident
        </button>
      </section>

      <section className="field-card">
        <h3 style={{ margin: 0, fontSize: 16 }}>Hazard observation</h3>
        <p style={{ margin: "4px 0 12px", color: "#374151", fontSize: 14 }}>
          Tap to log a site hazard.
        </p>
        <button
          type="button"
          className="field-btn"
          onClick={() => setToast("Hazard observation form coming soon")}
        >
          Log hazard
        </button>
      </section>

      <p style={{ color: "#6B7280", fontSize: 12, marginTop: 16 }}>
        Full safety form builder and incident management is planned for the Compliance module.
      </p>

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 8,
            textAlign: "center",
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)"
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
