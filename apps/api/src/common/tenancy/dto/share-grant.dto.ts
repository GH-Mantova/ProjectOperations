// MT-4 SLICE 1 — typed contract for a share grant.
//
// Used by SLICE 4 (share-management UI + API) to create a new share grant.
// No controller or service consumes this yet; it exists so the call-site can
// import a stable type rather than an inline literal.

export type ShareDomain = "client" | "worker" | "contact";

/**
 * Input shape for creating a share grant.
 * recordId is the id of the Client / Worker / Contact being shared.
 * granteeTenantId is the Tenant receiving access.
 * note is an optional human-readable explanation (audit trail).
 */
export interface CreateShareGrantDto {
  /** Domain the record belongs to. Drives which table the grant is written to. */
  domain: ShareDomain;
  /** Primary-key id of the Client, Worker, or Contact being shared. */
  recordId: string;
  /** id of the Tenant that should receive access to the record. */
  granteeTenantId: string;
  /** Optional audit note — who asked for this grant and why. */
  note?: string;
}

/**
 * Read-back shape of a single share grant (returned from list / create).
 * Mirrors the common fields across ClientShare / WorkerShare / ContactShare.
 */
export interface ShareGrantDto {
  id: string;
  domain: ShareDomain;
  recordId: string;
  granteeTenantId: string;
  grantedByUserId: string;
  grantedAt: Date;
  note?: string | null;
}
