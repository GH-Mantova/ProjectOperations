/**
 * Pure per-template action gating for the Forms list page.
 *
 * Mirrors the server-side guards in FormsService so the UI can disable
 * ineligible buttons with a matching tooltip. The server remains
 * authoritative — this only shapes affordances.
 */
export type FormsTemplateAuthorityInput = {
  isSystemTemplate?: boolean | null;
  status?: string | null;
};

export type FormsTemplateAuthority = {
  canEdit: boolean;
  canDuplicate: boolean;
  canArchive: boolean;
  canUnarchive: boolean;
  canDelete: boolean;
};

export function formTemplateAuthority(t: FormsTemplateAuthorityInput): FormsTemplateAuthority {
  const isSystem = Boolean(t.isSystemTemplate);
  const isArchived = t.status === "ARCHIVED";
  return {
    canEdit: !isSystem,
    canDuplicate: true,
    canArchive: !isSystem && !isArchived,
    canUnarchive: !isSystem && isArchived,
    canDelete: !isSystem
  };
}
