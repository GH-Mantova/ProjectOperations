/**
 * VendorRatesTab — S1, rate-hub-sor-integration-plan.md
 *
 * Displays vendors grouped by vendorType (GlobalList "vendor-types") with their
 * SubcontractorRate rows in a read-only table. Each rate row links to the vendor
 * detail card (/directory/subcontractors/:id) for write-through editing.
 *
 * Props:
 *   entityType — "subcontractor" | "supplier" (passed from RatesListsAdminPage tabs).
 *
 * The hub is a VIEW over the authoritative SubcontractorRate rows; it never stores
 * a copy. Rate edits happen on the vendor detail card (SubcontractorRatesTab).
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────────

type RateLine = {
  id: string;
  discipline: string;
  unit: string;
  rate: string;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

type VendorEntry = {
  id: string;
  name: string;
  entityType: string;
  rates: RateLine[];
};

type VendorTypeGroup = {
  typeId: string | null;
  typeLabel: string;
  vendors: VendorEntry[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

function fmtRate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return raw;
  return num.toLocaleString("en-AU", { style: "currency", currency: "AUD" });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RateTable({ rates, vendorId }: { rates: RateLine[]; vendorId: string }) {
  if (rates.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "4px 0 8px" }}>
        No rates on file.
      </p>
    );
  }
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 13,
        marginBottom: 8
      }}
    >
      <thead>
        <tr style={{ background: "var(--surface-subtle, #f9fafb)" }}>
          <th style={thStyle}>Discipline</th>
          <th style={thStyle}>Unit</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
          <th style={thStyle}>Valid from</th>
          <th style={thStyle}>Valid to</th>
          <th style={thStyle}>Active</th>
          <th style={thStyle}></th>
        </tr>
      </thead>
      <tbody>
        {rates.map((rate) => (
          <tr key={rate.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
            <td style={tdStyle}>{rate.discipline}</td>
            <td style={tdStyle}>{rate.unit}</td>
            <td style={{ ...tdStyle, textAlign: "right" }}>{fmtRate(rate.rate)}</td>
            <td style={tdStyle}>{fmtDate(rate.validFrom)}</td>
            <td style={tdStyle}>{fmtDate(rate.validTo)}</td>
            <td style={tdStyle}>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: rate.isActive ? "var(--success, #16a34a)" : "var(--text-muted, #9ca3af)"
                }}
                title={rate.isActive ? "Active" : "Inactive"}
              />
            </td>
            <td style={tdStyle}>
              <Link
                to={`/directory/subcontractors/${vendorId}`}
                style={{ color: "var(--brand-primary, #005B61)", fontSize: 12, textDecoration: "none" }}
              >
                Edit
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const thStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  fontWeight: 600,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border, #e5e7eb)",
  whiteSpace: "nowrap"
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  verticalAlign: "middle"
};

function VendorCard({ vendor }: { vendor: VendorEntry }) {
  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 6,
        padding: "12px 14px",
        marginBottom: 10,
        background: "var(--surface, #fff)"
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 8
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{vendor.name}</span>
        <Link
          to={`/directory/subcontractors/${vendor.id}`}
          style={{ color: "var(--brand-primary, #005B61)", fontSize: 12, textDecoration: "none" }}
          title="Open vendor detail card"
        >
          View card
        </Link>
      </div>
      <RateTable rates={vendor.rates} vendorId={vendor.id} />
    </div>
  );
}

function TypeGroup({
  group,
  defaultOpen
}: {
  group: VendorTypeGroup;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: 20 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text)"
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 14,
            textAlign: "center",
            transition: "transform 0.15s",
            transform: open ? "rotate(90deg)" : "rotate(0deg)"
          }}
        >
          &#9654;
        </span>
        {group.typeLabel}
        <span style={{ fontWeight: 400, fontSize: 13, color: "var(--text-muted)" }}>
          ({group.vendors.length} vendor{group.vendors.length !== 1 ? "s" : ""})
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 8, paddingLeft: 22 }}>
          {group.vendors.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No vendors in this group.</p>
          ) : (
            group.vendors.map((vendor) => <VendorCard key={vendor.id} vendor={vendor} />)
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function VendorRatesTab({
  entityType
}: {
  entityType: "subcontractor" | "supplier";
}) {
  const { authFetch } = useAuth();
  const [groups, setGroups] = useState<VendorTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `?entityType=${encodeURIComponent(entityType)}`;
      const res = await authFetch(`/subcontractors/hub-view${qs}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`${res.status}: ${text}`);
      }
      const data: VendorTypeGroup[] = await res.json();
      setGroups(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendor rates.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div style={{ padding: "24px 0", color: "var(--text-muted)" }}>Loading vendor rates&hellip;</div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "24px 0" }}>
        <p style={{ color: "var(--error, #dc2626)", marginBottom: 12 }}>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          style={{
            padding: "6px 14px",
            background: "var(--brand-primary, #005B61)",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontSize: 13
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div style={{ padding: "24px 0", color: "var(--text-muted)" }}>
        <p>No {entityType === "subcontractor" ? "subcontractors" : "suppliers"} found.</p>
        <p style={{ fontSize: 13 }}>
          Vendors appear here once they have a rate card on their detail page. Use the{" "}
          <strong>Lists</strong> tab to manage vendor type groupings.
        </p>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group, idx) => (
        <TypeGroup key={group.typeId ?? "__untyped__"} group={group} defaultOpen={idx === 0} />
      ))}
    </div>
  );
}
