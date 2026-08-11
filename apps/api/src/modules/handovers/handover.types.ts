// B-HW-5: Handover instance types.
// These mirror the Prisma schema models added in migration
// 20260812_b_hw_5_handover_instance_schema. The service (B-HW-6) and
// controller will build on these foundations.

// ── Enums ─────────────────────────────────────────────────────────────────────

export type HandoverStatus = 'draft' | 'finalised';

export type HandoverOrigin = 'suggested' | 'manual';

export type HandoverResponsibleParty = 'us' | 'client';

// ── Core models ───────────────────────────────────────────────────────────────

export interface HandoverDto {
  id: string;
  contractId: string;
  tenderId: string;
  /** Pinned template version at creation — never changes after the handover is created. */
  templateVersionId: string;
  status: HandoverStatus;
  /** 0–100 integer, computed from section completion; never hand-edited. */
  completionPct: number;
  createdById: string;
  finalisedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverValueDto {
  id: string;
  handoverId: string;
  /** Stable field key from HandoverTemplateField.key. */
  fieldKey: string;
  /** The current (possibly overridden) value stored as JSON. */
  value: unknown;
  /**
   * The original auto-prefilled value from the tender/quote/contract source.
   * Present when the field has a sourceType of "auto"; null for capture/attach fields.
   */
  sourceValue: unknown | null;
  /** True when the user has edited an auto-field away from its sourceValue. */
  isOverridden: boolean;
  /** True when the entire section this field belongs to has been marked done. */
  sectionDone: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverComplianceItemDto {
  id: string;
  handoverId: string;
  /** Human-readable obligation type (e.g. "SWMS", "Form 65 — Demolition/Asbestos"). */
  type: string;
  /** How the item was added: auto-derived from WBS activity types, or added manually. */
  origin: HandoverOrigin;
  /** Which party is responsible for fulfilling this obligation. */
  responsibleParty: HandoverResponsibleParty;
  /** Free-form status string (e.g. "pending", "submitted", "approved"). */
  status: string;
  /** Optional document reference (e.g. SharePoint path or doc ID). */
  docRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverSubcontractorDto {
  id: string;
  handoverId: string;
  name: string;
  /** Reference to the quote document or quote ID. */
  quoteRef: string | null;
  /** Purchase-order reference once raised. */
  poRef: string | null;
  /** SharePoint folder slot identifier for this subcontractor's documents. */
  folderSlot: string;
  createdAt: string;
  updatedAt: string;
}

export interface HandoverAttachmentDto {
  id: string;
  handoverId: string;
  /**
   * If set, this attachment is bound to a specific template field (by key).
   * Exactly one of fieldKey / category is expected to be non-null; validation
   * is enforced at the API layer, not in the DB.
   */
  fieldKey: string | null;
  /** If set, a free-form category label (e.g. "site-logistics", "programme"). */
  category: string | null;
  /** Document reference — SharePoint path, blob URL, or doc registry ID. */
  docRef: string;
  createdAt: string;
  updatedAt: string;
}

// ── Create / patch DTOs ───────────────────────────────────────────────────────

export interface CreateHandoverDto {
  contractId: string;
  tenderId: string;
  /** If omitted the service resolves the currently active template version. */
  templateVersionId?: string;
}

export interface PatchHandoverValueDto {
  value: unknown;
  /** Supply to mark this field as manually overriding the auto-prefilled source. */
  isOverridden?: boolean;
}

export interface CreateHandoverComplianceItemDto {
  type: string;
  origin: HandoverOrigin;
  responsibleParty: HandoverResponsibleParty;
  status: string;
  docRef?: string;
}

export interface CreateHandoverSubcontractorDto {
  name: string;
  quoteRef?: string;
  poRef?: string;
  folderSlot: string;
}

export interface CreateHandoverAttachmentDto {
  fieldKey?: string;
  category?: string;
  docRef: string;
}
