import { AdminClientVersionsTab } from "../admin/AdminClientVersionsTab";

// SLICE 14 (settings-restructure): extracted from the Client versions inline
// tab on AdminSettingsPage into a standalone Administration page.
export function AdminClientVersionsPage() {
  return <AdminClientVersionsTab />;
}
