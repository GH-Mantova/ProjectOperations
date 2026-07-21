import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { AddressAutocomplete, type AddressSuggestion } from "../../components/AddressAutocomplete";

// ── Types ─────────────────────────────────────────────────────────────────

type MapLocationKind = "TIP" | "POI";

type MapLocation = {
  id: string;
  name: string;
  kind: MapLocationKind;
  categoryId: string | null;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  facility: string | null;
  notes: string | null;
  isActive: boolean;
  ratesStatus?: "set" | "needed";
};

type AddressFields = {
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  // Raw autocomplete value for controlled input
  autocompleteValue: string;
};

type AddPanel = "tip-from-rates" | "new-tip" | "new-poi" | null;

// ── Address sub-form ──────────────────────────────────────────────────────

function AddressForm({
  fields,
  onChange
}: {
  fields: AddressFields;
  onChange: (f: AddressFields) => void;
}) {
  const handleSelect = (s: AddressSuggestion) => {
    onChange({
      autocompleteValue: s.formatted,
      addressLine1: s.addressLine1 ?? "",
      suburb: s.suburb ?? "",
      state: s.state ?? "",
      postcode: s.postcode ?? "",
      latitude: s.lat ?? null,
      longitude: s.lon ?? null
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Address search</span>
        <AddressAutocomplete
          value={fields.autocompleteValue}
          onValueChange={(v) => onChange({ ...fields, autocompleteValue: v })}
          onSelect={handleSelect}
          placeholder="Start typing an address…"
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Address line 1</span>
        <input
          className="s7-input"
          value={fields.addressLine1}
          onChange={(e) => onChange({ ...fields, addressLine1: e.target.value })}
          placeholder="Street address"
          required
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Suburb</span>
          <input
            className="s7-input"
            value={fields.suburb}
            onChange={(e) => onChange({ ...fields, suburb: e.target.value })}
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>State</span>
          <input
            className="s7-input"
            value={fields.state}
            onChange={(e) => onChange({ ...fields, state: e.target.value })}
            required
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Postcode</span>
          <input
            className="s7-input"
            value={fields.postcode}
            onChange={(e) => onChange({ ...fields, postcode: e.target.value })}
            required
          />
        </label>
      </div>
      {fields.latitude !== null && fields.longitude !== null && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Coordinates captured: {fields.latitude.toFixed(6)}, {fields.longitude.toFixed(6)}
        </p>
      )}
    </div>
  );
}

// ── Blank address helper ─────────────────────────────────────────────────

function blankAddress(): AddressFields {
  return {
    addressLine1: "",
    suburb: "",
    state: "",
    postcode: "",
    latitude: null,
    longitude: null,
    autocompleteValue: ""
  };
}

// ── Main tab ──────────────────────────────────────────────────────────────

export function MapLocationsTab() {
  const { authFetch } = useAuth();
  const [filter, setFilter] = useState<"all" | "TIP" | "POI">("all");
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addPanel, setAddPanel] = useState<AddPanel>(null);
  const [orphanFacilities, setOrphanFacilities] = useState<string[]>([]);
  const [poiCategories, setPoiCategories] = useState<{ value: string; label: string }[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // Form state — tip from rates
  const [selectedFacility, setSelectedFacility] = useState("");
  const [tipFromRatesAddress, setTipFromRatesAddress] = useState<AddressFields>(blankAddress());

  // Form state — new tip
  const [newTipName, setNewTipName] = useState("");
  const [newTipAddress, setNewTipAddress] = useState<AddressFields>(blankAddress());
  const [newTipNotes, setNewTipNotes] = useState("");

  // Form state — new POI
  const [newPoiName, setNewPoiName] = useState("");
  const [newPoiCategory, setNewPoiCategory] = useState("");
  const [newPoiAddress, setNewPoiAddress] = useState<AddressFields>(blankAddress());
  const [newPoiNotes, setNewPoiNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filter === "all" ? "/map-locations" : `/map-locations?kind=${filter}`;
      const res = await authFetch(url);
      if (!res.ok) throw new Error(await res.text());
      setLocations((await res.json()) as MapLocation[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, filter]);

  const loadOrphans = useCallback(async () => {
    try {
      const res = await authFetch("/map-locations/orphan-facilities");
      if (res.ok) setOrphanFacilities((await res.json()) as string[]);
    } catch {
      // non-fatal
    }
  }, [authFetch]);

  const loadPoiCategories = useCallback(async () => {
    try {
      const res = await authFetch("/lists/poi-categories/items");
      if (res.ok) {
        const items = (await res.json()) as { value: string; label: string; isArchived?: boolean }[];
        setPoiCategories(items.filter((i) => !i.isArchived));
      }
    } catch {
      // non-fatal
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadOrphans();
    void loadPoiCategories();
  }, [loadOrphans, loadPoiCategories]);

  const flash = (msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg((m) => (m === msg ? null : m)), 2000);
  };

  const handleDelete = async (loc: MapLocation) => {
    if (!window.confirm(`Deactivate "${loc.name}"?`)) return;
    try {
      const res = await authFetch(`/map-locations/${loc.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      flash("Location deactivated.");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resetAddPanel = () => {
    setAddPanel(null);
    setSaveError(null);
    setSelectedFacility("");
    setTipFromRatesAddress(blankAddress());
    setNewTipName("");
    setNewTipAddress(blankAddress());
    setNewTipNotes("");
    setNewPoiName("");
    setNewPoiCategory("");
    setNewPoiAddress(blankAddress());
    setNewPoiNotes("");
  };

  const submitTipFromRates = async () => {
    if (!selectedFacility) {
      setSaveError("Select a facility.");
      return;
    }
    if (!tipFromRatesAddress.addressLine1 || !tipFromRatesAddress.suburb) {
      setSaveError("Address line 1 and suburb are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/map-locations", {
        method: "POST",
        body: JSON.stringify({
          name: selectedFacility,
          kind: "TIP",
          facility: selectedFacility,
          addressLine1: tipFromRatesAddress.addressLine1,
          suburb: tipFromRatesAddress.suburb,
          state: tipFromRatesAddress.state,
          postcode: tipFromRatesAddress.postcode,
          latitude: tipFromRatesAddress.latitude,
          longitude: tipFromRatesAddress.longitude
        })
      });
      if (!res.ok) throw new Error(await res.text());
      flash(`Tip "${selectedFacility}" created.`);
      resetAddPanel();
      await load();
      await loadOrphans();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitNewTip = async () => {
    if (!newTipName.trim()) {
      setSaveError("Name is required.");
      return;
    }
    if (!newTipAddress.addressLine1 || !newTipAddress.suburb) {
      setSaveError("Address line 1 and suburb are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/map-locations", {
        method: "POST",
        body: JSON.stringify({
          name: newTipName.trim(),
          kind: "TIP",
          facility: newTipName.trim(),
          addressLine1: newTipAddress.addressLine1,
          suburb: newTipAddress.suburb,
          state: newTipAddress.state,
          postcode: newTipAddress.postcode,
          latitude: newTipAddress.latitude,
          longitude: newTipAddress.longitude,
          notes: newTipNotes.trim() || null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      flash(`Tip "${newTipName.trim()}" created.`);
      resetAddPanel();
      await load();
      await loadOrphans();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const submitNewPoi = async () => {
    if (!newPoiName.trim()) {
      setSaveError("Name is required.");
      return;
    }
    if (!newPoiAddress.addressLine1 || !newPoiAddress.suburb) {
      setSaveError("Address line 1 and suburb are required.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await authFetch("/map-locations", {
        method: "POST",
        body: JSON.stringify({
          name: newPoiName.trim(),
          kind: "POI",
          categoryId: newPoiCategory || null,
          addressLine1: newPoiAddress.addressLine1,
          suburb: newPoiAddress.suburb,
          state: newPoiAddress.state,
          postcode: newPoiAddress.postcode,
          latitude: newPoiAddress.latitude,
          longitude: newPoiAddress.longitude,
          notes: newPoiNotes.trim() || null
        })
      });
      if (!res.ok) throw new Error(await res.text());
      flash(`Point of interest "${newPoiName.trim()}" created.`);
      resetAddPanel();
      await load();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Map locations</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Tip sites and points of interest for operations. Tip locations are linked to waste rate
        entries by facility name. Points of interest are categorised by the POI categories list.
      </p>

      {/* Filter chips */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "TIP", "POI"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${filter === f ? "#005B61" : "var(--border, #e5e5e5)"}`,
              background: filter === f ? "#005B61" : "transparent",
              color: filter === f ? "#fff" : "var(--text)",
              fontWeight: filter === f ? 600 : 400,
              cursor: "pointer",
              fontSize: 13
            }}
          >
            {f === "all" ? "All" : f === "TIP" ? "Tips" : "Points of interest"}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => setAddPanel(addPanel === "tip-from-rates" ? null : "tip-from-rates")}
            style={{ fontSize: 13 }}
          >
            + Tip from waste rates
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => setAddPanel(addPanel === "new-tip" ? null : "new-tip")}
            style={{ fontSize: 13 }}
          >
            + New tip
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setAddPanel(addPanel === "new-poi" ? null : "new-poi")}
            style={{ fontSize: 13 }}
          >
            + Point of interest
          </button>
        </div>
      </div>

      {/* Add panels */}
      {addPanel !== null && (
        <div
          style={{
            background: "var(--surface-muted, #F6F6F6)",
            border: "1px solid var(--border, #e5e5e5)",
            borderRadius: 8,
            padding: 16,
            marginBottom: 20
          }}
        >
          {addPanel === "tip-from-rates" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Tip from waste rates</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
                Pick a facility already used in waste rates. A Tip location will be created with that
                facility name, and the address you supply below.
              </p>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Facility</span>
                <select
                  className="s7-input"
                  value={selectedFacility}
                  onChange={(e) => setSelectedFacility(e.target.value)}
                >
                  <option value="">Select a facility…</option>
                  {orphanFacilities.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
                {orphanFacilities.length === 0 && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    All waste-rate facilities already have a map location.
                  </span>
                )}
              </label>
              <AddressForm fields={tipFromRatesAddress} onChange={setTipFromRatesAddress} />
              {saveError && (
                <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{saveError}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => void submitTipFromRates()}
                  disabled={saving}
                >
                  {saving ? "Creating…" : "Create tip"}
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost"
                  onClick={resetAddPanel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {addPanel === "new-tip" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>New tip</h3>
              <div
                style={{
                  padding: 10,
                  borderRadius: 6,
                  background: "rgba(254,170,109,0.12)",
                  border: "1px solid #FEAA6D",
                  fontSize: 13
                }}
              >
                This tip will show as "rates needed" until you add waste rates for this facility in
                Rates &amp; Lists.
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</span>
                <input
                  className="s7-input"
                  value={newTipName}
                  onChange={(e) => setNewTipName(e.target.value)}
                  placeholder="Tip / facility name"
                  required
                />
              </label>
              <AddressForm fields={newTipAddress} onChange={setNewTipAddress} />
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Notes (optional)</span>
                <textarea
                  className="s7-input"
                  value={newTipNotes}
                  onChange={(e) => setNewTipNotes(e.target.value)}
                  rows={2}
                />
              </label>
              {saveError && (
                <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{saveError}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => void submitNewTip()}
                  disabled={saving}
                >
                  {saving ? "Creating…" : "Create tip"}
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost"
                  onClick={resetAddPanel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {addPanel === "new-poi" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>New point of interest</h3>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</span>
                <input
                  className="s7-input"
                  value={newPoiName}
                  onChange={(e) => setNewPoiName(e.target.value)}
                  placeholder="Location name"
                  required
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Category</span>
                <select
                  className="s7-input"
                  value={newPoiCategory}
                  onChange={(e) => setNewPoiCategory(e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {poiCategories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </label>
              <AddressForm fields={newPoiAddress} onChange={setNewPoiAddress} />
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Notes (optional)</span>
                <textarea
                  className="s7-input"
                  value={newPoiNotes}
                  onChange={(e) => setNewPoiNotes(e.target.value)}
                  rows={2}
                />
              </label>
              {saveError && (
                <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{saveError}</p>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => void submitNewPoi()}
                  disabled={saving}
                >
                  {saving ? "Creating…" : "Create POI"}
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost"
                  onClick={resetAddPanel}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {flashMsg && (
        <p style={{ color: "#16a34a", fontSize: 13, margin: "0 0 12px" }}>{flashMsg}</p>
      )}
      {error && (
        <p style={{ color: "var(--status-danger)", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : locations.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No locations found.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border, #e5e5e5)", textAlign: "left" }}>
              <th style={{ padding: "8px 6px" }}>Name</th>
              <th style={{ padding: "8px 6px" }}>Type</th>
              <th style={{ padding: "8px 6px" }}>Address</th>
              <th style={{ padding: "8px 6px" }}>Rates</th>
              <th style={{ padding: "8px 6px" }} />
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                <td style={{ padding: "8px 6px", fontWeight: 500 }}>{loc.name}</td>
                <td style={{ padding: "8px 6px" }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: loc.kind === "TIP" ? "rgba(0,91,97,0.1)" : "rgba(254,170,109,0.2)",
                      color: loc.kind === "TIP" ? "#005B61" : "#8B4513"
                    }}
                  >
                    {loc.kind === "TIP" ? "Tip" : "POI"}
                  </span>
                </td>
                <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>
                  {loc.addressLine1}, {loc.suburb} {loc.state} {loc.postcode}
                </td>
                <td style={{ padding: "8px 6px" }}>
                  {loc.kind === "TIP" ? (
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          loc.ratesStatus === "set"
                            ? "rgba(22,163,74,0.1)"
                            : "rgba(245,158,11,0.1)",
                        color:
                          loc.ratesStatus === "set" ? "#16a34a" : "#b45309"
                      }}
                    >
                      {loc.ratesStatus === "set" ? "Set" : "Needed"}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: "8px 6px", textAlign: "right" }}>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost"
                    onClick={() => void handleDelete(loc)}
                    style={{ fontSize: 12, color: "var(--status-danger)" }}
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
