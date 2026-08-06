export type DirectoryTab = "clients" | "subcontractors" | "contacts";

export const DIRECTORY_TABS: ReadonlyArray<{ id: DirectoryTab; label: string }> = [
  { id: "clients", label: "Clients" },
  { id: "subcontractors", label: "Subcontractors & Suppliers" },
  { id: "contacts", label: "Contacts" }
];

const VALID: ReadonlySet<string> = new Set(DIRECTORY_TABS.map((t) => t.id));

export function resolveDirectoryTab(raw: string | null): DirectoryTab {
  return raw && VALID.has(raw) ? (raw as DirectoryTab) : "clients";
}

export function withDirectoryTab(current: URLSearchParams, next: DirectoryTab): URLSearchParams {
  const params = new URLSearchParams(current);
  params.set("tab", next);
  return params;
}
