import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Worker = { id: string; firstName: string; lastName: string };
type Job = { id: string; jobNumber: string; name: string };
type Asset = { id: string; assetCode: string; name: string };

type DocketRow = {
  id: string;
  docketNumber: string;
  type: string;
  status: string;
  capturedAt: string;
  job: { jobNumber: string; name: string } | null;
  asset: { assetCode: string; name: string } | null;
  materialWasteType: string | null;
  quantity: string | null;
  unit: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  signedByName: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Delivery",
  HAULAGE: "Haulage",
  DISPOSAL: "Disposal"
};

const STATUS_PILL: Record<string, { bg: string; fg: string }> = {
  CAPTURED: { bg: "#DCFCE7", fg: "#166534" },
  VOIDED: { bg: "#FEE2E2", fg: "#991B1B" }
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function FieldDocketPage() {
  const { authFetch } = useAuth();
  const [view, setView] = useState<"list" | "new">("list");
  const [rows, setRows] = useState<DocketRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Workers / jobs / assets for form selects
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);

  // Form state
  const [type, setType] = useState<string>("HAULAGE");
  const [workerId, setWorkerId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [assetId, setAssetId] = useState<string>("");
  const [material, setMaterial] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [unit, setUnit] = useState<string>("t");
  const [fromLocation, setFromLocation] = useState<string>("");
  const [toLocation, setToLocation] = useState<string>("");
  const [signedByName, setSignedByName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const loadList = useCallback(async () => {
    setError(null);
    try {
      const res = await authFetch("/field/dockets?limit=50");
      if (!res.ok) throw new Error(await res.text());
      const body = await res.json();
      setRows(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  const loadFormData = useCallback(async () => {
    try {
      const [wRes, jRes, aRes] = await Promise.all([
        authFetch("/workers?limit=200"),
        authFetch("/jobs?limit=200"),
        authFetch("/assets?limit=200")
      ]);
      if (wRes.ok) {
        const wb = await wRes.json();
        setWorkers(wb.items ?? []);
      }
      if (jRes.ok) {
        const jb = await jRes.json();
        setJobs(jb.items ?? []);
      }
      if (aRes.ok) {
        const ab = await aRes.json();
        setAssets(ab.items ?? []);
      }
    } catch {
      // non-fatal — selects will be empty but user can still type IDs
    }
  }, [authFetch]);

  useEffect(() => {
    if (view === "list") void loadList();
    if (view === "new") void loadFormData();
  }, [loadList, loadFormData, view]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!workerId) {
      setError("Driver (worker) is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        type,
        workerId,
        capturedAt: new Date().toISOString()
      };
      if (jobId) payload["jobId"] = jobId;
      if (assetId) payload["assetId"] = assetId;
      if (material) payload["materialWasteType"] = material;
      if (quantity) payload["quantity"] = parseFloat(quantity);
      if (unit) payload["unit"] = unit;
      if (fromLocation) payload["fromLocation"] = fromLocation;
      if (toLocation) payload["toLocation"] = toLocation;
      if (signedByName) payload["signedByName"] = signedByName;

      const res = await authFetch("/field/dockets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      const created = await res.json();
      setSuccess(`Docket ${created.docketNumber as string} captured.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="field-card" style={{ textAlign: "center" }}>
        <h2 style={{ fontFamily: "Syne, Outfit, sans-serif" }}>Docket captured</h2>
        <p style={{ color: "#374151" }}>{success}</p>
        <button
          type="button"
          className="field-btn"
          onClick={() => {
            setSuccess(null);
            setView("list");
          }}
        >
          Back to dockets
        </button>
        <button
          type="button"
          className="field-btn"
          style={{ marginLeft: "0.5rem", background: "#005B61", color: "#fff" }}
          onClick={() => {
            setSuccess(null);
            // Reset form
            setType("HAULAGE");
            setWorkerId("");
            setJobId("");
            setAssetId("");
            setMaterial("");
            setQuantity("");
            setUnit("t");
            setFromLocation("");
            setToLocation("");
            setSignedByName("");
            setView("new");
          }}
        >
          Capture another
        </button>
      </div>
    );
  }

  if (view === "new") {
    return (
      <div className="field-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <button type="button" className="field-btn" onClick={() => setView("list")}>
            Back
          </button>
          <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>New Docket</h2>
        </div>

        {error && (
          <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Type *
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field-input"
            style={{ marginBottom: "1rem", width: "100%" }}
            required
          >
            <option value="DELIVERY">Delivery</option>
            <option value="HAULAGE">Haulage</option>
            <option value="DISPOSAL">Disposal</option>
          </select>

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Driver (Worker) *
          </label>
          {workers.length > 0 ? (
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="field-input"
              style={{ marginBottom: "1rem", width: "100%" }}
              required
            >
              <option value="">Select driver...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.firstName} {w.lastName}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="field-input"
              placeholder="Worker ID"
              style={{ marginBottom: "1rem", width: "100%" }}
              required
            />
          )}

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Job (optional)
          </label>
          {jobs.length > 0 ? (
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="field-input"
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              <option value="">None</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.jobNumber} — {j.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className="field-input"
              placeholder="Job ID (optional)"
              style={{ marginBottom: "1rem", width: "100%" }}
            />
          )}

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Truck / Asset (optional)
          </label>
          {assets.length > 0 ? (
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="field-input"
              style={{ marginBottom: "1rem", width: "100%" }}
            >
              <option value="">None</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.assetCode} — {a.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="field-input"
              placeholder="Asset ID (optional)"
              style={{ marginBottom: "1rem", width: "100%" }}
            />
          )}

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Material / Waste type
          </label>
          <input
            type="text"
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="field-input"
            placeholder="e.g. Rubble, Soil, Mixed demolition"
            style={{ marginBottom: "1rem", width: "100%" }}
          />

          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                Quantity
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="field-input"
                placeholder="0.00"
                min={0}
                step={0.001}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
                Unit
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="field-input"
                style={{ width: "100%" }}
              >
                <option value="t">t</option>
                <option value="m3">m3</option>
                <option value="load">load</option>
              </select>
            </div>
          </div>

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            From location
          </label>
          <input
            type="text"
            value={fromLocation}
            onChange={(e) => setFromLocation(e.target.value)}
            className="field-input"
            placeholder="e.g. 123 Demo St, Brisbane"
            style={{ marginBottom: "1rem", width: "100%" }}
          />

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            To location
          </label>
          <input
            type="text"
            value={toLocation}
            onChange={(e) => setToLocation(e.target.value)}
            className="field-input"
            placeholder="e.g. Hemmant tip"
            style={{ marginBottom: "1rem", width: "100%" }}
          />

          <label style={{ display: "block", marginBottom: "0.25rem", fontWeight: 600 }}>
            Received / signed by
          </label>
          <input
            type="text"
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            className="field-input"
            placeholder="Name of receiving person"
            style={{ marginBottom: "1.5rem", width: "100%" }}
          />

          <button
            type="submit"
            className="field-btn"
            disabled={submitting}
            style={{ background: "#005B61", color: "#fff", width: "100%" }}
          >
            {submitting ? "Capturing..." : "Capture Docket"}
          </button>
        </form>
      </div>
    );
  }

  // List view
  return (
    <div className="field-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0, fontFamily: "Syne, Outfit, sans-serif" }}>Dockets</h2>
        <button
          type="button"
          className="field-btn"
          style={{ background: "#005B61", color: "#fff" }}
          onClick={() => setView("new")}
        >
          + New
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "0.75rem", borderRadius: "0.375rem", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {rows === null && <p style={{ color: "#6B7280" }}>Loading...</p>}

      {rows !== null && rows.length === 0 && (
        <p style={{ color: "#6B7280" }}>No dockets yet. Tap + New to capture one.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {rows.map((row) => {
            const pill = STATUS_PILL[row.status] ?? { bg: "#E2E8F0", fg: "#1F2937" };
            return (
              <li
                key={row.id}
                style={{
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.5rem",
                  padding: "0.75rem",
                  marginBottom: "0.75rem"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <strong style={{ fontFamily: "Syne, Outfit, sans-serif" }}>{row.docketNumber}</strong>
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        background: "#E0F2F1",
                        color: "#005B61",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600
                      }}
                    >
                      {TYPE_LABELS[row.type] ?? row.type}
                    </span>
                  </div>
                  <span
                    style={{
                      background: pill.bg,
                      color: pill.fg,
                      padding: "0.1rem 0.4rem",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      fontWeight: 600
                    }}
                  >
                    {row.status}
                  </span>
                </div>
                <div style={{ fontSize: "0.8rem", color: "#6B7280", marginTop: "0.25rem" }}>
                  {formatDate(row.capturedAt)}
                  {row.job && <span> &middot; Job {row.job.jobNumber}</span>}
                  {row.asset && <span> &middot; {row.asset.assetCode}</span>}
                </div>
                {(row.materialWasteType || row.quantity) && (
                  <div style={{ fontSize: "0.8rem", color: "#374151", marginTop: "0.125rem" }}>
                    {row.materialWasteType}
                    {row.quantity && (
                      <span>
                        {" "}
                        &mdash; {row.quantity} {row.unit ?? ""}
                      </span>
                    )}
                  </div>
                )}
                {(row.fromLocation || row.toLocation) && (
                  <div style={{ fontSize: "0.8rem", color: "#374151", marginTop: "0.125rem" }}>
                    {row.fromLocation} {row.fromLocation && row.toLocation ? "→" : ""} {row.toLocation}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
