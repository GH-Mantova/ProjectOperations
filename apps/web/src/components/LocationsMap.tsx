import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

// ── Types ──────────────────────────────────────────────────────────────────

type MapLocationKind = "TIP" | "POI";

export type MappableLocation = {
  id: string;
  name: string;
  kind: MapLocationKind;
  latitude: number | null;
  longitude: number | null;
  ratesStatus?: "set" | "needed";
};

export type LocationsMapProps = {
  locations: MappableLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

// ── Pin colour helpers ─────────────────────────────────────────────────────

function pinColor(loc: MappableLocation): string {
  if (loc.kind === "POI") return "#8B4513";
  if (loc.ratesStatus === "needed") return "#F59E0B";
  return "#005B61";
}

function makeDivIcon(color: string, isSelected: boolean): L.DivIcon {
  const size = isSelected ? 28 : 22;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 24 34">
      <path
        d="M12 0C5.373 0 0 5.373 0 12c0 8.25 12 22 12 22S24 20.25 24 12C24 5.373 18.627 0 12 0z"
        fill="${color}"
        stroke="white"
        stroke-width="${isSelected ? 2.5 : 1.5}"
      />
      <circle cx="12" cy="12" r="5" fill="white" opacity="0.7"/>
    </svg>
  `.trim();
  return L.divIcon({
    html: svg,
    iconSize: [size, Math.round(size * 1.4)],
    iconAnchor: [size / 2, Math.round(size * 1.4)],
    popupAnchor: [0, -Math.round(size * 1.4)],
    className: ""
  });
}

// ── Sub-component: auto-fit bounds + centre on selection ──────────────────

type BoundsControllerProps = {
  pins: Array<[number, number, string]>; // lat, lng, id
  selectedId: string | null;
};

function BoundsController({ pins, selectedId }: BoundsControllerProps) {
  const map = useMap();
  const prevPinCount = useRef(-1);

  // Fit bounds when the pin list changes
  useEffect(() => {
    if (pins.length === 0) return;
    if (pins.length === prevPinCount.current) return;
    prevPinCount.current = pins.length;
    const bounds = L.latLngBounds(pins.map(([lat, lng]) => [lat, lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, [map, pins]);

  // Centre on selected pin
  useEffect(() => {
    if (!selectedId) return;
    const pin = pins.find(([, , id]) => id === selectedId);
    if (!pin) return;
    map.setView([pin[0], pin[1]], Math.max(map.getZoom(), 13));
  }, [map, pins, selectedId]);

  return null;
}

// ── Main component ─────────────────────────────────────────────────────────

// Australia centre as fallback when there are no pins
const AUSTRALIA_CENTER: [number, number] = [-25.2744, 133.7751];
const AUSTRALIA_ZOOM = 4;

export function LocationsMap({ locations, selectedId, onSelect }: LocationsMapProps) {
  const pins = locations.filter(
    (loc): loc is MappableLocation & { latitude: number; longitude: number } =>
      loc.latitude !== null && loc.longitude !== null
  );

  const hasNoPins = pins.length === 0;

  return (
    <div
      style={{
        position: "relative",
        height: 320,
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border, #e5e5e5)",
        marginBottom: 20,
        background: "#f0f4f0"
      }}
    >
      <MapContainer
        center={AUSTRALIA_CENTER}
        zoom={AUSTRALIA_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {!hasNoPins && (
          <BoundsController
            pins={pins.map((loc) => [loc.latitude, loc.longitude, loc.id])}
            selectedId={selectedId}
          />
        )}

        {pins.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={makeDivIcon(pinColor(loc), selectedId === loc.id)}
            eventHandlers={{
              click: () => onSelect(loc.id)
            }}
          >
            <Popup>
              <strong>{loc.name}</strong>
              <br />
              {loc.kind === "TIP" ? "Tip" : "Point of interest"}
              {loc.kind === "TIP" && loc.ratesStatus === "needed" && (
                <>
                  <br />
                  <span style={{ color: "#b45309" }}>Rates needed</span>
                </>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {hasNoPins && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255,255,255,0.75)",
            color: "var(--text-muted)",
            fontSize: 13,
            pointerEvents: "none",
            zIndex: 500
          }}
        >
          No mappable locations yet — add coordinates to see pins here.
        </div>
      )}
    </div>
  );
}
