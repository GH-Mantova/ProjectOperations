/**
 * TipFinderPanel — Finder panel rendered inside the Settings > Map Locations tab.
 *
 * Three inputs:
 *   1. Waste type  — distinct values from /estimate-rates/waste (via RateResolverService)
 *   2. Load size   — options from /assets filtered to those with nominalLoadTonnes
 *   3. Coming from — active Project site OR office fallback
 *
 * On submit: calls POST /waste/recommendations → renders ranked cards.
 * "Use this facility" calls POST /waste/recommendations/accept → writes log row.
 *
 * v1 costing (server-side):
 *   disposalFee = loadTonnes × resolvedRate
 *   travelCost  = haversineKm × 2 × OperationsSettings.travelRatePerKm
 *   totalCost   = disposalFee + travelCost
 *
 * TIPs with no rate row render greyed as "not accepted / rates needed".
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type WasteRate = {
  id: string;
  wasteType: string;
  facility: string;
  isActive: boolean;
};

type AssetItem = {
  id: string;
  name: string;
  assetCode: string;
  nominalLoadTonnes: number | null;
  category?: { defaultNominalLoadTonnes: number | null } | null;
};

type ProjectItem = {
  id: string;
  projectNumber: string;
  name: string;
  status: string;
};

type TipCard = {
  mapLocationId: string;
  facilityName: string;
  addressLine1: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  disposalFee: number | null;
  travelCost: number | null;
  totalCost: number | null;
  ratePerTonne: number | null;
  travelRatePerKm: number | null;
  accepted: boolean;
};

type OriginType = "office" | "project";

// ── Format helpers ─────────────────────────────────────────────────────────────

function fmt(val: number | null, decimals = 2): string {
  if (val === null) return "—";
  return val.toLocaleString("en-AU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function fmtCurrency(val: number | null): string {
  if (val === null) return "—";
  return `$${fmt(val, 2)}`;
}

// ── Tip Card ──────────────────────────────────────────────────────────────────

function TipCardView({
  card,
  onAccept,
  accepting
}: {
  card: TipCard;
  onAccept: (mapLocationId: string) => void;
  accepting: boolean;
}) {
  const canAccept = card.accepted && card.totalCost !== null;

  return (
    <div
      style={{
        border: `1px solid ${canAccept ? "var(--border, #e5e5e5)" : "var(--border, #e5e5e5)"}`,
        borderRadius: 8,
        padding: 16,
        opacity: canAccept ? 1 : 0.55,
        background: "var(--surface, #fff)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
            {card.facilityName}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>
            {card.addressLine1}, {card.suburb} {card.state} {card.postcode}
            {card.latitude !== 0 && (
              <span style={{ marginLeft: 8 }}>
                &bull; {fmt(card.distanceKm, 1)} km away
              </span>
            )}
          </div>

          {canAccept ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                fontSize: 13
              }}
            >
              <div
                style={{
                  background: "var(--surface-muted, #F6F6F6)",
                  borderRadius: 6,
                  padding: "8px 10px"
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  Disposal fee
                </div>
                <div style={{ fontWeight: 600 }}>{fmtCurrency(card.disposalFee)}</div>
                {card.ratePerTonne !== null && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @ ${fmt(card.ratePerTonne)}/t
                  </div>
                )}
              </div>
              <div
                style={{
                  background: "var(--surface-muted, #F6F6F6)",
                  borderRadius: 6,
                  padding: "8px 10px"
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  Travel (return)
                </div>
                <div style={{ fontWeight: 600 }}>{fmtCurrency(card.travelCost)}</div>
                {card.travelRatePerKm !== null && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    @ ${fmt(card.travelRatePerKm)}/km &times; {fmt(card.distanceKm * 2, 1)} km
                  </div>
                )}
              </div>
              <div
                style={{
                  background: "rgba(0,91,97,0.07)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  border: "1px solid rgba(0,91,97,0.18)"
                }}
              >
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                  Total
                </div>
                <div style={{ fontWeight: 700, color: "#005B61" }}>{fmtCurrency(card.totalCost)}</div>
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: "#b45309",
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.2)",
                borderRadius: 6,
                padding: "6px 10px",
                display: "inline-block"
              }}
            >
              {card.travelRatePerKm === null
                ? "Travel rate not configured — set in Operations Settings."
                : card.latitude === 0
                ? "No coordinates — add a location to this TIP in Map Locations."
                : "No disposal rate for this waste type — add rates in Rates & Lists."}
            </div>
          )}
        </div>

        {canAccept && (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}
            onClick={() => onAccept(card.mapLocationId)}
            disabled={accepting}
          >
            {accepting ? "Saving…" : "Use this facility"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function TipFinderPanel() {
  const { authFetch } = useAuth();

  // Options
  const [wasteTypes, setWasteTypes] = useState<string[]>([]);
  const [loadOptions, setLoadOptions] = useState<{ label: string; tonnes: number }[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  // Inputs
  const [wasteType, setWasteType] = useState("");
  const [loadTonnes, setLoadTonnes] = useState<number | "">("");
  const [originType, setOriginType] = useState<OriginType>("office");
  const [projectId, setProjectId] = useState("");

  // Results
  const [cards, setCards] = useState<TipCard[] | null>(null);
  const [computing, setComputing] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedMsg, setAcceptedMsg] = useState<string | null>(null);

  // Load options on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Waste types — distinct values from waste rate library
        const ratesRes = await authFetch("/estimate-rates/waste");
        if (ratesRes.ok) {
          const rates = (await ratesRes.json()) as WasteRate[];
          const distinct = Array.from(
            new Set(rates.filter((r) => r.isActive).map((r) => r.wasteType))
          ).sort();
          setWasteTypes(distinct);
        }
      } catch {
        // non-fatal
      }

      try {
        // Load sizes — from assets with nominalLoadTonnes set
        const assetsRes = await authFetch("/assets?limit=500");
        if (assetsRes.ok) {
          const assets = (await assetsRes.json()) as AssetItem[] | { data: AssetItem[] };
          const list = Array.isArray(assets) ? assets : (assets as { data: AssetItem[] }).data ?? [];
          const opts: { label: string; tonnes: number }[] = [];
          const seen = new Set<number>();
          for (const a of list) {
            const t = a.nominalLoadTonnes ?? a.category?.defaultNominalLoadTonnes ?? null;
            if (t !== null && t > 0 && !seen.has(t)) {
              seen.add(t);
              opts.push({ label: `${t} t`, tonnes: t });
            }
          }
          opts.sort((x, y) => x.tonnes - y.tonnes);
          setLoadOptions(opts);
        }
      } catch {
        // non-fatal
      }

      try {
        // Active projects for "coming from" picker
        const projRes = await authFetch("/projects?status=ACTIVE&status=MOBILISING&limit=500");
        if (projRes.ok) {
          const result = (await projRes.json()) as ProjectItem[] | { data: ProjectItem[] };
          const list = Array.isArray(result) ? result : (result as { data: ProjectItem[] }).data ?? [];
          setProjects(list);
        }
      } catch {
        // non-fatal
      }
    };
    void loadData();
  }, [authFetch]);

  const handleCompute = useCallback(async () => {
    if (!wasteType) { setComputeError("Select a waste type."); return; }
    if (!loadTonnes || Number(loadTonnes) <= 0) { setComputeError("Enter a load size."); return; }
    if (originType === "project" && !projectId) { setComputeError("Select a project."); return; }

    setComputing(true);
    setComputeError(null);
    setCards(null);
    setAcceptedMsg(null);

    try {
      const body: Record<string, unknown> = {
        wasteTypeCode: wasteType,
        loadTonnes: Number(loadTonnes),
        originType
      };
      if (originType === "project") body.projectId = projectId;

      const res = await authFetch("/waste/recommendations", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      setCards((await res.json()) as TipCard[]);
    } catch (err) {
      setComputeError((err as Error).message);
    } finally {
      setComputing(false);
    }
  }, [authFetch, wasteType, loadTonnes, originType, projectId]);

  const handleAccept = useCallback(async (mapLocationId: string) => {
    if (!wasteType || !loadTonnes) return;
    setAcceptingId(mapLocationId);
    setAcceptedMsg(null);
    try {
      const body: Record<string, unknown> = {
        mapLocationId,
        wasteTypeCode: wasteType,
        loadTonnes: Number(loadTonnes),
        originType
      };
      if (originType === "project") body.projectId = projectId;

      const res = await authFetch("/waste/recommendations/accept", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      const found = cards?.find((c) => c.mapLocationId === mapLocationId);
      setAcceptedMsg(`Logged: ${found?.facilityName ?? "tip"} — decision saved.`);
    } catch (err) {
      setComputeError((err as Error).message);
    } finally {
      setAcceptingId(null);
    }
  }, [authFetch, wasteType, loadTonnes, originType, projectId, cards]);

  return (
    <div
      style={{
        border: "1px solid var(--border, #e5e5e5)",
        borderRadius: 8,
        padding: 20,
        marginTop: 24,
        background: "var(--surface, #fff)"
      }}
    >
      <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>Tip Finder</h3>
      <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-muted)" }}>
        Find the best tip for a waste type, load size and departure point.
        Costs are calculated server-side: disposal rate from the rate library plus return travel at
        the configured rate per kilometre.
      </p>

      {/* Three-input form */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        {/* Waste type */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Waste type</span>
          <select
            className="s7-input"
            value={wasteType}
            onChange={(e) => setWasteType(e.target.value)}
          >
            <option value="">Select waste type…</option>
            {wasteTypes.map((wt) => (
              <option key={wt} value={wt}>{wt}</option>
            ))}
          </select>
        </label>

        {/* Load size */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Load size (tonnes)</span>
          {loadOptions.length > 0 ? (
            <select
              className="s7-input"
              value={loadTonnes === "" ? "" : String(loadTonnes)}
              onChange={(e) => setLoadTonnes(e.target.value === "" ? "" : Number(e.target.value))}
            >
              <option value="">Select load size…</option>
              {loadOptions.map((opt) => (
                <option key={opt.tonnes} value={opt.tonnes}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="s7-input"
              type="number"
              min="0.001"
              step="0.5"
              placeholder="e.g. 12.5"
              value={loadTonnes === "" ? "" : loadTonnes}
              onChange={(e) => setLoadTonnes(e.target.value === "" ? "" : Number(e.target.value))}
            />
          )}
        </label>

        {/* Origin */}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Coming from</span>
          <select
            className="s7-input"
            value={originType === "office" ? "office" : projectId}
            onChange={(e) => {
              if (e.target.value === "office") {
                setOriginType("office");
                setProjectId("");
              } else {
                setOriginType("project");
                setProjectId(e.target.value);
              }
            }}
          >
            <option value="office">Office</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.projectNumber} — {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {computeError && (
        <p style={{ color: "var(--status-danger)", fontSize: 13, margin: "0 0 12px" }}>
          {computeError}
        </p>
      )}

      <button
        type="button"
        className="s7-btn s7-btn--primary"
        onClick={() => void handleCompute()}
        disabled={computing}
        style={{ marginBottom: cards ? 20 : 0 }}
      >
        {computing ? "Computing…" : "Find tips"}
      </button>

      {/* Results */}
      {acceptedMsg && (
        <p style={{ color: "#16a34a", fontSize: 13, margin: "12px 0 0" }}>{acceptedMsg}</p>
      )}

      {cards !== null && (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {cards.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No active TIP locations found. Add tip sites in the Map Locations table above.
            </p>
          ) : (
            cards.map((card) => (
              <TipCardView
                key={card.mapLocationId}
                card={card}
                onAccept={handleAccept}
                accepting={acceptingId === card.mapLocationId}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
