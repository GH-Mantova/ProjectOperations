// NAV-1: placeholder route for /crm/register.
// The real Tenders register view (read-only, all statuses, client + status
// columns) is wired up in NAV-3. This stub keeps the route resolvable so
// the CRM nav group doesn't 404.
export function TendersRegisterPlaceholderPage() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Tenders register</h1>
      <p>Coming soon — this view will be wired up in NAV-3.</p>
    </div>
  );
}
