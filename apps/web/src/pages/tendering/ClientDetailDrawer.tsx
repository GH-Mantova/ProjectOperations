import { CenteredModal } from "@project-ops/ui";
import { ClientStarRating } from "../../components/ClientStarRating";

export type ActivityClient = {
  tenderClientId: string;
  clientId: string;
  name: string;
  preferenceScore: number | null;
  relationshipType: string | null;
  isAwarded: boolean;
  contractIssued: boolean;
  winCount: number;
  tenderCount: number;
  winRate: string | null;
  contact: { id: string; firstName: string; lastName: string; email?: string | null } | null;
};

export function isPrimaryClient(client: Pick<ActivityClient, "relationshipType">): boolean {
  return (client.relationshipType ?? "").toLowerCase() === "primary";
}

export function PrimaryTag() {
  return (
    <span
      style={{
        background: "#DBEAFE",
        color: "#1E40AF",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em"
      }}
    >
      Primary
    </span>
  );
}

// No slide-over/drawer primitive exists in the codebase yet, so the Client
// Detail view uses CenteredModal as agreed fallback. TODO: replace with a
// proper Drawer component when one ships.
export function ClientDetailDrawer({
  client,
  canManage,
  canRemove,
  onClose,
  onScoreChange,
  onLogInteraction,
  onRemove
}: {
  client: ActivityClient;
  canManage: boolean;
  canRemove: boolean;
  onClose: () => void;
  onScoreChange: (score: number) => void;
  onLogInteraction: () => void;
  onRemove: () => void;
}) {
  const winRate = client.winRate !== null && client.winRate !== undefined ? Number(client.winRate) : null;
  return (
    <CenteredModal
      title={client.name}
      onClose={onClose}
      maxWidth={460}
      dataTestId="client-detail-drawer"
      footer={
        <>
          {canManage && (
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              disabled={!canRemove}
              title={canRemove ? undefined : "A tender must have at least one client"}
              onClick={onRemove}
              style={{ marginRight: "auto", color: "var(--status-danger)" }}
            >
              Remove from tender
            </button>
          )}
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {isPrimaryClient(client) ? <PrimaryTag /> : null}
          {client.relationshipType && !isPrimaryClient(client) ? (
            <span className="tender-detail__client-tag">{client.relationshipType}</span>
          ) : null}
          {client.isAwarded ? <span className="s7-badge s7-badge--active">Awarded</span> : null}
          {client.contractIssued ? <span className="s7-badge s7-badge--info">Contract</span> : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Preference:</span>
          <ClientStarRating
            score={client.preferenceScore}
            readOnly={!canManage}
            onChange={canManage ? onScoreChange : undefined}
            ariaLabel={`${client.name} preference score`}
          />
        </div>

        <div>
          <p className="s7-type-label" style={{ margin: "0 0 4px" }}>Tender history</p>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            {client.tenderCount > 0 && winRate !== null
              ? `${winRate.toFixed(0)}% win rate (${client.winCount} won of ${client.tenderCount} quoted)`
              : "No tender history yet"}
          </p>
        </div>

        <div>
          <p className="s7-type-label" style={{ margin: "0 0 4px" }}>Contact</p>
          {client.contact ? (
            <div style={{ fontSize: 13 }}>
              <strong>{client.contact.firstName} {client.contact.lastName}</strong>
              {client.contact.email ? (
                <div>
                  <a href={`mailto:${client.contact.email}`}>{client.contact.email}</a>
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>No contact on file</p>
          )}
        </div>

        {canManage ? (
          <div>
            <button type="button" className="s7-btn s7-btn--secondary s7-btn--sm" onClick={onLogInteraction}>
              + Log interaction
            </button>
          </div>
        ) : null}
      </div>
    </CenteredModal>
  );
}
